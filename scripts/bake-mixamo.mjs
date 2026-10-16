// Offline conversion. Download FBX files directly from the user's Mixamo account.
// Original Adobe assets stay outside this repository; output is rig-specific game data.
import fs from 'node:fs';
import path from 'node:path';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {Vector3,Quaternion,AnimationMixer,LoopOnce} from 'three';
import {makeHumanoid} from '../src/humanoid.js';
const source=process.argv[2];
if(!source)throw Error('Usage: node scripts/bake-mixamo.mjs /path/to/mixamo-source');
const names=['hips','spine','chest','neck','head'];
const map={hips:'Hips',spine:'Spine',chest:'Spine2',neck:'Neck',head:'Head'};
for(const side of ['L','R']){const prefix=side==='L'?'Left':'Right';for(const [target,src]of Object.entries({shoulder:'Shoulder',arm:'Arm',forearm:'ForeArm',hand:'Hand',thigh:'UpLeg',shin:'Leg',foot:'Foot',toe:'ToeBase'})){names.push(target+side);map[target+side]=prefix+src;}}
const reference=makeHumanoid(),bones=reference.userData.human.bones;
// The game bind pose has lowered arms. Retarget against a matching T-pose,
// preserving the original skin binding and the game's limb proportions.
for(const side of ['L','R']){
 const sign=side==='L'?-1:1,arm=bones['arm'+side],forearm=bones['forearm'+side],hand=bones['hand'+side];
 arm.quaternion.setFromUnitVectors(forearm.position.clone().normalize(),new Vector3(sign,0,0));
 forearm.quaternion.setFromUnitVectors(hand.position.clone().normalize(),forearm.position.clone().normalize());
}
reference.updateMatrixWorld(true);
const targetRest=Object.fromEntries(names.map(n=>[n,bones[n].getWorldQuaternion(new Quaternion())]));
const convert=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),inverse=convert.clone().invert(),rate=30;
const manifest=JSON.parse(fs.readFileSync(new URL('./mixamo-manifest.json',import.meta.url)));
const result={version:1,rate,bones:names,clips:{}};
for(const [id,entry]of Object.entries(manifest)){
 let buffer=fs.readFileSync(path.join(source,entry.file));
 // Adobe's FBX 7700 footer sometimes has extra alignment bytes; normalize
 // the footer after the top-level null record (never modify animation nodes).
 const wide=buffer.readUInt32LE(23)>=7500;let end=27;
 while(end+25<buffer.length){const next=wide?Number(buffer.readBigUInt64LE(end)):buffer.readUInt32LE(end);if(!next)break;if(next<=end||next>buffer.length)throw Error('Invalid FBX node');end=next;}
 buffer=Buffer.concat([buffer.subarray(0,end+(wide?25:13)),Buffer.alloc(160)]);
 const rig=new FBXLoader().parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');rig.updateMatrixWorld(true);
 const srcBones=Object.fromEntries(names.map(n=>[n,rig.getObjectByName('mixamorig'+map[n])]));
 if(Object.values(srcBones).some(b=>!b))throw Error('Missing source bone: '+id);
 const sourceRest=Object.fromEntries(names.map(n=>[n,srcBones[n].getWorldQuaternion(new Quaternion()).invert()]));
 const animation=rig.animations[0],mixer=new AnimationMixer(rig),action=mixer.clipAction(animation);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
 const duration=animation.duration,frames=Math.ceil(duration*rate)+1;
 const rootTrack=animation.tracks.find(t=>t.name==='mixamorigHips.position'),rootEnd=rootTrack.values.slice(-3),rootStart=rootTrack.values.slice(0,3);
 const scale=.93/srcBones.hips.position.y,values=[];
 for(let f=0;f<frames;f++){
  const t=Math.min(f/rate,duration),u=t/duration;mixer.setTime(t);rig.updateMatrixWorld(true);
  const root=srcBones.hips.position.clone();
  // Remove trajectory only. Vertical movement and lateral weight shifts remain.
  root.x-=rootStart[0]+(rootEnd[0]-rootStart[0])*u;root.z-=rootStart[2]+(rootEnd[2]-rootStart[2])*u;
  root.multiplyScalar(scale).applyQuaternion(convert);values.push(...root.toArray().map(v=>Math.round(v*10000)));
  const world={root:new Quaternion()};
  for(const n of names){
   const q=srcBones[n].getWorldQuaternion(new Quaternion()).multiply(sourceRest[n]);
   q.premultiply(convert).multiply(inverse).multiply(targetRest[n]).normalize();world[n]=q;
   const parent=bones[n].parent.name,local=(world[parent]||new Quaternion()).clone().invert().multiply(q).normalize();
   values.push(...local.toArray().map(v=>Math.round(v*32767)));
  }
 }
 if(entry.loop){
  const stride=3+names.length*4,tail=Math.min(4,frames-1);
  for(let f=frames-tail;f<frames;f++){
   const x=(f-(frames-tail)+1)/tail,w=x*x*(3-2*x),offset=f*stride;
   for(let i=0;i<3;i++)values[offset+i]=Math.round(values[offset+i]*(1-w)+values[i]*w);
   for(let i=0;i<names.length;i++){
    const k=3+i*4,q=new Quaternion(...values.slice(offset+k,offset+k+4).map(n=>n/32767)).normalize(),first=new Quaternion(...values.slice(k,k+4).map(n=>n/32767)).normalize();
    q.slerp(first,w).toArray().forEach((n,j)=>values[offset+k+j]=Math.round(n*32767));
   }
  }
 }
 const distance=Math.hypot(rootEnd[0]-rootStart[0],rootEnd[2]-rootStart[2])*scale;
 const data=new Int16Array(values);result.clips[id]={duration,frames,distance,loop:!!entry.loop,source:entry.label||entry.file,data:Buffer.from(data.buffer).toString('base64')};
 console.log(id,frames,Math.round(data.byteLength/1024)+' KB');
}
fs.writeFileSync(new URL('../src/mixamo-clips.js',import.meta.url),'// Rig-specific animation payload for Ravelfront. Adobe Mixamo assets are not separately licensed for redistribution.\nexport default '+JSON.stringify(result)+';\n');
