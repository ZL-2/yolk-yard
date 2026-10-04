// Fixed workloads isolate shared-system gains from different bot survival/AI.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {rng} from '../src/data.js';
import {ROYALE_MAP} from '../src/royale-map.js';
const root=resolve(new URL('..',import.meta.url).pathname),baseline=process.env.PERFORMANCE_BASELINE;
const random=rng(751),queries=Array.from({length:12000},()=>({o:{x:(random()-.5)*480,y:2+random()*22,z:(random()-.5)*480},d:{x:0,y:0,z:0},max:4+random()*90}));for(const q of queries){const a=random()*Math.PI*2,p=(random()-.5)*.35;q.d={x:Math.sin(a)*Math.cos(p),y:Math.sin(p),z:Math.cos(a)*Math.cos(p)};}
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
function time(fn,n){const samples=[];for(let trial=0;trial<4;trial++){const start=performance.now();for(let i=0;i<n;i++)fn(i);if(trial)samples.push(performance.now()-start);}return median(samples);}
async function measure(dir){
 const load=p=>import(pathToFileURL(resolve(dir,p)).href),[{wallDistance,canStand},{RoyaleSimulation},{RoyaleView}]=await Promise.all([load('src/physics.js'),load('src/royale.js'),load('src/royale-view.js')]);let checksum=0;
 const collisionsMs=time(i=>{const q=queries[i];checksum+=wallDistance(ROYALE_MAP,q.o,q.d,q.max);checksum+=canStand(ROYALE_MAP,q.o)?1:0;},queries.length);
 const s=new RoyaleSimulation({mode:'royale',capacity:48,bots:47,fill:true,seed:821}),p=s.addPlayer('host',{name:'Performance'});s.startRound();s.beginBattle();
 const snapshotsMs=time(()=>{const state=s.snapshot();checksum+=state.royale.loot.length+state.players.length;},1200);
 const materials=new Map(),kit={mat:c=>{if(!materials.has(c))materials.set(c,new THREE.MeshLambertMaterial({color:c}));return materials.get(c);},block:(g,x,y,z,w,h,d,c)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),kit.mat(c));m.position.set(x,y,z);g.add(m);return m;},ball:(g,x,y,z,w,h,d,c)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),kit.mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);g.add(m);return m;},cylinder:(g,x,y,z,r,h,c)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),kit.mat(c));m.position.set(x,y,z);g.add(m);return m;}},view=Object.assign(Object.create(RoyaleView.prototype),{kit});
 const lootModelsMs=time(()=>{const g=view.itemModel({id:'mini',rarity:1,count:3});checksum+=g.children.length;g.traverse(m=>{if(m.geometry&&!m.geometry.userData.shared)m.geometry.dispose();if(m.userData.ownedMaterial)m.material.dispose();});},250);
 assert.ok(Number.isFinite(checksum));return {collisionsMs,snapshotsMs,lootModelsMs,queries:queries.length,snapshots:1200,lootModels:250,actors:s.players.size,loot:s.loot.length};
}
const report={current:await measure(root)};if(baseline){report.baseline=await measure(resolve(baseline));report.reduction={};for(const key of ['collisionsMs','snapshotsMs','lootModelsMs'])report.reduction[key]=Math.round((1-report.current[key]/report.baseline[key])*1000)/10;assert.ok(report.current.collisionsMs<report.baseline.collisionsMs*.8,'collision CPU should improve at least 20%');assert.ok(report.current.lootModelsMs<report.baseline.lootModelsMs*.7,'repeated loot model CPU should improve at least 30%');}
mkdirSync('test-results/field-polish',{recursive:true});writeFileSync('test-results/field-polish/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
