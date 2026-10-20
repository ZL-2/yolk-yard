import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {PartyService} from '../server/realtime/parties.js';
import {presenceLabel,presenceMarkup} from '../src/presence-ui.js';
import {modePopulation,modePopulationMarkup} from '../src/mode-activity.js';
import {lobbyMarkup,modeMarkup} from '../src/lobby-ui.js';
import {strideProfile,strideFoot,pelvisTurn} from '../src/operator-motion.js';
import {makeHumanoid,animateHumanoid} from '../src/humanoid.js';
import {itemDrawProfile,equipPose,drawTransform} from '../src/equip.js';
import {VERSION} from '../src/data.js';

test('presence names the current mode and every discovery artwork has an honest population',()=>{
 assert.equal(presenceLabel('in-match','royale'),'Playing Battle Royale');assert.equal(presenceLabel('in-match','ffa'),'Playing Free For All');assert.equal(presenceLabel('in-match','training'),'Playing Training');
 assert.equal(presenceLabel('in-match','<script>'),'Playing');assert.match(presenceMarkup('in-match','','royale'),/Playing Battle Royale/);
 assert.equal(modePopulation('ffa',{ffa:NaN}),null);assert.equal(modePopulation('ffa',{ffa:-1}),null);assert.equal(modePopulation('box-fights',null),0);
 assert.match(modePopulationMarkup('royale',{royale:16}),/16 players playing/);assert.match(modePopulationMarkup('training',null),/unavailable/);
 const mode=modeMarkup({mode:'ffa'},false,1,{ffa:6,royale:12,training:1});assert.equal((mode.match(/data-mode-population=/g)||[]).length,6);assert.match(mode,/6 players playing/);assert.match(mode,/0 players playing/);
 for(const access of ['public','private']){const html=lobbyMarkup({profile:{name:'Operator'},party:{leader:'a',state:'idle',selection:{mode:'royale',teamSize:2,access},members:[{id:'a',profile:{name:'Operator'},presence:'in-match',playingMode:'royale'}]},id:'a',online:true,balance:0});assert.match(html,new RegExp('Build, Duos, '+(access==='public'?'Public':'Private')));assert.match(html,/Playing Battle Royale/);}
});

test('mode counts deduplicate tabs, combine rooms, exclude bots/spectators/disconnects and clear returns',async()=>{
 const peers=new Map(),service=new PartyService({peers},{store:{flush:async()=>{}}}),messages=[];
 const add=(id,mode,room=id)=>{const ws={readyState:1,bufferedAmount:0,send:s=>messages.push(JSON.parse(s)),close(){}},u={id,profile:{name:id},sessions:new Map([[ws,{visible:true,activity:'in-match',mode}]]),ws,inMatch:mode!=='training',matchPeer:id,matchCode:room,matchSession:ws};service.users.set(id,u);service.create(u);if(u.inMatch){const host={id:`yolk-yard-v${VERSION}-${room}`,ws,listing:{mode,phase:'playing',public:room!=='private'},links:new Map()};peers.set(host.id,host);peers.set(id,{id,ws,links:new Map([[host.id,host]])});}return u;};
 try{
  const a=add('alpha','royale','public'),b=add('bravo','royale','private'),c=add('charlie','ffa'),d=add('delta','training');
  a.sessions.set({readyState:1,bufferedAmount:0,send(){},close(){}},{visible:true,activity:'in-match',mode:'royale'});
  assert.deepEqual(service.modeCounts(),{royale:1,ffa:1,training:1,zonewars:0,boxfight:0,zombies:0});
  service.publishModeCounts();const first=messages.filter(m=>m.type==='mode-counts').length;service.publishModeCounts();assert.equal(messages.filter(m=>m.type==='mode-counts').length,first,'unchanged counts do not fan out again');
  b.spectateLaunch={};c.sessions.get(c.ws).activity='spectating';d.ws.readyState=3;
  assert.deepEqual(service.modeCounts(),{royale:1,ffa:0,training:0,zonewars:0,boxfight:0,zombies:0});
  peers.delete(a.matchPeer);assert.equal(service.modeCounts().royale,0,'stale in-match reports cannot resurrect disconnected admitted players');
  service.command(b,{type:'returned'},b.ws);assert.equal(b.sessions.get(b.ws).activity,'lobby');assert.equal(service.modeCounts().royale,0);
 }finally{await service.close();}
});

test('stride contact speed equals movement speed, soles lift, and side-step pelvis turns the correct way',()=>{
 for(const speed of [1.12,3,5,9]){const p=strideProfile(speed),phase=.2*p.stance*Math.PI*2,dt=.00001,a=strideFoot(phase,1,p),b=strideFoot(phase+speed*dt/p.distance*Math.PI*2,1,p);assert.ok(a.contact&&b.contact);assert.ok(Math.abs((b.stride-a.stride)/dt+speed)<1e-6);for(let n=0;n<100;n++){const foot=strideFoot(n/100*Math.PI*2,1,p);assert.ok(Number.isFinite(foot.stride)&&foot.lift>=0);assert.ok(Math.abs(foot.stride)<.53);}}
 assert.ok(pelvisTurn(0,4)<0);assert.ok(pelvisTurn(0,-4)>0);assert.ok(Math.abs(pelvisTurn(4,0))<1e-12);
});

test('moving rigs plant in world space without accumulated spine twist at 30, 60 or 120 Hz',()=>{
 for(const fps of [30,60,120]){const model=makeHumanoid(),h=model.userData.human,dt=1/fps;let samples=0;
  for(let frame=0;frame<fps*5;frame++){model.position.x=frame*dt*2;const before=h.plantL&&{...h.plantL};animateHumanoid(model,{health:100,grounded:true,vx:2,vz:0,yaw:0},dt,frame*dt);model.updateMatrixWorld(true);assert.ok(Math.abs(h.bones.spine.rotation.y)<.7);assert.ok(h.bones.hips.rotation.y<=.001);if(frame>fps&&before&&h.plantL){assert.ok(Math.hypot(h.plantL.x-before.x,h.plantL.z-before.z)<1e-6);samples++;}for(const bone of Object.values(h.bones))assert.ok(bone.matrixWorld.elements.every(Number.isFinite));}
  assert.ok(samples>fps/2);assert.ok(h.bones.hips.position.y>.77);
 }
 const model=makeHumanoid();for(let f=0;f<120;f++)animateHumanoid(model,{health:100,grounded:true,vz:-1.12},1/60,f/60);const hips=model.userData.human.bones.hips;assert.ok(hips.position.y>.72,'motion-captured walking keeps the pelvis above a collapsed crouch');
});

test('rifles and long tools draw from the back; sidearms and utilities draw from the hip, with exact settle',()=>{
 for(const item of [{id:'sprinter',weapon:true},{id:'needle',weapon:true},{id:'pickaxe',pickaxe:true},{id:'pip',weapon:true},{id:'zipper',weapon:true},{id:'mini'},{id:'popper'},{id:'anchorWinch'}]){
  const p={health:100,slot:0,inventory:[item],equipStarted:10,equipUntil:11},start=equipPose(p,10),expected=['sprinter','needle','pickaxe'].includes(item.id)?'back':'hip';assert.equal(start.route,expected);assert.ok(expected==='back'?start.position[1]>0:start.position[1]<0);
  for(let n=0;n<=100;n++){const t=drawTransform(itemDrawProfile(item),n/100);assert.ok([...t.position,...t.rotation].every(Number.isFinite));}
  assert.ok([...equipPose(p,12).position,...equipPose(p,12).rotation].every(n=>Math.abs(n)<1e-9));
 }
});
