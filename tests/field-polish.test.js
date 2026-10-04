import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {rng,gun} from '../src/data.js';
import {candidates,rayBox,wallDistance,canStand,invalidateCollision,direction,humanHit} from '../src/physics.js';
import {terrainHit} from '../src/terrain.js';
import {nearbyItems,itemsChanged,itemById} from '../src/nearby-items.js';
import {snapshotLoot} from '../src/loot-snapshot.js';
import {BOSSES,bossMapMarkers,bossDefeatMessage} from '../src/bosses.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {RoyaleSimulation} from '../src/royale.js';
import {newBrain} from '../src/bot-perception.js';
import {chooseObjective} from '../src/bot-objectives.js';
import {skillFor} from '../src/bot-config.js';
import {botInput} from '../src/bots.js';
import {executeRoyaleIntent,royaleAimError} from '../src/royale-bot-execution.js';
import {inventory} from '../src/building.js';
import {movePlayer} from '../src/physics.js';
import {RoyaleView} from '../src/royale-view.js';
function flat(){const s=new RoyaleSimulation({mode:'royale',capacity:2,bots:0,fill:false,seed:191,building:false});const p=s.addPlayer('bot',{name:'Bot'},true),enemy=s.addPlayer('human',{name:'Human'});s.phase='playing';s.stage='active';s.time=10;s.elapsed=40;s.matchId='polish';s.map={id:'flat',theme:'royale',size:256,boxes:[],floorLoot:[],landmarks:[],districts:[]};s.nav={path:()=>[]};s.relays=[];s.loot=[];s.chests=[];s.storm={active:false};for(const q of [p,enemy])Object.assign(q,{inventory:inventory(),bank:{light:0,medium:0,heavy:0,shells:0,rockets:0},materials:{wood:0,brick:0,metal:0},x:0,y:0,z:0,yaw:0,pitch:0,health:100,shield:100,shieldUntil:0,lastDamage:-100,grounded:true,flight:'ground',contestant:true,spectating:false,slot:0,botPath:[],brain:null});enemy.z=-18;p.brain=newBrain(s,p);s.syncInventory(p);return {s,p,enemy};}
test('numeric collision buckets match exhaustive exact rays and occupancy across boundaries and edits',()=>{
 const random=rng(113),map={theme:'royale',size:80,boxes:Array.from({length:220},(_,i)=>({x:i<3?i*8:(random()-.5)*140,y:random()*5,z:(random()-.5)*140,w:.1+random()*18,h:.15+random()*8,d:.1+random()*16}))};
 for(let i=0;i<2500;i++){const o={x:(random()-.5)*160,y:random()*18,z:(random()-.5)*160},d=direction(random()*Math.PI*2,(random()-.5)*2),max=random()*150;const boxes=Math.min(max,...map.boxes.map(b=>rayBox(o,d,b,max))),ground=terrainHit(map,o,d,boxes),expected=Math.min(boxes,ground?.distance??boxes);assert.ok(Math.abs(wallDistance(map,o,d,max)-expected)<1e-8);
  const height=1.85,blocked=map.boxes.some(b=>o.y+.035<b.y+b.h&&o.y+height>b.y+.02&&Math.abs(o.x-b.x)<b.w/2+.32&&Math.abs(o.z-b.z)<b.d/2+.32);assert.equal(canStand(map,o),!blocked&&Math.abs(o.x)<=map.size-.32&&Math.abs(o.z)<=map.size-.32);
 }
 const crossing={x:7.9,y:0,z:8},box={x:8.3,y:0,z:8,w:.2,h:3,d:4};map.boxes=[box];invalidateCollision(map);assert.equal(canStand(map,crossing),false);assert.ok(Math.abs(wallDistance(map,{x:0,y:1,z:8},{x:1,y:0,z:0},20)-8.2)<1e-8);map.boxes=[];invalidateCollision(map);assert.equal(wallDistance(map,crossing,{x:1,y:0,z:0},20),20);
 const outer=candidates(map,crossing);wallDistance(map,crossing,{x:1,y:0,z:0},20);assert.equal(outer.length,0,'nested queries retain their own result');
});
test('authored island terrain rays still match exhaustive boxes plus terrain',()=>{
 const r=rng(573);for(let i=0;i<180;i++){const o={x:(r()-.5)*460,y:20+r()*50,z:(r()-.5)*460},d=direction(r()*Math.PI*2,(r()-.8)*1.7),max=120;const boxes=Math.min(max,...ROYALE_MAP.boxes.map(b=>rayBox(o,d,b,max))),ground=terrainHit(ROYALE_MAP,o,d,boxes);assert.ok(Math.abs(wallDistance(ROYALE_MAP,o,d,max)-Math.min(boxes,ground?.distance??boxes))<1e-8);}
});
test('loot indices handle incremental pickup/drop, XY relocation, count changes and recovery arrays',()=>{
 const a={uid:1,x:0,z:0,count:20},b={id:'chest',x:0,z:0,opened:false},s={loot:[a],chests:[b],lootVersion:1,lootSpatialVersion:0,chestSpatialVersion:0};assert.deepEqual(nearbyItems(s,'loot',a,3),[a]);a.count=10;s.lootVersion++;assert.equal(itemById(s,'loot',1),a);
 a.x=80;itemsChanged(s,'loot',a);assert.deepEqual(nearbyItems(s,'loot',{x:0,z:0},3),[]);assert.deepEqual(nearbyItems(s,'chests',{x:0,z:0},3),[b]);const c={uid:2,x:1,z:0};s.loot.push(c);itemsChanged(s,'loot',c);assert.equal(itemById(s,'loot',2),c);s.loot.splice(0,1);itemsChanged(s,'loot',a,true);assert.equal(itemById(s,'loot',1),undefined);s.loot=[{uid:9,x:0,z:0}];assert.equal(itemById(s,'loot',9),s.loot[0]);
});
test('world snapshots reuse immutable static records and refresh stack, chest and motion transitions',()=>{
 const s={loot:[{uid:1,x:0,y:5,z:0,motion:{from:5,at:0,vy:0,floor:0}}],chests:[{id:'c',opened:false,contents:[{secret:true}]}],lootVersion:1};const a=snapshotLoot(s);assert.equal(snapshotLoot(s).loot,a.loot);assert.equal(a.chests[0].contents,undefined);s.loot[0].motion.floor=1;assert.equal(a.loot[0].motion.floor,0,'detached from mutable simulation');s.lootVersion++;s.chests[0].opened=true;const b=snapshotLoot(s);assert.notEqual(a.loot,b.loot);assert.equal(a.chests[0].opened,false);assert.equal(b.chests[0].opened,true);
});
test('a landed unarmed bot takes a reachable gun even with an enemy in view, then moves to fight',()=>{
 const {s,p,enemy}=flat(),drop=s.dropWeapon({x:1,y:0,z:0},'sprinter',1);let input=botInput(s,p);assert.equal(p.brain.task.kind,'loot');assert.equal(input.interact,true);assert.equal(input.fire,false);s.interact(p,input,1/60);assert.equal(p.inventory[1].id,'sprinter');assert.equal(itemById(s,'loot',drop.uid),undefined);
 let travelled=0,fired=0;for(let i=0;i<360;i++){s.time+=1/60;const before={x:p.x,z:p.z};input=executeRoyaleIntent(s,p,botInput(s,p));movePlayer(p,input,s.map,1/60);s.interact(p,input,1/60);travelled+=Math.hypot(p.x-before.x,p.z-before.z);if(input.fire)fired++;}
 assert.ok(travelled>8,'combat continues moving');assert.ok(fired>0&&fired<160,'bot shoots with recovery pauses');assert.equal(p.brain.task.kind,'fight');assert.ok(enemy.health>0);
});
test('unarmed landing searches a chest or room; an armed bot keeps looting with a distant enemy',()=>{
 const {s,p,enemy}=flat(),brain=p.brain,skill=skillFor(s);s.chests=[{id:'c',x:5,y:0,z:0}];assert.equal(chooseObjective(s,p,brain,skill,{...enemy,visible:true}).kind,'chest');s.chests=[];s.map.floorLoot=[{id:'room',role:'weapon',x:20,y:0,z:0}];assert.equal(chooseObjective(s,p,brain,skill,{...enemy,visible:true}).kind,'search-room');
 p.inventory[1]={id:'sprinter',weapon:true,rarity:1,ammo:30};s.syncInventory(p);s.dropWeapon({x:2,y:0,z:0},'doubleyolk',2);const task=chooseObjective(s,p,brain,skill,{...enemy,z:-90,visible:true});assert.equal(task.kind,'loot');
});
test('distance makes real bot rays less accurate; fire duty gives players a response window',()=>{
 const results=[];for(const distance of [8,28,58]){const {s,p,enemy}=flat();enemy.z=-distance;p.inventory[1]={id:'sprinter',weapon:true,rarity:1,ammo:30};p.slot=1;s.syncInventory(p);p.brain.target=enemy.id;p.brain.memory[enemy.id]={...enemy,visible:true,seenAt:s.time};let shots=0,hits=0,frames=0;
  const input={slot:1,yaw:0,pitch:0,combatAim:true,worldMoveX:1,worldMoveZ:0};for(let i=0;i<3600;i++){s.time+=1/60;p.brain.memory[enemy.id].seenAt=s.time;const out=executeRoyaleIntent(s,p,input);p.yaw=out.yaw;p.pitch=out.pitch;if(out.fire){frames++;if(i%7===0){shots++;if(Number.isFinite(humanHit({x:p.x,y:p.y+1.7,z:p.z},direction(out.yaw,out.pitch),enemy).distance))hits++;}}}
  results.push(hits/shots);assert.ok(frames/3600<.4);assert.ok(frames/3600>.12);
 }assert.ok(results[0]>results[1]&&results[1]>results[2],JSON.stringify(results));assert.ok(results[2]<.35,JSON.stringify(results));
 const skill=skillFor({options:{mode:'royale',difficulty:2}});assert.ok(royaleAimError(skill,60)>royaleAimError(skill,10)*2);
});
test('every boss has its own defeat rewards and independent live/dead map marker',()=>{
 const players=BOSSES.map(b=>({id:b.id,bossId:b.id,boss:true,health:b.health})),markers=bossMapMarkers(ROYALE_MAP,players);assert.equal(markers.length,3);assert.deepEqual(markers.map(m=>m.id),BOSSES.map(b=>b.id));players[1].health=0;assert.equal(bossMapMarkers(ROYALE_MAP,players)[1].alive,false);assert.equal(bossMapMarkers(ROYALE_MAP,players)[0].alive,true);
 for(const b of BOSSES){const text=bossDefeatMessage({target:b.id,name:b.name});assert.ok(text.startsWith(b.name.toUpperCase()+' DEFEATED'));assert.match(text,/Mythic/);if(b.id!=='warden-aster')assert.ok(!text.includes('Voss'));}assert.match(bossDefeatMessage({target:'marshal-rook'}),/Anchor Winch/);assert.match(bossDefeatMessage({target:'lieutenant-nyx'}),/Veil Projector/);
});
test('collectible rendering budgets new models, prioritizes nearby loot and removes stale IDs',()=>{
 const v=Object.assign(Object.create(RoyaleView.prototype),{view:{settings:{quality:'high'},disposeGroup:g=>g.clear()},root:new THREE.Group(),loot:new Map(),chests:new Map(),itemModel:()=>new THREE.Group(),chestModel:()=>{const g=new THREE.Group();g.userData.lid=new THREE.Group();return g;}}),r={loot:Array.from({length:1000},(_,uid)=>({uid,id:'mini',x:uid===999?1:50+uid,y:0,z:0})),chests:[],lootVersion:1},p={x:0,z:0};v.updateCollectibles(r,p,1/60,0,0);assert.ok(v.loot.size<=3);assert.equal(v.loot.has(999),true);const first=r.loot.find(i=>i.uid===999);r.loot=r.loot.filter(i=>i!==first);r.lootVersion++;v.updateCollectibles(r,p,1/60,.02,.02);assert.equal(v.loot.has(999),false);assert.ok(v.loot.size<=5);
});
