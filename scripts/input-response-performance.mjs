import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import * as T from 'three';
const baseline=process.env.INPUT_RESPONSE_BASELINE;assert.ok(baseline,'INPUT_RESPONSE_BASELINE must identify the previous release');
const load=(root,file)=>import(pathToFileURL(resolve(root,'src',file)));
const ids=['sprinter','zipper','anchor','duet','pip','needle','scatter','thumper','peeper','doubleyolk','comet','stormspike'];
function digest(model){const h=createHash('sha256');model.updateMatrixWorld(true);model.traverse(o=>{h.update(JSON.stringify([o.type,o.name,o.matrixWorld.elements,o.visible]));if(o.geometry){for(const [key,a]of Object.entries(o.geometry.attributes).sort()){h.update(key);h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(o.geometry.index)h.update(new Uint8Array(o.geometry.index.array.buffer));}if(o.material)h.update(JSON.stringify([o.material.type,o.material.color?.getHex(),o.material.opacity,o.material.transparent,o.material.metalness,o.material.roughness]));});return h.digest('hex');}
const results=[];
for(const root of [baseline,'.']){
 const {View}=await load(root,'view.js'),{makeBlaster,disposeBlaster}=await load(root,'weapons.js'),{RemoteInputBuffer}=await load(root,'remote-input.js');
 const geometry=Object.fromEntries(ids.map(id=>[id,digest(makeBlaster(id))]));
 const v=Object.assign(Object.create(View.prototype),{gunGroup:new T.Group(),viewmodelCamera:new T.Group(),scopeTarget:{texture:new T.Texture()},reticleTexture:new T.Texture()});
 const samples=[],factory=[];for(let i=0;i<240;i++){const id=ids[i%5],t=performance.now();v.setWeapon({health:100,weapon:id,slot:0,outfit:'outfit-wren'},{holster:0});if(i>=40)samples.push(performance.now()-t);const s=performance.now(),model=makeBlaster(id);disposeBlaster(model);if(i>=40)factory.push(performance.now()-s);}
 const stats=a=>{a.sort((a,b)=>a-b);return {median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
 const buffer=new RemoteInputBuffer();let seq=0,lag=[];for(let i=0;i<6;i++)buffer.push({seq:++seq});for(let i=0;i<600;i++){buffer.push({seq:++seq});buffer.take(1/60);lag.push(seq-buffer.last.seq);}
 results.push({root,geometry,switchMs:stats(samples),factoryMs:stats(factory),queue:{after150ms:lag[8],after10s:lag.at(-1)},cacheSize:v.weaponCache?.size||0});
}
assert.deepEqual(results[0].geometry,results[1].geometry,'Cached models must preserve all authored geometry, matrices and material properties');
assert.equal(results[0].queue.after10s,6);assert.equal(results[1].queue.after150ms,0);assert.equal(results[1].queue.after10s,0);
assert.ok(results[1].switchMs.median<results[0].switchMs.median*.5,'Repeated weapon switching must materially reduce CPU cost');
const report={previous:results[0],current:results[1],switchMedianReductionPercent:100*(1-results[1].switchMs.median/results[0].switchMs.median),note:'Identical synthetic inputs and authored models. CPU timing is not a device FPS or Internet latency guarantee.'};
await mkdir('test-results/input-response',{recursive:true});await writeFile('test-results/input-response/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(process.env.REFRESH_MODEL_MANIFEST==='1'){
 const path='public/inventory-previews/manifest.json',manifest=JSON.parse(await readFile(path));manifest.source=createHash('sha256').update(await readFile('src/weapons.js')).digest('hex');await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
}
