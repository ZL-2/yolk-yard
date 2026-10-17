import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fixture,until} from './helpers/public-match.js';
import {RoyaleSimulation} from '../src/royale.js';
import {publicRoyaleOptions} from '../src/public-royale.js';
import {movePlayer} from '../src/physics.js';
import {groundAt} from '../src/terrain.js';
import {getMap} from '../src/maps.js';
import {View} from '../src/view.js';
import {cameraDistance} from '../src/camera-collision.js';
import {weaponMotion} from '../src/weapon-motion.js';
import {vehicleLocal,vehicleSupportHeight,ATV_WHEELS,stepVehicle,seatPose} from '../src/vehicles.js';
import {SocialStore} from '../server/realtime/social-store.js';
import {executeRoyaleIntent} from '../src/royale-bot-execution.js';
import {navigate} from '../src/bot-navigation.js';
import {armPose,makeArms,updateArms,RELOAD_STYLES} from '../src/arms.js';
import {makeBlaster} from '../src/weapons.js';
import {WEAPONS} from '../src/data.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';

test('a full party enters public and private Arena together and bots release all four seats',async()=>{
 for(const access of ['public','private']){const f=await fixture();try{
  const users=[];for(let i=0;i<4;i++)users.push(await f.user('Arena Crew '+i));const [leader,...mates]=users;
  await leader.ask('privacy',{value:'open'});for(const mate of mates)await mate.ask('join',{id:leader.party.id});
  await leader.ask('select',{mode:'ffa',access,options:{mode:'ffa',capacity:8,bots:7,fill:true}});for(const mate of mates)await mate.ask('ready',{value:true});
  await leader.ask('queue');const host=await f.game(leader);
  for(const mate of mates){await until(()=>mate.launches.length,'Party member dispatch');await f.game(mate);}
  await until(()=>[...host.sim.players.values()].filter(p=>!p.bot).length===4,'Full Arena roster');
  assert.equal(host.sim.players.size,8);assert.equal(new Set(users.map(u=>u.launches[0].code)).size,1);assert.ok([...host.sim.players.values()].filter(p=>!p.bot).every(p=>p.partyId===leader.party.id));assert.deepEqual(f.games.flatMap(g=>g.errors),[]);
 }finally{await f.close();}}
});

test('the last human death keeps the same public round and a live killer to spectate',()=>{
 const sim=new RoyaleSimulation({...publicRoyaleOptions(),capacity:8,bots:7,seed:172});const p=sim.addPlayer('host',{name:'Watcher'});sim.startRound();sim.beginBattle();sim.stage='active';
 for(const q of sim.players.values())if(q.contestant){q.flight='ground';q.y=groundAt(sim.map,q.x,q.z);q.shieldUntil=0;q.grounded=true;}
 const killer=[...sim.players.values()].find(q=>q.bot&&q.contestant);p.killerId=killer.id;p.health=0;sim.eliminate(p);const match=sim.matchId;
 for(let i=0;i<120;i++)sim.tick(1/60);
 assert.equal(sim.matchId,match);assert.equal(p.spectating,true);assert.equal(p.killerId,killer.id);assert.ok(killer.health>0);assert.notEqual(sim.stage,'spawn-island');
 sim.setConnectedHumans([]);sim.tick(1/60);assert.notEqual(sim.matchId,match,'An actually abandoned round still recycles');
});

test('jump uncrouches once, does not buffer a surprise jump, and still respects ceilings',()=>{
 const map={size:30,boxes:[]},p={health:100,x:0,y:0,z:0,vy:0,yaw:0,pitch:0,weapon:'sprinter',grounded:true,crouching:true,flight:'ground'};
 for(let i=0;i<20;i++)movePlayer(p,{jump:true,jumpPress:1,crouch:true},map,1/60,i/60);
 assert.equal(p.crouching,false);assert.equal(p.grounded,true);assert.equal(p.y,0);
 movePlayer(p,{jump:false,crouch:true},map,1/60);movePlayer(p,{jump:true,jumpPress:2,crouch:true},map,1/60);assert.equal(p.grounded,false);assert.ok(p.vy>0);
 Object.assign(p,{y:0,vy:0,grounded:true,crouching:true,jumpHeld:false,standFromJump:false,uncrouchJumpHeld:false});map.boxes=[{x:0,y:1.3,z:0,w:4,h:.4,d:4}];movePlayer(p,{jump:true,jumpPress:3,crouch:true},map,1/60);assert.equal(p.crouching,true);assert.equal(p.grounded,true);
});

