import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderBudget,shadowAnchor} from '../src/render-budget.js';
import {RemotePoses} from '../src/remote-poses.js';
import {MAPS} from '../src/maps.js';
import {candidates,wallDistance,rayBox,invalidateCollision} from '../src/physics.js';
import {CollisionIndex} from '../src/campaign-layout.js';
import {relayRetryDelay} from '../src/relay-recovery.js';

test('render budget responds to wall time, stabilizes and recovers without oscillating',()=>{
 const budget=new RenderBudget();for(let t=0;t<4000;t+=80)budget.sample(t,{quality:'medium'});
 assert.ok(budget.scale<=.7);assert.equal(budget.pressure,true);assert.equal(budget.shadows,false);
 const floor=budget.scale;budget.sample(12000,{active:false});assert.equal(budget.scale,floor);
 for(let t=12016;t<26000;t+=1000/60)budget.sample(t,{});
 assert.equal(budget.scale,1);assert.equal(budget.pressure,false);assert.equal(budget.shadows,true);
 const thirty=new RenderBudget();for(let t=0;t<15000;t+=1000/30)thirty.sample(t,{limit:30});assert.equal(thirty.scale,1);
});
test('shadow anchor follows distant terrain without quantizing outside its local footprint',()=>{
 for(const p of [{x:158,y:5,z:74},{x:-420,y:35,z:300},{x:0,y:0,z:0}]){const a=shadowAnchor(p);assert.ok(Math.hypot(a.x-p.x,a.z-p.z)<.12);assert.ok(Math.abs(a.y-p.y)<=1);assert.deepEqual(a,shadowAnchor(p));}
});
test('all arena broad phases preserve exact sight hits and nearby collision coverage',()=>{
 let seed=200;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
 for(const map of MAPS){
  for(let i=0;i<300;i++){
   const o={x:(random()-.5)*map.size*2,y:random()*9,z:(random()-.5)*map.size*2},a=random()*Math.PI*2,d={x:Math.cos(a),y:0,z:Math.sin(a)},max=90;
   const expected=map.boxes.reduce((t,b)=>Math.min(t,rayBox(o,d,b,t)),max);
   assert.ok(Math.abs(wallDistance(map,o,d,max)-expected)<1e-8,map.id+' sight mismatch');
   const nearby=new Set(candidates(map,o,null,0,.34));for(const b of map.boxes)if(Math.abs(o.x-b.x)<=b.w/2+.34&&Math.abs(o.z-b.z)<=b.d/2+.34)assert.ok(nearby.has(b));
  }
 }
 const map={...MAPS[0],boxes:MAPS[0].boxes.map(b=>({...b}))},box=map.boxes[0];candidates(map,{x:0,z:0});Object.assign(box,{x:999,z:999});invalidateCollision(map);assert.ok(candidates(map,{x:999,z:999}).includes(box));
 map.boxes=map.boxes.filter(b=>b!==box);assert.ok(!candidates(map,{x:999,z:999}).includes(box));
});
test('campaign spatial cache reuses bucket unions and observes active door changes',()=>{
 const box={x:0,y:0,z:0,sx:2,sy:2,sz:2,active:true},index=new CollisionIndex([box]);const a=index.near(0,0,2);assert.equal(index.near(.1,.1,2),a);box.active=false;assert.equal(a[0].active,false);
 for(let i=0;i<600;i++)index.near(i*8,0);assert.ok(index.queries.size<=256);
});
const actor={id:'remote',health:100,x:0,y:0,z:0,yaw:0,pitch:0,flight:'ground',presentationAt:0};
const state=(time,p)=>({round:1,phase:'playing',time,players:[p]});
test('jitter buffer adapts within bounds and never blends sparse teleports, respawns or seats',()=>{
 const poses=new RemotePoses();let arrival=0;
 for(let i=0;i<50;i++){arrival+=i%5===0?90:20;poses.receive(state(i/30,{...actor,x:i*.1,presentationAt:i/30}),arrival);}
 assert.ok(poses.delay>=.06&&poses.delay<=.16);assert.ok(poses.jitter>0);
 for(const change of [{x:100},{vehicleId:'kestrel',vehicleSeat:0},{vehicleId:'kestrel',vehicleSeat:1},{health:0},{flight:'dive'}]){
  const r=new RemotePoses(),latest={...actor,...change,presentationAt:.1};r.receive(state(0,{...actor}));r.receive(state(.1,latest));assert.deepEqual(r.players(state(.1,latest),null,.15)[0],latest);
 }
 poses.receive(state(0,actor),5000);assert.equal(poses.samples.length,1);assert.equal(poses.delay,.1);
});
test('retry delays are jittered, bounded and grow across repeated failures',()=>{
 assert.equal(relayRetryDelay(0,()=>0),200);assert.equal(relayRetryDelay(0,()=>1),300);assert.equal(relayRetryDelay(99,()=>1),4800);assert.ok(relayRetryDelay(3,()=>.5)>relayRetryDelay(2,()=>.5));
});
