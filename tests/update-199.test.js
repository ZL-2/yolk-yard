import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {weapon,gun} from '../src/data.js';
import {rollItem} from '../src/royale-loot.js';
import {BOSSES,MYTHIC_WEAPONS} from '../src/bosses.js';
import {HELICOPTER,HELIPAD,spawnHelicopter,stepHelicopter,helicopterFits,helicopterHit} from '../src/helicopter.js';
import {ATV,vehicleInteract,stepVehicle,damageVehicle,tickVehicles} from '../src/vehicles.js';
import {STORMSPIKE,lodgeStormspike,tickStormspikes} from '../src/stormspike.js';
import {predictionCopy,predictMovement} from '../src/guest-movement.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {sanitizeInput} from '../src/physics.js';
import {SETTINGS_CATEGORIES} from '../src/settings-layout.js';
import {CONTROL_GROUPS,CONTROLS,normalizeBindings} from '../src/keybinds.js';
import {LOBBY_NEWS} from '../src/lobby-news.js';
const flat={id:'flat',theme:'royale',size:1000,boxes:[],helipad:{...HELIPAD,x:0,y:0,z:0,yaw:0}};
function flight(){const v=spawnHelicopter(flat);v.seats[0]='human';return v;}
function advance(v,input,seconds,map=flat){for(let i=0;i<seconds*60;i++)stepHelicopter(v,input,map,1/60);}
function battle(){const s=new RoyaleSimulation({capacity:4,bots:3,seed:199}),p=s.addPlayer('human',{name:'Pilot'});s.startRound();s.beginBattle();s.stage='active';s.time=10;Object.assign(p,{health:100,shield:0,flight:'ground',grounded:true,vy:0,spectating:false,connected:true,shieldUntil:0,lastInput:10});return {s,p};}
test('Stormspike has four graduated tiers and replaces only Nyx’s Mythic DMR',()=>{
 for(const [tier,damage,reload]of [[2,58,3.4],[3,61,3.2],[4,64,3],[5,67,2.8]]){const w=gun({slot:1,inventory:[null,{id:'stormspike',weapon:true,rarity:tier,bossId:tier===5?'lieutenant-nyx':undefined}]});assert.equal(w.damage,damage);assert.equal(w.reload,reload);assert.equal(w.magazine,4);assert.equal(w.ammoType,'heavy');assert.ok(w.damage<weapon('needle').damage);assert.equal(w.critical,1.6);}
 assert.equal(gun({slot:0,inventory:[{id:'stormspike',weapon:true,rarity:0}]}).rarity,2);
 assert.equal(BOSSES.find(b=>b.id==='lieutenant-nyx').weapon,'stormspike');assert.equal(MYTHIC_WEAPONS['lieutenant-nyx'].id,'stormspike');assert.equal(weapon('anchor').name,'DMR-18 Sentinel');
});
test('every natural source restricts Stormspike to Rare–Legendary, even an exact-zero rarity roll',()=>{
 for(const source of ['ground','chest','high','supply','epic'])for(const edge of [0,.5,.999999]){let n=0;const item=rollItem(()=>++n===1?.999999:edge,source,'weapon');assert.equal(item.id,'stormspike');assert.ok(item.rarity>=2&&item.rarity<=4,source);assert.equal(item.ammo,4);}
});
test('structural spikes wait for the fuse, damage touching structures, and do not blast through cover',()=>{
 const root={buildId:'a',x:0,y:0,z:0,w:4,h:4,d:.2},neighbor={buildId:'b',x:4,y:0,z:0,w:4,h:4,d:.2},separate={buildId:'c',x:10,y:0,z:0,w:4,h:4,d:.2},architecture={objectId:'wall',x:0,y:0,z:0,w:4,h:4,d:.2},hits=[];
 const sim={time:10,projectileId:0,builds:[{id:'a'},{id:'b'},{id:'c'}],map:{boxes:[root,neighbor,separate,architecture]},damageWorld:(b,n)=>hits.push([b.buildId||b.objectId,n]),damage:()=>assert.fail('player blast'),emit(){}};
 lodgeStormspike(sim,{owner:'p',x:0,y:1,z:.1,damage:58},root,{x:0,y:0,z:1});tickStormspikes(sim);assert.equal(hits.length,0);sim.time+=STORMSPIKE.fuse+.001;tickStormspikes(sim);assert.deepEqual(hits,[['a',150],['b',82.5],['wall',82.5]]);assert.equal(sim.stormSpikes.length,0);
 lodgeStormspike(sim,{owner:'p',x:0,y:1,z:0,damage:58},architecture,{x:0,y:0,z:1});assert.equal(sim.stormSpikes.length,1);assert.equal(sim.stormSpikes[0].objectId,'wall');
});
test('actual projectile collision lodges a spike and cover protects the player behind it',()=>{
 const {s,p}=battle();s.map={...flat,boxes:[{buildId:'cover',x:0,y:0,z:-5,w:4,h:4,d:.2}]};s.vehicles=[];s.builds=[{id:'cover',health:500}];const calls=[];s.damageWorld=(b,n)=>calls.push([b.buildId,n]);const enemy=s.addPlayer('target',{name:'Target'});Object.assign(enemy,{health:100,shield:100,shieldUntil:0,spectating:false,x:0,y:0,z:-9});
 s.projectiles=[{id:1,owner:p.id,shotId:1,weapon:'stormspike',kind:'bolt',x:0,y:1,z:-1,vx:0,vy:0,vz:-155,gravity:.45,hitRadius:.025,damage:58,buildDamage:40,range:300,born:s.time,travelled:0}];s.updateProjectiles(.05);assert.equal(s.projectiles.length,0);assert.equal(s.stormSpikes.length,1);assert.deepEqual(calls,[['cover',40]]);s.time+=1.2;tickStormspikes(s);assert.equal(calls[1][1],150);assert.equal(enemy.health,100);assert.equal(enemy.shield,100);
});
test('helipad spawns one clear Kestrel between boss POIs and keeps six ATVs',()=>{const{s}=battle(),heli=s.vehicles.filter(v=>v.type==='helicopter');assert.equal(heli.length,1);assert.equal(s.vehicles.filter(v=>v.type!=='helicopter').length,6);assert.ok(helicopterFits(s.map,heli[0]));assert.equal(heli[0].health,1500);assert.equal(heli[0].seats.length,5);assert.ok(s.map.helipad.z>-139&&s.map.helipad.z<157);assert.equal(ATV.speed,17/2);assert.equal(ATV.boostSpeed,31/2);});
test('spool, lift, hover, normal speed, boost cooldown and controlled landing share one simulation',()=>{
 const v=flight();advance(v,{heliUp:true},1);assert.equal(v.y,0);advance(v,{heliUp:true},4);assert.ok(v.y>8&&v.rotor===1);advance(v,{},2);assert.ok(Math.abs(v.vy)<1e-9);const y=v.y;advance(v,{},1);assert.equal(v.y,y);
 advance(v,{forward:1,yaw:0},4);assert.ok(Math.abs(v.speed-25)<1e-8);advance(v,{forward:1,yaw:0,heliBoost:true},.7);assert.ok(v.speed>30&&v.speed<=35);assert.ok(v.boostTime>0);advance(v,{forward:1,yaw:0},2);assert.ok(v.boostCooldown>0&&!v.boosting);
 advance(v,{heliDown:true},10);assert.equal(v.y,0);assert.ok(v.grounded);assert.ok(v.fuel<100&&v.fuel>0);
});
test('helicopter swept collision blocks thin walls and ceilings; tail is a weak point',()=>{
 const v=flight();v.rotor=1;v.y=10;v.grounded=false;v.vz=-35;const map={...flat,boxes:[{x:0,y:0,z:-5,w:30,h:30,d:.01}]};advance(v,{forward:1,yaw:0},1,map);assert.ok(v.z>-3);assert.ok(v.health===1500);
 const overhead={...flat,boxes:[{x:0,y:15,z:0,w:30,h:.1,d:30}]};v.x=v.z=0;v.vx=v.vz=0;advance(v,{heliUp:true},2,overhead);assert.ok(v.y+2.6<15.1);
 const body=helicopterHit({...v,x:0,y:0,z:0,yaw:0},{x:10,y:.9,z:0},{x:-1,y:0,z:0},20),tail=helicopterHit({...v,x:0,y:0,z:0,yaw:0},{x:10,y:2.9,z:5.1},{x:-1,y:0,z:0},20);assert.equal(body.multiplier,1);assert.equal(tail.multiplier,2.25);
});
test('five seats, held exit, crash and passenger input survive network snapshots and host recovery',()=>{
 const{s,p}=battle();s.map=flat;s.players=new Map([[p.id,p]]);const v=spawnHelicopter(flat);s.vehicles=[v];Object.assign(p,{x:0,y:0,z:0});vehicleInteract(s,p,{interact:true});assert.equal(p.vehicleType,'helicopter');
 for(let i=1;i<5;i++){const rider=s.addPlayer('rider'+i,{name:'Rider '+i});Object.assign(rider,{health:100,flight:'ground',spectating:false,connected:true,x:1,y:0,z:0});vehicleInteract(s,rider,{interact:true});assert.equal(rider.vehicleSeat,i);}
 const clean=sanitizeInput({heliUp:true,heliDown:true,heliBoost:true,heliSeat:true,heliExit:true,heliHorn:true});for(const key of ['heliUp','heliDown','heliBoost','heliSeat','heliExit','heliHorn'])assert.equal(clean[key],true);
 const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),round=decoder.decode(JSON.parse(JSON.stringify(encoder.encode({state:s.snapshot(),checkpoint:s.checkpoint()}).frame)));assert.equal(round.state.royale.vehicles[0].seats.length,5);assert.equal(round.state.players.find(p=>p.id==='human').vehicleType,'helicopter');const copy=new RoyaleSimulation().restore(s.checkpoint());assert.deepEqual(copy.vehicles,s.vehicles);
 v.y=30;v.grounded=false;s.time+=1;vehicleInteract(s,p,{heliExit:true});assert.equal(p.vehicleId,v.id);s.time+=.5;vehicleInteract(s,p,{heliExit:true});assert.equal(p.vehicleId,null);assert.equal(p.fall.immune,false);assert.equal(p.flight,'ground');
 damageVehicle(s,v,1501);assert.equal(v.falling,true);assert.equal(v.wrecked,false);assert.ok(v.seats.some(Boolean));for(let i=0;i<360&&!v.wrecked;i++){s.time+=1/60;tickVehicles(s,1/60);}assert.equal(v.wrecked,true);assert.ok(v.seats.every(x=>!x));
});
test('guest prediction matches authority flight without mutating its received snapshot',()=>{
 const v=flight(),r={vehicles:[structuredClone(v)]},p={id:'human',vehicleId:v.id,vehicleSeat:0,vehicleType:'helicopter',x:0,y:0,z:0,health:100},predicted=predictionCopy(p),before=structuredClone(r);for(let i=0;i<360;i++){const input={heliUp:i<240,forward:i>240?1:0,yaw:0};stepVehicle(v,input,flat,1/60);predictMovement(predicted,input,flat,1/60,r,i/60);}assert.ok(Math.abs(predicted.predictedVehicle.y-v.y)<1e-8);assert.ok(Math.abs(predicted.predictedVehicle.z-v.z)<1e-8);assert.deepEqual(r,before);
});
test('announcement, settings and controls expose the update in the intended locations',()=>{
 assert.equal(LOBBY_NEWS[0].action,'midseason-briefing');assert.ok(LOBBY_NEWS.some(s=>s.action==='voice-briefing'));assert.ok(!LOBBY_NEWS.some(s=>s.action==='perspective-briefing'));
 const categorized=CONTROL_GROUPS.flatMap(([,ids])=>ids);assert.equal(new Set(categorized).size,CONTROLS.length);assert.deepEqual([...categorized].sort(),CONTROLS.map(c=>c[0]).sort());const b=normalizeBindings();assert.ok(b.heliUp.includes('Mouse0'));assert.ok(b.fire.includes('Mouse0'));assert.ok(b.heliSeat.includes('ControlLeft'));assert.ok(b.sprint.includes('ControlLeft'));
 const settings=SETTINGS_CATEGORIES.flatMap(([, , ,groups])=>groups.flatMap(([,ids])=>ids));assert.equal(settings.length,new Set(settings).size);assert.ok(SETTINGS_CATEGORIES.find(c=>c[0]==='social')[3][0][1].includes('voiceSettings'));
});

test('helicopter audio is silent without a craft and remains finite and spatial while spooling',async()=>{
 const {updateHelicopterAudio}=await import('../src/helicopter-audio.js'),calls=[],sound={clock:1,loop:(id,target,options)=>{assert.ok(Number.isFinite(target));assert.ok(Number.isFinite(options.freq));calls.push({id,target,...options});}};
 updateHelicopterAudio(sound,null,{x:0,y:0,z:0});assert.ok(calls.every(c=>c.target===0));calls.length=0;
 updateHelicopterAudio(sound,{vehicles:[{id:'h',type:'helicopter',x:20,y:0,z:0,rotor:.5,speed:0,fuel:100,health:1500}]},{x:0,y:0,z:0,yaw:0});assert.ok(calls.find(c=>c.id==='helicopter-blades').pulse>0);assert.equal(calls.find(c=>c.id==='helicopter-turbine').pan,1);
});

test('the Kestrel model keeps a bounded geometry and draw-call budget',async()=>{
 const {makeHelicopter}=await import('../src/helicopter-model.js');const model=makeHelicopter({detail:2});let meshes=0,triangles=0;model.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}});assert.ok(meshes<32,{meshes});assert.ok(triangles<12000,{triangles});
});
