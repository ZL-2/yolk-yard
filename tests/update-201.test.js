import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {spawnHelicopter,HELICOPTER,helicopterCameraDistance} from '../src/helicopter.js';
import {vehicleInteract,seatPlayer} from '../src/vehicles.js';
import {normalizeBindings,helicopterActions} from '../src/keybinds.js';
import {thirdPersonActive,cameraPose} from '../src/perspective.js';
import {predictionCopy,predictMovement} from '../src/guest-movement.js';
import {STORMSPIKE,lodgeStormspike,tickStormspikes,stormspikePose} from '../src/stormspike.js';
import {updateHelicopterAudio} from '../src/helicopter-audio.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
const flat={id:'flat',theme:'royale',size:1000,boxes:[],terrain:null,helipad:{x:0,y:0,z:0,yaw:0}};
function battle(){
 const s=new RoyaleSimulation({capacity:4,bots:0,fill:false,seed:201}),p=s.addPlayer('human',{name:'Pilot'}),target=s.addPlayer('target',{name:'Target'});s.startRound();s.beginBattle();s.stage='active';s.time=10;s.map={...flat,boxes:[]};s.worldBoxes=[];s.worldDamage={};s.builds=[];s.vehicles=[];s.chests=[];s.players=new Map([[p.id,p],[target.id,target]]);
 for(const q of [p,target])Object.assign(q,{health:100,shield:100,flight:'ground',grounded:true,vy:0,x:0,y:0,z:q===p?0:-5,yaw:0,pitch:0,spectating:false,contestant:true,connected:true,loading:false,shieldUntil:0,lastInput:s.time,deaths:0});
 s.stormSteps=s.stormSteps.map(v=>({...v,start:1e9,closeAt:1e9,end:2e9}));return {s,p,target};
}
function shoot(s,p,extra={}){s.projectiles=[{id:100,owner:p.id,shotId:5,weapon:'stormspike',kind:'bolt',x:0,y:1,z:-1,vx:0,vy:0,vz:-155,gravity:.45,hitRadius:.025,damage:58,buildDamage:40,range:300,born:s.time,fuse:2,travelled:0,...extra}];s.updateProjectiles(.05);}
function board(s,p){const v=spawnHelicopter(s.map);s.vehicles=[v];Object.assign(p,{x:3,y:0,z:0});vehicleInteract(s,p,{interact:true});s.time+=1;return v;}
test('helicopter controls override shared build keys; passengers keep right-click aiming',()=>{
 const b=normalizeBindings({buildEdit:['KeyE',null],buildRoof:['KeyB',null]});const pilot={vehicleId:'h',vehicleType:'helicopter',vehicleSeat:0},passenger={...pilot,vehicleSeat:1};
 assert.deepEqual(helicopterActions(pilot,b,'KeyF'),['interact']);assert.deepEqual(helicopterActions(pilot,b,'KeyB'),['heliHorn']);assert.deepEqual(helicopterActions(pilot,b,'Mouse2'),['heliDown']);assert.deepEqual(helicopterActions(passenger,b,'Mouse2'),[]);assert.ok(b.aim.includes('Mouse2'));
});
test('hold exit cancels on release, remains held when blocked, and clears the seat once space opens',()=>{
 const {s,p}=battle(),v=board(s,p);vehicleInteract(s,p,{heliExit:true});s.time+=.2;vehicleInteract(s,p,{});assert.equal(p.vehicleExitSince,null);assert.equal(p.vehicleId,v.id);
 s.map.boxes=[{x:0,y:0,z:0,w:30,h:10,d:30}];vehicleInteract(s,p,{heliExit:true});const start=p.vehicleExitSince;s.time+=HELICOPTER.exitHold+.01;vehicleInteract(s,p,{heliExit:true});assert.equal(p.vehicleId,v.id);assert.equal(p.vehicleExitSince,start);
 s.map.boxes=[];vehicleInteract(s,p,{heliExit:true});assert.equal(p.vehicleId,null);assert.equal(v.seats[0],null);assert.equal(p.vehicleExitSince,null);assert.equal(p.fall.immune,false);
});
test('short remote loudspeaker taps survive a press and release in one authority tick',()=>{
 const {s,p}=battle(),v=board(s,p);let seq=0;
 for(const expected of [true,false]){s.setInput(p.id,{seq:++seq,heliHorn:true},true);s.setInput(p.id,{seq:++seq,heliHorn:false},true);const commands=s.movementInput(p,1/30);vehicleInteract(s,p,commands.input);assert.equal(v.loudspeaker,expected);vehicleInteract(s,p,commands.input);assert.equal(v.loudspeaker,expected,'replayed edge must not toggle twice');}
 assert.equal(s.events.filter(e=>e.cue?.startsWith('helicopter-speaker-')).length,2);
});
test('passenger perspective and scoped aim agree between authority and prediction',()=>{
 const {s,p}=battle(),v=board(s,p);v.seats[0]=null;v.seats[1]=p.id;p.vehicleSeat=1;seatPlayer(p,v);p.slot=1;p.inventory[1]={id:'needle',weapon:true,rarity:2,ammo:1};p.equipUntil=0;p.reloadEnd=0;
 s.setInput(p.id,{seq:1,perspective:'third',viewBlend:.6,viewBoom:1,slot:1,yaw:.3,pitch:.1});s.tick(1/60);assert.equal(p.perspective,'third');assert.equal(thirdPersonActive(p),true);assert.ok(cameraPose(s.map,p).length>0);
 const predicted=predictionCopy(p),input={perspective:'third',aim:true,viewBlend:1,viewBoom:1,slot:1,yaw:.4,pitch:0};predictMovement(predicted,input,s.map,1/60,{vehicles:[v]},s.time);s.setInput(p.id,{seq:2,...input});s.tick(1/60);
 assert.equal(p.aim,true);assert.equal(predicted.aim,true);assert.equal(thirdPersonActive(p),false);assert.deepEqual(cameraPose(s.map,p).origin,cameraPose(s.map,predicted).origin);
});
test('passenger third-person cameras stay outside the cabin at every craft heading',()=>{
 const v=spawnHelicopter(flat);
 for(const angle of [0,.7,Math.PI/2,Math.PI])for(const seat of [1,2,3,4]){
  const p={id:'p',health:100,perspective:'third',vehicleId:v.id,vehicleType:'helicopter',vehicleSeat:seat,yaw:angle+(seat%2?Math.PI/2:-Math.PI/2),pitch:0};v.yaw=angle;seatPlayer(p,v);const pose=cameraPose(flat,p),o=pose.origin;
  const c=Math.cos(angle),sn=Math.sin(angle),x=(o.x-v.x)*c-(o.z-v.z)*sn;
  assert.ok(Math.abs(x)>1.45,'camera must remain outside the cabin wall');assert.ok(pose.fraction<.5,'inward boom is shortened by the cabin');
 }
 assert.equal(helicopterCameraDistance({}, {x:0,y:0,z:0},{x:1,y:0,z:0},3),3,'non-vehicle cameras retain their distance');
});
test('airborne passengers gain scoped accuracy, finish reloading and can fire again',()=>{
 const {s,p,target}=battle(),v=board(s,p);target.x=100;v.seats[0]=null;v.seats[1]=p.id;v.y=30;v.rotor=1;v.grounded=false;p.vehicleSeat=1;seatPlayer(p,v);p.slot=1;p.inventory[1]={id:'needle',weapon:true,rarity:2,ammo:1};p.bank.heavy=5;p.equipUntil=0;p.reloadEnd=0;s.syncInventory(p);let seq=0;
 const step=(extra={})=>{s.setInput(p.id,{seq:++seq,slot:1,aim:true,yaw:0,pitch:0,...extra});s.tick(1/60);};
 for(let i=0;i<80;i++)step();assert.ok(p.accuracyState[1].adsBlend>.995);assert.equal(p.accuracyState[1].spread,0);assert.equal(p.grounded,false);
 step({fire:true});assert.equal(p.ammo[1],0);step({reload:true});assert.ok(p.reloadEnd>s.time);for(let i=0;i<200;i++)step();assert.equal(p.reloadEnd,0);assert.equal(p.ammo[1],1);assert.equal(p.bank.heavy,4);step({fire:true});assert.equal(p.ammo[1],0);
});
test('a player hit sticks, follows movement and rotation, survives recovery, and bursts once',()=>{
 const {s,p,target}=battle();shoot(s,p);assert.equal(target.shield,42);assert.equal(s.stormSpikes.length,1);assert.equal(s.stormSpikes[0].playerId,target.id);
 const initial=structuredClone(s.stormSpikes[0]);target.x=7;target.z=-12;target.yaw=Math.PI/2;s.time+=.5;tickStormspikes(s);const pose=stormspikePose(initial,target);assert.equal(s.stormSpikes[0].x,pose.x);assert.equal(s.stormSpikes[0].z,pose.z);assert.equal(target.shield,42);
 const packet={state:s.snapshot(),checkpoint:{simulation:s.checkpoint()}},decoded=new SnapshotDecoder().decode(JSON.parse(JSON.stringify(new SnapshotEncoder().encode(packet).frame)));assert.equal(decoded.state.royale.stormSpikes[0].playerId,target.id);
 const copy=new RoyaleSimulation().restore(decoded.checkpoint.simulation),restored=copy.players.get(target.id);copy.time+=.7;tickStormspikes(copy);assert.equal(restored.shield,2);assert.equal(restored.health,100);assert.equal(copy.stormSpikes.length,0);tickStormspikes(copy);assert.equal(restored.shield,2);
});
test('world walls, trees and props take impact and delayed damage from actual projectiles',()=>{
 for(const kind of ['wall','tree','prop']){const {s,p,target}=battle();target.x=20;const box={objectId:kind,kind,x:0,y:0,z:-5,w:4,h:4,d:.4,health:500,material:'wood'};s.map.boxes=[box];s.worldBoxes=[box];shoot(s,p);assert.equal(s.stormSpikes[0].objectId,kind);assert.equal(s.worldDamage[kind].health,460);s.time+=1.2;tickStormspikes(s);assert.equal(s.worldDamage[kind].health,310);assert.equal(s.stormSpikes.length,0);}
});
test('spikes attach to vehicles, supply canopies and terrain, and retain their fuse after targets disappear',()=>{
 const {s,p,target}=battle();target.x=20;const v=spawnHelicopter(s.map);v.z=-6;s.vehicles=[v];shoot(s,p);assert.equal(s.stormSpikes[0].vehicleId,v.id);assert.equal(v.health,1460);v.x=10;v.y=3;v.yaw=.8;s.time+=.5;tickStormspikes(s);assert.ok(s.stormSpikes[0].x>5);s.time+=.7;tickStormspikes(s);assert.equal(v.health,1310);
 s.vehicles=[];const c={id:'supply',supply:true,x:0,y:0,z:-5,landAt:s.time+5,canopyHealth:100};s.chests=[c];shoot(s,p,{y:25});assert.equal(s.stormSpikes[0].supplyId,c.id);assert.equal(c.canopyHealth,60);s.time+=1.2;tickStormspikes(s);assert.equal(c.canopyHealth,0);
 s.chests=[];shoot(s,p,{x:10,y:.2,z:0,vx:0,vy:-40,vz:0});assert.equal(s.stormSpikes.length,1);const before=s.events.filter(e=>e.kind==='stormspike-burst').length;s.time+=1.2;tickStormspikes(s);assert.equal(s.stormSpikes.length,0);assert.equal(s.events.filter(e=>e.kind==='stormspike-burst').length,before+1);
 const spike=lodgeStormspike(s,{owner:p.id,x:target.x,y:1,z:target.z,damage:58},null,{x:0,y:0,z:1},{player:target});target.deaths++;target.shield=100;s.time=spike.until+.01;tickStormspikes(s);assert.equal(target.shield,100,'new life never inherits old damage');
});
test('loudspeaker is audible while parked, spatial, effect-volume controlled and stops when off',()=>{
 const calls=[],sound={clock:2,loop:(id,target,options)=>calls.push({id,target,...options})},v={...spawnHelicopter(flat),loudspeaker:true};
 updateHelicopterAudio(sound,{vehicles:[v]},{x:0,y:1,z:0,vehicleId:v.id});let speaker=calls.find(c=>c.id==='helicopter-speaker');assert.ok(speaker.target>0);assert.equal(speaker.category,'effects');assert.equal(calls.find(c=>c.id==='helicopter-blades').target,0);
 calls.length=0;v.rotor=1;updateHelicopterAudio(sound,{vehicles:[v]},{x:-40,y:0,z:0,yaw:0});speaker=calls.find(c=>c.id==='helicopter-speaker');assert.ok(speaker.target>0&&speaker.target<1);assert.equal(speaker.pan,1);v.loudspeaker=false;calls.length=0;updateHelicopterAudio(sound,{vehicles:[v]},{x:0,y:0,z:0});assert.equal(calls.find(c=>c.id==='helicopter-speaker').target,0);
});
