import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {inventory} from '../src/building.js';
import {ITEMS} from '../src/royale-data.js';
import {movePlayer,canStand} from '../src/physics.js';
import {predictMovement} from '../src/guest-movement.js';
import {resetStance} from '../src/stance.js';
import {launchPlayer,fallDamage} from '../src/airborne.js';
import {startGrapple} from '../src/grappler.js';
import {useSeasonItem,seasonInteract} from '../src/season-world.js';
import {frontierInteract} from '../src/frontier-world.js';
import {vaultOpen} from '../src/vaults.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {TACTICAL_SPRINT} from '../src/world-rules.js';
import {newActivity} from '../src/activity.js';

const flat={id:'flat',theme:'royale',size:1000,boxes:[],floorLoot:[],landmarks:[],districts:[]};
function runner(){const p={id:'runner',x:0,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,pitch:0,health:100,grounded:true,flight:'ground',slot:1,weapon:'sprinter',inventory:inventory()};resetStance(p);p.inventory[1]={id:'sprinter',weapon:true,rarity:0,ammo:30};return p;}
function step(p,input={},map=flat,dt=1/60,predict=false){const{x,z}=p;if(predict)predictMovement(p,input,map,dt,{stage:'active'},100);else movePlayer(p,input,map,dt);p.vx=(p.x-x)/dt;p.vz=(p.z-z)/dt;}
function room(){
 const s=new RoyaleSimulation({capacity:2,bots:0,fill:false,seed:142,building:false}),p=s.addPlayer('host',{name:'Host'}),other=s.addPlayer('guest',{name:'Guest'});
 Object.assign(s,{phase:'playing',stage:'active',time:100,startedAt:0,alive:2,map:{...flat,boxes:[{x:0,y:0,z:-18,w:8,h:60,d:1}]},worldBoxes:[],relays:[],bossCaches:[],chests:[],loot:[],supplyAt:99999});
 s.stormSteps=[{index:0,fromX:500,fromZ:500,fromRadius:5,x:500,z:500,radius:5,start:0,closeAt:10000,end:11000,dps:1}];
 for(const q of [p,other])Object.assign(q,runner(),{id:q===p?'host':'guest',health:50,shield:0,shieldUntil:0,lastDamage:-100,contestant:true,spectating:false,equipUntil:0,activity:newActivity(s.time),inventory:inventory(),bank:{medium:120,shells:30,heavy:20,light:40,rockets:6}});
 other.x=100;return {s,p,other};
}
function tickInput(s,p,input,remote=false){s.setInput(p.id,{seq:(s.inputs.get(p.id)?.seq||0)+1,dt:1/60,slot:p.slot,yaw:0,...input},remote);s.tick(1/60);}

test('every usable inventory item completes through real storm ticks for host and remote inputs',()=>{
 for(const remote of [false,true])for(const [id,def]of Object.entries(ITEMS).filter(([,d])=>!['keycard','crown'].includes(d.kind))){
  const{s,p}=room();p.inventory[1]={id,count:2,rarity:5};p.slot=1;s.syncInventory(p);
  for(let i=0;i<Math.ceil((def.duration+.15)*60);i++)tickInput(s,p,{fire:true},remote);
  assert.ok(s.events.some(e=>e.type==='royale-cue'&&e.player===p.id&&e.cue==='complete-'+id),id+' completes, remote='+remote);
  assert.ok(s.events.some(e=>e.type==='hit'&&e.target===p.id&&e.weapon==='Storm'),id+' does not block storm damage');
  assert.equal(s.events.some(e=>e.cue==='use-cancel'&&e.player===p.id),false,id+' was not interrupted by storm');
 }
});

test('holding sprint does not repeatedly cancel movement-item activation in the storm',()=>{
 for(const id of ['anchorWinch','jumpRig','shadowstep','impulse','launchpad']){
  const{s,p}=room();p.inventory[1]={id,count:2};p.slot=1;
  for(let i=0;i<Math.ceil((ITEMS[id].duration+.2)*60);i++)tickInput(s,p,{forward:1,sprint:true,fire:true});
  assert.ok(s.events.some(e=>e.cue==='complete-'+id),id+' activates while sprint is held');
 }
});

test('storm preserves item/chest progress while weapon damage, death and deliberate sprint still cancel healing',()=>{
 const{s,p,other}=room();p.inventory[1]={id:'medkit',count:1};p.slot=1;s.beginUse(p);p.chestProgress=.5;
 s.damage(p,null,1,'Storm');assert.ok(p.use);assert.equal(p.chestProgress,.5);assert.equal(p.health,49);
 s.damage(p,other,1,'Sprinter');assert.equal(p.use,null);assert.equal(p.chestProgress,0);
 s.beginUse(p);tickInput(s,p,{forward:1,sprint:true});assert.equal(p.use,null);
 s.beginUse(p);s.damage(p,null,1000,'Storm');assert.equal(p.health,0);assert.equal(p.use,null);assert.equal(p.spectating,true);
});

