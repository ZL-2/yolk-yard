import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {Simulation} from '../src/simulation.js';
import {movePlayer,canStand} from '../src/physics.js';
import {launchPlayer,fallDamage,resetAirborne} from '../src/airborne.js';
import {inventory,rebuildMap,editBuilding,pieceBoxes} from '../src/building.js';
import {SPAWN_ISLAND} from '../src/spawn-island.js';
import {tickLootMotion,lootHeight} from '../src/loot-motion.js';
import {botInput} from '../src/bots.js';
import {newBrain,observe,selectThreat} from '../src/bot-perception.js';
import {BOT_SKILL} from '../src/bot-config.js';
import {chooseObjective,stormPriority} from '../src/bot-objectives.js';
import {MatchEarnings} from '../src/egg-wallet.js';
import {glidePose} from '../src/glide-pose.js';
const flat={size:80,theme:'royale',boxes:[],spawns:[[0,0],[30,30]],floorLoot:[],districts:[{x:20,z:20,name:'Camp'}],landmarks:[]};
const round=()=>{const s=new RoyaleSimulation({capacity:4,bots:0,seed:141});s.addPlayer('host',{name:'Host'});s.addPlayer('guest',{name:'Guest'});s.startRound();return s;};
const fall=(height,source)=>{const p={health:100,x:0,y:height,z:0,vy:0,grounded:false,yaw:0,pitch:0,flight:'ground',inventory:inventory(),stamina:100};if(source)launchPlayer(p,{source,vy:0});for(let i=0;i<600&&!p.grounded;i++)movePlayer(p,{},flat,1/60);return p;};

test('Spawn Island admits separated contestants, ignores damage and rewards, and atomically discards practice state',()=>{
 const s=round(),p=s.players.get('host');assert.equal(s.stage,'spawn-island');assert.equal(s.map.id,SPAWN_ISLAND.id);
 const join=s.admitPlayer('early',{name:'Early'});assert.ok(join.contestant);assert.equal(join.flight,'ground');assert.ok(canStand(s.map,join));
 assert.ok(Math.hypot(join.x-p.x,join.z-p.z)>2);assert.equal(p.inventory[0].id,'pickaxe');
 s.damage(p,join,1000,'Practice');assert.equal(p.health,100);assert.equal(join.kills,0);
 const earnings=new MatchEarnings();let paid=0;earnings.sample({key:'warmup',eligible:false,active:true,dt:60,kills:20,finished:true,won:true},()=>paid++);assert.equal(paid,0);
 s.dropWeapon(p,'needle',4);s.pads.push({x:0,y:0,z:0});s.projectiles.push({id:1});p.shield=100;p.streak=5;
 s.queueEnds=s.time+.01;s.tick(1/60);assert.equal(s.stage,'battle-bus');assert.equal(s.map.id,'sunnybreak');assert.equal(s.projectiles.length,0);assert.equal(s.pads.length,0);
 for(const egg of s.players.values()){assert.equal(egg.health,100);assert.equal(egg.shield,0);assert.equal(egg.slot,0);assert.deepEqual(egg.inventory.slice(1),Array(5).fill(null));assert.deepEqual(egg.materials,{wood:0,brick:0,metal:0});assert.equal(egg.streak,0);assert.equal(egg.flight,'transport');}
 const copy=new RoyaleSimulation(s.options).restore(s.checkpoint());assert.deepEqual(copy.snapshot(),s.snapshot());
});

test('late join is spectator-only at capacity; forged entry/input/build/pickup requests cannot acquire a life',()=>{
 const s=new RoyaleSimulation({capacity:2,bots:1,fill:true,seed:12});s.addPlayer('host',{name:'Host'});s.startRound();s.beginBattle();const bot=[...s.players.values()].find(p=>p.bot),loot=s.loot.length;
 const guest=s.admitPlayer('late',{name:'Late'});assert.ok(guest);assert.equal(s.players.get(bot.id),bot);assert.equal(s.alive,2);assert.equal(guest.health,0);assert.equal(guest.contestant,false);
 for(const action of ['respawn','rejoin','team-entry-0','inventory-select-1','inventory-drop-1','build-repair'])s.playerAction(guest.id,action);
 s.spawn(guest);s.setInput(guest.id,{seq:4,fire:true,buildMode:true,jump:true},true);s.tick(1/60);assert.equal(guest.health,0);assert.equal(s.builds.length,0);assert.equal(s.takeLoot(guest,s.loot[0]),false);assert.equal(s.loot.length,loot);
 s.leavePlayer(guest.id);assert.equal(s.alive,2);assert.equal(s.players.size,2);
 for(let i=0;i<4;i++)assert.ok(s.admitPlayer('observer-'+i,{name:'Observer '+i})?.lateSpectator);
 assert.equal(s.admitPlayer('overflow',{name:'Overflow'}),null);assert.equal(s.alive,2);
});

