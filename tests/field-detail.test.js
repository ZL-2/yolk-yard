import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {makeHumanoid,animateHumanoid,humanoidDiagnostics} from '../src/humanoid.js';
import {makeBlaster,makeGroundBlaster} from '../src/weapons.js';
import {SHOP_ITEMS} from '../src/shop-catalog.js';
import {makeShopPickaxe,makeShopBack,makeShopGlider,makeShopTrail} from '../src/shop-models.js';
import {lootModel,chestModel,gliderModel,launchpadModel} from '../src/royale-art.js';
import {makeVictoryCrown,decorateBoss} from '../src/celebration-view.js';
import {makeArms,updateArms} from '../src/arms.js';
import {ROYALE_GUN_IDS,ITEMS,AMMO_CAPS} from '../src/royale-data.js';
import {BOSSES} from '../src/bosses.js';
import {weapon} from '../src/data.js';
import {View,worldKit} from '../src/view.js';
import {bake} from '../src/royale-view.js';
import {surfaceAtlasMaterial,modelMaterial,modelEnvironment,SURFACE_KINDS} from '../src/model-surfaces.js';
const signature=g=>{const h=createHash('sha256');for(const key of ['position','color'])if(g.attributes[key])h.update(Buffer.from(g.attributes[key].array.buffer));return h.digest('hex');};
const modelSignature=m=>{const h=createHash('sha256');m.traverse(o=>{if(o.isMesh)h.update(signature(o.geometry));});return h.digest('hex');};
const budget=root=>{let meshes=0,triangles=0;root.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const key of ['position','normal','uv'])assert.ok(o.geometry.attributes[key]?.array.every(Number.isFinite),root.name+' '+key);});return {meshes,triangles};};
test('PBR material kinds share bounded maps and a cross-renderer HDR reflection source',()=>{
 const atlas=surfaceAtlasMaterial();assert.equal(atlas.isMeshPhysicalMaterial,true);assert.deepEqual([atlas.map.image.width,atlas.map.image.height],[512,384]);assert.equal(atlas.userData.shared,true);
 const roughness=new Set();for(const kind of SURFACE_KINDS){const m=modelMaterial('#738a86',kind);assert.equal(m,modelMaterial('#738a86',kind));assert.equal(m.userData.surfaceKind,kind);assert.ok(m.normalMap&&m.roughnessMap&&m.metalnessMap);roughness.add(m.roughnessMap.image.data[0]);}assert.ok(roughness.size>=7);
 assert.equal(modelEnvironment().isDataTexture,true);assert.equal(modelEnvironment().type,T.HalfFloatType);assert.equal(modelEnvironment().mapping,T.EquirectangularReflectionMapping);
});
test('all 36 outfit styles, default operators and themed guards keep one finite 32-bone rig',()=>{
 const profiles=[{},...SHOP_ITEMS.filter(i=>i.slot==='outfit').map(i=>({outfit:i.id})),...BOSSES.map(b=>({outfit:b.outfit,henchman:true}))],unique=new Set();
 for(const profile of profiles){const m=makeHumanoid(profile),h=m.userData.human,d=humanoidDiagnostics(m),b=budget(m);assert.equal(d.bones,32);assert.equal(b.meshes,1);assert.ok(b.triangles<14000,JSON.stringify(profile));assert.ok(d.vertices<=13000);assert.ok(h.mesh.material.userData.surfaceAtlas);assert.equal(m.userData.artRevision,166);unique.add(signature(h.mesh.geometry));
  const weights=h.mesh.geometry.attributes.skinWeight;for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
  for(const pose of [{grounded:true},{grounded:true,vz:-5},{downed:true},{flight:'dive',grounded:false},{flight:'glide',grounded:false},{health:0}]){animateHumanoid(m,{health:100,...pose},1/30,2);m.updateMatrixWorld(true);assert.ok(h.mesh.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)));}
 }assert.ok(unique.size>=20);
});
test('live bosses keep the same authored signature outfit geometry as their shop skins',()=>{
 for(const boss of BOSSES){const m=makeHumanoid({outfit:boss.outfit}),before=budget(m);decorateBoss(m,{...boss,bossId:boss.id});assert.deepEqual(budget(m),before);assert.equal(m.userData.bossDesign,boss.id);}
});
test('eleven held and ground weapons retain exact sockets, one-draw PBR pickups and reload motion',()=>{
 for(const id of ROYALE_GUN_IDS){const m=makeBlaster(id),g=makeGroundBlaster(id),w=weapon(id);assert.equal(m.userData.artRevision,155);assert.equal(g.userData.artRevision,155);assert.equal(m.userData.muzzle.position.z,-w.muzzle);assert.equal(m.userData.sightY,w.sightY);assert.ok(budget(m).triangles<=12500,id);assert.equal(budget(g).meshes,1);assert.ok(g.material.userData.surfaceAtlas);assert.equal(g.geometry,makeGroundBlaster(id).geometry);
  const rig=makeArms(id,{outfit:'outfit-wren'});for(const t of [-1,.20,.45,.80,1]){updateArms(rig,t,m,0,1,null,true);budget(rig);}assert.equal(rig.userData.artRevision,155);
 }
});
test('all gameplay items, ammo and resource pickups retain PBR through the actual loot bake',()=>{
 const items=[...Object.keys(ITEMS).map(id=>({id})),...Object.keys(AMMO_CAPS).map(id=>({id,ammoType:id})),{id:'pickaxe',pickaxe:true},...['wood','brick','metal'].map(id=>({id,resource:id})),{id:'blueprint'}];
 for(const item of items){const m=lootModel(item,worldKit,{ground:false});bake(m,false,true);const b=budget(m);assert.ok(b.triangles<=7500,item.id);assert.ok(b.meshes<=5,item.id);let physical=0;m.traverse(o=>{if(o.isMesh){assert.notEqual(o.material.isMeshLambertMaterial,true,item.id);if(o.material.isMeshPhysicalMaterial)physical++;}});assert.ok(physical>0,item.id);}
});
test('all shop equipment collections and default world equipment stay bounded and finite',()=>{
 for(const [slot,factory]of Object.entries({pickaxe:makeShopPickaxe,backbling:makeShopBack,glider:makeShopGlider,trail:makeShopTrail})){const unique=new Set();for(const item of SHOP_ITEMS.filter(i=>i.slot===slot)){const m=factory(item.id),b=budget(m);assert.ok(b.triangles<=5500,item.id);assert.ok(b.meshes<=4,item.id);if(item.model)unique.add(modelSignature(m));}assert.equal(unique.size,6,slot);}
 for(const args of [[false,false],[false,true],[true,false]]){const m=chestModel(worldKit,...args),lid=m.userData.lid;assert.ok(lid);bake(lid,false,true);bake(m,false,true);assert.ok(budget(m).triangles<7500);lid.rotation.x=-1.1;m.updateMatrixWorld(true);assert.ok(lid.matrixWorld.elements.every(Number.isFinite));}
 assert.ok(budget(gliderModel(worldKit)).triangles<6000);assert.ok(budget(launchpadModel(worldKit)).triangles<6000);assert.ok(budget(makeVictoryCrown()).triangles<3500);assert.ok(budget(View.prototype.rocketModel()).triangles<4000);
});
test('closing wrapped previews preserves the shared texture atlas for the active match',()=>{
 const wrapped=makeBlaster('sprinter','wrap-voss'),map=surfaceAtlasMaterial().map;let disposed=0;const listener=()=>disposed++;map.addEventListener('dispose',listener);
 const shared=[];wrapped.traverse(o=>{if(o.material?.map?.userData.shared){shared.push(o.material.map);o.material.map.addEventListener('dispose',listener);}});
 View.prototype.disposeGroup.call({scopeTarget:{texture:null},reticleTexture:null},wrapped);assert.equal(disposed,0);map.removeEventListener('dispose',listener);for(const texture of shared)texture.removeEventListener('dispose',listener);
});
