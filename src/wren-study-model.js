import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeHumanoid,HUMANOID_BONES,animateHumanoid} from './humanoid.js';

// The study is deliberately separate from the live cosmetic catalog while its
// fidelity is reviewed. It exercises the real game rig and animation functions.
export async function loadWrenStudy(url=new URL('models/operators/wren-prototype.glb',document.baseURI).href){
 const gltf=await new GLTFLoader().loadAsync(url);gltf.scene.updateMatrixWorld(true);
 const source=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)source.push(o);});
 if(source.length!==1)throw Error('Wren study requires one skinned mesh');
 const input=source[0],geometry=input.geometry.clone();geometry.applyMatrix4(input.matrixWorld);
 geometry.rotateY(Math.PI);
 const swap=name=>name.replace(/(shoulder|arm|forearm|hand|thigh|shin|foot|toe|finger)([LR])/,(_,part,side)=>part+(side==='L'?'R':'L'));
 const ids=Object.fromEntries(HUMANOID_BONES.map((name,i)=>[name,i])),skin=geometry.attributes.skinIndex;
 const names=input.skeleton.bones.map(b=>swap(b.name));
 for(let i=0;i<skin.count;i++)for(let j=0;j<4;j++){const name=names[skin.array[i*4+j]];if(ids[name]===undefined)throw Error('Unknown Wren joint: '+name);skin.array[i*4+j]=ids[name];}
 const joints={};input.skeleton.bones.forEach(b=>{const pos=b.getWorldPosition(new T.Vector3());pos.x=-pos.x;pos.z=-pos.z;joints[swap(b.name)]=pos;});
 geometry.computeBoundingSphere();geometry.userData.shared=true;
 const material=input.material.clone();material.side=T.DoubleSide;
 const model=makeHumanoid({color:'#394b56'}),h=model.userData.human;
 h.mesh.geometry=geometry;h.mesh.material=material;
 for(const name of HUMANOID_BONES){const bone=h.bones[name],parent=bone.parent?.isBone?bone.parent.name:null;if(!joints[name])throw Error('Missing Wren joint: '+name);bone.position.copy(joints[name]).sub(parent?joints[parent]:new T.Vector3());bone.userData.rest=bone.position.clone();}
 model.updateMatrixWorld(true);h.mesh.bind(new T.Skeleton(HUMANOID_BONES.map(name=>h.bones[name])));
 h.mesh.frustumCulled=false;model.name='Wren GLB study';model.userData.asset='wren-prototype.glb';
 model.userData.bindHeight=h.bones.hips.userData.rest.y;
 return model;
}
export function animateWrenStudy(model,p,dt,time){
 animateHumanoid(model,p,dt,time,{menu:false});
 // The captured clips use the common .93m pelvis. Wren's longer legs require
 // a bind-height translation in air. Ground contact already solves both ankles;
 // translating the pelvis again there would lift the soles off the ground.
 if(p.grounded===false)model.userData.human.bones.hips.position.y+=model.userData.bindHeight-.93;
 model.updateMatrixWorld(true);
}
