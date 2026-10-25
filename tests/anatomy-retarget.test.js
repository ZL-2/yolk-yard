import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3,Quaternion} from 'three';
import {makeHumanoid,animateHumanoid} from '../src/humanoid.js';
import {createAnatomyRetarget,retargetAnatomy} from '../src/anatomy-retarget.js';
import {OPERATOR_ASSET_IDS} from '../src/operator-assets.js';
const reviewIds=process.env.ANATOMY_REVIEW_IDS?.split(',')||OPERATOR_ASSET_IDS;
const swap=n=>n.replace(/(shoulder|arm|forearm|hand|thigh|shin|foot|toe|finger)([LR])/,(_,p,s)=>p+(s==='L'?'R':'L'));
function rig(id){
 const model=makeHumanoid(),h=model.userData.human;model.updateMatrixWorld(true);const points={},defs=[];
 for(const [n,b]of Object.entries(h.bones)){points[n]=b.getWorldPosition(new Vector3());defs.push([n,n==='root'?null:b.parent.name]);}
 const raw=JSON.parse(readFileSync(new URL('../art/operators/'+id+'/production.json',import.meta.url))).joints;
 assert.ok(raw,id+' anatomy source');const joints=Object.fromEntries(Object.entries(raw).map(([n,[x,y,z]])=>[swap(n),new Vector3(-x,z,y)]));
 h.retarget=createAnatomyRetarget(defs,points,joints);
 for(const [n,parent]of defs){h.bones[n].position.copy(joints[n]).sub(parent?joints[parent]:new Vector3());h.bones[n].userData.rest.copy(h.bones[n].position);}
 h.motionRootOffset=joints.hips.y-.93;h.soleHeight=joints.footL.y;h.motionLegLength=h.bones.shinL.position.length()+h.bones.footL.position.length()-.02;
 return {model,h,points,defs};
}
test('rest-direction transfer preserves captured limb direction on distinct anatomies',()=>{
 for(const id of reviewIds){const {model,h,points,defs}=rig(id),expected={};
  for(const [n]of defs)h.bones[n].rotation.set(.15,.10,-.12);
  model.updateMatrixWorld(true);
  for(const S of ['L','R'])for(const [a,b]of [['arm','forearm'],['forearm','hand'],['thigh','shin'],['shin','foot']]){const n=a+S;expected[n]=points[b+S].clone().sub(points[n]).normalize().applyQuaternion(h.bones[n].getWorldQuaternion(new Quaternion()));}
  retargetAnatomy(h.retarget,h.bones);model.updateMatrixWorld(true);
  for(const S of ['L','R'])for(const [a,b]of [['arm','forearm'],['forearm','hand'],['thigh','shin'],['shin','foot']]){const n=a+S,actual=h.bones[b+S].getWorldPosition(new Vector3()).sub(h.bones[n].getWorldPosition(new Vector3())).normalize();assert.ok(actual.distanceTo(expected[n])<1e-6,id+' '+n);}
 }
});
test(`${reviewIds.length} rigs preserve limb length and player state through movement and action transitions`,()=>{
 const states=[{}, {vz:-2.4},{vx:2.4},{vz:2.4},{vz:-5},{vz:-8,sprinting:true},{crouching:true},{sliding:true,slideAge:.25},{grounded:false,vy:4},{grounded:false,vy:-4},{flight:'glide'},{downed:true,vz:-.8},{reviving:'mate'},{reloadEnd:100,reloadDuration:2},{emote:{id:'shuffle',start:0}},{vehicleId:'atv',vehicleSeat:0},{vehicleId:'helicopter',vehicleType:'helicopter',vehicleSeat:1},{mantle:{elapsed:.2,duration:.44}},{traversal:{kind:'zipline'}},{flight:'dive',grounded:false},{building:true},{throwProgress:.5},{use:{id:'mini',start:0,end:100}},{use:{id:'bandage',start:0,end:100}},{equipStarted:0,equipUntil:100,equipHolster:.2},{health:0},{health:0,crouching:true}];
 for(const id of reviewIds){const {model,h}=rig(id);let t=0;for(const extra of states){const p={health:100,grounded:true,inventory:[null],slot:0,...extra},before=structuredClone(p);for(let f=0;f<40;f++){t+=1/60;animateHumanoid(model,p,1/60,t);model.updateMatrixWorld(true);for(const b of Object.values(h.bones)){assert.ok(b.matrixWorld.elements.every(Number.isFinite),id+' '+b.name);assert.ok(Math.abs(b.quaternion.length()-1)<1e-5);if(b.name!=='hips')assert.ok(b.position.distanceTo(b.userData.rest)<1e-7,id+' length');}}assert.deepEqual(p,before);assert.deepEqual(model.position.toArray(),[0,0,0]);}}
});
