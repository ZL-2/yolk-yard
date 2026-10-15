import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {ROYALE_MAP} from '../src/royale-map.js';
import {groundAt} from '../src/terrain.js';
import {buildDetailedTerrain,createDetailedOcean,createTerrainSurfaceSampler,updateTerrainEnvironment,terrainDetailDiagnostics,TERRAIN_DETAIL_BUDGET} from '../src/terrain-detail.js';

const originalHeights=ROYALE_MAP.terrain.heights.slice(),world=new T.Group();
world.add(createDetailedOcean(ROYALE_MAP));
for(const _ of buildDetailedTerrain(world,ROYALE_MAP)){}
const terrain=world.children.filter(o=>o.userData.terrainChunk),ocean=world.children.find(o=>o.userData.terrainOcean);

test('detailed earth preserves every collision height and original triangle diagonal',()=>{
 assert.deepEqual(ROYALE_MAP.terrain.heights,originalHeights);
 const t=ROYALE_MAP.terrain;
 for(const mesh of terrain){
  const {position:p}=mesh.geometry.attributes,indices=mesh.geometry.index.array;
  for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-groundAt(ROYALE_MAP,p.getX(i),p.getZ(i)))<.00001);
  for(let i=0;i<indices.length;i+=3){
   const [a,b,c]=[indices[i],indices[i+1],indices[i+2]],x=p.getX(a)*.23+p.getX(b)*.36+p.getX(c)*.41,z=p.getZ(a)*.23+p.getZ(b)*.36+p.getZ(c)*.41,y=p.getY(a)*.23+p.getY(b)*.36+p.getY(c)*.41;
   assert.ok(Math.abs(y-groundAt(ROYALE_MAP,x,z))<.00001);
  }
 }
 assert.equal(terrainDetailDiagnostics(world).triangles,(t.n-1)**2*2);
});

test('chunk-edge normals are globally continuous, finite and smoothly shaded',()=>{
 const seen=new Map();let shared=0;
 for(const mesh of terrain){const {position:p,normal:n}=mesh.geometry.attributes;
  assert.equal(mesh.material.flatShading,false);assert.equal(mesh.userData.keepDynamic,true);
  for(let i=0;i<p.count;i++){
   const key=p.getX(i)+':'+p.getZ(i),normal=[n.getX(i),n.getY(i),n.getZ(i)];
   assert.ok(normal.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...normal)-1)<.000001);
   if(seen.has(key)){assert.deepEqual(normal,seen.get(key));shared++;}else seen.set(key,normal);
  }
 }assert.ok(shared>3000);
});

test('terrain keeps one PBR material, the same draw/triangle budgets and less vertex memory',()=>{
 const d=terrainDetailDiagnostics(world);assert.equal(new Set(terrain.map(m=>m.material)).size,1);assert.equal(terrain[0].material.isMeshStandardMaterial,true);
 assert.equal(d.chunks,64);assert.equal(d.triangles,131072);assert.equal(d.vertices,69696);assert.ok(d.geometryBytes<4000000);assert.ok(d.geometryBytes<d.triangles*3*9*4*.28);
 assert.equal(d.controlBytes,1024*1024*4);assert.equal(d.atlasBytes,768*512*4);
 assert.equal(terrain.filter(m=>m.userData.ownedMaterial).length,1);assert.deepEqual(TERRAIN_DETAIL_BUDGET.atlasSize,[768,512]);
});

test('spatial road sampling excludes building footprints and differentiates paths from pavement',()=>{
 const map={...ROYALE_MAP,roads:[{kind:'road',width:6,points:[[-40,0],[40,0]]},{kind:'path',width:4,points:[[-40,20],[40,20]]}],buildings:[{x:0,z:0,w:8,d:8}]},sample=createTerrainSurfaceSampler(map);
 assert.equal(sample(20,0).road,1);assert.equal(sample(0,0).road,0);assert.equal(sample(20,8).road,0);
 assert.equal(sample(20,20).path,1);assert.equal(sample(20,20).road,0);assert.equal(sample(20,20).grass,0);
 assert.ok(sample(0,0).height===groundAt(map,0,0));
});

test('ocean stays at sea level and animates only uniforms without extra passes or geometry',()=>{
 assert.equal(ocean.position.y,.5);assert.equal(ocean.geometry.index.count/3,2);assert.equal(ocean.userData.keepDynamic,true);assert.equal(ocean.material.transparent,false);
 const position=ocean.geometry.attributes.position.array.slice();updateTerrainEnvironment(world,17.25,'low');
 assert.equal(ocean.material.userData.uniforms.waterTime.value,17.25);assert.equal(ocean.material.userData.uniforms.waterQuality.value,.45);assert.equal(terrain[0].material.userData.uniforms.terrainQuality.value,.45);
 assert.deepEqual(ocean.geometry.attributes.position.array,position);assert.equal(ocean.material.userData.uniforms.waterCoast.value.image.width,256);
 updateTerrainEnvironment(world,NaN,'high');assert.equal(ocean.material.userData.uniforms.waterTime.value,0);assert.equal(terrain[0].material.userData.uniforms.terrainQuality.value,1);
});

test('surface shader hooks match installed Three physical shader and retain light/fog/shadow chunks',()=>{
 for(const material of [terrain[0].material,ocean.material]){
  const shader={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes('modelMatrix*vec4(transformed,1.0)'));
  for(const chunk of ['lights_physical_fragment','lights_fragment_begin','fog_fragment','tonemapping_fragment','colorspace_fragment'])assert.ok(shader.fragmentShader.includes('#include <'+chunk+'>'));
  assert.ok(shader.fragmentShader.includes('roughnessFactor='));assert.ok(shader.fragmentShader.includes('normal='));
 }
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};terrain[0].material.onBeforeCompile(shader);
 assert.ok(shader.fragmentShader.includes('textureGrad(terrainAtlas'));assert.ok(shader.uniforms.terrainControl.value.isDataTexture);
});

test('owned material disposal releases only per-world maps, preserving the shared detail atlas',()=>{
 const material=terrain[0].material,uniforms=material.userData.uniforms;let owned=0,shared=0;
 uniforms.terrainControl.value.addEventListener('dispose',()=>owned++);uniforms.terrainAtlas.value.addEventListener('dispose',()=>shared++);material.dispose();
 assert.equal(owned,1);assert.equal(shared,0);assert.equal(uniforms.terrainAtlas.value.userData.shared,true);
});
