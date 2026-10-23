import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SHOP_ITEMS} from '../src/shop-catalog.js';
import {pickaxeStyle,pickaxePose,animatePickaxe} from '../src/pickaxe-animation.js';
import {makeShopPickaxe} from '../src/shop-models.js';
import {makeArms} from '../src/arms.js';

test('a model-only or malformed cosmetic falls back without stopping gameplay',()=>{
 const item=SHOP_ITEMS.find(i=>i.slot==='pickaxe'),shape=item.shape,swingStyle=item.swingStyle;
 try{
  delete item.shape;item.swingStyle='unrecognized';
  assert.deepEqual(pickaxePose(item.id,.216),pickaxePose('',.216));
  item.shape=-1;assert.equal(pickaxeStyle(item.id),'classic');
 }finally{item.shape=shape;if(swingStyle===undefined)delete item.swingStyle;else item.swingStyle=swingStyle;}
});

test('every tool has a shape family, forward strike and seamless recovery',()=>{
 const items=SHOP_ITEMS.filter(i=>i.slot==='pickaxe');
 assert.equal(new Set(items.map(i=>pickaxeStyle(i.id))).size,6);
 for(const id of ['','unknown-pickaxe','outfit-starbound',...items.map(i=>i.id)]){
  const idle=pickaxePose(id,-1),hit=pickaxePose(id,.216);
  assert.equal(typeof idle.style,'string',id+' has a resolved animation');
  assert.ok([...idle.rotation,...idle.offset,...hit.rotation,...hit.offset].every(Number.isFinite),id+' has finite poses');
  assert.ok(hit.offset[2]<-.2);
  assert.deepEqual(pickaxePose(id,.45),idle);
  const last=pickaxePose(id,.44999);
  last.rotation.forEach((v,i)=>assert.ok(Math.abs(v-idle.rotation[i])<.001));
 }
 assert.equal(new Set(items.slice(0,6).map(i=>JSON.stringify(pickaxePose(i.id,.1)))).size,6);
});
test('both hands stay on the moving shaft throughout every swing family',()=>{
 const arms=makeArms('pip',{},true);
 for(const item of SHOP_ITEMS.filter(i=>i.slot==='pickaxe')){
  const tool=makeShopPickaxe(item.id);
  for(const firstPerson of [false,true])for(const age of [-1,0,.08,.216,.28,.4,.45]){
   tool.userData.firstPerson=firstPerson;
   animatePickaxe(tool,arms,item.id,age);
   for(const limb of arms.userData.limbs){
    const expected=new THREE.Vector3(0,limb.side<0?-.05:-.38,0).applyMatrix4(tool.matrix);
    assert.ok(limb.hand.position.distanceTo(expected)<1e-8);
    assert.ok(limb.hand.quaternion.toArray().every(Number.isFinite));
   }
  }
 }
});
