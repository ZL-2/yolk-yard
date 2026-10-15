import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {detailEnvironmentProp,ENVIRONMENT_PROP_KINDS} from '../src/environment-props.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {SPAWN_ISLAND} from '../src/spawn-island.js';

function model(p,detail=true){const g=new T.Group();assert.equal(detailEnvironmentProp(g,p,{},detail),true,p.kind);return g;}
function triangles(g){return g.children.reduce((sum,m)=>sum+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);}
test('all authored environment props have finite direct PBR shells within their triangle budgets',()=>{
 const props=[...ROYALE_MAP.props,...SPAWN_ISLAND.props],covered=new Set();let total=0;
 for(const p of props){const before=JSON.stringify(p),g=model(p);covered.add(p.kind);assert.equal(JSON.stringify(p),before,'visual model must not mutate authoritative '+p.kind);
  assert.ok(g.children.length>0&&g.children.length<100,p.kind);assert.ok(triangles(g)<4000,p.kind+' triangle budget');total+=triangles(g);
  for(const m of g.children){assert.ok(m.isMesh&&m.children.length===0,p.kind+' direct mesh');assert.ok(m.material.isMeshStandardMaterial,p.kind+' PBR');assert.ok(m.material.userData.environmentSurface,p.kind+' typed surface');assert.equal(m.userData.environmentRevision,159);for(const key of ['position','normal','uv'])assert.ok(m.geometry.attributes[key]?.array.every(Number.isFinite),p.kind+' finite '+key);assert.ok(m.geometry.userData.shared,p.kind+' shared geometry');}
  g.updateMatrixWorld(true);assert.ok(g.children.every(m=>m.matrixWorld.elements.every(Number.isFinite)),p.kind+' transforms');
 }
 assert.ok(covered.size>=40);assert.ok(total<400000,'entire island prop triangle budget');
});
test('unsupported building kinds leave the original rendering path untouched',()=>{
 const g=new T.Group(),existing=new T.Object3D();g.add(existing);assert.equal(detailEnvironmentProp(g,{kind:'building',w:5,h:8,d:5},{}),false);assert.deepEqual(g.children,[existing]);
});
test('distance variants remain cheaper, deterministic and reuse surface geometry',()=>{
 for(const kind of ENVIRONMENT_PROP_KINDS){const p={kind,x:3,y:2,z:-7,w:3,h:3,d:4,seed:3},full=model(p),far=model(p,false),copy=model(p);assert.ok(triangles(far)<=triangles(full),kind+' distant budget');assert.equal(full.children.length,copy.children.length);for(let i=0;i<full.children.length;i++){assert.equal(full.children[i].geometry,copy.children[i].geometry,kind+' shared template');assert.equal(full.children[i].material,copy.children[i].material,kind+' shared material');}}
});
