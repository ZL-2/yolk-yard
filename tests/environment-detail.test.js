import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {environmentKit,environmentMaterial,environmentUV,environmentAtlasMaterial,packEnvironmentGeometry,unpackEnvironmentGeometry,environmentSurfaceDiagnostics} from '../src/environment-surfaces.js';
import {environmentTree} from '../src/environment-trees.js';
import {detailEnvironmentProp} from '../src/environment-props.js';
import {EnvironmentGroundCover,GROUND_COVER_BUDGET} from '../src/environment-groundcover.js';
import {bake} from '../src/royale-view.js';
import {bakeObject,disposeMapGroup} from '../src/map-object-view.js';
import {updateWorldDamage} from '../src/damage-visuals.js';

test('compact environment buffers preserve positions and bounded UV/color/normal accuracy',()=>{
 const g=new T.BoxGeometry().toNonIndexed();environmentUV(g,'wood');g.setAttribute('color',new T.Float32BufferAttribute(Array(g.attributes.position.count*3).fill(.64),3));
 const original=g.clone(),bytes=Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0);packEnvironmentGeometry(g);
 assert.deepEqual(g.attributes.position.array,original.attributes.position.array);assert.ok(g.attributes.color.normalized&&g.attributes.normal.normalized&&g.attributes.uv.normalized);
 assert.ok(Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)<bytes*.60);
 for(const name of ['uv','color','normal'])for(let i=0;i<g.attributes[name].count;i++)for(let k=0;k<g.attributes[name].itemSize;k++)assert.ok(Math.abs(g.attributes[name].getComponent(i,k)-original.attributes[name].getComponent(i,k))<.004);
 unpackEnvironmentGeometry(g);for(const name of ['uv','color','normal'])assert.ok(g.attributes[name].array instanceof Float32Array);
});
test('environment survives repeated world/editor baking with destruction IDs and textures intact',()=>{
 const kit=environmentKit(),world=new T.Group();environmentTree(world,{x:2,y:0,z:2,h:9,kind:'oak',seed:7});for(const m of world.children)m.userData.objectId='tree';const start=world.children.length;detailEnvironmentProp(world,{kind:'car',x:6,y:0,z:2,w:2.3,h:1.8,d:4.7,seed:3},kit);for(const m of world.children.slice(start))m.userData.objectId='car';
 bake(world,false,true);assert.ok(world.children.length<=2);for(const m of world.children){assert.ok(m.material.isMeshStandardMaterial&&m.material.map&&m.geometry.attributes.uv);assert.ok(m.geometry.userData.compactStatic);}
 // Re-bake compact cached sources alongside fresh Float32 geometry.
 detailEnvironmentProp(world,{kind:'rock',x:-2,y:0,z:2,w:2,h:2,d:2,seed:1},kit);bakeObject(world);assert.ok(world.children.length<=2);
 // A fresh tree is directly tagged as by the actual cell generator.
 const tree=new T.Group();environmentTree(tree,{x:2,y:0,z:2,h:9,kind:'oak',seed:7});for(const m of tree.children)m.userData.objectId='tree';bake(tree,false,true);
 const before=tree.children.map(m=>m.geometry.attributes.position.array.slice());updateWorldDamage(tree,{tree:{destroyed:true}},'destroy');for(const m of tree.children)assert.ok(m.geometry.attributes.position.array.every(v=>v===0));updateWorldDamage(tree,{},'reset');tree.children.forEach((m,i)=>assert.deepEqual(m.geometry.attributes.position.array,before[i]));
});
test('ground cover is bounded, collision-free, deterministic, short and releases buffers on travel',()=>{
 const n=129,map={id:'detail-test',terrain:{n,cell:2,size:128,heights:new Float32Array(n*n).fill(5),max:5},buildings:[{x:8,z:8,w:8,d:8}],boxes:[],roads:[{width:5,points:[[-128,0],[128,0]]}]},world=new T.Group(),cover=new EnvironmentGroundCover(world,map),p={x:10,y:5,z:12};
 for(let i=0;i<40;i++)cover.update(p,{quality:'high',time:i/60});let d=cover.diagnostics();assert.ok(d.cells<=16&&d.draws<=32&&d.instances>0&&d.instances<=16*152);
 const matrix=new T.Matrix4(),pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();
 for(const cell of cover.cells.values())for(const m of cell.group.children)for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);matrix.decompose(pos,q,scale);const x=pos.x+cell.group.position.x,z=pos.z+cell.group.position.z;assert.ok(Math.abs(z)>2.5,'roads remain clear');assert.ok(Math.abs(x-8)>5||Math.abs(z-8)>5,'buildings remain clear');if(m.name==='grass')assert.ok(.32*scale.y<=GROUND_COVER_BUDGET.maxHeight);}
 const first=cover.cells.values().next().value;let disposed=0;for(const m of first.group.children)m.addEventListener('dispose',()=>disposed++);for(let i=0;i<40;i++)cover.update({x:-110,y:5,z:-110},{quality:'low',time:2+i/60});assert.ok(disposed>0);assert.ok(cover.diagnostics().cells<=9);cover.update({x:0,y:80,z:0},{quality:'high',time:5});assert.equal(cover.root.visible,false);cover.close();assert.equal(cover.diagnostics().cells,0);assert.equal(cover.root.parent,null);
});
test('shared environmental texture/material lifetime survives world disposal and atlas memory is bounded',()=>{
 const g=new T.Group(),kit=environmentKit();kit.block(g,0,1,0,1,2,1,0x7c6c51,'wood');bake(g,false,true);const material=environmentAtlasMaterial(),map=material.map;let disposed=0;map.addEventListener('dispose',()=>disposed++);disposeMapGroup(g);assert.equal(disposed,0);assert.equal(environmentAtlasMaterial().map,map);assert.equal(environmentMaterial(0x778866,'stone'),environmentMaterial(0x778866,'stone'));const d=environmentSurfaceDiagnostics();assert.deepEqual(d.atlas,[512,384]);assert.equal(d.surfaceKinds,9);assert.ok(d.textureBytes<6000000);
});