test('guns and chest searches still work while receiving storm damage',()=>{
 const{s,p}=room();p.inventory[1]={id:'sprinter',weapon:true,rarity:1,ammo:30};s.syncInventory(p);
 for(let i=0;i<30;i++)tickInput(s,p,{fire:true});assert.ok(p.shotSerial>0);assert.ok(p.inventory[1].ammo<30);
 s.chests=[{id:'storm-chest',x:1,y:0,z:0,opened:false,contents:[{id:'mini',count:2}]}];
 for(let i=0;i<90;i++)tickInput(s,p,{interact:true});assert.equal(s.chests[0].opened,true);
});

test('storm permits keycard channels, without erasing a recent weapon interruption or recovery state',()=>{
 const s=new RoyaleSimulation({capacity:2,bots:0,fill:false,seed:142}),p=s.addPlayer('host',{name:'Host'});s.addPlayer('other',{name:'Other'});s.startRound();s.beginBattle();s.stage='active';s.time=100;
 const v=s.map.vaults[0];Object.assign(p,v.reader,{health:100,shieldUntil:0,lastDamage:-100,flight:'ground',grounded:true,slot:1});p.inventory[1]={id:v.key,count:1};
 s.damage(p,null,1,'Sprinter');s.damage(p,null,.01,'Storm');frontierInteract(s,p,{interact:true},.1);assert.equal(p.vaultProgress,0,'storm does not erase the last direct hit');
 for(let i=0;i<150;i++){s.time+=1/60;s.damage(p,null,.01,'Storm');frontierInteract(s,p,{interact:true},1/60);}
 assert.equal(vaultOpen(s,v.id),true);assert.equal(p.inventory[1],null);
 const restored=new RoyaleSimulation().restore(s.checkpoint());assert.equal(restored.players.get(p.id).lastInterruptDamage,p.lastInterruptDamage);
 s.bossCaches=[{id:'cache',name:'Test Cache',key:'nyxKeycard',x:p.x,y:p.y,z:p.z,opened:false}];p.inventory[1]={id:'nyxKeycard',count:1};
 for(let i=0;i<100;i++){s.time+=1/60;s.damage(p,null,.01,'Storm');seasonInteract(s,p,{interact:true},1/60);}
 assert.equal(s.bossCaches[0].opened,true);
});

test('sprint jumping preserves speed and stamina rules for both authority and guest prediction',()=>{
 for(const predict of [false,true])for(const dt of [1/60,1/30]){
  const p=runner();for(let i=0;i<30;i++)step(p,{forward:1,sprint:true},flat,dt,predict);
  const stamina=p.stamina;step(p,{forward:1,sprint:true,jump:true},flat,dt,predict);assert.equal(p.grounded,false);
  for(let i=0;i<12;i++){step(p,{forward:1,sprint:true},flat,dt,predict);assert.equal(p.sprinting,true);assert.equal(p.tacticalSprint,true);assert.ok(Math.abs(Math.hypot(p.vx,p.vz)-TACTICAL_SPRINT.speed)<.01);}
  assert.ok(p.stamina<stamina);assert.equal(p.sprintRecovery,0);
  step(p,{forward:1},flat,dt,predict);assert.equal(p.sprinting,false);
  step(p,{forward:1,sprint:true},flat,dt,predict);assert.equal(p.sprinting,false,'cannot initiate sprint midair');
 }
});

test('firing, aiming and exhaustion still end an airborne sprint',()=>{
 for(const action of ['fire','aim','exhaust']){
  const p=runner();for(let i=0;i<30;i++)step(p,{forward:1,sprint:true});step(p,{forward:1,sprint:true,jump:true});
  if(action==='exhaust')p.stamina=.01;
  for(let i=0;i<2;i++)step(p,{forward:1,sprint:true,...(action==='exhaust'?{}:{[action]:true})});
  assert.equal(p.sprinting,false,action);assert.equal(p.tacticalSprint,false,action);
 }
});

test('flat-ground slides depend on actual speed, preserve direction, and slow to a crouch',()=>{
 const p=runner();p.vx=7;p.crouchLatch=true;step(p,{crouch:true});assert.equal(p.sliding,true);assert.ok(p.slideVX>7);assert.equal(p.slideVZ,0);
 for(let i=0;i<150;i++)step(p,{crouch:true});assert.equal(p.sliding,false);assert.equal(p.crouching,true);
 const slow=runner();slow.vx=4;step(slow,{crouch:true});assert.equal(slow.sliding,false);
});

