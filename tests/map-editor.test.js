import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BASE_MAPS,baseMap,getMap,installPublishedLayouts,useMatchLayouts} from '../src/maps.js';
import {emptyLayout,validateLayout,compileLayout,baseObjects,sourceRecord,prefabBoxes} from '../src/map-layout.js';
import {MapDocument} from '../src/map-document.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {MapStore,validateGlb} from '../server/realtime/map-store.js';
import {OwnerService} from '../server/realtime/owner.js';
import {SnapshotEncoder,SnapshotDecoder,SnapshotBatch} from '../src/snapshot-codec.js';
import {rayBox,canStand} from '../src/physics.js';

const record=(kind='wall',position=[5,0,5])=>({id:'test-object',kind,name:'Test wall',position,rotation:0,scale:[1,1,1],collision:true});
const layout=(id='yard',objects=[record()])=>({...emptyLayout(id),objects});
export function fixtureGlb(extra={}){
 const positions=new Float32Array([0,0,0,1,0,0,0,1,0]),bin=Buffer.from(positions.buffer),doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:bin.length}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],...extra};const text=JSON.stringify(doc),json=Buffer.from(text+' '.repeat((4-text.length%4)%4)),bytes=Buffer.alloc(28+json.length+bin.length);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(json.length,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);bytes.writeUInt32LE(bin.length,20+json.length);bytes.writeUInt32LE(0x004e4942,24+json.length);bin.copy(bytes,28+json.length);return bytes;
}
test('layout input rejects invalid geometry, unsupported rotation and duplicate IDs',()=>{
 assert.throws(()=>validateLayout(layout('yard',[{...record(),position:[NaN,0,0]}])),/position/);
 assert.throws(()=>validateLayout(layout('yard',[{...record(),rotation:45}])),/90°/);
 assert.throws(()=>validateLayout(layout('yard',[record(),record()])),/unique/);
 assert.throws(()=>validateLayout(layout('yard',[{...record(),source:'../../outside'}])),/source/);
 assert.equal(validateLayout(layout('yard',[{...record(),rotation:45,collision:false}])).objects[0].rotation,45);
});
test('published additions share visible dimensions and exact quarter-turn collision without mutating base',()=>{
 for(const base of BASE_MAPS){const before=base.boxes.length,r={...record(),rotation:90,scale:[2,1,3]},map=compileLayout(base,layout(base.id,[r])),solid=map.boxes.find(b=>b.editorObject===r.id);assert.equal(base.boxes.length,before);assert.ok(Math.abs(solid.w-1.2)<1e-8);assert.ok(Math.abs(solid.d-16)<1e-8);assert.ok(Math.abs(solid.x-5)<1e-8);assert.equal(canStand(map,{x:5,y:0,z:5}),false);assert.ok(Number.isFinite(rayBox({x:-10,y:1,z:5},{x:1,y:0,z:0},solid)));assert.equal(map.editorObjects[0].rotation,90);}
 const stairs=prefabBoxes('stairs');assert.equal(stairs.length,12);assert.ok(stairs.every((b,i)=>i===0||b.h-stairs[i-1].h<.43));
});
test('moving a complete building moves solids, interior props and loot; deleting/restoring is reversible',()=>{
 const base=baseMap('sunnybreak'),src=baseObjects(base).find(o=>o.type==='building'),r=sourceRecord(src);r.position[0]+=20;r.rotation=90;
 const map=compileLayout(base,layout(base.id,[r]));assert.equal(map.buildings[0].editorHidden,true);assert.equal(map.boxes.filter(b=>b.editorObject===r.id).length,src.boxes.length);assert.ok(map.props.filter(p=>p.building===0).every(p=>p.editorHidden));const old=base.chests.find(c=>c.building===0),moved=map.chests.find(c=>c.id===old.id);assert.notEqual(moved.x,old.x);assert.notEqual(moved.z,old.z);
 const removed=compileLayout(base,layout(base.id,[{...r,removed:true}]));assert.ok(!removed.chests.some(c=>c.building===0));assert.ok(!removed.boxes.some(b=>b.building===0));
 const doc=new MapDocument(base);doc.set(r);doc.remove(r.id);assert.ok(doc.record(r.id).removed);doc.undo();assert.ok(!doc.record(r.id).removed);doc.undo();assert.equal(doc.layout.objects.length,0);doc.redo();assert.equal(doc.layout.objects.length,1);doc.restore(r.id);assert.equal(doc.dirty,false);
});
test('rounds pin their layouts through snapshots, host migration, and spawn-island departure',()=>{
 installPublishedLayouts({'yard':layout(),'sunnybreak':layout('sunnybreak',[record('crate',[0,50,0])]),'hatchery-atoll':layout('hatchery-atoll',[record('crate',[20,3.2,0])])});
 const sim=new Simulation({map:'yard',bots:0}),royale=new RoyaleSimulation({bots:2,capacity:4,fill:false});sim.startRound();royale.addPlayer('human',{name:'Human'});royale.startRound();
 installPublishedLayouts({});assert.ok(sim.map.boxes.some(b=>b.editorObject));assert.ok(royale.map.boxes.some(b=>b.editorObject));royale.beginBattle();assert.ok(royale.map.boxes.some(b=>b.editorObject));const state=sim.snapshot();useMatchLayouts(state.mapLayouts,state.mapLayoutKey);assert.ok(getMap(state.options.map).boxes.some(b=>b.editorObject));const restored=new Simulation().restore(sim.checkpoint());assert.ok(restored.map.boxes.some(b=>b.editorObject));useMatchLayouts(null);assert.ok(!new Simulation({map:'yard'}).map.boxes.some(b=>b.editorObject));
});
test('unchanged layout data is retained by snapshot deltas and reaches fresh/reconnected entrants',()=>{
 const bundle={'yard':layout()},encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();const a={type:'state',state:{time:1,players:[],projectiles:[],mapLayouts:bundle,mapLayoutKey:'abc'}},b={type:'state',state:{...a.state,time:2}};
 const first=encoder.encode(a),second=encoder.encode(b);assert.deepEqual(decoder.decode(first.frame).state.mapLayouts,bundle);assert.ok(JSON.stringify(second).length<300);assert.deepEqual(decoder.decode(second.frame).state.mapLayouts,bundle);const fresh=new SnapshotDecoder();assert.deepEqual(fresh.decode(new SnapshotEncoder().encode(b).frame).state.mapLayouts,bundle);
 const batch=new SnapshotBatch(),frame=batch.normalize(a),next=new SnapshotBatch().normalize(b);assert.equal(frame.state.mapLayouts,next.state.mapLayouts);
});
test('server draft/publish revision checks persist maps and GLB assets across restart',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'ravel-map-')),path=join(folder,'maps.json');try{const store=new MapStore({path});await store.ready;const saved=await store.update('yard',layout(),0);assert.equal(saved.draftVersion,1);assert.deepEqual(store.layouts(),{});await assert.rejects(store.update('yard',layout(),0),/another editor/);await store.update('yard',layout(),1,true);assert.equal(store.layouts()['yard'].objects.length,1);const asset=await store.upload(fixtureGlb(),{name:'Model',dimensions:[6,6,.02]});assert.equal((await store.asset(asset.id)).length,fixtureGlb().length);await store.close();const restored=new MapStore({path});await restored.ready;assert.equal(restored.get('yard').revision,1);assert.equal(restored.overview().assets.length,1);assert.ok(await restored.asset(asset.id));await restored.close();assert.ok((await readFile(path,'utf8')).includes('draftVersion'));}finally{installPublishedLayouts({});await rm(folder,{recursive:true,force:true});}
});
test('bad saved map data fails closed; invalid/external/compressed/oversized models are rejected',async()=>{
 assert.equal(validateGlb(fixtureGlb()).triangles,1);assert.throws(()=>validateGlb(fixtureGlb({buffers:[{byteLength:36,uri:'https://outside.example/a'}]})),/embedded/);assert.throws(()=>validateGlb(fixtureGlb({extensionsUsed:['KHR_draco_mesh_compression']})),/compression/);assert.throws(()=>validateGlb(Buffer.alloc(100)),/GLB/);const folder=await mkdtemp(join(tmpdir(),'ravel-bad-map-')),path=join(folder,'map.json');try{await writeFile(path,'{"bad":"existing"}');const store=new MapStore({path});await store.ready;assert.equal(store.available,false);await assert.rejects(store.update('yard',layout(),0),/recovery/);assert.equal(await readFile(path,'utf8'),' {"bad":"existing"}'.trim());}finally{await rm(folder,{recursive:true,force:true});}
});
test('owner map APIs reject wrong origin, missing/expired tokens and stale draft writes',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'ravel-auth-map-')),store=new MapStore({path:join(folder,'map.json')}),owner=new OwnerService({code:'89271406539284756012'});await Promise.all([store.ready,owner.ready]);const origin='https://zl-2.github.io',req=async(url,body,from=origin)=>{let status,result;await owner.handle({url,method:'POST',headers:{origin:from},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}},{writeHead(s){status=s;},end(text){result=JSON.parse(text);}},{origins:[origin],relay:{mapStore:store,peers:new Map()}});return {status,result};};try{assert.equal((await req('/owner/maps',{action:'list'})).status,401);assert.equal((await req('/owner/maps',{action:'list'},'https://wrong.example')).status,403);const login=await req('/owner/login',{code:'89271406539284756012'}),token=login.result.token;assert.equal((await req('/owner/maps',{token,action:'save',mapId:'yard',expectedVersion:0,layout:layout()})).status,200);assert.equal((await req('/owner/maps',{token,action:'publish',mapId:'yard',expectedVersion:0,layout:layout()})).status,409);owner.tokens.set(token,0);assert.equal((await req('/owner/maps',{token,action:'get',mapId:'yard'})).status,401);}finally{await owner.close();await store.close();await rm(folder,{recursive:true,force:true});}
});

