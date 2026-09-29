import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {makeHumanoid,animateHumanoid} from '../src/humanoid.js';
import {makeBlaster} from '../src/weapons.js';
import {WEAPONS,ROYALE_WEAPONS} from '../src/data.js';
test('conservative skin bounds contain animated standing, crouched, sliding and airborne bodies',()=>{
 const model=makeHumanoid(),mesh=model.userData.human.mesh,vertex=new Vector3();
 assert.equal(mesh.frustumCulled,true);
 for(const state of [{},{crouching:true},{sliding:true},{downed:true},{reviving:true},{grounded:false,flight:'glide'},{grounded:false,flight:'dive'},{health:0}]){
  for(let frame=0;frame<20;frame++)animateHumanoid(model,{health:100,grounded:true,vz:3,...state},1/60,frame/60);
  model.updateMatrixWorld(true);mesh.skeleton.update();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,vertex);assert.ok(mesh.boundingSphere.containsPoint(vertex),'animated vertex inside conservative bounds');}
 }
});
test('repeated weapon creation reuses the exact baked geometry for every firearm',()=>{
 for(const weapon of [...WEAPONS,...ROYALE_WEAPONS]){
  const first=makeBlaster(weapon.id),second=makeBlaster(weapon.id);
  const meshes=model=>model.children.filter(m=>m.isMesh&&!m.userData.ownedMaterial&&m!==model.userData.reloadPart&&m!==model.userData.reloadToken);
  const a=meshes(first),b=meshes(second);assert.equal(a.length,b.length);
  a.forEach((mesh,i)=>assert.equal(mesh.geometry,b[i].geometry));
 }
});
