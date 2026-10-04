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

test('warmup construction preserves the full island and departure adopts prepared geometry',async()=>{
 const THREE=await import('three'),{View}=await import('../src/view.js');
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({strokeText(){},fillText(){}})})};
 try{
  const make=()=>Object.assign(Object.create(View.prototype),{world:new THREE.Group(),scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),scopeCamera:new THREE.PerspectiveCamera(),pickupMeshes:new Map(),renderer:{compileAsync:async()=>{}}});
  const direct=make();
  const prepared=make();let batches=0;
  while(!prepared.preparedBattle?.done){prepared.prepareBattleMap();assert.ok(++batches<3000);}
  assert.ok(batches>1,'construction yields across frames');
  const meshes=prepared.preparedBattle.group.children.slice();
  const {applyBuildState}=await import('../src/building.js'),{getMap}=await import('../src/maps.js');
  applyBuildState(getMap('sunnybreak'),{matchId:'transition-test',round:1,builds:[],worldDamage:{}});
  direct.loadMap('sunnybreak');prepared.loadMap('sunnybreak');
  let identified=0;prepared.world.traverse(mesh=>{if(mesh.userData.objectRanges?.some(range=>range.id))identified++;});assert.ok(identified>0,'prepared streamed scenery has destruction IDs');
  assert.equal(prepared.preparedBattle,null);assert.equal(prepared.world.children.length,direct.world.children.length);
  meshes.forEach(mesh=>assert.equal(mesh.parent,prepared.world));
  const collect=world=>{const result=[];world.traverse(mesh=>{if(mesh.isMesh)result.push(mesh);});return result;},a=collect(direct.world),b=collect(prepared.world);assert.equal(a.length,b.length);
  for(let i=0;i<a.length;i++){
   assert.deepEqual(a[i].position.toArray(),b[i].position.toArray());assert.deepEqual(a[i].userData.objectRanges,b[i].userData.objectRanges);
   for(const key of ['position','color'])assert.deepEqual(a[i].geometry?.attributes[key]?.array,b[i].geometry?.attributes[key]?.array);
  }

 }finally{globalThis.document=previous;}
});
