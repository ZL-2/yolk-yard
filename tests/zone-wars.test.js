import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {ZoneWarsSimulation} from '../src/zone-wars.js';
import {BoxFightSimulation} from '../src/box-fights.js';
import {ZONE_RULES,ZONE_PHASES,zoneStormPath,zoneStormAt,zoneLoadout,zoneSpawnLootPoints,bounceZonePad} from '../src/zone-wars-rules.js';
import {ZONE_BUILDINGS} from '../src/zone-wars-map.js';
import {matchOptions} from '../src/match-options.js';
import {publicMatchOptions,publicPoolKey} from '../src/public-royale.js';
import {buildingTick,editBuilding,rebuildMap} from '../src/building.js';
import {predictionCopy,predictMovement} from '../src/guest-movement.js';
import {rewardFrame} from '../src/rewards.js';
import {movePlayer} from '../src/physics.js';
import {validLootPoint} from '../src/royale-loot.js';
const setup=(options={},count=2)=>{const s=new ZoneWarsSimulation({fill:false,...options});s.addPlayer('a',{name:'Alpha'});s.addPlayer('b',{name:'Bravo'});for(let i=2;i<count;i++)s.addPlayer('human-'+i,{name:'Human '+i});s.startRound();return s;};
const fight=s=>{s.boxEnd=s.time;s.tick(1/30);assert.equal(s.boxStage,'fight');};
test('Zone Wars has a distinct public pool and configurable private solo rooms',()=>{
 const p=publicMatchOptions({mode:'zonewars',capacity:2,building:false,scoreLimit:1,fill:false});assert.equal(p.capacity,16);assert.equal(p.scoreLimit,0);assert.equal(p.fill,false);assert.equal(p.bots,0);assert.equal(p.building,true);assert.equal(p.boxFormat,'ffa');assert.notEqual(publicPoolKey(p),publicPoolKey({mode:'royale'}));
 const s=new ZoneWarsSimulation({fill:false});s.addPlayer('a',{name:'Alfa'});assert.equal(s.configure({capacity:4,scoreLimit:7,fill:false}),true);assert.equal(s.options.mode,'zonewars');assert.equal(s.options.capacity,4);assert.equal(s.options.bots,0);assert.equal(s.map.id,'tilted-district');assert.equal(matchOptions({mode:'zonewars',capacity:500}).capacity,16);
});
test('sixteen randomized spawns, balanced random kit roles and intact interior floors',()=>{
 const s=setup({},16);assert.equal(s.players.size,16);assert.equal(s.players.get('a').name,'Alpha');assert.equal(s.players.get('b').name,'Bravo');assert.ok(s.map.roads.every(r=>r.points.length===2&&r.width>0));const poses=new Set(),kits=new Set();for(const p of s.players.values()){poses.add([p.x,p.y,p.z].join(','));assert.equal(p.health+p.shield,200);assert.deepEqual(p.materials,{wood:500,brick:500,metal:500});assert.equal(p.inventory.length,6);assert.ok(p.inventory[0].pickaxe);assert.ok(p.inventory.slice(1).every(i=>!i));assert.equal(p.slot,0);const start=p.y;movePlayer(p,{yaw:p.yaw},s.map,1/30,s.time);assert.ok(Math.abs(p.y-start)<.1,'Spawn stands on a real floor');}for(let i=0;i<16;i++)kits.add(s.loot.filter(l=>l.zoneSpawn===i).map(l=>l.id).join(','));assert.equal(poses.size,16);assert.ok(kits.size>5);assert.equal(s.map.buildings.filter(b=>b.clock).length,4);assert.equal(s.map.buildings.find(b=>b.id==='central').footprints.length,2);assert.equal(s.map.buildings.filter(b=>b.style==='courtyard').length,2);assert.equal(s.map.court.y,4);assert.ok(s.map.cliffs.length>=24);assert.equal(s.map.bouncePads.length,6);
 const first=[...s.players.values()].map(p=>p.boxSpawn);s.beginBoxRound();assert.notDeepEqual([...s.players.values()].map(p=>p.boxSpawn),first);for(let i=0;i<50;i++){const kit=zoneLoadout(Math.random);assert.equal(kit.length,5);assert.ok(kit.every(i=>i.id&&i.count>0));}
});
test('prep protection confines both host and guest to their spawn and releases on cue',()=>{
 const s=setup(),p=s.players.get('a'),other=s.players.get('b');s.damage(p,other,1000,'scatter');assert.equal(p.health+p.shield,200);const start={...p.boxSpawn},q=predictionCopy(p),input={yaw:start.yaw,forward:1,sprint:true,jump:true,slot:0};for(let i=0;i<120;i++){s.setInput('a',{...input,seq:i+1,round:s.round});s.tick(1/30);predictMovement(q,input,s.map,1/30,s.snapshot().royale,s.time);}assert.ok(p.z-start.z<=4.71&&p.z-start.z>=3.5,'Entire loot lane is reachable during preparation');assert.ok(q.z-start.z<=4.71&&q.z-start.z>=3.5);assert.equal(p.y,start.y);fight(s);assert.equal(s.map.boxPrep,false);s.damage(other,p,300,'scatter');assert.equal(other.health,0);assert.equal(other.spectating,true);assert.equal(other.downed,false);assert.equal(p.boxRoundKills,1);
});
test('all sixteen spawn lanes have five reachable ordered pickups, including empty rooms',()=>{
 for(const recurring of [false,true]){
  const s=setup({recurring});if(recurring)s.beginBoxRound();assert.equal(s.loot.length,80);
  for(const [i,spawn]of s.map.spawnRooms.entries()){
   const line=s.loot.filter(l=>l.zoneSpawn===i),points=zoneSpawnLootPoints(spawn);assert.equal(line.length,5);
   assert.ok(['sprinter','duet'].includes(line[0].id));assert.ok(['scatter','doubleyolk'].includes(line[1].id));
   for(const [j,item]of line.entries()){assert.equal(item.zoneSlot,j+1);assert.equal(item.x,points[j].x);assert.equal(item.z,points[j].z);assert.ok(Math.abs(item.y-spawn.y)<.15,'Loot stays on its spawn floor');assert.ok(validLootPoint(s.map,item,.35),'Clear floor at spawn '+i+' slot '+j);assert.ok(!item.weapon||item.ammo>0);}
  }
 }
});
test('walking each spawn lane collects rifle then shotgun, resets cleanly and survives host recovery',()=>{
 const s=setup({},16),original=s.loot.map(l=>l.uid);
 for(let i=0;i<40;i++){for(const p of s.players.values())s.setInput(p.id,{yaw:p.boxSpawn.yaw,forward:1,slot:p.slot,seq:i+1,round:s.round});s.tick(1/30);}
 assert.equal(s.loot.length,0,'All eighty drops collected without crossing a wall or floor');
 for(const p of s.players.values()){assert.ok(['sprinter','duet'].includes(p.inventory[1]?.id));assert.ok(['scatter','doubleyolk'].includes(p.inventory[2]?.id));assert.ok(p.inventory.slice(1).filter(Boolean).length>=4);assert.ok(p.inventory.every(i=>!i?.zoneSlot),'Pickup metadata never follows a carried item');}
 const p=s.players.get('a');s.dropSlot(p,1);const dropped=s.loot[0];assert.equal(dropped.zoneSlot,undefined);Object.assign(p,{x:dropped.x,y:dropped.y,z:dropped.z});s.time+=2;s.interact(p,{},1/30);assert.equal(p.inventory[1],null,'Dropped weapons require a deliberate pickup');
 s.beginBoxRound();assert.equal(s.loot.length,80);assert.ok(s.loot.every(l=>!original.includes(l.uid)));assert.ok(p.inventory.slice(1).every(i=>!i));
 const first=s.loot[0];Object.assign(p,{x:first.x,y:first.y,z:first.z});assert.equal(s.takeLoot(p,first),true);const restored=new ZoneWarsSimulation(s.options).restore(s.checkpoint());assert.deepEqual(restored.loot,s.loot);assert.equal(restored.loot.length,79);assert.deepEqual(restored.players.get('a').inventory,p.inventory);
 restored.beginBoxRound();assert.equal(restored.loot.length,80);
});
test('actual stair collision supports climbing from ground to the next floor',()=>{
 const s=setup(),p=s.players.get('a'),b=ZONE_BUILDINGS[0],north=b.z-b.d/2;fight(s);Object.assign(p,{x:b.x+b.w/2-2.25,y:0,z:north+.7,yaw:Math.PI,grounded:true,vy:0});for(let i=0;i<150;i++)movePlayer(p,{yaw:Math.PI,forward:.5},s.map,1/30,i/30);assert.ok(p.y>3.7,'Stair run reaches first storey: '+JSON.stringify({x:p.x,y:p.y,z:p.z}));assert.ok(p.z>north+8,'Player can leave stairwell');
});
test('storm phases move continuously, close completely and preserve damage escalation',()=>{
 const path=zoneStormPath(()=>.25);assert.equal(path.length,6);let end=0;for(const [i,p]of path.entries()){const at=zoneStormAt(path,p.start+p.wait+p.duration-.0001);assert.ok(Math.abs(at.radius-p.radius)<.001);assert.ok(at.dps>0);if(i)assert.equal(p.startRadius,path[i-1].radius);end=p.start+p.wait+p.duration;}assert.equal(end,186);const final=zoneStormAt(path,220);assert.equal(final.radius,0);assert.equal(final.dps,15);assert.ok(final.active);assert.ok(!zoneStormAt(path,0).active);assert.ok(zoneStormAt(path,30).closing);assert.ok(zoneStormAt(path,70).z!==zoneStormAt(path,25).z);
 const s=setup();fight(s);s.boxStarted=s.time-207;for(let i=0;i<150;i++)s.tick(1/30);assert.equal(s.roundHistory.length,1);assert.equal(s.roundWinner,null);
});
test('build edits, damage, gear, round inputs and reward events reset without duplicate kills',()=>{
 const s=setup(),p=s.players.get('a');fight(s);Object.assign(p,{x:0,y:0,z:-16,yaw:Math.PI,pitch:0,grounded:true});buildingTick(s,p,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});assert.equal(s.builds.length,1);const wall=s.builds[0];assert.equal(editBuilding(s,p,'build-change:'+JSON.stringify({id:wall.id,mask:16,path:[],revision:0,yaw:p.yaw,pitch:0})),true);
 p.health=60;p.shield=20;p.materials={wood:490,brick:490,metal:490};s.damage(s.players.get('b'),p,1000,'scatter');s.tick(1/30);assert.equal(s.roundWinner,'a');assert.deepEqual(p.materials,{wood:500,brick:500,metal:500});assert.equal(p.health+p.shield,130);const frame=rewardFrame(s.snapshot(),'a',{});assert.equal(frame.phase,'results');assert.equal(frame.winnerId,'a');assert.equal(frame.players[0].kills,1);
 const oldRound=s.round;s.boxEnd=s.time;s.tick(1/30);assert.equal(s.builds.length,0);assert.equal(p.boxRoundKills,0);assert.equal(p.kills,1);s.setInput('a',{round:oldRound,yaw:.3});s.tick(1/30);assert.equal(p.yaw,p.boxSpawn.yaw);assert.equal(rewardFrame(s.snapshot(),'a',{}).events.some(e=>e.type==='elimination'),false);
 const cp=new ZoneWarsSimulation(s.options).restore(s.checkpoint());assert.equal(cp.options.mode,'zonewars');assert.equal(cp.map.id,'tilted-district');assert.deepEqual(cp.zonePath,s.zonePath);assert.deepEqual(cp.roundWins,s.roundWins);cp.boxEnd=cp.time;cp.tick(1/30);assert.equal(cp.boxStage,'fight');
});
test('Box Fights rejects delayed look packets at every round boundary',()=>{
 const s=new BoxFightSimulation({fill:false});s.addPlayer('a',{name:'Alpha'});s.addPlayer('b',{name:'Bravo'});s.startRound();for(let n=0;n<6;n++){const p=s.players.get('a'),r=s.round;s.setInput('a',{round:r,yaw:1.1});s.tick(1/30);s.beginBoxRound();s.setInput('a',{round:r,yaw:1.1},true);s.tick(1/30);assert.ok(Math.abs(Math.sin(p.yaw))<.0001);assert.ok(-Math.cos(p.yaw)*-p.z>0,'Facing center barrier');}
});
test('sixteen-player simulation progresses and stays within a 30 Hz tick budget',()=>{
 const s=setup({},16);const times=[];for(let i=0;i<2100;i++){const start=performance.now();s.tick(1/30);times.push(performance.now()-start);}times.sort((a,b)=>a-b);const p95=times[Math.floor(times.length*.95)];assert.ok(p95<30,'p95 '+p95.toFixed(2)+' ms');assert.ok([...s.players.values()].some(p=>p.kills>0)||s.roundHistory.length>0,'Storm resolves combat');console.log('Zone Wars 16 seats p95: '+p95.toFixed(2)+' ms');
});

