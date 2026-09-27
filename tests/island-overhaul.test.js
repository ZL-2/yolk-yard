import {tickLootMotion} from '../src/loot-motion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {ROYALE_MAP as map} from '../src/royale-map.js';
import {groundAt} from '../src/terrain.js';
import {navigation} from '../src/maps.js';
import {movePlayer} from '../src/physics.js';
import {validLootPoint,LOOT_TABLE,AMMO_DROPS} from '../src/royale-loot.js';
import {RoyaleSimulation} from '../src/royale.js';
import {ammoType} from '../src/royale-data.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {damageObject} from '../src/building.js';
const setup=seed=>{const s=new RoyaleSimulation({capacity:4,bots:0,fill:false,seed});s.addPlayer('host',{name:'Host'});s.addPlayer('guest',{name:'Guest'});s.startRound();s.beginBattle();return s;};
test('all POIs and landmarks have supported, unobstructed loot across their floors',()=>{
 for(const p of [...map.floorLoot,...map.chests])assert.ok(validLootPoint(map,p,p.id.includes('chest')?.8:.7),p.id);
 for(const p of [...map.districts,...map.landmarks]){assert.ok(map.floorLoot.filter(a=>a.poi===p.id).length>=2,p.name);assert.ok(map.chests.some(a=>a.poi===p.id),p.name);}
 for(const [i,b]of map.buildings.entries())for(let f=0;f<=b.floors;f++)assert.ok(map.floorLoot.some(a=>a.building===i&&a.floor===f&&a.role==='weapon'),`${b.poi} floor ${f}`);
 assert.ok(groundAt(map,147,218)<.5,'the pier must extend into the inlet');
});
test('navigation reaches every roof and physics can walk interior stairs without jumps',()=>{
 const nav=navigation(map);
 for(const [index,b]of map.buildings.entries()){
  const start={x:b.x,y:b.baseY,z:b.z-b.d/2-1.8},end={x:b.x,y:b.baseY+b.h,z:b.z-b.d*.25},path=nav.path(start,end);
  assert.ok(path.length&&Math.hypot(path.at(-1).x-end.x,path.at(-1).z-end.z)<3&&Math.abs(path.at(-1).y-end.y)<.45,`${index} ${b.type} roof path`);
  if(![0,7,12,23,31,45].includes(index))continue;
  const p={...start,vy:0,grounded:true,flight:'ground',stamina:100,inventory:[null],yaw:0,pitch:0};
  for(const step of path){let frames=0;while(Math.hypot(step.x-p.x,step.z-p.z)>.3&&frames++<180){movePlayer(p,{forward:1,yaw:Math.atan2(p.x-step.x,p.z-step.z)},map,1/60);}assert.ok(frames<180,`stairs ${index}: ${JSON.stringify({p,step})}`);}
  assert.ok(Math.abs(p.y-end.y)<.4,`physics roof ${index}`);
 }
});
test('match loot varies, restores exactly, pairs ammunition and survives support destruction',()=>{
 const a=setup(840),same=setup(840),other=setup(841);
 assert.deepEqual(a.loot,same.loot);assert.notDeepEqual(a.loot,other.loot);
 assert.deepEqual(a.chests,same.chests);assert.notDeepEqual(a.chests,other.chests);
 for(const c of a.chests){assert.equal(c.contents[1].ammoType,ammoType(c.contents[0].id));assert.ok(c.contents[1].count>0);}
 const restored=new RoyaleSimulation(a.options).restore(a.checkpoint());assert.deepEqual(restored.loot,a.loot);assert.deepEqual(restored.chests,a.chests);
 assert.equal(restored.random(),a.random());
 const high=a.loot.find(i=>i.y>groundAt(a.map,i.x,i.z)+3),support=a.map.boxes.find(b=>Math.abs(b.y+b.h-high.y)<.01&&Math.abs(b.x-high.x)<b.w/2&&Math.abs(b.z-high.z)<b.d/2);
 const uid=high.uid,before=a.loot.length;assert.ok(support);damageObject(a,support,10000);assert.equal(a.loot.length,before);assert.equal(a.loot.filter(i=>i.uid===uid).length,1);tickLootMotion(a);a.time+=3;tickLootMotion(a);assert.ok(validLootPoint(a.map,high));
 a.phase='results';a.startRound();a.beginBattle();assert.notDeepEqual(a.loot,same.loot);assert.ok(a.chests.every(c=>!c.opened&&c.contents.length===3));assert.ok(a.loot.every(i=>validLootPoint(a.map,i)));
});
test('pickup deltas stay small after intervening movement frames and preserve removals',()=>{
 const items=Array.from({length:700},(_,uid)=>({uid,id:'sprinter',x:uid,y:0,z:4,weapon:true}));
 const enc=new SnapshotEncoder(),dec=new SnapshotDecoder(),wire=o=>JSON.parse(JSON.stringify(o));
 const send=m=>{const encoded=wire(enc.encode(m));assert.deepEqual(dec.decode(encoded.frame),wire(m));return JSON.stringify(encoded).length;};
 send({type:'state',state:{players:[],royale:{loot:items,chests:[{id:'chest',opened:false}],lootVersion:1}}});
 for(let i=0;i<3;i++)send({type:'state',state:{players:[],royale:{lootVersion:1}}});
 const bytes=send({type:'state',state:{players:[],royale:{loot:items.slice(1),chests:[{id:'chest',opened:true}],lootVersion:2}}});assert.ok(bytes<400,`${bytes} bytes`);
 assert.equal(new Set(LOOT_TABLE.filter(i=>i.weapon).map(i=>i.id)).size,11);assert.equal(Object.keys(AMMO_DROPS).length,5);
});
