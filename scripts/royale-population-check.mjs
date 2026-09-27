import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {RoyaleSimulation} from '../src/royale.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {mkdir,writeFile} from 'node:fs/promises';
const s=new RoyaleSimulation({capacity:32,bots:31,fill:true,seed:551,difficulty:2});s.addPlayer('host',{name:'Population QA'});s.startRound();
assert.equal(s.players.size,32);assert.equal(s.queueEnds,60);
const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),report={capacity:32,stages:[],loot:[],snapshots:0,bytes:0,peakBytes:0},dt=1/60;
let frames=0,firstBytes=0,lastEvent=0;
function run(name,seconds){
 const samples=[],encodeTimes=[],start=s.time;let firing=0;
 for(let frame=0;frame<seconds*60;frame++){
  const now=performance.now();s.tick(dt);samples.push(performance.now()-now);frames++;
  firing=Math.max(firing,[...s.players.values()].filter(p=>p.bot&&p.fireLatch).length);
  if(frames%3===0){const t=performance.now(),state=s.snapshot();
   state.events=state.events.filter(e=>e.id>lastEvent);lastEvent=s.eventId;
   if(frames%60!==0&&s.lootVersion===run.lootVersion){delete state.royale.loot;delete state.royale.chests;}run.lootVersion=s.lootVersion;
   if(s.buildVersion===run.buildVersion)delete state.royale.builds;run.buildVersion=s.buildVersion;
   const packet=encoder.encode({type:'state',state,...(frames%150===0?{checkpoint:{simulation:s.checkpoint()}}:{})}),bytes=Buffer.byteLength(JSON.stringify(packet));
   encodeTimes.push(performance.now()-t);assert.ok(decoder.decode(packet.frame));
   if(!firstBytes)firstBytes=bytes;else{report.bytes+=bytes;report.peakBytes=Math.max(report.peakBytes,bytes);report.snapshots++;}
  }
 }
 samples.sort((a,b)=>a-b);encodeTimes.sort((a,b)=>a-b);
 const quantile=(a,q)=>+a[Math.floor((a.length-1)*q)].toFixed(2);
 report.stages.push({name,seconds:s.time-start,alive:s.alive,contestants:[...s.players.values()].filter(p=>p.contestant).length,tickMedianMs:quantile(samples,.5),tickP95Ms:quantile(samples,.95),tickMaxMs:quantile(samples,1),encodeP95Ms:quantile(encodeTimes,.95),maxSimultaneousFire:firing});
 console.log(JSON.stringify(report.stages.at(-1)));
}
run('Spawn Island',20);assert.ok(report.stages[0].maxSimultaneousFire<=3);
s.beginBattle();
assert.equal(s.alive,32);
for(const poi of s.map.districts){const buildings=s.map.buildings.filter(b=>b.poi===poi.id),guns=s.loot.filter(i=>i.weapon&&buildings.some(b=>Math.abs(i.x-b.x)<b.w/2+4&&Math.abs(i.z-b.z)<b.d/2+4)),chests=s.chests.filter(c=>c.poi===poi.id);assert.ok(chests.length>=3);assert.ok(guns.length>=buildings.length);report.loot.push({poi:poi.name,buildings:buildings.length,nearbyWeapons:guns.length,chests:chests.length});}
run('Bus, drop and early loot',80);
run('Early encounters',30);
report.initialBytes=firstBytes;report.averageDeltaBytes=Math.round(report.bytes/report.snapshots);report.kibPerSecondPerGuest=+(report.averageDeltaBytes*20/1024).toFixed(1);
report.buildings=s.map.buildings.length;report.authoredSockets=s.map.floorLoot.length;report.chestSockets=s.map.chests.length;report.groundLoot=s.loot.length;
// A simulation budget leaves room for rendering; CI hardware timing is recorded,
// while only severe stalls fail this diagnostic across varying machines.
assert.ok(report.stages.every(r=>r.tickP95Ms<30),'32-contestant simulation exceeds a frame budget');
assert.ok(report.averageDeltaBytes<24000,'Unexpected per-frame world retransmission');
await mkdir('test-results/connected-island',{recursive:true});await writeFile('test-results/connected-island/population.json',JSON.stringify(report,null,2));console.log('PASS 32 real contestants, bounded AI work and sparse world replication',JSON.stringify(report));