test('ordinary landing damage uses the fall apex, respects small jumps, higher landing floors and shields',()=>{
 assert.equal(fallDamage(fall(3).landing),0);assert.equal(fallDamage(fall(12).landing),0);assert.ok(fallDamage(fall(13).landing)>=10);assert.ok(fallDamage(fall(20).landing)>fallDamage(fall(14).landing));assert.ok(fallDamage(fall(24).landing)>=100);
 const p={health:100,x:0,y:0,z:0,grounded:true,vy:0,yaw:0,pitch:0};movePlayer(p,{jump:true},flat,1/60);for(let i=0;i<120&&!p.grounded;i++)movePlayer(p,{},flat,1/60);assert.equal(fallDamage(p.landing),0);
 const s=round();s.beginBattle();s.map={...flat,boxes:[]};const host=s.players.get('host');Object.assign(host,{x:0,z:0,y:24,flight:'ground',grounded:false,vy:0,shield:100});resetAirborne(host);for(let i=0;i<180&&host.health>0;i++)s.tick(1/60);assert.equal(host.health,0);assert.equal(host.shield,100);
 const platform={...flat,boxes:[{x:0,z:0,y:8,w:10,d:10,h:1}]},q={...fall(0),y:20,grounded:false,vy:0};resetAirborne(q);for(let i=0;i<180&&!q.grounded;i++)movePlayer(q,{},platform,1/60);assert.equal(q.y,9);assert.equal(fallDamage(q.landing),0);
});

test('shock launches protect one landing and never deploy a glider; ordinary impulses remain vulnerable',()=>{
 const p={...fall(0)};launchPlayer(p,{source:'shockwave',vy:28,vx:6});let high=0;
 for(let i=0;i<400&&!p.grounded;i++){movePlayer(p,{},flat,1/60);high=Math.max(high,p.y);assert.notEqual(p.flight,'glide');}assert.ok(high>12);assert.equal(fallDamage(p.landing),0);assert.equal(p.fall,null);assert.equal(p.redeploy,false);
 p.y=25;p.grounded=false;p.vy=0;for(let i=0;i<300&&!p.grounded;i++)movePlayer(p,{},flat,1/60);assert.ok(fallDamage(p.landing)>=100);
 assert.ok(fallDamage(fall(25,'impulse').landing)>=100);
 const pad={...fall(0)};launchPlayer(pad,{source:'launchpad',vy:38});let glided=false;for(let i=0;i<600&&!pad.grounded;i++){movePlayer(pad,{},flat,1/60);glided ||=pad.flight==='glide';}assert.ok(glided);assert.equal(fallDamage(pad.landing),0);
});

test('loot descends after support removal and airborne elimination, preserving ownership and final snapshot positions',()=>{
 const s=round();s.beginBattle();s.map={...flat,boxes:[]};s.worldBoxes=[{objectId:'floor',x:0,y:7.8,z:0,w:8,d:8,h:.2}];s.builds=[];rebuildMap(s);s.loot=[];s.chests=[];
 const item=s.dropWeapon({x:0,y:8,z:0},'pip');assert.equal(item.y,8);s.worldDamage.floor={destroyed:true};rebuildMap(s);tickLootMotion(s);assert.ok(item.motion);const start=s.lootVersion;assert.equal(item.y,8);
 s.time+=.3;tickLootMotion(s);assert.ok(item.y>0&&item.y<8);assert.equal(s.lootVersion,start);assert.equal(lootHeight(item,s.time),item.y);
 const restored=new RoyaleSimulation().restore(s.checkpoint());assert.deepEqual(restored.loot,s.loot);
 s.time+=2;tickLootMotion(s);assert.equal(item.y,0);assert.equal(item.motion,undefined);assert.equal(s.loot.length,1);
 const p=s.players.get('host');Object.assign(p,{x:10,y:22,z:0,flight:'ground',grounded:false,health:100});p.inventory[1]={id:'needle',weapon:true,ammo:2,count:1,rarity:1};s.damage(p,null,200,'Test');const dropped=s.loot.find(i=>i.id==='needle');assert.equal(dropped.y,22);assert.ok(dropped.motion);s.time+=3;tickLootMotion(s);assert.equal(dropped.y,0);assert.equal(s.loot.filter(i=>i.id==='needle').length,1);
});

