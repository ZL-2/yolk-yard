import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {WEAPONS,ROYALE_WEAPONS} from '../src/data.js';import {viewmodelProfile,RETICLES,WEAPON_ART_REVISION} from '../src/weapon-presentation.js';import {makeBlaster} from '../src/weapons.js';import {synthesizeShot,reloadSequence} from '../src/firearm-audio.js';import {Box3,Vector3} from 'three';
const guns=[...WEAPONS,...ROYALE_WEAPONS],sha=data=>createHash('sha256').update(data).digest('hex');
test('all weapon artwork is regenerated from the current model factory with canonical names',async()=>{
 const manifest=JSON.parse(await readFile('public/inventory-previews/manifest.json'));assert.equal(manifest.source,sha(await readFile('src/weapons.js')));assert.equal(manifest.revision,WEAPON_ART_REVISION);assert.equal(new Set(guns.map(w=>w.name)).size,11);
 for(const w of guns){const art=await readFile('public/inventory-previews/'+w.id+'.svg');assert.equal(manifest.weapons[w.id].name,w.name);assert.equal(manifest.weapons[w.id].sha256,sha(art));assert.match(String(art),new RegExp('aria-label="'+w.name+'"'));assert.equal(makeBlaster(w.id).name,w.name);}
});
test('every category stays in front of the viewmodel camera at all supported aspect ratios',()=>{
 for(const w of guns)for(const aspect of [390/844,4/3,16/9,21/9]){const vm=viewmodelProfile(w.id,aspect),box=new Box3().setFromObject(makeBlaster(w.id)),rear=box.max.z*vm.scale+vm.z;assert.ok(rear<-.12,w.name+' rear clear of near plane');assert.ok(vm.fov>=60&&vm.fov<=75);assert.ok(box.getSize(new Vector3()).length()<4);}
 assert.equal(RETICLES.sprinter,'crosshair');assert.equal(makeBlaster('sprinter').userData.reticle,undefined);assert.ok(makeBlaster('zipper').userData.reticle);assert.ok(makeBlaster('comet').userData.reticle);
});
test('eleven original audio designs differ in spectrum/envelope and keep finite bounded samples',()=>{
 const signatures=new Set();for(const w of guns){const samples=synthesizeShot(w.id,22050);assert.ok(samples.every(n=>Number.isFinite(n)&&Math.abs(n)<1));signatures.add(sha(new Uint8Array(samples.buffer)));assert.ok(reloadSequence(w.id,2).every(e=>e.at>=0&&e.at<2));}assert.equal(signatures.size,11);
});
