import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeEgg} from '../../../src/view.js';
import {createAnatomyRetarget} from '../../../src/anatomy-retarget.js';

// Review-only loader. Deliberately separate from the production cosmetic list.
const paths={
 normal:[new URL('../models/jim-normal.glb',import.meta.url).href,new URL('../models/jim-normal-lod.glb',import.meta.url).href],
 golf:[new URL('../models/jim-golf.glb',import.meta.url).href,new URL('../models/jim-golf-lod.glb',import.meta.url).href],
};
const swap=name=>name.replace(/(shoulder|arm|forearm|hand|thigh|shin|foot|toe|finger)([LR])/,(_,part,side)=>part+(side==='L'?'R':'L'));
async function decode(url){
 const gltf=await new GLTFLoader().loadAsync(url);gltf.scene.updateMatrixWorld(true);
 const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 if(!meshes.length)throw Error('Jim model contains no skinned surfaces');
 meshes.sort((a,b)=>a.material.name.localeCompare(b.material.name));
 const names=meshes[0].skeleton.bones.map(b=>swap(b.name)),joints={},materials=[],parts=[];
 for(const b of meshes[0].skeleton.bones){const p=b.getWorldPosition(new T.Vector3());p.x=-p.x;p.z=-p.z;joints[swap(b.name)]=p;}
 for(const m of meshes){
  const g=m.geometry.clone().applyMatrix4(m.matrixWorld).rotateY(Math.PI),s=g.attributes.skinIndex;
  for(let i=0;i<s.array.length;i++)s.array[i]=names.indexOf(swap(m.skeleton.bones[s.array[i]].name));
  for(const a of Object.keys(g.attributes))if(!['position','normal','uv','skinIndex','skinWeight'].includes(a))g.deleteAttribute(a);
  g.clearGroups();parts.push(g);m.material.side=T.DoubleSide;m.material.vertexColors=false;
  if(m.material.map)m.material.map.anisotropy=4;
  if(m.material.normalMap)m.material.normalMap.anisotropy=4;
  materials.push(m.material);
 }
 const geometry=mergeGeometries(parts,true);if(!geometry)throw Error('Incompatible Jim surface attributes');
 for(const g of parts)g.dispose();for(const m of meshes)m.geometry.dispose();geometry.computeBoundingSphere();
 return {geometry,materials,names,joints};
}
export async function makeJim(style){
 if(!paths[style])throw Error('Unknown Jim style');
 const asset=await decode(paths[style][0]);asset.id='jim-'+style;
 const model=makeEgg({outfit:'outfit-scout',weapon:'sprinter'},-1,true),h=model.userData.human;
 const list=h.mesh.skeleton.bones,defs=list.map(b=>[b.name,b.parent?.isBone?b.parent.name:null]),points={};
 // makeEgg evaluates a lobby pose during construction. Clear it before
 // recording the reference anatomy and calculating inverse bind matrices.
 for(const b of list){b.position.copy(b.userData.rest);b.quaternion.identity();b.scale.set(1,1,1);}
 model.updateMatrixWorld(true);for(const b of list)points[b.name]=b.getWorldPosition(new T.Vector3());
 const ids=Object.fromEntries(list.map((b,i)=>[b.name,i]));
 function remap(a){const s=a.geometry.attributes.skinIndex;for(let i=0;i<s.array.length;i++){const id=ids[a.names[s.array[i]]];if(id===undefined)throw Error('Unknown Jim skin joint');s.array[i]=id;}a.geometry.userData.remapped=true;}
 remap(asset);
 for(const [name,parent]of defs){if(!asset.joints[name])throw Error('Missing Jim joint '+name);const b=h.bones[name];b.position.copy(asset.joints[name]).sub(parent?asset.joints[parent]:new T.Vector3());b.userData.rest.copy(b.position);}
 h.mesh.geometry=asset.geometry;h.mesh.material=asset.materials;h.mesh.updateMatrixWorld(true);
 h.mesh.skeleton.dispose();h.mesh.bind(new T.Skeleton(list));h.mesh.boundingSphere=new T.Sphere(new T.Vector3(0,.95,0),2);
 h.asset=asset;h.retarget=createAnatomyRetarget(defs,points,asset.joints);h.soleHeight=asset.joints.footL.y;
 h.motionRootOffset=h.bones.hips.userData.rest.y-.93;h.motionLegLength=h.bones.shinL.userData.rest.length()+h.bones.footL.userData.rest.length()-.02;
 model.userData.asset=asset.id;model.userData.held.visible=false;h.mocap=null;h.previous=null;h.clock=0;h.nextUpdate=0;
 asset.lodRequest=decode(paths[style][1]).then(lod=>{remap(lod);for(const m of lod.materials){m.map?.dispose();m.normalMap?.dispose();m.dispose();}lod.materials=asset.materials;asset.lod=lod;return lod;});
 return model;
}