test('Arena spectator boom ignores stale Royale collision terrain',()=>{
 const map=getMap('yard'),stale=getMap('sunnybreak'),p={id:'killer',x:-34,y:0,z:-34},origin=new T.Vector3(-34,1.6,-34),back=new T.Vector3(0,.35,1).normalize();
 const view={buildMap:stale,camera:new T.PerspectiveCamera()},state={round:1,options:{map:'yard'}};
 View.prototype.placeCameraBehind.call(view,state,p,origin,back,3.5,1/60,'spectator');
 assert.ok(Math.abs(view.camera.position.distanceTo(origin)-cameraDistance(map,origin,back,3.5))<1e-7);assert.ok(view.camera.position.distanceTo(origin)>1.5);
});

test('walking weapon bob is bounded and off means zero decoration',()=>{
 const s={},p={vx:0,vz:-8,grounded:true,yaw:0,pitch:0};let maxX=0,maxY=0;
 for(let i=0;i<300;i++){const v=weaponMotion(s,p,1/60,i/60,0,{});maxX=Math.max(maxX,Math.abs(v.x));maxY=Math.max(maxY,Math.abs(v.y));}
 assert.ok(maxX<=.00301&&maxY<=.0026);const off=weaponMotion(s,p,1/60,6,0,{weaponMotion:0});assert.ok(Object.values(off).every(x=>x===0));
});

test('ATV wheels stay above a sloped surface and seats follow vehicle tilt',()=>{
 const n=33,size=16,heights=Float32Array.from({length:n*n},(_,i)=>((i%n)-16)*.16+Math.floor(i/n)*.09),map={size,theme:'royale',boxes:[],terrain:{n,size,cell:1,heights}};
 const v={x:0,z:0,y:groundAt(map,0,0),yaw:1,pitch:0,roll:0,vy:0,speed:0,boost:100,grounded:true};
 for(let i=0;i<100;i++){stepVehicle(v,{forward:1,strafe:.18},map,1/60);for(const [x,z]of ATV_WHEELS){const q=vehicleLocal(v,x,.53,z);assert.ok(v.y+q.y-.53>=groundAt(map,v.x+q.x,v.z+q.z)-.001);}assert.ok(Number.isFinite(v.y));}
 assert.ok(v.y>=vehicleSupportHeight(map,v)-.001);const a=seatPose(v,0),b=seatPose({...v,pitch:0,roll:0},0);assert.notEqual(a.y,b.y);
});

test('storm evacuation cancels a cached heal and combat command immediately',()=>{
 const map={size:50,boxes:[]},p={id:'bot',inventory:[{pickaxe:true},{id:'sprinter',weapon:true,ammo:30}],bank:{medium:100},ammo:[0,30],reserve:[0,100],slot:1,health:30,flight:'ground',x:20,y:0,z:0,yaw:0,pitch:0,use:{slot:2},reviving:'mate',brain:{memory:{},task:{kind:'heal'},utility:{slot:2,until:30}}};
 const sim={time:10,map,stage:'active',options:{difficulty:2},storm:{active:true,x:0,z:0,radius:10,nextX:0,nextZ:0,nextRadius:6,seconds:3,closing:true},players:new Map([[p.id,p]]),cancelUse:q=>q.use=null};
 const result=executeRoyaleIntent(sim,p,{fire:true,aim:true,buildMode:true,utilityItem:true,slot:1,forward:0});assert.equal(p.use,null);assert.equal(p.reviving,null);assert.equal(result.fire,false);assert.equal(result.aim,false);assert.equal(result.sprint,true);assert.ok(result.moveTarget.x<20);
});

