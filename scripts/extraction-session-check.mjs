import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ZombiesSimulation} from '../src/zombies-expedition.js';
import {SnapshotEncoder,SnapshotDecoder,SnapshotBatch} from '../src/snapshot-codec.js';
const seconds=Number(process.argv[2]||1801),rooms=[];
for(let r=0;r<2;r++){const sim=new ZombiesSimulation({sharedWorld:true,teamSize:4,seed:176+r});for(let n=0;n<12;n++)sim.admitPlayer('r'+r+'p'+n,{name:'Stress '+n},{partyId:'squad'+Math.floor(n/4)});sim.startRound();for(const [n,p]of [...sim.players.values()].entries()){p.zProtected=1e9;p.x=[-162,-54,54,162][n%4];p.z=-145+Math.floor(n/4)*100;}rooms.push({sim,encoders:Array.from({length:12},()=>new SnapshotEncoder()),decoders:Array.from({length:12},()=>new SnapshotDecoder()),cursor:0});}
globalThis.gc?.();const baseHeap=process.memoryUsage().heapUsed,cpu=process.cpuUsage(),start=performance.now(),samples=[];let maxStep=0,totalBytes=0,frames=0,checks=0,clientCpuMicros=0;
for(let tick=0;tick<seconds*30;tick++){
 const begin=performance.now();
 for(const room of rooms){const s=room.sim;if(tick%15===0)for(const [n,p]of [...s.players.values()].entries())if(!p.zExtracted){const north=Math.floor(tick/900+n)%2===0;s.setInput(p.id,{seq:tick+1,forward:.65,yaw:north?0:Math.PI,pitch:0},true);}
  if(tick%90===0){const enemy=s.enemies.find(e=>e.health>0);if(enemy)s.enemyHit(enemy,[...s.players.values()].find(p=>!p.zExtracted),enemy.maxHealth+1,false,'stress',false);}
  s.tick(1/30);if(tick===9000){const p=[...s.players.values()][0];s.extract(p);assert.equal(s.phase,'playing');}
  assert.ok(s.enemies.length<=56&&s.zEffects.length<=32&&s.zDrops.length<=12);assert.ok(s.zLoot.length<256);checks++;
  if(tick%3!==2){const state=s.snapshot(),batch=new SnapshotBatch();state.events=state.events.filter(e=>e.id>room.cursor);room.cursor=state.events.at(-1)?.id||room.cursor;
   const encoded=[];for(let n=0;n<12;n++){const frame=room.encoders[n].encode({type:'authority-state',state},batch),raw=batch.serialize(frame.frame);totalBytes+=Buffer.byteLength(raw);frames++;encoded.push(frame.frame);}const clientStart=process.cpuUsage();for(let n=0;n<12;n++){const got=room.decoders[n].decode(encoded[n]);assert.equal(got.state.matchId,state.matchId);assert.equal(got.state.zombies.stage,state.zombies.stage);}const clientTime=process.cpuUsage(clientStart);clientCpuMicros+=clientTime.user+clientTime.system;}
 }
 maxStep=Math.max(maxStep,performance.now()-begin);
 if(tick%9000===0){globalThis.gc?.();samples.push({second:tick/30,heapMiB:process.memoryUsage().heapUsed/1048576,rooms:rooms.map(r=>({phase:r.sim.phase,enemies:r.sim.enemies.length,pool:r.sim.enemyPool.length,loot:r.sim.zLoot.length}))});console.log('Two worlds:',tick/30,'simulated seconds');}
}
if(seconds>=1801)for(const {sim}of rooms){assert.equal(sim.phase,'results');assert.ok([...sim.players.values()].some(p=>p.zLost));assert.ok([...sim.players.values()].some(p=>p.zExtracted));}
globalThis.gc?.();const used=process.cpuUsage(cpu),result={result:'MEASURED',rooms:2,operators:24,seconds,checks,replicationHz:20,decodedFrames:frames,wallSeconds:(performance.now()-start)/1000,serverCpuMsPerSimulatedSecond:(used.user+used.system-clientCpuMicros)/1000/seconds,allClientsCpuMsPerSimulatedSecond:clientCpuMicros/1000/seconds,heapDeltaMiB:(process.memoryUsage().heapUsed-baseHeap)/1048576,wireKiBPerClientSecond:totalBytes/24/seconds/1024,maxCombinedStepMs:maxStep,samples,note:'Two accelerated authoritative worlds with moving protected operators and all 24 delta streams decoded at 20 Hz; not 24 hardware browser FPS measurements.'};
result.result=result.heapDeltaMiB<96&&result.serverCpuMsPerSimulatedSecond<350?'PASS':'FAIL';await mkdir('test-results/zombies',{recursive:true});await writeFile('test-results/zombies/full-session.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.equal(result.result,'PASS','Authoritative worlds must stay below 0.35 CPU core and 96 MiB retained growth.');
