import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ICON_BUNDLE_ITEMS,ICON_BUNDLE_IDS} from '../src/icon-bundle-catalog.js';
import {shopItem,shopOffer,validCosmetic,SHOP_ITEMS,quoteOffer} from '../src/shop-catalog.js';
import {makeShopPickaxe,makeShopBack,makeShopGlider,makeShopTrail} from '../src/shop-models.js';
import {makeIconGear,updateIconGear} from '../src/icon-bundle-models.js';
import {pickaxePose,animatePickaxe} from '../src/pickaxe-animation.js';
import {makeArms} from '../src/arms.js';
import {makeBlaster,disposeBlaster} from '../src/weapons.js';

test('approved equipment is available in the live shop and profiles',()=>{
 assert.equal(ICON_BUNDLE_ITEMS.length,5);assert.equal(new Set(ICON_BUNDLE_ITEMS.map(i=>i.slot)).size,5);
 for(const item of ICON_BUNDLE_ITEMS){assert.equal(shopItem(item.id),item);assert.equal(shopOffer(item.id),item);assert.ok(quoteOffer({owned:[]},item.id).price>0);assert.equal(validCosmetic(item.slot,item.id),item.id);assert.ok(SHOP_ITEMS.includes(item));}
});

test('every native equipment builder creates finite bounded geometry within the render budget',()=>{
 for(const [slot,build]of Object.entries({pickaxe:makeShopPickaxe,backbling:makeShopBack,glider:makeShopGlider,trail:makeShopTrail})){
  const g=build(ICON_BUNDLE_IDS[slot]);g.updateMatrixWorld(true);let triangles=0,meshes=0;
  g.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));});
  assert.ok(triangles>1000&&triangles<65000,slot+' has '+triangles+' triangles');assert.ok(meshes<=19,slot+' uses '+meshes+' meshes');
  assert.ok(new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).length()<7);
 }
});

test('golf swing completes on the existing harvest cadence and both hands stay on the shaft',()=>{
 const id=ICON_BUNDLE_IDS.pickaxe,tool=makeShopPickaxe(id),arms=makeArms('pip',{},true);assert.equal(tool.userData.loftDegrees,60);
 assert.equal(pickaxePose(id,0).style,'golf');assert.deepEqual(pickaxePose(id,.45),pickaxePose(id,-1));assert.ok(pickaxePose(id,.216).offset[2]<-.3);
 for(const firstPerson of [true,false])for(const age of [0,.08,.216,.32,.449,.45]){tool.userData.firstPerson=firstPerson;animatePickaxe(tool,arms,id,age);for(const limb of arms.userData.limbs){const expected=new THREE.Vector3(0,limb.side<0?-.05:-.38,0).applyMatrix4(tool.matrix);assert.ok(limb.hand.position.distanceTo(expected)<1e-8);}}
});

test('glider unrolls and its suspension lines animate without rebuilding geometry',()=>{
 const g=makeIconGear('glider'),wing=g.getObjectByName('icon-wing-left'),cords=g.getObjectByName('icon-cords'),id=cords.geometry.uuid;updateIconGear(g,0,{deploy:0});const folded=wing.rotation.z,first=cords.instanceMatrix.array.slice();updateIconGear(g,1.4,{deploy:1});assert.ok(Math.abs(wing.rotation.z)<Math.abs(folded));assert.notDeepEqual(cords.instanceMatrix.array,first);assert.equal(cords.geometry.uuid,id);assert.ok(cords.instanceMatrix.array.every(Number.isFinite));
});

test('animated copies have independent particle matrices and shader materials but shared static geometry',()=>{
 const a=makeIconGear('trail'),b=makeIconGear('trail'),ad=a.getObjectByName('icon-droplets'),bd=b.getObjectByName('icon-droplets');assert.notEqual(ad.instanceMatrix,bd.instanceMatrix);assert.equal(ad.geometry,bd.geometry);assert.notEqual(a.getObjectByName('icon-slime-0').material,b.getObjectByName('icon-slime-0').material);
 updateIconGear(a,1);const before=ad.instanceMatrix.array.slice();updateIconGear(b,4);assert.deepEqual(ad.instanceMatrix.array,before);assert.notDeepEqual(ad.instanceMatrix.array,bd.instanceMatrix.array);
 for(const time of [0,1,1000,NaN]){updateIconGear(a,time);assert.ok(ad.instanceMatrix.array.every(Number.isFinite));}
});

test('watermelon mapping leaves shared weapon templates and glass intact, and owns its extra UV geometry',()=>{
 const original=makeBlaster('sprinter'),before=[];original.traverse(m=>{if(m.isMesh)before.push({geometry:m.geometry,uv:m.geometry.attributes.uv?.array.slice()});});
 const wrapped=makeBlaster('sprinter',ICON_BUNDLE_IDS.wrap);let owned=0,disposed=0;wrapped.traverse(m=>{if(m.userData.ownedGeometry){owned++;assert.equal(m.geometry.userData.shared,false);assert.ok(!before.some(row=>row.geometry===m.geometry));m.geometry.addEventListener('dispose',()=>disposed++);}if(m.material?.transparent)assert.ok(!m.userData.ownedGeometry);});
 assert.ok(owned>0);for(const row of before)if(row.uv)assert.deepEqual(row.geometry.attributes.uv.array,row.uv);disposeBlaster(wrapped);assert.equal(disposed,owned);
 const again=makeBlaster('sprinter');let n=0;again.traverse(m=>{if(m.isMesh){assert.equal(m.geometry,before[n++].geometry);}});
});
