import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {movePlayer,canStand} from '../src/physics.js';
import {inventory} from '../src/building.js';
import {newBrain,hostile} from '../src/bot-perception.js';
import {botInput} from '../src/bots.js';
import {scheduledBotInput} from '../src/bot-runtime.js';
import {shadowCharges,shadowRechargeState,startShadowstep} from '../src/shadowstep.js';
import {SnapshotEncoder,SnapshotDecoder,SnapshotBatch} from '../src/snapshot-codec.js';
import {snapshotLoot} from '../src/loot-snapshot.js';
import {PublicJoinChime} from '../src/public-join-chime.js';
function flat(){const s=new RoyaleSimulation({capacity:2,bots:0,fill:false,seed:321,building:false}),p=s.addPlayer('bot',{name:'Scout'},true),human=s.addPlayer('human',{name:'Human'});s.phase='playing';s.stage='active';s.time=10;s.map={id:'flat',theme:'royale',size:256,boxes:[],floorLoot:[],landmarks:[],districts:[]};s.nav={path:()=>[]};s.relays=[];s.smokes=[];s.loot=[];s.chests=[];s.storm={active:false};for(const q of [p,human])Object.assign(q,{x:0,y:0,z:0,health:100,shield:0,flight:'ground',grounded:true,vy:0,yaw:0,pitch:0,slot:0,inventory:inventory(),bank:{medium:0,shells:0,heavy:0,light:0,rockets:0},materials:{wood:0,brick:0,metal:0},lastDamage:-100,contestant:true,spectating:false});human.z=-20;p.brain=newBrain(s,p);return {s,p,human};}
test('Shadowstep retains the item, recharges six charges, blocks spam and replicates a detached dash',()=>{
 const{s,p}=flat(),item={id:'shadowstep',rarity:5,count:1};p.inventory[1]=item;p.slot=1;
 for(let i=0;i<6;i++){s.time=10+i;assert.equal(startShadowstep(p,item,s.time),true);assert.equal(startShadowstep(p,item,s.time),false);}assert.equal(item.charges,0);assert.equal(item.count,1);assert.equal(shadowRechargeState(item,17).remaining,3);assert.equal(shadowCharges(item,20),1);assert.equal(shadowCharges(item,70),6);
 const enc=new SnapshotEncoder(),dec=new SnapshotDecoder();let state=dec.decode(JSON.parse(JSON.stringify(enc.encode({state:s.snapshot()},new SnapshotBatch()).frame))).state;
 const row=state.players.find(q=>q.id===p.id);assert.ok(row.shadowstep);assert.equal(row.inventory[1].charges,6);row.shadowstep.x=999;assert.notEqual(p.shadowstep.x,999);assert.equal(hostile(s,flat().p,p),false);
});
test('Shadowstep travels nine metres, stops at thin walls, and protects its resulting fall',()=>{
 const{s,p}=flat();p.fall={apex:40,immune:false,source:'normal'};assert.equal(startShadowstep(p,{id:'shadowstep'},s.time),true);for(let i=0;i<12;i++)movePlayer(p,{},s.map,1/60);assert.ok(Math.abs(p.z+9)<.01);assert.equal(p.landing.immune,true);
 Object.assign(p,{x:0,y:0,z:0,vy:0,grounded:true});s.map.boxes=[{x:0,y:0,z:-3,w:4,h:4,d:.1}];assert.equal(startShadowstep(p,{id:'shadowstep'},s.time+2),true);for(let i=0;i<12;i++)movePlayer(p,{},s.map,1/60);assert.ok(p.z>-2.64);assert.ok(canStand(s.map,p));
});
test('bots finish chest searches through scheduled intent ticks and move on to the gun',()=>{
 const{s,p}=flat();s.chests=[{id:'test',x:1,y:0,z:0,opened:false,contents:[{id:'sprinter',weapon:true,count:1,rarity:1,ammo:30}]}];s.players.delete('human');
 let openedAt=0;for(let i=0;i<100;i++){s.time+=1/60;const input=scheduledBotInput(s,p,()=>botInput(s,p),{combat:.16,roam:.25});movePlayer(p,input,s.map,1/60);s.interact(p,input,1/60);if(s.chests[0].opened&&!openedAt)openedAt=i;}
 assert.ok(openedAt>0&&openedAt<65);assert.ok(p.inventory.some(i=>i?.weapon),'bot collects the chest gun');
});
test('an unarmed bot defends against a point-blank player with its pickaxe',()=>{
 const{s,p,human}=flat();human.z=-1.7;const input=botInput(s,p);assert.equal(p.brain.task.kind,'melee');assert.equal(input.slot,0);assert.equal(input.fire,true);
});
test('Nyx bunker floor stays at its authored height during sustained walking',()=>{
 const{s,p}=flat(),v=ROYALE_MAP.vaults.find(v=>v.id==='nyx-vault');s.map={...ROYALE_MAP,boxes:ROYALE_MAP.boxes.filter(b=>!b.doorId)};Object.assign(p,{x:v.x,y:v.y,z:v.z+3,grounded:true,vy:0});
 const heights=[];for(let i=0;i<180;i++){movePlayer(p,{yaw:0,forward:i<50?1:0},s.map,1/60);heights.push(p.y);assert.ok(canStand(s.map,p));}assert.ok(Math.max(...heights)-Math.min(...heights)<.01);
});
test('changing a single loot stack preserves other immutable wire records',()=>{
 const sim={loot:[{uid:1,id:'mini',count:1},{uid:2,id:'flask',count:2}],chests:[],lootVersion:1};const first=snapshotLoot(sim),batch=new SnapshotBatch(),a=batch.clone(first.loot);sim.loot[0].count++;sim.lootVersion++;const second=snapshotLoot(sim),b=new SnapshotBatch().clone(second.loot);assert.notEqual(first.loot[0],second.loot[0]);assert.equal(first.loot[1],second.loot[1]);assert.equal(a[1],b[1]);assert.equal(a[0].count,1);assert.equal(b[0].count,2);
});
test('freezing a wrapper does not cache its mutable nested data across broadcasts',()=>{
 const nested={charges:3},record=Object.freeze({id:'shadowstep',nested});const first=new SnapshotBatch().clone(record);nested.charges=2;const next=new SnapshotBatch().clone(record);assert.equal(first.nested.charges,3);assert.equal(next.nested.charges,2);
});
test('public arrival chime ignores initial status, bot fills, repeated updates and in-match joins',()=>{
 const chime=new PublicJoinChime();assert.equal(chime.update({joinSerial:5,botPlayers:47},true),false);assert.equal(chime.update({joinSerial:5,botPlayers:45},true),false);assert.equal(chime.update({joinSerial:6},true),true);assert.equal(chime.update({joinSerial:6},true),false);assert.equal(chime.update({joinSerial:7},false),false);assert.equal(chime.update({joinSerial:7},true),false);
});
