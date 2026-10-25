import {Quaternion} from 'three';
// Captured clips were baked for the original rig. Transfer their model-space
// segment directions to each authored rest pose, preserving bone lengths and
// the source pose used by crossfades. Corrections are cached per skeleton.
export function createAnatomyRetarget(defs,points,joints){
 const records=[],byName=new Map(),children={hips:'spine',spine:'chest',chest:'neck',neck:'head'};
 for(const S of ['L','R'])for(const [a,b]of [['shoulder','arm'],['arm','forearm'],['forearm','hand'],['thigh','shin'],['shin','foot']])children[a+S]=b+S;
 for(const [name,parent]of defs){
  const child=children[name],correction=new Quaternion();
  if(child){const from=joints[child].clone().sub(joints[name]).normalize(),to=points[child].clone().sub(points[name]).normalize();correction.setFromUnitVectors(from,to);}
  const record={name,parent:byName.get(parent),correction,source:new Quaternion(),target:new Quaternion()};records.push(record);byName.set(name,record);
 }
 return records;
}
export function retargetAnatomy(records,bones){
 for(const r of records){
  r.source.copy(bones[r.name].quaternion);if(r.parent)r.source.premultiply(r.parent.source);
  r.target.copy(r.source).multiply(r.correction);
  if(r.parent)bones[r.name].quaternion.copy(r.parent.target).invert().multiply(r.target);else bones[r.name].quaternion.copy(r.target);
 }
}
