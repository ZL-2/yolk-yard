import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ZombiesSimulation} from '../src/zombies.js';
import {Z_DOORS} from '../src/zombies-map.js';
import {SnapshotEncoder,SnapshotBatch} from '../src/snapshot-codec.js';
const s=new ZombiesSimulation({capacity:4,teamSize:4});for(let i=0;i<4;i++)s.admitPlayer('p'+i,{name:'Load Operator '+i});s.startRound();s.zOpen=Z_DOORS.map(d=>d.id);s.rebuildMap();s.zWave=39;s.beginWave();s.zQueued=0;for(const p of s.players.values())p.zProtected=1e9;
let cursor=0;const encoders=Array.from({length:4},()=>new SnapshotEncoder()),steps=[],frames=[],sizes=[];const start=performance.now(),cpu=process.cpuUsage();globalThis.gc?.();const heap=process.memoryUsage().heapUsed;
for(let tick=0;tick<36000;tick++){
 if(tick%60===0){for(const [i,p]of [...s.players.values()].entries()){p.x=-30+Math.sin(tick/300+i)*5;p.z=25+Math.cos(tick/300+i)*8;}const victim=s.enemies.find(e=>e.health>0);if(victim)s.enemyHit(victim,s.players.get('p0'),1e8);}
 while(s.enemies.filter(e=>e.health>0).length<32)s.spawnEnemy(['runner','armored','heavy','leaper','disruptor','elite'][tick%6],{x:-28+tick%8,y:0,z:7+tick%4});
 s.zQueued=1;s.zNextSpawn=s.time+10;const at=performance.now();s.tick(1/60);steps.push(performance.now()-at);
 if(tick%3===0){const before=performance.now(),state=s.snapshot(),batch=new SnapshotBatch();state.events=state.events.filter(e=>e.id>cursor);cursor=state.events.at(-1)?.id||cursor;for(const encoder of encoders){const frame=encoder.encode({type:'authority-state',state},batch);sizes.push(Buffer.byteLength(batch.serialize(frame.frame)));}frames.push(performance.now()-before);}
 assert.ok(s.enemies.length<=42&&s.zEffects.length<=24&&s.zDrops.length<=10);
}
globalThis.gc?.();const endCPU=process.cpuUsage(cpu),percentile=(xs,n)=>xs.toSorted((a,b)=>a-b)[Math.floor((xs.length-1)*n)],mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const result={scenario:'10 simulated minutes; four real-player slots, 32 active infected, all sectors open, four 20 Hz delta recipients',simulatedSeconds:600,wallSeconds:(performance.now()-start)/1000,cpuMsPerSimulatedSecond:(endCPU.user+endCPU.system)/1000/600,simulation:{meanMs:mean(steps),p95Ms:percentile(steps,.95),p99Ms:percentile(steps,.99)},fourRecipientEncoding:{meanMs:mean(frames),p95Ms:percentile(frames,.95)},wire:{meanBytesPerClientFrame:mean(sizes),p95BytesPerClientFrame:percentile(sizes,.95),estimatedKiBPerClientSecond:mean(sizes)*20/1024},retainedHeapDeltaMiB:(process.memoryUsage().heapUsed-heap)/1048576,retained:{enemies:s.enemies.length,pool:s.enemyPool.length,effects:s.zEffects.length,drops:s.zDrops.length},limits:'CPU measurements are local/CI evidence, not a guarantee of hardware FPS or zero network lag.'};
await mkdir('test-results/zombies',{recursive:true});await writeFile('test-results/zombies/performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
assert.ok(result.simulation.p99Ms<8,'AI must leave ample room in the 16.7 ms server step');assert.ok(result.cpuMsPerSimulatedSecond<200,'one full room must stay inside its conservative server budget');assert.ok(result.retainedHeapDeltaMiB<48,'long-session retained state must remain bounded');assert.ok(result.wire.estimatedKiBPerClientSecond<160,'bounded 20 Hz replication budget');

