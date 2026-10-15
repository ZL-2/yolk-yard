import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {environmentTree,environmentTreeDiagnostics} from '../src/environment-trees.js';

const species=['oak','pine','palm','autumn','orchard'];
function tree(kind,detail=true,seed=0){return environmentTree(new T.Group(),{x:0,y:0,z:0,h:10,kind,seed},detail);}
function triangles(g){return g.children.reduce((sum,m)=>sum+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);}
const signature=g=>createHash('sha256').update(Buffer.from(g.children[1].geometry.attributes.position.array.buffer)).digest('hex');

test('all vegetation species have opaque two-draw PBR near/far models within triangle budgets',()=>{
 for(const kind of species)for(const detail of [true,false])for(let seed=0;seed<8;seed++){
  const m=tree(kind,detail,seed);assert.equal(m.children.length,2);assert.ok(triangles(m)<=(detail?2000:350),kind+' triangle budget');
  for(const part of m.children){
   assert.equal(part.isMesh,true);assert.equal(part.geometry.userData.shared,true);assert.equal(part.geometry.userData.environmentAtlas,true);assert.equal(part.material.isMeshStandardMaterial,true);assert.equal(part.material.transparent,false);assert.equal(part.material.userData.shared,true);assert.equal(part.userData.artRevision,159);
   assert.equal(part.geometry.attributes.position.count,part.geometry.attributes.normal.count);assert.equal(part.geometry.attributes.position.count,part.geometry.attributes.uv.count);assert.equal(part.geometry.attributes.position.count,part.geometry.attributes.color.count);
   for(const key of ['position','normal','uv','color'])assert.ok(part.geometry.attributes[key].array.every(Number.isFinite),kind+' '+key);
   assert.ok(Number.isFinite(part.geometry.boundingSphere.radius));assert.ok(part.geometry.boundingSphere.radius>0);
  }
  assert.equal(m.children[0].material.userData.environmentFoliage,false);assert.equal(m.children[1].material.userData.environmentFoliage,true);assert.equal(m.children[1].material.side,T.DoubleSide);
 }
});

test('tree geometry and materials are shared and bounded across every position and seed',()=>{
 for(const kind of species)for(const detail of [true,false]){
  const first=tree(kind,detail,3),second=tree(kind,detail,3+8*100);
  for(let i=0;i<2;i++){assert.equal(first.children[i].geometry,second.children[i].geometry);assert.equal(first.children[i].material,second.children[i].material);}
  assert.equal(new Set(Array.from({length:8},(_,seed)=>signature(tree(kind,detail,seed)))).size,8);
 }
 const d=environmentTreeDiagnostics();assert.equal(d.meshesPerTree,2);assert.equal(d.assemblies,80);assert.equal(d.maxAssemblies,80);
});

test('tree placement, vertical scale, and collision descriptor remain untouched',()=>{
 for(const kind of species){
  const descriptor={x:147,y:12.5,z:-83,h:6,kind,seed:2,objectId:'existing-tree-collider'},copy={...descriptor},g=new T.Group();environmentTree(g,descriptor,true);
  assert.deepEqual(descriptor,copy);for(const m of g.children){assert.deepEqual(m.position.toArray(),[147,12.5,-83]);assert.deepEqual(m.scale.toArray(),[1,.6,1]);assert.equal(m.userData.objectId,undefined);}
  const near=tree(kind,true,0),far=tree(kind,false,0),nb=new T.Box3().setFromObject(near),fb=new T.Box3().setFromObject(far),ns=nb.getSize(new T.Vector3()),fs=fb.getSize(new T.Vector3());
  assert.ok(nb.min.y>=-.05&&fb.min.y>=-.05,kind+' ground');assert.ok(nb.max.y<=10.5&&fb.max.y<=10.5,kind+' height');assert.ok(ns.x<9&&ns.z<9&&fs.x<9&&fs.z<9,kind+' original crown envelope');
  for(const axis of ['x','y','z'])assert.ok(Math.abs(ns[axis]-fs[axis])<2,kind+' coherent distant silhouette '+axis);
 }
});

test('bark has outward-facing triangles and foliage is geometrically creased',()=>{
 for(const kind of species){
  const g=tree(kind),bark=g.children[0].geometry,p=bark.attributes.position,n=bark.attributes.normal;
  // Side rings are authored with smooth outward normals, not inside-out culling.
  const a=new T.Vector3().fromBufferAttribute(p,0),b=new T.Vector3().fromBufferAttribute(p,1),c=new T.Vector3().fromBufferAttribute(p,2),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize(),authored=new T.Vector3().fromBufferAttribute(n,0);
  assert.ok(normal.dot(authored)>.5,kind+' trunk winding');
  const leafNormals=g.children[1].geometry.attributes.normal,unique=new Set();for(let i=0;i<leafNormals.count;i++)unique.add([leafNormals.getX(i),leafNormals.getY(i),leafNormals.getZ(i)].map(v=>v.toFixed(2)).join(','));assert.ok(unique.size>40,kind+' leaf volume');
 }
});
