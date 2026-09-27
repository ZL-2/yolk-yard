import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {canStand,dist,wallDistance,direction,EYE} from '../src/physics.js';

test('arena seats replace bots, refill departures, reject a ninth human and reserve names',()=>{
 const s=new Simulation({bots:7,fill:true,seed:8});s.addPlayer('host',{name:'Host Egg'});s.startRound();
 for(let i=1;i<8;i++)assert.ok(s.admitPlayer('human'+i,{name:'Player '+i}));
 assert.equal(s.players.size,8);assert.equal([...s.players.values()].some(p=>p.bot),false);
 assert.equal(s.admitPlayer('extra',{name:'New Egg'}),null);
 assert.equal(s.admitPlayer('same',{name:'host egg'}),null);
 s.leavePlayer('human1');assert.equal(s.players.size,8);assert.equal([...s.players.values()].filter(p=>p.bot).length,1);
 assert.ok(s.admitPlayer('replacement',{name:'New Egg'}));assert.equal(s.players.size,8);
});

test('spawns are separated, clear of cover, and face an open route',()=>{
 const s=new Simulation({bots:7,fill:true,seed:17});s.addPlayer('host',{name:'Host Egg'});s.startRound();s.playerAction('host','rejoin');s.tick(1/60);
 const players=[...s.players.values()].filter(p=>p.health>0);
 for(const p of players){assert.ok(canStand(s.map,p,.8));assert.ok(wallDistance(s.map,{...p,y:p.y+EYE},direction(p.yaw),10)>=4);for(const q of players)if(q!==p)assert.ok(dist(p,q)>=6.9);}
});

test('Royale checkpoints retain spectator admission and the original bot life',()=>{
 const s=new RoyaleSimulation({capacity:4,bots:3,fill:true,seed:17});s.addPlayer('host',{name:'Host Egg'});s.startRound();s.beginBattle();
 const bot=[...s.players.values()].find(p=>p.bot);Object.assign(bot,{health:42,shield:23,flight:'ground',slot:2});bot.inventory[2]={id:'pip',weapon:true,ammo:7,count:1,rarity:2};s.syncInventory(bot);
 const p=s.admitPlayer('guest',{name:'Guest Egg'});assert.equal(p.health,0);assert.equal(p.spectating,true);assert.equal(p.contestant,false);assert.equal(bot.inventory[2].ammo,7);assert.equal(s.players.size,5);
 const copy=new RoyaleSimulation(s.options).restore(s.checkpoint());assert.deepEqual(copy.snapshot(),s.snapshot());
 copy.leavePlayer('guest');assert.equal(copy.players.size,4);assert.equal(copy.alive,s.alive);copy.leavePlayer('host');assert.equal(copy.players.size,4);assert.equal(copy.players.has('host'),false);
});

test('a Royale bot finishes a queued popper throw after firing a weapon',()=>{
 const s=new RoyaleSimulation({capacity:2,bots:1,fill:true,seed:17});s.addPlayer('host',{name:'Host Egg'});s.startRound();s.beginBattle();s.map={size:100,theme:'royale',boxes:[]};
 const bot=[...s.players.values()].find(p=>p.bot);
 Object.assign(bot,{x:70,y:0,z:0,flight:'ground',grounded:true,slot:1,useLatch:true,brain:{utility:{slot:2,yaw:0,pitch:.35,until:s.time+1}}});
 bot.inventory[1]={id:'pip',weapon:true,ammo:7,count:1,rarity:0};bot.inventory[2]={id:'popper',count:2,rarity:1};s.syncInventory(bot);
 for(let i=0;i<30;i++)s.tick(1/60);
 assert.equal(bot.inventory[2].count,1);assert.equal(bot.use,null);
 assert.ok(s.projectiles.some(p=>p.owner===bot.id&&p.popper));
});