test('a trapped bot chooses an actual destructible surface and clears its breach after destruction',()=>{
 const wall={x:0,y:0,z:-1.1,w:8,h:3,d:.3,objectId:'trap'},p={id:'bot',x:0,y:0,z:0,health:100,inventory:[{pickaxe:true}],bot:true},map={size:20,boxes:[wall]},brain={checkAt:0,lastX:0,lastZ:0,pathAt:10,pathGoal:{x:0,y:0,z:-8},side:1,visited:{},task:{kind:'rotate'}},sim={time:2,map,players:new Map([[p.id,p]]),random:()=>.5,nav:{path:()=>[]},worldDamage:{}};
 navigate(sim,p,brain,{x:0,y:0,z:-8},{decision:1});assert.equal(brain.breach.box,wall);const move=navigate(sim,p,brain,{x:0,y:0,z:-8},{decision:1});assert.ok(move.breach);sim.worldDamage.trap={destroyed:true};navigate(sim,p,brain,{x:0,y:0,z:-8},{decision:1});assert.equal(brain.breach,null);
});

test('feature replies survive restart, only their recipient can acknowledge, completion is idempotent',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ravel-notifications-');try{let store=new SocialStore(dir+'/social.json');const a=store.identify(null,{name:'Requester'}).identity,b=store.identify(null,{name:'Other Player'}).identity,r=store.featureRequest(a.id,'Please improve the Arena camera');store.featureInbox('reply',r.id,false,'The camera fix is being published.');store.featureInbox('completed',r.id);store.featureInbox('completed',r.id);await store.flush();store=new SocialStore(dir+'/social.json');
  const updates=store.featureUpdates(a.id);assert.equal(updates.length,2);assert.deepEqual(store.featureUpdates(b.id),[]);store.acknowledgeFeatures(b.id,updates.map(x=>x.id));assert.equal(store.featureUpdates(a.id).length,2);store.acknowledgeFeatures(a.id,updates.map(x=>x.id));await store.flush();assert.deepEqual(new SocialStore(dir+'/social.json').featureUpdates(a.id),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('lobby chat enforces party/private audiences, blocks and membership on real sockets',async()=>{
 const f=await fixture();try{const a=await f.user('Chat Captain'),b=await f.user('Chat Mate'),c=await f.user('Chat Outsider');await a.ask('privacy',{value:'open'});await b.ask('join',{id:a.party.id});
  await a.ask('lobby-chat',{channel:'universal',text:'Welcome to the lobby'});assert.equal((await c.ask('lobby-history',{channel:'universal'})).messages.length,1);
  await a.ask('lobby-chat',{channel:'party',text:'Ready for arena'});assert.equal((await b.ask('lobby-history',{channel:'party'})).messages.length,1);assert.equal((await c.ask('lobby-history',{channel:'party'})).messages.length,0);
  await a.ask('lobby-chat',{channel:'private',to:b.id,text:'Choose the harbor map'});assert.equal((await b.ask('lobby-history',{channel:'private',to:a.id})).messages.length,1);await assert.rejects(c.ask('lobby-history',{channel:'private',to:a.id}));
  await b.ask('leave');await assert.rejects(b.ask('lobby-history',{channel:'private',to:a.id}));await c.ask('block',{id:a.id});assert.equal((await c.ask('lobby-history',{channel:'universal'})).messages.length,0);
 }finally{await f.close();}
});

test('every weapon has its own reload style and mechanisms reset on interruption',()=>{
 for(const w of WEAPONS){assert.ok(RELOAD_STYLES[w.id]);const model=makeBlaster(w.id),rig=makeArms(w.id);for(const t of [.16,.3,.45,.6,.75,.88]){const pose=updateArms(rig,t,model,0,1,null,true);assert.ok([...pose.left,...pose.right,...pose.partOffset].every(Number.isFinite));}updateArms(rig,-1,model);if(model.userData.reloadPart){assert.equal(model.userData.reloadPart.visible,true);assert.ok(model.userData.reloadPart.position.equals(model.userData.reloadPart.userData.restPosition));}if(model.userData.breakAction)assert.equal(model.userData.breakAction.rotation.x,0);}
 assert.ok(armPose('scatter',.4).breakAngle<-.3);assert.equal(armPose('sprinter',.45).partVisible,false);assert.equal(armPose('doubleyolk',.55).tokenVisible,true);
});