test('copies have independent solids, doors and loot, and explicit furniture edits do not duplicate visuals',()=>{
 const base=baseMap('sunnybreak'),src=baseObjects(base).find(o=>o.type==='building'),copy={...sourceRecord(src),id:'building-copy',position:[src.position[0]+20,src.position[1],src.position[2]]},map=compileLayout(base,layout(base.id,[copy]));
 assert.ok(map.boxes.filter(b=>b.editorObject===copy.id).every(b=>b.objectId.startsWith('editor-building-copy-')));const chest=map.chests.find(c=>c.id.startsWith('editor-building-copy-'));assert.ok(chest);assert.equal(chest.building,undefined);
 const prop=baseObjects(base).find(o=>o.type==='prop'&&o.spec.building===0),edited=compileLayout(base,layout(base.id,[sourceRecord(src),{...sourceRecord(prop),position:[0,30,0]}]));assert.ok(edited.editorObjects.find(o=>o.id===src.id).omitProps.includes(prop.id));
 const sources=Array.from({length:251},(_,i)=>({...copy,id:'copy-'+i}));assert.throws(()=>validateLayout(layout(base.id,sources)),/limit/);
});
test('decoded layout data is immutable and reused without copying it each movement frame',()=>{
 const bundle={yard:layout()},encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),first=decoder.decode(encoder.encode({type:'state',state:{players:[],time:1,mapLayouts:bundle}}).frame),next=decoder.decode(encoder.encode({type:'state',state:{players:[],time:2,mapLayouts:bundle}}).frame);
 assert.equal(first.state.mapLayouts,next.state.mapLayouts);assert.ok(Object.isFrozen(first.state.mapLayouts.yard.objects[0].position));assert.throws(()=>first.state.mapLayouts.yard.objects[0].position[0]=999);assert.equal(next.state.mapLayouts.yard.objects[0].position[0],5);
});
