import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {makeHumanoid,animateHumanoid} from '../src/humanoid.js';
import {MOTION_NAMES,motionSelection,motionInfo} from '../src/character-motion.js';
import {updateCelebration} from '../src/celebration-view.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {groundAt} from '../src/terrain.js';

test('downloaded motion covers every gameplay branch and all eight movement directions',()=>{
 for(const gait of ['walk','run','sprint','crouch'])for(const direction of ['forward','forward-right','right','backward-right','backward','backward-left','left','forward-left'])assert.ok(motionInfo(gait+'-'+direction));
 for(const id of ['idle','aim','jump','fall','land','death','crawl','revive','slide','mantle','hang','sit','salute','shuffle','cheer','crown','reload','throw','drink','heal','build','draw','draw-hip','holster','holster-hip','melee'])assert.ok(MOTION_NAMES.includes(id),id);
 assert.equal(motionSelection({health:0,emote:{id:'shuffle'}},0,0).id,'death');
 assert.equal(motionSelection({downed:true,reviving:'a'},0,0).id,'crawl');
 assert.equal(motionSelection({mantle:{elapsed:.2,duration:.4}},0,0).progress,.5);
});

test('mocap stays finite, preserves anatomy and never mutates gameplay or root movement',()=>{
 const states=[{}, {vx:3}, {vz:-5}, {vz:8}, {vz:-9,sprinting:true}, {crouching:true}, {crouching:true,vx:2}, {sliding:true,slideAge:.5}, {grounded:false,vy:4}, {grounded:false,vy:-4}, {flight:'dive'}, {flight:'glide'}, {downed:true}, {downed:true,vz:-1}, {reviving:'teammate'}, {vehicleId:'atv',vehicleSeat:0}, {traversal:{type:'zipline'}}, {mantle:{elapsed:.2,duration:.4}}, {use:{id:'mini',start:0,end:3}}, {building:true,editing:true}, {reloadEnd:3,reloadDuration:3}, {throwProgress:.4}, {swingAt:1.8}, {equipStarted:0,equipUntil:3,equipHolster:.2}, ...['salute','shuffle','cheer','crown'].map(id=>({emote:{id,start:0}})),{health:0}];
 for(const extra of states){
  const p={health:100,grounded:true,weapon:'sprinter',...extra},before=structuredClone(p),m=makeHumanoid();m.position.set(20,4,-8);
  for(let f=0;f<120;f++){
   animateHumanoid(m,p,1/60,f/60);m.updateMatrixWorld(true);
   for(const bone of Object.values(m.userData.human.bones)){assert.ok(bone.matrixWorld.elements.every(Number.isFinite));assert.ok(Math.abs(bone.quaternion.length()-1)<1e-5);if(bone.name!=='hips')assert.ok(bone.position.distanceTo(bone.userData.rest)<1e-8);}
  }
  assert.ok(m.userData.human.mocap,JSON.stringify(extra));assert.deepEqual(p,before);assert.deepEqual(m.position.toArray(),[20,4,-8]);
 }
});

test('directional animation clocks are frame independent and landings transition back to movement',()=>{
 const phases=[];
 for(const fps of [30,60,120]){const m=makeHumanoid();for(let i=0;i<fps*3;i++)animateHumanoid(m,{health:100,grounded:true,vx:2,weapon:'sprinter'},1/fps,i/fps);phases.push(m.userData.human.mocap.phase);}
 assert.ok(Math.max(...phases)-Math.min(...phases)<1e-5);
 const m=makeHumanoid();animateHumanoid(m,{grounded:false,vy:-3},.016,0);animateHumanoid(m,{grounded:true},.016,.016);assert.equal(m.userData.human.mocap.id,'land');
 for(let i=0;i<30;i++)animateHumanoid(m,{grounded:true},1/60,i/60);assert.equal(m.userData.human.mocap.id,'locomotion');
});

test('locomotion soles keep floor contact and upper action layers preserve the moving gait',()=>{
 const m=makeHumanoid();for(let f=0;f<180;f++){
  animateHumanoid(m,{health:100,grounded:true,weapon:'sprinter',vz:-3,reloadEnd:3,reloadDuration:3},1/60,f/60);m.updateMatrixWorld(true);
  if(f>20){const b=m.userData.human.bones,y=Math.min(b.footL.getWorldPosition(new Vector3()).y,b.footR.getWorldPosition(new Vector3()).y);assert.ok(y>=.04&&y<.17,'feet stay on the floor: '+y);}
 }
 assert.equal(m.userData.human.mocap.id,'locomotion');assert.equal(m.userData.human.mocap.action,'reload');assert.ok(m.userData.human.mocap.phase>0);
});