test('holding crouch queues a fast sprint-jump or launch landing into a slide',()=>{
 const p=runner();for(let i=0;i<30;i++)step(p,{forward:1,sprint:true});step(p,{forward:1,sprint:true,jump:true});
 let ticks=0;while(!p.grounded&&ticks++<120)step(p,{forward:1,sprint:true,crouch:true});assert.ok(ticks<120);assert.ok(Math.hypot(p.vx,p.vz)>8);
 step(p,{forward:1,sprint:true,crouch:true});assert.equal(p.sliding,true);assert.equal(p.tacticalSprint,false);
 const q=runner();Object.assign(q,{y:.12,vy:-2,grounded:false,crouchLatch:true,launchVelocity:{x:9,z:0}});
 for(let i=0;i<12&&!q.sliding;i++)step(q,{crouch:true});assert.equal(q.sliding,true);assert.ok(q.slideVX>7);
});

test('grappler gives swept upward hops at latch and release, including low-ceiling collision',()=>{
 const p=runner();startGrapple(p,{origin:{x:0,y:1.7,z:0},anchor:{x:0,y:1.7,z:-18},length:18,valid:true},100);
 while(p.grapple.phase==='hook')step(p);assert.ok(p.y>0);assert.ok(p.vy>0);
 let ticks=0;while(p.grapple.phase==='pull'&&ticks++<180)step(p);assert.equal(p.grapple.phase,'return');assert.ok(p.vy>3);
 const y=p.y;for(let i=0;i<5;i++)step(p);assert.ok(p.y>y);assert.equal(p.fall.immune,true);
 const q=runner(),ceiling={...flat,boxes:[{x:0,y:1.95,z:-10,w:20,h:1,d:100}]};startGrapple(q,{origin:{x:0,y:1.7,z:0},anchor:{x:0,y:1.7,z:-18},length:18,valid:true},100);
 for(let i=0;i<150;i++){step(q,{},ceiling);assert.ok(q.y+1.85<=1.951);assert.ok(canStand(ceiling,q));}
});

test('all mobility sources protect their resulting landing but not a later ordinary fall',()=>{
 for(const source of ['jumpRig','shadowstep','anchorWinch','shockwave','impulse','launchpad']){
  const p=runner(),map={...flat,boxes:[{x:0,y:0,z:-15,w:8,h:60,d:1}]};Object.assign(p,{y:40,grounded:false,fall:{apex:40,immune:false,source:'normal'}});
  if(['jumpRig','shadowstep','anchorWinch'].includes(source))assert.equal(useSeasonItem({time:100,map,emit(){}},p,{id:source,count:1}),true);
  else launchPlayer(p,{source,vy:source==='launchpad'?38:19,vx:4});
  let ticks=0;while(!p.grounded&&ticks++<1500)step(p,{},map);assert.ok(ticks<1500,source);assert.equal(fallDamage(p.landing),0,source);assert.equal(p.fall,null,source);
  Object.assign(p,{x:100,y:30,z:0,grounded:false,vy:0});ticks=0;while(!p.grounded&&ticks++<300)step(p,{},map);assert.ok(fallDamage(p.landing)>=100,source+' does not grant permanent immunity');
 }
 const miss=runner();Object.assign(miss,{y:40,grounded:false});startGrapple(miss,{origin:{x:0,y:41.7,z:0},anchor:{x:0,y:41.7,z:-75},length:75,valid:false},100);while(!miss.grounded)step(miss);assert.ok(fallDamage(miss.landing)>=100,'a missed hook does not grant protection');
});

test('grapple hop, fall protection and sprint state survive wire snapshots and host recovery',()=>{
 const{s,p}=room();startGrapple(p,{origin:{x:0,y:1.7,z:0},anchor:{x:0,y:1.7,z:-18},length:18,valid:true},s.time);while(p.grapple.phase==='hook')step(p,{},s.map);
 const state=new SnapshotDecoder().decode(JSON.parse(JSON.stringify(new SnapshotEncoder().encode({state:s.snapshot()}).frame))).state,q=state.players.find(q=>q.id===p.id);
 assert.equal(q.grapple.pullAt,p.grapple.pullAt);assert.equal(q.fall.immune,true);const restored=new RoyaleSimulation().restore(s.checkpoint()).players.get(p.id);assert.deepEqual(restored.grapple,p.grapple);
 step(p,{},s.map);step(q,{},s.map);step(restored,{},s.map);for(const k of ['x','y','z','vy']){assert.equal(q[k],p[k],k);assert.equal(restored[k],p[k],k);}
 p.grapple=null;p.fall=null;Object.assign(p,{y:0,grounded:true,vy:0});for(let i=0;i<30;i++)step(p,{forward:1,sprint:true});step(p,{forward:1,sprint:true,jump:true});
 const guest=new SnapshotDecoder().decode(JSON.parse(JSON.stringify(new SnapshotEncoder().encode({state:s.snapshot()}).frame))).state.players.find(q=>q.id===p.id);
 step(p,{forward:1,sprint:true},s.map);step(guest,{forward:1,sprint:true},s.map,1/60,true);assert.equal(guest.sprinting,true);assert.equal(guest.z,p.z);
});
