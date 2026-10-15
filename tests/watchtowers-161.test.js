import test from 'node:test';
import assert from 'node:assert/strict';
import {ROYALE_MAP} from '../src/royale-map.js';
import {groundAt} from '../src/terrain.js';
import {canOccupy,canStand,movePlayer,rayBox} from '../src/physics.js';
import {authorWatchtowers,WATCHTOWER_SITES,WATCHTOWER_LAYOUT,watchtowerPoint,dressWatchtower} from '../src/watchtowers.js';

function fixture(){
 const c={terrain:{...ROYALE_MAP.terrain,heights:ROYALE_MAP.terrain.heights.slice()},boxes:[],floorLoot:[],chests:[],navLinks:[],landmarks:[],signs:[]};
 const {watchtowers}=authorWatchtowers(c);return {c,watchtowers,map:{id:'watchtower-fixture',theme:'royale',size:256,terrain:c.terrain,boxes:c.boxes}};
}

test('four military outposts reserve open land clear of occupied structures and roads',()=>{
 const {c,watchtowers}=fixture();assert.equal(watchtowers.length,4);assert.equal(new Set(watchtowers.map(t=>t.id)).size,4);
 const solids=ROYALE_MAP.boxes.filter(b=>!b.watchtowerId&&b.kind!=='tree'&&(b.prop===undefined||!['rock','bush'].includes(ROYALE_MAP.props[b.prop].kind)));
 for(const tower of watchtowers){
  assert.ok(Math.abs(tower.x)+12.2<ROYALE_MAP.size&&Math.abs(tower.z)+12.2<ROYALE_MAP.size);
  assert.ok(tower.baseY>2,'outpost stays on dry land');
  for(const b of solids){const distance=Math.hypot(Math.max(0,Math.abs(b.x-tower.x)-b.w/2),Math.max(0,Math.abs(b.z-tower.z)-b.d/2));assert.ok(distance>20,`${tower.id}: existing ${b.kind} is ${distance}m away`);}
  for(const road of ROYALE_MAP.roads)for(let i=1;i<road.points.length;i++){
   const [ax,az]=road.points[i-1],[bx,bz]=road.points[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((tower.x-ax)*dx+(tower.z-az)*dz)/(dx*dx+dz*dz))),distance=Math.hypot(tower.x-ax-dx*t,tower.z-az-dz*t)-road.width/2;
   assert.ok(distance>15,`${tower.id} must leave the road clear`);
  }
  for(const p of [tower.entry,...tower.parts.filter(p=>p.towerPart==='footing')])assert.ok(Math.abs(groundAt({terrain:c.terrain},p.x,p.z)-tower.baseY)<1e-5,'ground, footing and stair entrance share the flattened pad');
  assert.ok(tower.parts.length<=280,'parts are bounded and merged with ordinary static geometry');
  for(const b of tower.parts){assert.ok(b.w>0&&b.d>0&&b.h>0);assert.ok(Math.abs(b.x-tower.x)+b.w/2<=tower.w/2+.001&&Math.abs(b.z-tower.z)+b.d/2<=tower.d/2+.001);assert.ok(['metal','concrete','paint'].includes(b.surface));}
 }
 assert.equal(c.navLinks.length,16);assert.equal(c.landmarks.length,4);assert.equal(c.boxes.length,1080);
});

test('every wraparound stair and deck works through actual player movement at all four rotations',()=>{
 const {watchtowers,map}=fixture();let clock=0;
 for(const tower of watchtowers){
  const p={id:'tower-walker',...tower.entry,health:100,yaw:0,pitch:0,flight:'ground',grounded:true,vy:0,inventory:[]};
  const walkTo=q=>{
   for(let i=0;i<360;i++){
    const dx=q.x-p.x,dz=q.z-p.z,distance=Math.hypot(dx,dz);if(distance<.09)return;
    const dt=1/60;movePlayer(p,{forward:Math.min(1,distance/(5*dt)),yaw:Math.atan2(-dx,-dz),pitch:0},map,dt,clock+=dt);
    assert.ok(canOccupy(map,p),`${tower.id}: no stair, guardrail or deck penetration`);
   }
   assert.fail(`${tower.id}: route stuck at ${JSON.stringify(p)} toward ${JSON.stringify(q)}`);
  };
  for(const [i,flight]of tower.stairs.entries()){
   assert.equal(flight.points.length,WATCHTOWER_LAYOUT.steps+2);
   for(let j=1;j<flight.points.length;j++)assert.ok(flight.points[j].y-flight.points[j-1].y<=.431,'each riser fits the shared step-up limit');
   for(const q of [...flight.points,tower.levels[i].landing,tower.levels[i].entrance,watchtowerPoint(tower,0,(i+1)*3.6,0)])walkTo(q);
   assert.ok(Math.abs(p.y-tower.levels[i].y)<1e-5,`${tower.id}: floor ${i+1} is reachable`);assert.ok(canStand(map,p),'each occupied deck has standing headroom');
   for(const q of [tower.levels[i].entrance,tower.levels[i].landing])walkTo(q);
  }
  // Open ground below the tower is not a giant square invisible collider.
  const origin=watchtowerPoint(tower,-2,1.5,0),end=watchtowerPoint(tower,2,1.5,0),dir={x:(end.x-origin.x)/4,y:0,z:(end.z-origin.z)/4};
  assert.equal(Math.min(...tower.parts.map(b=>rayBox(origin,dir,b,4))),Infinity);
 }
});

test('all deck loot and both guaranteed chests occupy real standing-clear supported floors',()=>{
 const {watchtowers,map,c}=fixture();assert.equal(c.floorLoot.length,32);assert.equal(c.chests.length,8);
 for(const tower of watchtowers){
  assert.equal(tower.loot.length,8);assert.equal(tower.chests.length,2);assert.deepEqual(tower.chests.map(p=>p.floor),[2,4]);
  for(const p of [...tower.loot,...tower.chests]){
   assert.ok(canStand(map,p,.45),'the player can stand at every reward socket');
   assert.ok(tower.parts.some(b=>b.towerPart==='deck'&&Math.abs(b.y+b.h-p.y)<1e-5&&Math.abs(b.x-p.x)<b.w/2&&Math.abs(b.z-p.z)<b.d/2));
  }
  assert.ok(tower.chests.every(p=>p.chance===1));
 }
});

test('authoring and renderer-only dressing are deterministic and keep collision unchanged',()=>{
 const a=fixture(),b=fixture();assert.deepEqual(a.watchtowers,b.watchtowers);assert.deepEqual(a.c.terrain.heights,b.c.terrain.heights);
 const snapshot=JSON.stringify(a.watchtowers),calls=[];const kit={beam:(...args)=>calls.push(['beam',...args.slice(1)]),block:(...args)=>calls.push(['block',...args.slice(1)])};
 for(const tower of a.watchtowers)dressWatchtower({},tower,kit);
 assert.equal(JSON.stringify(a.watchtowers),snapshot);assert.ok(calls.length<=128,'close-only dressing uses a small bounded mesh budget');assert.equal(WATCHTOWER_SITES.length,4);
});