test('walking retains upright proportions and support soles instead of a permanent rifle crouch',()=>{
 const m=makeHumanoid(),b=m.userData.human.bones;
 for(let f=0;f<240;f++){
  m.position.z=-f*1.12/60;animateHumanoid(m,{health:100,grounded:true,weapon:'sprinter',vz:-1.12},1/60,f/60);m.updateMatrixWorld(true);
  if(f<20)continue;
  assert.ok(b.head.getWorldPosition(new Vector3()).y>1.50,'head collapsed into rifle level');
  for(const name of ['footL','footR']){const foot=b[name],position=foot.getWorldPosition(new Vector3());if(position.y<.12){const up=new Vector3(0,1,0).applyQuaternion(foot.getWorldQuaternion(m.quaternion.clone()));assert.ok(up.y>.99,'support sole is tilted');}}
 }
});

test('pickaxe, empty and consumable slots do not select the rifle idle',()=>{
 for(const item of [null,{id:'pickaxe',pickaxe:true},{id:'mini'},{id:'sprinter',weapon:true}]){
  const m=makeHumanoid();for(let f=0;f<30;f++)animateHumanoid(m,{health:100,grounded:true,weapon:'sprinter',inventory:[item],slot:0},1/60,f/60);
  assert.equal(m.userData.human.mocap.unarmed,!item?.weapon);
 }
});

test('victory crown follows the animated head through crouching and airborne poses',()=>{
 const m=makeHumanoid();for(const pose of [{},{crouching:true},{flight:'glide'}]){
  const p={health:100,crown:true,grounded:true,...pose};updateCelebration(m,p,1,()=>{});for(let f=0;f<30;f++)animateHumanoid(m,p,1/60,f/60);
  assert.equal(m.userData.victoryCrown.parent,m.userData.human.bones.head);assert.ok(m.userData.victoryCrown.position.y<.37);
 }
});

test('tiny direction changes while holding a tool cannot swap unrelated leg cycles',()=>{
 const models=[makeHumanoid(),makeHumanoid()];
 for(let f=0;f<240;f++){
  for(let i=0;i<2;i++)animateHumanoid(models[i],{health:100,grounded:true,weapon:'sprinter',inventory:[{id:'pickaxe',pickaxe:true}],slot:0,vz:-2,vx:i?.00001:-.00001},1/60,f/60);
  if(f>20)for(const n of ['footL','footR','head'])assert.ok(models[0].userData.human.bones[n].getWorldPosition(new Vector3()).distanceTo(models[1].userData.human.bones[n].getWorldPosition(new Vector3()))<.005,n+' directional discontinuity');
 }
});

test('vault slabs have terrain clearance instead of overlapping road-painted earth',()=>{
 for(const v of ROYALE_MAP.vaults){const w=v.width||22,d=v.depth||18;for(let x=-w/2+2;x<=w/2-2;x+=1)for(let z=-d/2+2;z<=d/2-2;z+=1)assert.ok(v.y-groundAt(ROYALE_MAP,v.x+x,v.z+z)>.14,v.id+' coplanar floor');}
});

test('stride releases and walk/run transitions remain continuous over successive frames',()=>{
 const m=makeHumanoid();let previous;
 for(let f=0;f<480;f++){
  const speed=f<120?2:f<240?5:f<360?2:0;m.position.z-=speed/60;
  animateHumanoid(m,{health:100,grounded:true,weapon:'sprinter',inventory:[{id:'pickaxe',pickaxe:true}],slot:0,vz:-speed,vx:f<300?.001:-.001},1/60,f/60);m.updateMatrixWorld(true);
  const points=['hips','head','footL','footR'].map(n=>m.userData.human.bones[n].getWorldPosition(new Vector3()));
  if(previous&&f>30)for(let i=0;i<points.length;i++)assert.ok(points[i].distanceTo(previous[i])<.23,'joint teleported at frame '+f);
  previous=points;
 }
});
