import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {rng} from '../src/data.js';
import {ROYALE_MAP} from '../src/royale-map.js';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),reference=process.env.PERFORMANCE_BASELINE;
const current=await import('../src/physics.js'),baseline=reference?await import(pathToFileURL(resolve(reference,'src/physics.js'))):null;
const random=rng(142),rays=Array.from({length:8000},(_,i)=>{
 const yaw=random()*Math.PI*2,pitch=(random()-.5)*.5,p={x:0,y:0,z:0,yaw:random()*Math.PI*2,vx:random()*6,vz:random()*6,health:100,...[{}, {crouching:true},{crouching:true,lowCrouch:true},{sliding:true},{downed:true},{flight:'glide'},{flight:'dive'}][i%7]};
 const o={x:(random()-.5)*3,y:random()*2,z:-2-random()*4};
 return {p,o,d:{x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)},radius:i%3===0?.05:0};
});
const world=rays.map(({o,d},i)=>({o:{x:o.x*70,y:2+i%20,z:o.z*30},d,max:20+i%100}));
if(baseline)for(const q of rays){const a=current.humanHit(q.o,q.d,q.p,q.radius),b=baseline.humanHit(q.o,q.d,q.p,q.radius);assert.equal(a.region,b.region);assert.ok(a.distance===b.distance||Math.abs(a.distance-b.distance)<1e-10);}
let checksum=0;
const workloads={hitboxes:api=>{for(let repeat=0;repeat<3;repeat++)for(const q of rays){const hit=api.humanHit(q.o,q.d,q.p,q.radius);if(Number.isFinite(hit.distance))checksum+=hit.distance;}},collision:api=>{for(const q of world)checksum+=api.wallDistance(ROYALE_MAP,q.o,q.d,q.max);},projectiles:api=>{for(const q of world){const hit=api.worldHit(ROYALE_MAP,q.o,q.d,q.max,.04);if(hit)checksum+=hit.distance;}}};
const report={baseline:reference||null,workloads:{},note:'Median of seven alternating warm samples; wall-clock CPU workload, not device-wide FPS or network latency.'};
for(const [name,run]of Object.entries(workloads)){
 run(current);if(baseline)run(baseline);const samples={current:[],baseline:[]};
 for(let trial=0;trial<7;trial++)for(const [label,api]of trial%2?[['baseline',baseline],['current',current]]:[['current',current],['baseline',baseline]])if(api){const start=performance.now();run(api);samples[label].push(performance.now()-start);}
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)],now=median(samples.current),before=baseline?median(samples.baseline):null;
 report.workloads[name]={currentMs:now,baselineMs:before,reductionPercent:before?Math.round((1-now/before)*1000)/10:null,samples};
 if(before)assert.ok(now<=before*1.1,`${name} regression: ${now.toFixed(2)} vs ${before.toFixed(2)} ms (10% noise guard)`);
}
assert.ok(Number.isFinite(checksum));mkdirSync('test-results/expansion',{recursive:true});writeFileSync('test-results/expansion/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
