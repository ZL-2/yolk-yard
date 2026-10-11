import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {MapStore} from '../server/realtime/map-store.js';
import {baseMap,installPublishedLayouts} from '../src/maps.js';
import {baseObjects,sourceRecord,emptyLayout,compileLayout} from '../src/map-layout.js';

const stale={id:'box-999999',source:'box-999999',name:'Retired wall',position:[12,0,9],rotation:0,scale:[1,1,1],collision:true,ownerNote:'Preserve the original record exactly'};
const doc=objects=>({...emptyLayout('yard'),objects});
const state=(draft,published=draft)=>({format:1,maps:{yard:{draftVersion:4,revision:2,updated:10,draft,published}},assets:[]});
const backupPath=(path,text)=>path+'.before-recovery-'+createHash('sha256').update(text).digest('hex')+'.bak';

test('obsolete source references are archived with an exact backup; valid edits, assets and revisions survive restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ravel-recovery-')),path=join(dir,'maps.json');
 try{
  const native=sourceRecord(baseObjects(baseMap('yard')).find(o=>o.type==='box'));
  const asset={id:'a'.repeat(64),name:'Owner model',triangles:1,dimensions:[1,1,1]},model={id:'custom-model',kind:'model',name:'Owner model',position:[12,30,9],rotation:0,scale:[1,1,1],asset:asset.id,dimensions:[1,1,1],collision:false};
  const original=state(doc([native,model,stale]));original.assets=[asset];const raw=JSON.stringify(original,null,2);
  await mkdir(join(dir,'map-assets'));await writeFile(join(dir,'map-assets',asset.id+'.glb'),'existing model bytes');await writeFile(path,raw);
  const store=new MapStore({path});await store.ready;
  assert.equal(store.available,true);assert.equal(store.storage().archivedReferences,2);
  const record=store.get('yard');assert.equal(record.draftVersion,5);assert.equal(record.revision,3);
  assert.deepEqual(record.draft.objects.map(o=>o.id),[native.id,model.id]);assert.deepEqual(record.published,record.draft);
  assert.deepEqual(record.recoveries[0].objects,{draft:[stale],published:[stale]});
  assert.equal(await readFile(backupPath(path,raw),'utf8'),raw);assert.deepEqual(store.overview().assets,[asset]);assert.equal(String(await store.asset(asset.id)),'existing model bytes');
  assert.ok(compileLayout(baseMap('yard'),store.layouts().yard).editorObjects.some(o=>o.id===model.id));
  await assert.rejects(store.update('yard',record.draft,4),/another editor/);
  await assert.rejects(store.update('yard',doc([stale]),5),/no longer exists/,'New invalid writes still fail');
  await store.update('yard',record.draft,5);await store.close();
  const persisted=await readFile(path,'utf8'),again=new MapStore({path});await again.ready;
  assert.equal(again.available,true);assert.equal(again.get('yard').draftVersion,6);assert.equal(again.get('yard').revision,3);assert.deepEqual(again.get('yard').recoveries,record.recoveries);
  assert.equal(await readFile(path,'utf8'),persisted);assert.equal((await readdir(dir)).filter(p=>p.endsWith('.bak')).length,1);await again.close();
 }finally{installPublishedLayouts({});await rm(dir,{recursive:true,force:true});}
});

test('recovery never discards malformed data alongside an obsolete source',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ravel-recovery-bad-')),path=join(dir,'maps.json');
 try{
  const raw=JSON.stringify(state(doc([{...stale,scale:[0,1,1]}])));await writeFile(path,raw);const store=new MapStore({path});await store.ready;
  assert.equal(store.available,false);assert.equal(await readFile(path,'utf8'),raw);assert.deepEqual(await readdir(dir),['maps.json']);
  await assert.rejects(store.update('yard',emptyLayout('yard'),0),/recovery/);await store.close();
 }finally{installPublishedLayouts({});await rm(dir,{recursive:true,force:true});}
});

test('an unusable backup fails closed and leaves the original map untouched',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ravel-recovery-backup-')),path=join(dir,'maps.json');
 try{
  const raw=JSON.stringify(state(doc([stale])));await writeFile(path,raw);await writeFile(backupPath(path,raw),'different existing backup');
  const store=new MapStore({path});await store.ready;assert.equal(store.available,false);assert.equal(await readFile(path,'utf8'),raw);assert.equal(await readFile(backupPath(path,raw),'utf8'),'different existing backup');
  await assert.rejects(store.update('yard',emptyLayout('yard'),0),/recovery/);await store.close();
 }finally{installPublishedLayouts({});await rm(dir,{recursive:true,force:true});}
});
