import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {architectureMaterial,architectureAtlasMaterial,architectureUV,architectureKit,buildingSurface,ARCHITECTURE_SURFACES} from '../src/architecture-surfaces.js';
import {architectureWindow} from '../src/architecture-art.js';
import {dressBuilding} from '../src/royale-art.js';
import {ROYALE_MAP} from '../src/royale-map.js';

test('all island buildings use bounded PBR dressing without changing their authoritative layout',()=>{
 const snapshot=JSON.stringify({buildings:ROYALE_MAP.buildings,boxes:ROYALE_MAP.boxes,doors:ROYALE_MAP.doors,nav:ROYALE_MAP.navLinks});let total=0;
 for(const b of ROYALE_MAP.buildings){
  const g=new T.Group();dressBuilding(g,b,{});g.updateMatrixWorld(true);let triangles=0;
  for(const m of g.children){assert.ok(m.isMesh&&!m.children.length,b.type+' direct bakeable mesh');assert.ok(m.material.isMeshStandardMaterial,b.type+' PBR');assert.ok(ARCHITECTURE_SURFACES.includes(m.material.userData.architectureSurface));assert.equal(m.material.transparent,false);assert.equal(m.geometry.userData.shared,true);assert.ok(m.matrixWorld.elements.every(Number.isFinite));triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}
  assert.equal(g.userData.architectureRevision,160);assert.ok(triangles<5000,b.type+' dressing triangle budget');total+=triangles;
 }
 assert.ok(total<165000,'61-building close-detail budget');assert.equal(JSON.stringify({buildings:ROYALE_MAP.buildings,boxes:ROYALE_MAP.boxes,doors:ROYALE_MAP.doors,nav:ROYALE_MAP.navLinks}),snapshot);
});

test('window reveals keep the entire authored clear opening free on every facade orientation',()=>{
 for(const axis of ['x','z'])for(const sign of [-1,1]){
  const g=new T.Group();architectureWindow(g,{x:4,y:3,z:8,w:1.1,h:1.05,axis,sign});g.updateMatrixWorld(true);
  for(const u of [-.54,0,.54])for(const v of [-.515,0,.515]){
   const origin=axis==='x'?new T.Vector3(4+sign*3,3+v,8+u):new T.Vector3(4+u,3+v,8+sign*3),direction=axis==='x'?new T.Vector3(-sign,0,0):new T.Vector3(0,0,-sign);
   const ray=new T.Raycaster(origin,direction,0,6);assert.equal(ray.intersectObjects(g.children).length,0,axis+' window opening '+u+','+v);
  }
 }
});

test('metre-scale UVs and compact surface identity survive merging different wall materials',()=>{
 const g=new T.Group(),k=architectureKit(),parts=[];
 for(const [i,kind]of ARCHITECTURE_SURFACES.entries()){
  const m=k.block(g,-10+i*2,2,5,3,4,.35,0xa9b8ba,kind);m.updateMatrix();const p=m.geometry.toNonIndexed();p.applyMatrix4(m.matrix);architectureUV(p,kind);assert.ok(p.attributes.uv.array.some(v=>Math.abs(v)>1),'UVs must repeat, not stretch one tile over a wall');assert.ok(p.attributes.architectureKind.array.every(v=>v===i));assert.ok(p.attributes.architectureKind.array instanceof Uint8Array);parts.push(p);
 }
 const merged=mergeGeometries(parts);assert.ok(merged);assert.equal(merged.attributes.architectureKind.count,merged.attributes.position.count);assert.ok(merged.attributes.uv.array.every(Number.isFinite));
 const material=architectureAtlasMaterial(),shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
 for(const channel of ['map','normalMap','roughnessMap','metalnessMap'])assert.ok(shader.fragmentShader.includes('architectureSample('+channel+','),channel+' samples the material tile');assert.ok(shader.fragmentShader.includes('textureGrad('));assert.ok(shader.vertexShader.includes('vArchitectureKind=architectureKind'));
 assert.equal(material,architectureAtlasMaterial());for(const kind of ARCHITECTURE_SURFACES){const m=architectureMaterial(0xa9b8ba,kind);assert.equal(m,architectureMaterial(0xa9b8ba,kind));for(const name of ['map','normalMap','roughnessMap','metalnessMap'])assert.equal(m[name].userData.shared,true);}
});

test('structural surface classification distinguishes floors, roofs, industrial stairs and masonry',()=>{
 const barn={type:'barn',kind:'farm'},apartment={type:'apartment',kind:'town'},warehouse={type:'warehouse',kind:'factory'},hotel={type:'hotel',kind:'resort'};
 assert.equal(buildingSurface({color:'wall'},barn),'timber');assert.equal(buildingSurface({color:'wall'},apartment),'brick');assert.equal(buildingSurface({color:'floor'},hotel),'tile');assert.equal(buildingSurface({color:'stair'},warehouse),'metal');assert.equal(buildingSurface({color:'foundation'},apartment),'concrete');assert.equal(buildingSurface({kind:'roof-collider'},barn),'roof');
 for(const box of ROYALE_MAP.boxes)if(box.building!==undefined)assert.ok(ARCHITECTURE_SURFACES.includes(buildingSurface(box,ROYALE_MAP.buildings[box.building])));
});
