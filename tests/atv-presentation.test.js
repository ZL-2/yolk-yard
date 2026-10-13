import test from 'node:test';
import assert from 'node:assert/strict';
import {makeATV,atvModelBudget} from '../src/atv-model.js';
import {animateATV,vehicleDetail} from '../src/vehicle-view.js';

test('ATV geometry keeps a bounded close-up, medium and distant rendering budget',()=>{
 let previous=0;
 for(const detail of [0,1,2]){
  const m=makeATV({detail}),budget=atvModelBudget(m);
  assert.ok(budget.triangles>previous);previous=budget.triangles;
  assert.ok(budget.triangles<=[7000,15000,33000][detail]);assert.ok(budget.meshes<=[18,30,34][detail]);
  for(let i=0;i<4;i++)assert.ok(m.getObjectByName('atv-wheel-'+i)?.getObjectByName('atv-spin'));
  m.traverse(o=>{if(o.isMesh){for(const name of ['position','normal'])assert.ok([...o.geometry.attributes[name].array].every(Number.isFinite));assert.ok(o.geometry.userData.shared);}});
  assert.ok(m.getObjectByName('atv-body').children.some(o=>o.material.isMeshPhysicalMaterial&&o.material.clearcoat===1));
 }
});
test('wheel spin is independent of front steering, suspension is bounded, and airborne contact shadow clears',()=>{
 const m=makeATV(),v={speed:12,steering:1,grounded:true,boosting:true,pitch:0,roll:0};
 for(let i=0;i<30;i++)animateATV(m,v,i/60,1/60);
 const wheels=m.userData.wheels;
 assert.notEqual(wheels[0].getObjectByName('atv-spin').rotation.x,0);assert.notEqual(wheels[0].rotation.y,0);assert.equal(wheels[2].rotation.y,0);
 assert.ok(wheels.every(w=>Math.abs(w.position.y-.53)<=.02));assert.equal(m.userData.boost.visible,true);
 animateATV(m,{...v,speed:0,steering:0,grounded:false,boosting:false},1,1/60);
 assert.equal(m.userData.shadow.visible,false);assert.equal(m.userData.boost.visible,false);assert.ok(m.userData.springs.every(s=>s.scale.y>0));
});
test('distance hysteresis preserves stable LOD selection and lower-quality detail',()=>{
 assert.equal(vehicleDetail(0,'high'),2);assert.equal(vehicleDetail(0,'low'),1);
 assert.equal(vehicleDetail(45,'high',2),2);assert.equal(vehicleDetail(49,'high',2),1);
 assert.equal(vehicleDetail(90,'high',0),0);assert.equal(vehicleDetail(85,'high',0),1);assert.equal(vehicleDetail(100,'high',1),0);
});
