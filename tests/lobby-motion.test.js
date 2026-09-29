import test from 'node:test';
import assert from 'node:assert/strict';
import {LobbyMotion} from '../src/lobby-motion.js';
test('planted idle stays continuous across gestures and loop boundaries',()=>{
 const motion=new LobbyMotion(),clips=new Set();let last=motion.update(0);
 for(let i=0;i<60*72;i++){
  const p=motion.update(1/60);clips.add(p.clip);assert.equal(p.speed,0);
  for(const key of Object.keys(p).filter(k=>typeof p[k]==='number')){
   assert.ok(Number.isFinite(p[key]));assert.ok(Math.abs(p[key]-last[key])<(['ready','check'].includes(key)?.035:.025),key+' snapped');
  }
  last=p;
 }
 assert.deepEqual([...clips].sort(),['low-ready','ready-idle','scan','sight-check']);
});
test('motion is frame-rate independent and party timing is staggered',()=>{
 const sample=fps=>{const m=new LobbyMotion();for(let i=0;i<fps*20;i++)m.update(1/fps);return m.update(0);};
 const a=sample(30),b=sample(120);for(const key of ['yaw','pitch','scan','weight','grip'])assert.ok(Math.abs(a[key]-b[key])<.002,key);
 assert.notEqual(new LobbyMotion().update(0).scan,new LobbyMotion(11.3).update(0).scan);
 const m=new LobbyMotion();for(const dt of [NaN,Infinity,-1,10])assert.ok(Number.isFinite(m.update(dt).yaw));
});