test('both competitive modes reject bot settings, bot admission and legacy checkpoint bots',()=>{
 for(const [mode,Type]of [['boxfight',BoxFightSimulation],['zonewars',ZoneWarsSimulation]]){
  for(const recurring of [false,true]){const s=new Type({bots:15,fill:true,difficulty:4,teamFill:true,recurring});assert.equal(s.options.bots,0);assert.equal(s.options.fill,false);assert.equal(s.options.teamFill,false);assert.equal(s.addPlayer('bot',{name:'Practice'},true),null);s.addPlayer('a',{name:'Human Alpha'});s.startRound();for(let i=0;i<600;i++)s.tick(1/30);assert.equal(s.players.size,1);assert.equal(s.boxRound,0);assert.equal(s.boxStage,'waiting');assert.equal(s.snapshot().boxfight.waitingForOpponents,true);}
  const original=new Type();original.addPlayer('a',{name:'Human Alpha'});original.addPlayer('b',{name:'Human Bravo'});original.startRound();const checkpoint=original.checkpoint();checkpoint.players[1].bot=true;checkpoint.options.bots=15;checkpoint.options.fill=true;const restored=new Type().restore(checkpoint);assert.equal(restored.players.size,1);assert.equal(restored.options.bots,0);assert.equal(restored.options.fill,false);assert.equal(restored.boxStage,'waiting');assert.equal(restored.snapshot().royale.queueEnds,0);
 }
});

