import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3} from 'three';
import {makeKestrel,createKestrel,animateKestrel,kestrelModelBudget} from '../src/kestrel-model.js';
test('the artwork-matched twin tiltrotor has bounded detailed and low-graphics meshes',()=>{
 for(const detail of [1,2]){
  const m=makeKestrel({detail}),budget=kestrelModelBudget(m);assert.ok(budget.triangles<=(detail===2?21000:8500));assert.ok(budget.meshes<=38);assert.equal(m.userData.artRevision,154);
  for(let i=0;i<2;i++)assert.ok(m.getObjectByName('kestrel-engine-'+i)?.getObjectByName('kestrel-rotor-'+i));assert.equal(m.getObjectByName('kestrel-engine-2'),undefined);
  m.traverse(o=>{if(o.isMesh){assert.ok(o.geometry.userData.shared);for(const name of ['position','normal','uv'])assert.ok([...o.geometry.attributes[name].array].every(Number.isFinite));}});
  assert.ok(m.getObjectByName('kestrel-cargo-door'));assert.ok(m.children[0].children.some(o=>o.material.isMeshPhysicalMaterial&&o.material.map));
 }
});
test('three landing wheels meet the existing airfield height, then fold upward in flight',()=>{
 const m=makeKestrel();animateKestrel(m,{parked:true,time:0,elapsed:0},1/60);
 for(let i=0;i<3;i++)assert.ok(Math.abs(new Box3().setFromObject(m.getObjectByName('kestrel-gear-'+i)).min.y+1.48)<.012);
 for(let i=0;i<120;i++)animateKestrel(m,{parked:false,time:10+i/60,elapsed:10+i/60},1/60);
 for(let i=0;i<3;i++)assert.ok(new Box3().setFromObject(m.getObjectByName('kestrel-gear-'+i)).min.y> -1.3);
 assert.equal(m.getObjectByName('kestrel-contact-shadow').visible,false);
 animateKestrel(m,{parked:true,time:20,elapsed:0},1/60);assert.equal(m.getObjectByName('kestrel-gear-0').rotation.z,0);assert.equal(m.getObjectByName('kestrel-contact-shadow').visible,true);
});
test('flight visuals counter-rotate two rotors, tilt engines and never move the route anchor',()=>{
 const m=makeKestrel();m.position.set(20,110,-80);const anchor=m.position.toArray();
 animateKestrel(m,{parked:false,time:9,elapsed:9},1/60);assert.deepEqual(m.position.toArray(),anchor);
 const a=m.getObjectByName('kestrel-rotor-0').rotation.y,b=m.getObjectByName('kestrel-rotor-1').rotation.y;assert.notEqual(a,0);assert.ok(Math.abs(a+b)<1e-9);
 assert.ok(m.getObjectByName('kestrel-engine-0').rotation.x<-.5);assert.equal(m.getObjectByName('kestrel-blur-0').visible,true);
 animateKestrel(m,{parked:true,time:10,elapsed:0},1/60);assert.equal(m.getObjectByName('kestrel-blur-0').visible,false);assert.equal(m.getObjectByName('kestrel-engine-0').rotation.x,0);
});
test('cached aircraft clones share geometry without sharing the flashing beacon material',()=>{
 const a=createKestrel(undefined,2),b=createKestrel(undefined,2);assert.equal(a.children[0].children[0].geometry,b.children[0].children[0].geometry);
 const am=a.getObjectByName('kestrel-beacon').material,bm=b.getObjectByName('kestrel-beacon').material;assert.notEqual(am,bm);am.emissiveIntensity=10;assert.notEqual(bm.emissiveIntensity,10);
});
