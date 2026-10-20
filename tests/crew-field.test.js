import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {RoyaleSimulation} from '../src/royale.js';
import {inventory} from '../src/building.js';
import {rng} from '../src/data.js';
import {ITEMS} from '../src/royale-data.js';
import {rollItem} from '../src/royale-loot.js';
import {zoneLoadout} from '../src/zone-wars-rules.js';
import {tickHealing} from '../src/progressive-healing.js';
import {newBrain} from '../src/bot-perception.js';
import {chooseObjective,idleOpponent} from '../src/bot-objectives.js';
import {skillFor} from '../src/bot-config.js';
import {LootAuras,lootAuraTier} from '../src/loot-auras.js';

function room(){
 const s=new RoyaleSimulation({capacity:4,bots:0,seed:192,building:false}),p=s.addPlayer('pilot',{name:'Pilot'}),enemy=s.addPlayer('enemy',{name:'Rival'});
 Object.assign(s,{phase:'playing',stage:'active',time:10,elapsed:40,loot:[],chests:[],relays:[],worldBoxes:[],storm:{active:false},map:{id:'test',size:200,boxes:[],floorLoot:[],districts:[],landmarks:[]}});
 for(const [i,q]of [p,enemy].entries())Object.assign(q,{x:i*20,y:0,z:0,health:100,shield:0,shieldUntil:0,equipUntil:0,grounded:true,flight:'ground',spectating:false,connected:true,inventory:inventory(),slot:1,lastDamage:-100,team:i,materials:{wood:500,brick:500,metal:500}});
 return {s,p,enemy};
}
test('all natural loot sources give one medkit and two capsules, including Zone Wars lanes',()=>{
 const random=rng(192);let kits=0,caps=0;
 const check=item=>{if(item.id==='medkit'){assert.equal(item.count,1);kits++;}if(item.id==='splash'){assert.equal(item.count,2);caps++;}};
 for(const source of ['ground','chest','high','supply','epic'])for(let i=0;i<600;i++)check(rollItem(random,source,'utility'));
 for(let i=0;i<200;i++)zoneLoadout(random).forEach(check);
 assert.ok(kits>100&&caps>100);assert.equal(ITEMS.splash.amount,20);
});
test('progressive healing survives damage, weapon pickup, stacking and ammo without restarting or double consumption',()=>{
 const {s,p,enemy}=room();p.health=20;p.inventory[1]={id:'medkit',count:1,rarity:1};s.beginUse(p);const use=p.use;
 s.time+=2;tickHealing(s,p);assert.equal(p.health,40);assert.equal(p.inventory[1].count,0);
 s.damage(p,enemy,10,'Rifle');assert.equal(p.health,30);assert.equal(p.use,use);
 const equip=p.equipUntil;s.takeLoot(p,s.dropLoot(p,{id:'scatter',weapon:true,count:1,rarity:2,ammo:6}));assert.equal(p.use,use);assert.equal(p.slot,1);assert.equal(p.equipUntil,equip);
 s.takeLoot(p,s.dropLoot(p,{id:'medkit',count:1,rarity:1}));s.takeLoot(p,s.dropAmmo(p,'shells',8));assert.equal(p.use,use);assert.equal(p.inventory[1].count,1);
 s.time+=1;tickHealing(s,p);assert.equal(p.health,50);assert.equal(p.inventory[1].count,1);
 s.time=use.end;s.finishUse(p);assert.equal(p.health,100);assert.equal(p.use,null);assert.equal(p.inventory[1].count,1);
});
test('an unconsumed shield use continues through damage and finishes exactly once',()=>{
 const {s,p,enemy}=room();p.inventory[1]={id:'mini',count:2};s.beginUse(p);const use=p.use;s.damage(p,enemy,10,'Rifle');assert.equal(p.use,use);
 s.time=use.end;s.finishUse(p);assert.equal(p.shield,25);assert.equal(p.health,90);assert.equal(p.inventory[1].count,1);assert.equal(p.use,null);
});
test('deliberate selected-slot replacement cancels a consumed kit and conserves the replacement',()=>{
 const {s,p}=room();p.health=20;p.inventory[1]={id:'medkit',count:1};for(let i=2;i<6;i++)p.inventory[i]={id:'pip',weapon:true,count:1,ammo:5};s.beginUse(p);s.time+=2;tickHealing(s,p);
 const item=s.dropLoot(p,{id:'scatter',weapon:true,count:1,ammo:6,rarity:2});assert.equal(s.takeLoot(p,item),true);assert.equal(p.use,null);assert.equal(p.inventory[1].id,'scatter');assert.equal(s.loot.some(i=>i.id==='medkit'),false);
});
test('elimination stops recovery without dropping a consumed medkit',()=>{
 const {s,p,enemy}=room();p.health=20;p.inventory[1]={id:'medkit',count:1};s.beginUse(p);s.time+=2;tickHealing(s,p);s.damage(p,enemy,500,'Rifle');assert.equal(p.use,null);assert.equal(p.health,0);assert.equal(s.loot.some(i=>i.id==='medkit'),false);
});
test('each capsule restores twenty total points, health first, within its range and caps',()=>{
 const {s,p,enemy}=room();p.inventory[1]={id:'splash',count:2};p.health=90;p.shield=50;enemy.x=3;enemy.health=100;enemy.shield=95;
 s.beginUse(p);s.time=p.use.end;s.finishUse(p);assert.equal(p.health,100);assert.equal(p.shield,60);assert.equal(enemy.shield,100);assert.equal(p.inventory[1].count,1);
 enemy.x=20;enemy.shield=0;s.beginUse(p);s.time=p.use.end;s.finishUse(p);assert.equal(p.shield,80);assert.equal(enemy.shield,0);assert.equal(p.inventory[1],null);
});
test('idle bots pursue the nearest eligible opponent and invalidate departed/dead cached targets',()=>{
 const {s,p,enemy}=room();p.bot=true;p.brain=newBrain(s,p);const nearer=s.addPlayer('near',{name:'Near'});Object.assign(nearer,{x:5,y:0,z:0,health:100,spectating:false,flight:'ground',team:2});
 assert.equal(idleOpponent(s,p,p.brain).id,'near');assert.equal(Object.keys(p.brain.memory).length,0,'pursuit must not manufacture visible targets');
 nearer.health=0;assert.equal(idleOpponent(s,p,p.brain).id,enemy.id);enemy.spectating=true;assert.equal(idleOpponent(s,p,p.brain),null);
 enemy.spectating=false;s.time+=.76;assert.equal(idleOpponent(s,p,p.brain).id,enemy.id);
 s.options.teamSize=2;enemy.team=p.team;assert.equal(idleOpponent(s,p,p.brain),null);
});
test('nearest scans are cached and remain below healing, storm and usable loot priorities',()=>{
 const {s,p,enemy}=room();p.bot=true;p.shield=100;p.inventory[1]={id:'sprinter',weapon:true,ammo:30,rarity:2};p.inventory[2]={id:'scatter',weapon:true,ammo:6,rarity:2};s.syncInventory(p);p.brain=newBrain(s,p);
 let scans=0;const values=s.players.values.bind(s.players);s.players.values=()=>{scans++;return values();};
 for(let n=0;n<100;n++)idleOpponent(s,p,p.brain);assert.equal(scans,1);
 assert.equal(chooseObjective(s,p,p.brain,skillFor(s),null).kind,'seek-player');
 p.health=20;p.inventory[3]={id:'medkit',count:1};assert.equal(chooseObjective(s,p,p.brain,skillFor(s),null).kind,'heal');
 s.storm={active:true,x:100,z:100,radius:10,nextX:100,nextZ:100,nextRadius:5,seconds:0,closing:true};assert.equal(chooseObjective(s,p,p.brain,skillFor(s),null).kind,'rotate');
 s.storm.active=false;p.health=100;p.shield=60;p.inventory[3]=null;const item=s.dropLoot(p,{id:'flask',count:1,rarity:2});p.brain.lootMemory[item.uid]={uid:item.uid,at:s.time};assert.equal(chooseObjective(s,p,p.brain,skillFor(s),null).kind,'loot');
});
test('rarity auras reuse one scene node and buffers, grow safely, and omit ammo/materials',()=>{
 const parent=new Group(),auras=new LootAuras(parent,2);assert.equal(parent.children.length,1);auras.begin(0);
 for(let i=0;i<300;i++)auras.add({id:'sprinter',weapon:true,rarity:i%6},{x:i,y:0,z:1});auras.end();assert.equal(auras.geometry.instanceCount,300);assert.equal(parent.children.length,1);assert.equal(auras.offsets.getX(0),0);assert.equal(auras.offsets.getX(299),299);
 const buffer=auras.offsets.array;auras.begin(1);auras.add({id:'mini',rarity:1},{x:3,y:0,z:0});auras.end();assert.equal(auras.offsets.array,buffer);assert.equal(auras.geometry.instanceCount,1);
 assert.equal(lootAuraTier({ammoType:'light'}),-1);assert.equal(lootAuraTier({resource:'wood'}),-1);assert.equal(lootAuraTier({id:'jumpRig'}),5);
 auras.begin(2);auras.end();assert.equal(auras.mesh.visible,false);auras.dispose();assert.equal(parent.children.length,0);
});
