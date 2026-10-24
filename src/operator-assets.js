import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original, editable Blender assets. Geometry, maps and materials are shared;
// makeHumanoid creates only the skeleton and pose state for each player.
export const OPERATOR_ASSET_IDS=Object.freeze(['wren','rank-25','rank-10','rank-5','rank-1','voss','rook','nyx','pulse','morrow']);
const assets=new Map(),pending=new Map();
const swap=name=>name.replace(/(shoulder|arm|forearm|hand|thigh|shin|foot|toe|finger)([LR])/,(_,part,side)=>part+(side==='L'?'R':'L'));
export function operatorAsset(profile){if(profile.infectedType||profile.infectedSkin||profile.henchman)return null;const id=profile.outfit?.replace(/^outfit-/,'');return assets.get(OPERATOR_ASSET_IDS.includes(id)?id:'scout');}
async function decode(id,suffix=''){
 const source=new URL(`models/operators/${id}${suffix}.glb`,document.baseURI);source.searchParams.set('v','215');const url=source.href;
 const gltf=await new GLTFLoader().loadAsync(url);gltf.scene.updateMatrixWorld(true);
 const inputs=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)inputs.push(o);});
 if(!inputs.length)throw Error(`No skinned geometry in ${id}${suffix}`);
 const joints={},names=inputs[0].skeleton.bones.map(b=>swap(b.name));
 inputs[0].skeleton.bones.forEach(b=>{const p=b.getWorldPosition(new T.Vector3());p.x=-p.x;p.z=-p.z;joints[swap(b.name)]=p;});
 const materials=[],parts=[];
 for(const input of inputs){
  const g=input.geometry.clone().applyMatrix4(input.matrixWorld).rotateY(Math.PI);
  const skin=g.attributes.skinIndex;
  for(let i=0;i<skin.array.length;i++){const name=swap(input.skeleton.bones[skin.array[i]].name);const n=names.indexOf(name);if(n<0)throw Error(`Unknown joint ${name}`);skin.array[i]=n;}
  g.deleteAttribute('color');g.deleteAttribute('tangent');g.clearGroups();
  // Each Blender mesh has one material; joining retains face/body material groups.
  if(Array.isArray(input.material))throw Error(`Unexpected material layout in ${id}`);
  const m=input.material;m.side=T.DoubleSide;m.userData.shared=true;
  for(const value of Object.values(m))if(value?.isTexture){value.userData.shared=true;value.anisotropy=4;}
  materials.push(m);parts.push(g);
 }
 const geometry=mergeGeometries(parts,true);if(!geometry)throw Error(`Cannot merge ${id}`);
 parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();geometry.userData.shared=true;
 return {geometry,materials,joints,names,id};
}
export function loadOperatorAsset(id){
 if(!OPERATOR_ASSET_IDS.includes(id))return Promise.reject(Error('Unknown operator asset'));
 if(pending.has(id))return pending.get(id);
 const task=decode(id).then(asset=>{assets.set(id,asset);return asset;}).catch(error=>{pending.delete(id);throw error;});pending.set(id,task);return task;
}
export async function preloadOperatorAssets(){
 // Three concurrent requests bound decoding and texture-upload pressure.
 const queue=[...OPERATOR_ASSET_IDS];
 await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{while(queue.length)await loadOperatorAsset(queue.shift());}));
}
export function loadOperatorLod(id){const asset=assets.get(id);if(!asset||asset.lodRequest)return;asset.lodRequest=decode(id,'-lod').then(lod=>{lod.materials.forEach(m=>m.dispose());lod.materials=asset.materials;asset.lod=lod;}).catch(()=>{});}
