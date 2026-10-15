import test from 'node:test';
import assert from 'node:assert/strict';
import {FramePacer,FPS_LIMITS,fpsLimit} from '../src/frame-pacing.js';
import {worldDoorBox,cacheDoorCollisions,updateDoorCollisions} from '../src/world-rules.js';
import {canStand,movePlayer,worldHit} from '../src/physics.js';
import {pieceBoxes,localToWorld} from '../src/building-shapes.js';
import {ActionToggles} from '../src/comfort-settings.js';
import {supplyHeight,damageSupply,tickSupplyDrops} from '../src/supply-drops.js';
import {snapshotLoot} from '../src/loot-snapshot.js';

test('FPS limits follow fractional display cadence without slowing the 60Hz simulation clock',()=>{
 assert.deepEqual(FPS_LIMITS,[30,60,90,120,144,'unlimited']);
 for(const refresh of [60,90,120,144,165,240])for(const cap of FPS_LIMITS){
  const p=new FramePacer();let frames=0,simulationSteps=0,accumulator=0;
  for(let i=0;i<refresh*5;i++){accumulator+=1/refresh;while(accumulator>=1/60-1e-10){accumulator-=1/60;simulationSteps++;}if(p.shouldRender(i*1000/refresh,cap))frames++;}
  assert.ok(Math.abs(frames-Math.min(refresh,fpsLimit(cap)||refresh)*5)<=1,refresh+'Hz / '+cap+': '+frames);assert.equal(simulationSteps,300);
 }
 const pacer=new FramePacer();pacer.shouldRender(0,30);assert.equal(pacer.shouldRender(10,30),false);assert.equal(pacer.shouldRender(10,144),true);assert.equal(pacer.shouldRender(11,'unlimited'),true);
 for(const corrupt of [undefined,null,-30,17,'invalid',Infinity])assert.equal(fpsLimit(corrupt),60);
});

test('vault passage follows the moving leaf while the opening animation is still running',()=>{
 const door={id:'vault',x:0,y:0,z:0,w:4,h:3.4,d:.18,vault:true},state={open:true,changedAt:0,passable:false},doors={vault:state},source={...door,doorId:'vault',kind:'door'};
 const leaf=worldDoorBox(source,doors,[door],0),map={size:50,theme:'royale',boxes:[leaf]};cacheDoorCollisions(map);const boxes=map.boxes;
 assert.equal(canStand(map,{x:1,y:0,z:0}),false,'locked bolts keep the leaf closed');
 updateDoorCollisions(map,doors,1.6);assert.equal(canStand(map,{x:1,y:0,z:0}),true,'usable space opens before 2.4 seconds');
 assert.equal(state.passable,false);assert.equal(map.boxes,boxes,'animation does not rebuild all collision buckets');
 const s=leaf.collisionShape,hit=worldHit(map,{x:s.x,y:1.4,z:s.z+5},{x:0,y:0,z:-1},10);assert.equal(hit?.box,leaf,'actual moving door stays solid');
 const p={health:100,x:1,y:0,z:1.4,yaw:0,pitch:0,grounded:true,vy:0,flight:'ground',weapon:'sprinter'};
 for(let i=0;i<28;i++){updateDoorCollisions(map,doors,1.6+i/60);movePlayer(p,{forward:1,yaw:0},map,1/60,i/60);assert.equal(canStand(map,p),true);}
 assert.ok(p.z<-.5,'player can enter the visible gap while the leaf swings');
});

test('toggle crouch cannot create a downhill slide on elevated player-built ramps',()=>{
 for(const rotation of [0,1,2,3]){
  const ramp={type:'stairs',id:'ramp',x:0,y:20,z:0,rotation,mask:0,material:'wood'},at=localToWorld(ramp,0,2,.1),p={health:100,...at,y:22,grounded:true,vy:0,vx:0,vz:0,yaw:rotation*Math.PI/2,pitch:0,flight:'ground',weapon:'sprinter'};
  const map={size:100,theme:'royale',boxes:pieceBoxes(ramp),terrain:{size:100,cell:100,n:3,heights:new Float32Array([8,4,0,8,4,0,8,4,0])}};
  const toggles=new ActionToggles(),settings={crouchMode:'toggle'};toggles.press('crouch',settings);const start={x:p.x,z:p.z};
  for(let i=0;i<120;i++){movePlayer(p,{crouch:toggles.value('crouch',false,settings)},map,1/60,i/60);assert.equal(!!p.sliding,false);}
  assert.ok(Math.hypot(p.x-start.x,p.z-start.z)<.01);assert.ok(p.y>21,'crouch does not throw the player off an elevated ramp');
 }
});

test('cut supply motion is continuous, lands once on intervening cover, and replicates health',()=>{
 const c={id:'drop',x:0,y:0,z:0,supply:true,landAt:28,canopyHealth:100,opened:false,contents:[{id:'mini',count:3}]},events=[],s={time:10,chests:[c],loot:[],lootVersion:1,map:{size:100,theme:'royale',boxes:[{x:0,y:15,z:0,w:8,h:1,d:8}]},emit:(type,data)=>events.push({type,...data})};
 const first=snapshotLoot(s).chests[0],height=supplyHeight(c,s.time);damageSupply(s,c,100,{id:'shooter'});
 assert.equal(supplyHeight(c,s.time),height);assert.ok(c.landAt<28);assert.equal(first.canopyHealth,100);assert.equal(snapshotLoot(s).chests[0].canopyHealth,0);
 const clone=structuredClone(c);assert.equal(supplyHeight(clone,11),supplyHeight(c,11));
 for(let i=0;i<240;i++){s.time+=1/60;tickSupplyDrops(s);}
 assert.equal(c.landed,true);assert.equal(c.y,16);assert.equal(c.opened,false);assert.equal(c.contents.length,1);assert.equal(events.filter(e=>e.cue==='supply-land').length,1);
});
