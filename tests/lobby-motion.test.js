import test from 'node:test';
import assert from 'node:assert/strict';
import {LobbyMotion,PATROL_SPEED,PATROL_CYCLE} from '../src/lobby-motion.js';
import {View,makeEgg} from '../src/view.js';
import {WEAPONS,ROYALE_WEAPONS} from '../src/data.js';
import {Vector3} from 'three';
test('continuous patrol travels at stride speed through every scan and loop',()=>{
 const motion=new LobbyMotion(),clips=new Set();let last=motion.update(0);
 for(let i=0;i<60*84;i++){
  const p=motion.update(1/60);clips.add(p.clip);assert.equal(p.speed,PATROL_SPEED);
  assert.ok(Math.abs(p.distance-last.distance-PATROL_SPEED/60)<1e-10);
  assert.ok(Math.abs(p.phase-p.distance/PATROL_CYCLE*Math.PI*2)<1e-10);
  for(const key of ['yaw','pitch','scan','bodyBob','bodySway','weaponYaw','grip']){
   assert.ok(Number.isFinite(p[key]));assert.ok(Math.abs(p[key]-last[key])<.025,key+' snapped');
  }
  last=p;
 }
 assert.deepEqual([...clips].sort(),['patrol-aim','patrol-forward','patrol-low-ready','patrol-scan']);
});
test('stride and scanning are frame-rate independent with staggered parties',()=>{
 const sample=fps=>{const m=new LobbyMotion();for(let i=0;i<fps*20;i++)m.update(1/fps);return m.update(0);};
 const a=sample(30),b=sample(120);for(const key of ['yaw','pitch','scan','distance','phase','grip'])assert.ok(Math.abs(a[key]-b[key])<.002,key);
 assert.notEqual(new LobbyMotion().update(0).phase,new LobbyMotion(11.3).update(0).phase);
 const m=new LobbyMotion();for(const dt of [NaN,Infinity,-1,10])assert.ok(Number.isFinite(m.update(dt).yaw));
});
test('patrol keeps checking both sectors instead of pausing for several seconds',()=>{
 const m=new LobbyMotion(),poses=[];for(let i=0;i<60*48;i++)poses.push(m.update(1/60));
 const angles=poses.map(p=>p.yaw-Math.PI+p.weaponYaw);
 assert.ok(Math.max(...angles)-Math.min(...angles)>1.2,'rifle needs a visible sweep across both sides');
 for(let i=0;i<angles.length-120;i+=30){const window=angles.slice(i,i+120);assert.ok(Math.max(...window)-Math.min(...window)>.20,'long stationary scan');}
 assert.ok(Math.max(...poses.map(p=>p.bodySway))-Math.min(...poses.map(p=>p.bodySway))>.08,'weight should transfer visibly between steps');
 assert.ok(Math.max(...poses.map(p=>p.grip))-Math.min(...poses.map(p=>p.grip))>.07,'shouldered aim needs a distinct raise');
});
test('wide lobby scans retain weapon grips and planted boots for every firearm',()=>{
 for(const id of new Set([...WEAPONS,...ROYALE_WEAPONS].map(w=>w.id))){
  const model=makeEgg({weapon:id}),motion=new LobbyMotion();let previous;
  for(let frame=0;frame<750;frame++){
   View.prototype.animateLobbyCharacter.call({},model,motion,1/30);model.updateMatrixWorld(true);
   const h=model.userData.human,feet=['footL','footR'].map(k=>h.bones[k].getWorldPosition(new Vector3()));
   if(frame>30){
    assert.ok(feet.some(p=>Math.abs(p.y-.09)<.001),id+' lost ground contact');
    for(const limb of model.userData.arms.userData.limbs){const hand=h.bones[limb.side<0?'handL':'handR'].getWorldPosition(new Vector3());assert.ok(hand.distanceTo(limb.hand.getWorldPosition(new Vector3()))<.055,id+' hand lost its grip');}
    for(let i=0;i<feet.length;i++)if(Math.abs(feet[i].y-.09)<.001&&Math.abs(previous[i].y-.09)<.001){assert.ok(Math.abs(feet[i].x-previous[i].x)<.001);assert.ok(Math.abs(feet[i].z-previous[i].z+PATROL_SPEED/30)<.001,'stance foot slipped relative to road');}
   }
   previous=feet;
  }
 }
});
