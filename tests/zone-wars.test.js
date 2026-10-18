import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {ZoneWarsSimulation} from '../src/zone-wars.js';
import {BoxFightSimulation} from '../src/box-fights.js';
import {ZONE_RULES,ZONE_PHASES,zoneStormPath,zoneStormAt,zoneLoadout} from '../src/zone-wars-rules.js';
import {ZONE_BUILDINGS} from '../src/zone-wars-map.js';
import {matchOptions} from '../src/match-options.js';
import {publicMatchOptions,publicPoolKey} from '../src/public-royale.js';
import {buildingTick,editBuilding} from '../src/building.js';
import {predictionCopy,predictMovement} from '../src/guest-movement.js';
import {rewardFrame} from '../src/rewards.js';
import {movePlayer} from '../src/physics.js';
const setup=(options={},count=2)=>{const s=new ZoneWarsSimulation({fill:false,...options});s.addPlayer('a',{name:'Alpha'});s.addPlayer('b',{name:'Bravo'});for(let i=2;i<count;i++)s.addPlayer('human-'+i,{name:'Human '+i});s.startRound();return s;};
const fight=s=>{s.boxEnd=s.time;s.tick(1/30);assert.equal(s.boxStage,'fight');};
test('Zone Wars has a distinct public pool and configurable private solo rooms',()=>{
 const p=publicMatchOptions({mode:'zonewars',capacity:2,building:false,scoreLimit:1,fill:false});assert.equal(p.capacity,16);assert.equal(p.scoreLimit,5);assert.equal(p.fill,false);assert.equal(p.bots,0);assert.equal(p.building,true);assert.equal(p.boxFormat,'ffa');assert.notEqual(publicPoolKey(p),publicPoolKey({mode:'royale'}));
 const s=new ZoneWarsSimulation({fill:false});s.addPlayer('a',{name:'Alfa'});assert.equal(s.configure({capacity:4,scoreLimit:7,fill:false}),true);assert.equal(s.options.mode,'zonewars');assert.equal(s.options.capacity,4);assert.equal(s.options.bots,0);assert.equal(s.map.id,'tilted-district');assert.equal(matchOptions({mode:'zonewars',capacity:500}).capacity,16);
});
test('sixteen randomized spawns, balanced random kit roles and intact interior floors',()=>{
 const s=setup({},16);assert.equal(s.players.size,16);assert.equal(s.players.get('a').name,'Alpha');assert.equal(s.players.get('b').name,'Bravo');assert.ok(s.map.roads.every(r=>r.points.length===2&&r.width>0));const poses=new Set(),kits=new Set();for(const p of s.players.values()){poses.add([p.x,p.y,p.z].join(','));kits.add(p.inventory.slice(1).map(i=>i.id).join(','));assert.equal(p.health+p.shield,200);assert.deepEqual(p.materials,{wood:500,brick:500,metal:500});assert.equal(p.inventory.length,6);assert.ok(p.inventory[1].weapon&&p.inventory[2].weapon);assert.ok(!p.inventory[4].weapon);assert.ok(p.inventory[1].ammo>0);const start=p.y;movePlayer(p,{yaw:p.yaw},s.map,1/30,s.time);assert.ok(Math.abs(p.y-start)<.1,'Spawn stands on a real floor');}assert.equal(poses.size,16);assert.ok(kits.size>5);assert.equal(s.map.buildings.length,9);assert.ok(s.map.buildings.some(b=>b.clock));assert.ok(s.map.buildings.some(b=>b.unfinished));
 const first=[...s.players.values()].map(p=>p.boxSpawn);s.beginBoxRound();assert.notDeepEqual([...s.players.values()].map(p=>p.boxSpawn),first);for(let i=0;i<50;i++){const kit=zoneLoadout(Math.random);assert.equal(kit.length,5);assert.ok(kit.every(i=>i.id&&i.count>0));}
});
test('prep protection confines both host and guest to their spawn and releases on cue',()=>{
 const s=setup(),p=s.players.get('a'),other=s.players.get('b');s.damage(p,other,1000,'scatter');assert.equal(p.health+p.shield,200);const start={...p.boxSpawn},q=predictionCopy(p),input={yaw:0,forward:1,sprint:true,jump:true,slot:1};for(let i=0;i<120;i++){s.setInput('a',{...input,round:s.round});s.tick(1/30);predictMovement(q,input,s.map,1/30,s.snapshot().royale,s.time);}assert.ok(Math.abs(p.z-start.z)<=1.5);assert.ok(Math.abs(q.z-start.z)<=1.5);assert.equal(p.y,start.y);fight(s);assert.equal(s.map.boxPrep,false);s.damage(other,p,300,'scatter');assert.equal(other.health,0);assert.equal(other.spectating,true);assert.equal(other.downed,false);assert.equal(p.boxRoundKills,1);
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
