import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {rng} from '../src/data.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {groundAt} from '../src/terrain.js';
import {resetStance} from '../src/stance.js';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),reference=process.env.PERFORMANCE_BASELINE;
const current=await import('../src/physics.js'),baseline=reference?await import(pathToFileURL(resolve(reference,'src/physics.js'))):null;
const random=rng(142),rays=Array.from({length:8000},(_,i)=>{
 const yaw=random()*Math.PI*2,pitch=(random()-.5)*.5,p={x:0,y:0,z:0,yaw:random()*Math.PI*2,vx:random()*6,vz:random()*6,health:100,...[{}, {crouching:true},{crouching:true,lowCrouch:true},{sliding:true},{downed:true},{flight:'glide'},{flight:'dive'}][i%7]};
 const o={x:(random()-.5)*3,y:random()*2,z:-2-random()*4};
 return {p,o,d:{x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)},radius:i%3===0?.05:0};
});
const world=rays.map(({o,d},i)=>({o:{x:o.x*70,y:2+i%20,z:o.z*30},d,max:20+i%100}));
const starts=[];
for(let attempt=0;starts.length<64&&attempt<2000;attempt++){
 const x=(random()-.5)*400,z=(random()-.5)*400,p={x,y:groundAt(ROYALE_MAP,x,z),z,yaw:random()*Math.PI*2,pitch:0,health:100,grounded:true,flight:'ground',vy:0,vx:0,vz:0,inventory:[{id:'sprinter',weapon:true,rarity:2}],slot:0};
 resetStance(p);if(current.canStand(ROYALE_MAP,p))starts.push(p);
}
assert.equal(starts.length,64);
function movement(api,{slides=true}={}){
 const players=starts.map(p=>structuredClone(p));
 for(let tick=0;tick<180;tick++)for(let i=0;i<players.length;i++){
  const p=players[i],x=p.x,z=p.z,dt=tick%20===0?1/30:1/60;
  api.movePlayer(p,{yaw:starts[i].yaw+tick*.004,forward:1,strafe:i%3-1,sprint:i%4===0,crouch:slides&&tick>80&&i%2===0,aim:i%5===0},ROYALE_MAP,dt);p.vx=(p.x-x)/dt;p.vz=(p.z-z)/dt;
 }return players;
}
if(baseline)for(const q of rays){const a=current.humanHit(q.o,q.d,q.p,q.radius),b=baseline.humanHit(q.o,q.d,q.p,q.radius);assert.equal(a.region,b.region);assert.ok(a.distance===b.distance||Math.abs(a.distance-b.distance)<1e-10);}
if(baseline)for(const q of world){const a=current.worldHit(ROYALE_MAP,q.o,q.d,q.max,.04),b=baseline.worldHit(ROYALE_MAP,q.o,q.d,q.max,.04);assert.equal(!!a,!!b);if(a){assert.ok(Math.abs(a.distance-b.distance)<1e-9);for(const axis of ['x','y','z'])assert.ok(Math.abs(a.normal[axis]-b.normal[axis])<1e-9);}}
// Uphill slide behavior deliberately changed in 145. Keep exact ordinary
// contact equivalence; include both engines' slides in the timed workload.
// The new uphill stop/direction rule has its own focused gameplay regression.
if(baseline){const a=movement(current,{slides:false}),b=movement(baseline,{slides:false});for(let i=0;i<a.length;i++){for(const key of ['x','y','z','vx','vy','vz','stamina'])assert.ok(Math.abs(a[i][key]-b[i][key])<1e-9,`movement contact mismatch: ${i} ${key}`);for(const key of ['grounded','crouching','lowCrouch','sliding'])assert.equal(a[i][key],b[i][key]);}}
let checksum=0;
const workloads={hitboxes:api=>{for(let repeat=0;repeat<3;repeat++)for(const q of rays){const hit=api.humanHit(q.o,q.d,q.p,q.radius);if(Number.isFinite(hit.distance))checksum+=hit.distance;}},collision:api=>{for(const q of world)checksum+=api.wallDistance(ROYALE_MAP,q.o,q.d,q.max);},projectiles:api=>{for(const q of world){const hit=api.worldHit(ROYALE_MAP,q.o,q.d,q.max,.04);if(hit)checksum+=hit.distance;}}};
workloads.movement=api=>{for(const p of movement(api))checksum+=p.x+p.y+p.z;};
const report={baseline:reference||null,workloads:{},note:'Median of seven alternating warm samples; wall-clock CPU workload, not device-wide FPS or network latency.'};
for(const [name,run]of Object.entries(workloads)){
 run(current);if(baseline)run(baseline);const samples={current:[],baseline:[]};
 for(let trial=0;trial<7;trial++)for(const [label,api]of trial%2?[['baseline',baseline],['current',current]]:[['current',current],['baseline',baseline]])if(api){const start=performance.now();run(api);samples[label].push(performance.now()-start);}
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)],now=median(samples.current),before=baseline?median(samples.baseline):null;
 report.workloads[name]={currentMs:now,baselineMs:before,reductionPercent:before?Math.round((1-now/before)*1000)/10:null,samples};
}
assert.ok(Number.isFinite(checksum));mkdirSync('test-results/expansion',{recursive:true});writeFileSync('test-results/expansion/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
for(const [name,row]of Object.entries(report.workloads))if(row.baselineMs)assert.ok(row.currentMs<=row.baselineMs*1.1,`${name} regression: ${row.currentMs.toFixed(2)} vs ${row.baselineMs.toFixed(2)} ms (10% noise guard)`);