test('bots cannot see through cover, react to incoming damage, and forget hidden movement',()=>{
 const s=new Simulation({bots:0,difficulty:4,seed:10});s.map={...flat,boxes:[{x:0,z:-5,y:0,w:20,d:1,h:5}]};const p=s.addPlayer('bot',{name:'Bot'},true),enemy=s.addPlayer('enemy',{name:'Enemy'});Object.assign(p,{x:0,y:0,z:0,yaw:0,health:100});Object.assign(enemy,{x:0,y:0,z:-10,health:100,spectating:false});p.brain=newBrain(s,p);const b=p.brain,skill=BOT_SKILL[3];observe(s,p,b,skill);assert.equal(Object.keys(b.memory).length,0);
 s.emit('hit',{player:enemy.id,target:p.id,sourceX:enemy.x,sourceY:enemy.y,sourceZ:enemy.z,amount:30});observe(s,p,b,skill);assert.ok(b.memory.enemy);assert.equal(b.memory.enemy.visible,false);assert.notDeepEqual([b.memory.enemy.x,b.memory.enemy.z],[enemy.x,enemy.z]);assert.equal(selectThreat(s,p,b,skill).id,enemy.id);
 const remembered={x:b.memory.enemy.x,z:b.memory.enemy.z};enemy.x=45;enemy.z=45;s.time+=1;observe(s,p,b,skill);assert.deepEqual({x:b.memory.enemy.x,z:b.memory.enemy.z},remembered);
 s.time+=20;observe(s,p,b,skill);assert.equal(b.memory.enemy,undefined);
});

test('bot priorities distinguish survival, useful loot, storm timing and team information',()=>{
 const s=round();s.beginBattle();s.map={...flat,boxes:[]};s.loot=[];s.chests=[];const p=s.players.get('host');Object.assign(p,{x:0,y:0,z:0,flight:'ground'});const b=newBrain(s,p),skill=BOT_SKILL[2];
 s.dropWeapon({x:2,y:0,z:0},'pip');const task=chooseObjective(s,p,b,skill,null);assert.equal(task.kind,'loot');const enemy={x:0,y:0,z:-5,id:'threat',visible:true,confidence:1};b.attackedAt=s.time;assert.notEqual(chooseObjective(s,p,b,skill,enemy).kind,'loot');
 s.storm={active:true,x:0,z:0,radius:100,nextX:60,nextZ:0,nextRadius:15,seconds:20};assert.equal(stormPriority(s,p,skill).kind,'rotate');assert.equal(stormPriority(s,p,skill).urgent,false);s.storm.radius=1;p.x=-5;assert.equal(stormPriority(s,p,skill).urgent,true);
 assert.ok(BOT_SKILL[0].reaction>BOT_SKILL[3].reaction);assert.ok(BOT_SKILL[3].reaction>=.15);assert.ok(BOT_SKILL[3].hit<1);assert.ok(BOT_SKILL[3].decision<BOT_SKILL[0].decision);
});

test('glider deployment, banking and landing poses interpolate without snaps or animation packets',()=>{
 const p={flight:'dive',yaw:0,vx:0,vz:-15};let pose;for(let i=0;i<90;i++)pose=glidePose(pose,p,1/60,i/60);assert.ok(pose.pitch>.6);p.flight='glide';const previous=pose.pitch;pose=glidePose(pose,p,1/60,1.5);assert.ok(Math.abs(pose.pitch-previous)<.12);for(let i=0;i<120;i++)pose=glidePose(pose,p,1/60,2+i/60);assert.ok(pose.glide>.99);p.yaw=1;pose=glidePose(pose,p,1/60,5);assert.ok(Math.abs(pose.roll)<.24);p.flight='ground';for(let i=0;i<180;i++)pose=glidePose(pose,p,1/60,6+i/60);assert.ok(pose.air<.001);assert.ok(Math.abs(pose.pitch)<.001);
});
