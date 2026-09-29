import test from 'node:test';
import assert from 'node:assert/strict';
import {LobbyMotion,PATROL_SPEED,PATROL_CYCLE} from '../src/lobby-motion.js';
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