test('every building stair reaches its first floor and roof, and the court has exterior access',()=>{
 const s=setup(),p=s.players.get('a');fight(s);
 for(const b of s.map.buildings.filter(b=>b.stairs))for(const f of [0,b.floors-1]){
  Object.assign(p,{x:b.stairs.x,y:f*4+.14,z:b.stairs.north+.55,yaw:Math.PI,grounded:true,vy:0,mantle:null,fall:null});
  for(let i=0;i<180;i++)movePlayer(p,{yaw:Math.PI,forward:.5},s.map,1/30,i/30);
  assert.ok(p.y>=f*4+3.9,`${b.id} floor ${f} has a climbable exit`);
 }
 Object.assign(p,{x:-30,y:0,z:50.4,yaw:0,grounded:true,vy:0,mantle:null,fall:null});
 for(let i=0;i<180;i++)movePlayer(p,{yaw:0,forward:.5},s.map,1/30,i/30);
 assert.ok(p.y>=3.9&&p.z<42,'The wide stair opens onto the basketball court');
});
test('fixed ground and roof bouncers agree with guest prediction and protect the resulting fall',()=>{
 const s=setup(),p=s.players.get('a');fight(s);
 for(const pad of s.map.bouncePads){
  Object.assign(p,{x:pad.x,y:pad.y+.13,z:pad.z,grounded:true,vy:0,mantle:null,fall:null,flight:'ground',health:100,shield:100});
  const q=predictionCopy(p),input={yaw:0};s.moveWithCommands(p,input,1/30);predictMovement(q,input,s.map,1/30,s.snapshot().royale,s.time);
  assert.equal(p.vy,25,pad.id+' launches');assert.equal(q.vy,p.vy,'Guest launches on the same frame');assert.equal(p.fall.immune,true);assert.equal(p.forceGlider,false);assert.equal(p.redeploy,false);
 }
 const roofPad=s.map.bouncePads.find(p=>p.y>0);s.worldDamage[roofPad.objectId]={destroyed:true};rebuildMap(s);Object.assign(p,{x:roofPad.x,y:roofPad.y+.13,z:roofPad.z,vy:0});assert.equal(bounceZonePad(p,s.map),false,'A destroyed roof cannot leave an active floating pad');
 const before=s.map.bouncePads.map(p=>p.objectId);s.beginBoxRound();assert.deepEqual(s.map.bouncePads.map(p=>p.objectId),before,'Pads reset with the map');
 const cp=new ZoneWarsSimulation(s.options).restore(s.checkpoint());assert.equal(cp.map.revision,2);assert.equal(cp.map.bouncePads.length,6);
});
