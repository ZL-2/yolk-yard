import test from 'node:test';
import assert from 'node:assert/strict';
import {pieceBoxes,localToWorld,worldToLocal} from '../src/building-shapes.js';
import {rebuildMap,applyBuildState,editBuilding} from '../src/building.js';
import {movePlayer,canOccupy,canStand,rayBox} from '../src/physics.js';
import {eyeHeight} from '../src/stance.js';
import {predictionCopy,predictMovement} from '../src/guest-movement.js';

function fixture({rotation=0,mask=1,lane=-1}={}){
 const ramp={id:'build-1',type:'stairs',owner:'builder',material:'wood',x:0,y:0,z:0,rotation,mask:0,health:150,maxHealth:150,revision:0};
 const floor={...ramp,id:'build-2',type:'floor',y:4,mask};
 const p={id:'builder',...localToWorld(ramp,lane,0,3),health:100,yaw:rotation*Math.PI/2,pitch:0,flight:'ground',grounded:true,vy:0,inventory:[],phasedBuilds:[]};
 const sim={map:{id:'flat',size:100,theme:'royale',boxes:[]},worldBoxes:[],worldDamage:{},builds:[ramp,floor],players:new Map([[p.id,p]]),options:{mode:'royale'},time:0,buildVersion:0,emit(){}};
 rebuildMap(sim);return{sim,p,ramp,floor};
}
function climb(f,{crouch=false,dt=1/60,seconds=2.5}={}){
 let top=0,ducked=false,stoodAfterOpening=false;
 for(let i=0;i<seconds/dt;i++){
  movePlayer(f.p,{forward:1,yaw:f.p.yaw,pitch:0,crouch},f.sim.map,dt,i*dt);
  top=Math.max(top,f.p.y);ducked||=!!f.p.crouching;
  assert.ok(canOccupy(f.sim.map,f.p),'movement must never overlap retained floor or stair solids');
  if(worldToLocal(f.ramp,f.p).z<-.4&&!f.p.crouching)stoodAfterOpening=true;
 }
 return{top,ducked,stoodAfterOpening};
}

test('walking uphill ducks through a single edited floor corner and stands again, at every rotation',()=>{
 for(const rotation of [0,1,2,3])for(const [mask,lane] of [[1,-1],[2,1]]){
  const f=fixture({rotation,mask,lane}),result=climb(f);
  assert.ok(result.top>=4,`corner ${mask}, rotation ${rotation}: stopped at ${JSON.stringify(worldToLocal(f.ramp,f.p))}`);
  assert.equal(result.ducked,true,'low clearance is handled before the next stair rise');
  assert.equal(result.stoodAfterOpening,true,'standing resumes as soon as the head clears the opening');
  assert.deepEqual(f.p.phasedBuilds,[],'clearance never grants permission to walk through the floor');
 }
});

test('held crouch and low frame rates also pass through the same corner without penetration',()=>{
 for(const rotation of [0,1,2,3])for(const crouch of [false,true]){
  const f=fixture({rotation}),result=climb(f,{crouch,dt:1/15,seconds:3.5});
  assert.ok(result.top>=4,`rotation ${rotation}, crouch ${crouch}`);
  assert.ok(worldToLocal(f.ramp,f.p).z<-2,'the entire character exits the hole');
 }
});

test('solid floors, retained floor corners, and walls remain blocking during the same approach',()=>{
 for(const rotation of [0,1,2,3])for(const mask of [0,2]){
  const f=fixture({rotation,mask}),result=climb(f,{seconds:4});
  assert.ok(result.top<4,'retained cover must stop the climb');
  assert.ok(worldToLocal(f.ramp,f.p).z>-.8,'player cannot continue underneath the retained high half');
  assert.deepEqual(f.p.phasedBuilds,[]);
 }
 const f=fixture(),wall={...f.ramp,id:'build-3',type:'wall',z:-.5,y:2};f.sim.builds.push(wall);rebuildMap(f.sim);
 assert.ok(climb(f,{seconds:4}).top<4,'an opening behind a wall does not bypass that wall');
 const floor=pieceBoxes(f.floor);
 assert.equal(Math.min(...floor.map(b=>rayBox({x:-1,y:6,z:-1},{x:0,y:-1,z:0},b))),Infinity,'removed corner stays empty for shots');
 assert.ok(Math.abs(Math.min(...floor.map(b=>rayBox({x:1,y:6,z:-1},{x:0,y:-1,z:0},b)))-1.84)<1e-9,'retained corner keeps its original cover');
});

test('editing above a stopped player resumes host and snapshot prediction identically',()=>{
 const f=fixture({mask:0});climb(f,{seconds:1.2});
 const target=localToWorld(f.floor,-1,.08,-1),pitch=Math.atan2(target.y-f.p.y-eyeHeight(f.p),Math.hypot(target.x-f.p.x,target.z-f.p.z));
 assert.equal(editBuilding(f.sim,f.p,'build-change:'+JSON.stringify({id:f.floor.id,revision:0,mask:1,path:[],yaw:0,pitch})),true);
 const snapshot=structuredClone({matchId:'ramp-floor',round:1,buildVersion:f.sim.buildVersion,builds:f.sim.builds,worldDamage:{}}),guestMap={id:'flat',size:100,theme:'royale',boxes:[]};
 applyBuildState(guestMap,snapshot);assert.deepEqual(guestMap.boxes,f.sim.map.boxes);
 const predicted=predictionCopy(f.p);let top=0;
 for(let i=0;i<100;i++){
  const input={forward:1,yaw:0,pitch:0};movePlayer(f.p,input,f.sim.map,1/60,i/60);predictMovement(predicted,input,guestMap,1/60,snapshot,i/60);top=Math.max(top,f.p.y);
  for(const key of ['x','y','z','crouching','lowCrouch','grounded'])assert.equal(predicted[key],f.p[key],key);
  assert.ok(canOccupy(f.sim.map,f.p));assert.ok(canOccupy(guestMap,predicted));
 }
 assert.ok(top>=4,'the committed floor edit opens a usable passage');
 assert.equal(canStand(f.sim.map,f.p),true);assert.deepEqual(f.p.phasedBuilds,[]);
});
