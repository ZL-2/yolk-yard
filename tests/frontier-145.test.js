import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {RoyaleSimulation} from '../src/royale.js';
import {getMap} from '../src/maps.js';
import {groundAt} from '../src/terrain.js';
import {canStand,movePlayer,invalidateCollision} from '../src/physics.js';
import {inventory} from '../src/building.js';
import {initializeVehicles,vehicleInteract,stepVehicle,damageVehicle,ATV,ATV_SITES} from '../src/vehicles.js';
import {startShadowstep,shadowCharges} from '../src/shadowstep.js';
import {predictionCopy,predictMovement} from '../src/guest-movement.js';
import {SEASON} from '../src/season-one.js';
import {vaultDoorPose,VAULT_DOOR_SECONDS} from '../src/vaults.js';
import {setDoor,tickVaultDoors} from '../src/frontier-world.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {preferredSpectator} from '../src/match-presentation.js';
import {SocialStore} from '../server/realtime/social-store.js';
import {PartyService} from '../server/realtime/parties.js';
import {OwnerService} from '../server/realtime/owner.js';
function battle(){const s=new RoyaleSimulation({capacity:4,bots:3,seed:145}),p=s.addPlayer('human',{name:'Pilot'});s.startRound();s.beginBattle();s.stage='active';s.time=10;Object.assign(p,{health:100,shield:0,flight:'ground',grounded:true,vy:0,spectating:false,connected:true,shieldUntil:0,lastInput:10});return {s,p};}
function flat(){const {s,p}=battle();s.map={id:'flat',theme:'royale',size:100,boxes:[]};s.vehicles=[];s.players=new Map([[p.id,p]]);Object.assign(p,{x:0,y:0,z:0,yaw:0,pitch:0,inventory:inventory(),slot:1,vx:0,vz:0});return {s,p};}
function quad(){return {id:'test-atv',x:0,y:0,z:0,yaw:0,vy:0,vx:0,vz:0,speed:0,boost:100,health:400,seats:[null,null],grounded:true,pitch:0,roll:0,revision:0};}
test('six strategically distributed ATVs spawn clear of cover, never on Spawn Island',()=>{
 const {s}=battle();assert.equal(s.vehicles.length,6);for(const v of s.vehicles){const site=ATV_SITES.find(x=>x.id===v.site);assert.ok(Math.hypot(v.x-site.x,v.z-site.z)<=16.01);assert.equal(v.y,groundAt(s.map,v.x,v.z));assert.ok(canStand(s.map,{...v,y:v.y+.1}));assert.deepEqual(v.seats,[null,null]);}
 s.map=getMap('hatchery-atoll');initializeVehicles(s);assert.equal(s.vehicles.length,0);
});
test('ATV boarding reserves two separate seats and holding Use never immediately ejects',()=>{
 const {s,p}=flat(),v=quad();s.options.teamSize=2;s.vehicles=[v];p.team=0;
 assert.equal(vehicleInteract(s,p,{interact:true}),true);assert.equal(p.vehicleSeat,0);s.time+=1;vehicleInteract(s,p,{interact:true});assert.equal(p.vehicleId,v.id);
 const mate=s.addPlayer('mate',{name:'Wingman'});Object.assign(mate,{x:1,y:0,z:0,team:0,health:100,spectating:false,flight:'ground',grounded:true,connected:true});vehicleInteract(s,mate,{interact:true});assert.equal(mate.vehicleSeat,1);assert.deepEqual(v.seats,[p.id,mate.id]);
 vehicleInteract(s,p,{interact:false});vehicleInteract(s,p,{interact:true});assert.equal(p.vehicleId,null);assert.equal(v.seats[0],null);assert.equal(v.seats[1],mate.id);assert.ok(canStand(s.map,p));
});
test('ATV swept motion stops at thin cover, boost is finite, and handbrake reduces speed',()=>{
 const map={theme:'royale',size:100,boxes:[]},normal=quad(),boosted=quad();for(let i=0;i<90;i++){stepVehicle(normal,{forward:1},map,1/60);stepVehicle(boosted,{forward:1,sprint:true},map,1/60);}assert.ok(-boosted.z>-normal.z+5);assert.ok(boosted.speed<=ATV.boostSpeed);assert.ok(boosted.boost<60);
 const fast=quad();fast.speed=31;map.boxes=[{x:0,y:0,z:-4,w:8,h:5,d:.02}];for(let i=0;i<30;i++)stepVehicle(fast,{forward:1,sprint:true},map,1/60);assert.ok(fast.z>-2.65);assert.ok(Number.isFinite(fast.y));
 map.boxes=[];invalidateCollision(map);const braking=quad();braking.speed=17;stepVehicle(braking,{jump:true},map,.1);assert.ok(braking.speed<10);
});
test('Solo players can share a two-seat ATV without displacing its driver',()=>{const{s,p}=flat(),v=quad();s.vehicles=[v];vehicleInteract(s,p,{interact:true});const rider=s.addPlayer('rider',{name:'Rider'});Object.assign(rider,{x:1,y:0,z:0,health:100,spectating:false,flight:'ground',grounded:true,connected:true});assert.equal(vehicleInteract(s,rider,{interact:true}),true);assert.equal(rider.vehicleSeat,1);s.time+=1;vehicleInteract(s,rider,{reload:true});assert.equal(v.seats[0],p.id);assert.equal(v.seats[1],rider.id);});
test('ATV passengers, health and boost survive detached wire snapshots and host recovery',()=>{
 const {s,p}=battle(),v=s.vehicles[0];Object.assign(p,{x:v.x,y:v.y,z:v.z});vehicleInteract(s,p,{interact:true});v.boost=23;v.health=310;
 const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),state=decoder.decode(JSON.parse(JSON.stringify(encoder.encode({state:s.snapshot(),checkpoint:s.checkpoint()}).frame))).state;
 assert.equal(state.royale.vehicles[0].seats[0],p.id);assert.equal(state.players.find(x=>x.id===p.id).vehicleId,v.id);state.royale.vehicles[0].seats[0]='other';assert.equal(v.seats[0],p.id);
 const copy=new RoyaleSimulation().restore(s.checkpoint());assert.deepEqual(copy.vehicles,s.vehicles);assert.equal(copy.players.get(p.id).vehicleId,v.id);damageVehicle(copy,copy.vehicles[0],500);assert.equal(copy.players.get(p.id).vehicleId,null);assert.equal(copy.vehicles[0].health,0);
});
test('guest driving uses the same bounded physics without mutating the vehicle snapshot',()=>{
 const {s,p}=flat(),v=quad();s.vehicles=[v];vehicleInteract(s,p,{interact:true});const row=s.snapshot().players[0],royale=s.snapshot().royale,predicted=predictionCopy(row),before=structuredClone(royale.vehicles[0]);
 for(let i=0;i<60;i++){stepVehicle(v,{forward:1,sprint:true},s.map,1/60);predictMovement(predicted,{forward:1,sprint:true},s.map,1/60,royale,s.time);}
 assert.ok(Math.abs(predicted.predictedVehicle.z-v.z)<1e-8);assert.deepEqual(royale.vehicles[0],before);
});
test('double Jump uses an unequipped rig with matching predicted charges and a fifteen-second refill',()=>{
 const {s,p}=flat();p.inventory[4]={id:'jumpRig',count:1};const predicted=predictionCopy(p),original=p.inventory[4];
 for(const [i,jump]of [true,false,true].entries()){const input={jump,jumpPress:jump?i+1:1,yaw:0,pitch:0};movePlayer(p,input,s.map,1/60,10+i/60);predictMovement(predicted,input,s.map,1/60,null,10+i/60);}
 assert.equal(p.inventory[4].charges,3);assert.equal(p.inventory[4].rechargeAt,10+2/60+15);assert.equal(SEASON.rig.recharge,15);assert.equal(p.fall.immune,true);assert.equal(p.mobilityKind,'jumpRig');assert.notEqual(predicted.inventory[4],original);assert.ok(Math.abs(p.y-predicted.y)<1e-8);assert.equal(predicted.inventory[4].charges,3);
});
test('unlimited Shadowstep follows vertical look, stops at ceilings, and keeps fall protection',()=>{
 const {s,p}=flat(),item={id:'shadowstep',count:1};p.pitch=1.3;assert.equal(startShadowstep(p,item,10),true);for(let i=0;i<14;i++)movePlayer(p,{},s.map,1/60,10);assert.ok(p.y>12);assert.equal(p.fall.immune,true);assert.equal(shadowCharges(item),Infinity);assert.equal(startShadowstep(p,item,10.99),false);assert.equal(startShadowstep(p,item,11),true);
 Object.assign(p,{x:0,y:0,z:0,pitch:1.48,grounded:true});s.map.boxes=[{x:0,y:4,z:0,w:10,h:1,d:10}];startShadowstep(p,{id:'shadowstep'},20);for(let i=0;i<14;i++)movePlayer(p,{},s.map,1/60,20);assert.ok(p.y+1.85<=4.001);assert.ok(canStand(s.map,p));
});
test('uphill crouch slides keep forward momentum and stop before reversing downhill',()=>{
 const map={theme:'royale',size:100,boxes:[],terrain:{size:100,cell:100,n:3,heights:new Float32Array([0,40,80,0,40,80,0,40,80])}},p={health:100,x:0,y:40,z:0,yaw:-Math.PI/2,pitch:0,flight:'ground',grounded:true,vy:0,vx:8.8,vz:0,weapon:'sprinter',inventory:[]};let stopped=false,last=0;
 for(let i=0;i<80;i++){const x=p.x;movePlayer(p,{forward:1,crouch:true,yaw:-Math.PI/2},map,1/60);p.vx=(p.x-x)*60;p.vz=0;assert.ok(p.x>=last-1e-8);last=p.x;if(i>0&&!p.sliding)stopped=true;}assert.ok(p.x>1);assert.equal(stopped,true);
});
test('direct Rare rocket hits deliver 105 damage, while thin cover still protects targets behind it',()=>{
 const {s,p}=flat(),enemy=s.addPlayer('target',{name:'Target'});Object.assign(enemy,{health:100,shield:100,spectating:false,flight:'ground',x:0,y:0,z:-12,shieldUntil:0});
 const rocket=()=>({id:1,owner:p.id,shotId:1,weapon:'thumper',kind:'shell',x:0,y:.9,z:-1.5,vx:0,vy:0,vz:-48,gravity:0,hitRadius:.08,damage:105,buildDamage:230,range:240,born:s.time,fuse:5,travelled:0,popper:false});s.projectiles=[rocket()];s.updateProjectiles(.25);assert.equal(enemy.shield,0);assert.equal(enemy.health,95);assert.equal(s.events.filter(e=>e.type==='explosion').length,1);
 enemy.health=enemy.shield=100;s.map.boxes=[{x:0,y:0,z:-5,w:8,h:5,d:.03}];s.projectiles=[rocket()];s.updateProjectiles(.25);assert.equal(enemy.health,100);assert.equal(enemy.shield,100);assert.equal(s.projectiles.length,0);
});
test('vault wheels and bolts move before the door, with solid collision until it clears',()=>{
 const {s,p}=battle(),v=s.map.vault,door=s.map.doors.find(d=>d.id===v.doorId);s.vault.open=true;assert.equal(setDoor(s,door,true,p),true);const record=s.doors[door.id];assert.equal(record.passable,false);assert.ok(s.map.boxes.some(b=>b.doorId===door.id));
 const early=vaultDoorPose(door,record,s.time+.3);assert.equal(early.angle,0);assert.ok(early.wheel>0&&early.bolt>0);assert.ok(vaultDoorPose(door,record,s.time+1.5).angle>0);s.time+=VAULT_DOOR_SECONDS;tickVaultDoors(s);assert.equal(record.passable,true);assert.equal(s.map.boxes.some(b=>b.doorId===door.id),false);assert.ok(Math.abs(vaultDoorPose(door,record,s.time).angle-Math.PI/2)<1e-8);
});
test('bot eliminations spectate living humans ahead of a bot killer or bot teammate',()=>{
 const state={options:{mode:'royale',teamSize:2},players:[{id:'me',health:0,killerId:'bot',team:0,x:0,z:0},{id:'mate',bot:true,health:100,contestant:true,team:0,x:1,z:0},{id:'bot',bot:true,health:100,contestant:true,team:1,x:2,z:0},{id:'human',bot:false,health:100,contestant:true,team:1,x:20,z:0}]};assert.equal(preferredSpectator(state,'me'),'human');
});
test('away means all connected tabs are hidden, and persisted feature requests require owner access',async()=>{
 const dir=await mkdtemp('/tmp/frontier-145-'),store=new SocialStore(dir+'/social.json'),relay={peers:new Map()},service=new PartyService(relay,{store}),owner=new OwnerService({code:'145145145145145145'});relay.parties=service;
 try{const {identity}=store.identify(null,{name:'Pilot'}),first={readyState:1,send(){},close(){}},second={readyState:1,send(){},close(){}},u={id:identity.id,profile:identity.profile,sessions:new Map([[first,{visible:true}],[second,{visible:false}]]),ws:first};service.users.set(u.id,u);service.create(u);assert.equal(service.presence(u.id),'lobby');service.command(u,{type:'presence',visible:false},first);assert.equal(service.presence(u.id),'away');assert.equal(service.connected(u),true);service.command(u,{type:'presence',visible:true},second);assert.equal(service.presence(u.id),'lobby');
  const request=service.command(u,{type:'feature-request',text:'Please add a practice target range.'});await store.flush();const restored=new SocialStore(store.path);assert.equal(restored.featureRequests[0].id,request.id);assert.equal(restored.featureRequests[0].name,'Pilot');
  await owner.ready;let status,result;const response={writeHead(s){status=s;},end(raw){result=JSON.parse(raw);}},http=token=>({url:'/owner/requests',method:'POST',headers:{origin:'https://zl-2.github.io'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify({token,action:'list'}));}});
  await owner.handle(http('invalid'),response,{origins:['https://zl-2.github.io'],relay});assert.equal(status,401);const token='c'.repeat(64);owner.tokens.set(token,Date.now()+60000);await owner.handle(http(token),response,{origins:['https://zl-2.github.io'],relay});assert.equal(status,200);assert.equal(result.requests.length,1);assert.equal(result.requests[0].text,'Please add a practice target range.');assert.equal(result.requests[0].token,undefined);
  for(let i=0;i<2;i++)service.command(u,{type:'feature-request',text:'Another helpful feature suggestion.'});assert.throws(()=>service.command(u,{type:'feature-request',text:'Another helpful feature suggestion.'}),/Please wait/);
 }finally{await service.close();await owner.close();await rm(dir,{recursive:true,force:true});}
});
