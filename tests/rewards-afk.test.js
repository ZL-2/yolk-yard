import test from 'node:test';import assert from 'node:assert/strict';
import {calculateReward} from '../src/rewards.js';import {ProgressionService} from '../server/realtime/progression.js';
import {newActivity,observeInput,observeMotion,activityRemaining} from '../src/activity.js';
import {SPAWN_ISLAND,SPAWN_REGIONS,distributedSpawn} from '../src/spawn-island.js';import {canStand} from '../src/physics.js';import {groundAt} from '../src/terrain.js';
const active={active:160,distance:600,damage:120,contributions:8};
const pay=(n,{difficulty=0,custom=false,place=1,player=active,elapsed=300,...rest}={})=>calculateReward({player,elapsed,opponents:Array.from({length:n-1},()=>({...active,bot:!!difficulty,difficulty})),custom,mode:'royale',place,won:place===1,...rest});
test('reward budgets scale by difficulty and population with diminishing returns',()=>{
 const rows=[2,4,8,16,32].map(n=>({n,human:pay(n).amount,casual:pay(n,{difficulty:1}).amount,intermediate:pay(n,{difficulty:2}).amount,advanced:pay(n,{difficulty:3}).amount,impossible:pay(n,{difficulty:4}).amount}));
 for(const r of rows){assert.ok(r.casual<r.intermediate&&r.intermediate<r.advanced&&r.advanced<r.impossible&&r.impossible<r.human);assert.ok(r.casual<r.human*.15);assert.ok(r.human<=600);}assert.ok(rows.at(-1).human>rows[0].human*2);assert.ok(rows.at(-1).human<rows[0].human*4);
 assert.ok(pay(32,{place:1}).amount>pay(32,{place:5}).amount);assert.ok(pay(32,{place:5}).amount>pay(32,{place:31}).amount);assert.ok(pay(32,{custom:true}).amount<pay(32).amount*.6);console.log('Reward matrix',JSON.stringify(rows));
});
test('idle, short, AFK, duplicate trades and hourly limits cannot farm normal rewards',()=>{
 assert.equal(pay(32,{player:{...active,active:0}}).amount,0);assert.equal(pay(32,{player:{...active,distance:0,damage:0,contributions:0}}).amount,0);assert.equal(pay(32,{elapsed:40}).amount,0);assert.equal(pay(32,{player:{...active,afkRemoved:true}}).amount,0);
 assert.equal(pay(32,{hourEarned:900}).amount,0);assert.equal(pay(32,{hourEarned:899}).amount,1);
 const fresh=pay(4,{eliminations:[{bot:false,repeat:0}]}),repeated=pay(4,{eliminations:[{bot:false,repeat:4}]});assert.ok(fresh.amount>repeated.amount);
 assert.equal(calculateReward({player:active,elapsed:300,opponents:[{active:0}],won:true}).amount,0);
});
test('59 seconds counts meaningful input, ignores stationary packets and fixed jitter, exempts no game state by packet arrival',()=>{
 const a=newActivity();for(let t=0;t<59;t++){observeInput(a,{yaw:0,pitch:0,slot:t%2},t);observeMotion(a,{x:0,z:0},1,t);}assert.equal(activityRemaining(a,59),0);
 const b=newActivity();for(let t=0;t<100;t++){observeInput(b,{yaw:t%2?.1:0,pitch:0},t);}assert.ok(b.last<99,'fixed loop cannot continually reset inactivity');
 const c=newActivity();for(let t=0;t<90;t++){observeMotion(c,{x:t*2,z:0},1,t);}assert.ok(activityRemaining(c,90)>57);assert.ok(c.active>=85);
});
test('relay binds entrants to real connections, settles once, and never trusts client balances',async()=>{
 let now=0;const sent=[],relay={peers:new Map(),send:(p,m)=>sent.push([p.id,m])},service=new ProgressionService(relay,{clock:()=>now,path:null});await service.ready;
 const host={id:'room',progressId:'host-account',ws:{},listing:{},links:new Map(),rewardPublic:true},guest={id:'guest',progressId:'guest-account',ws:{},links:new Map([['g',host]])};host.links.set('g',guest);relay.peers.set(host.id,host);relay.peers.set(guest.id,guest);
 const state=t=>({round:1,matchId:'m',mode:'royale',difficulty:1,phase:'playing',stage:'active',hostId:'host',input:{yaw:t/3,pitch:0},players:[{id:'host',x:t*2,z:0,y:0,health:100,place:1},{id:'guest',x:-t*2,z:0,y:0,health:100,place:2},{id:'forged-human',x:0,z:0,health:100}],events:[]});
 for(now=0;now<=180;now++){service.input(guest,{yaw:now/4,pitch:0});service.frame(host,state(now));}
 service.frame(host,{...state(181),phase:'results'});const receipts=sent.filter(([,m])=>m.type==='reward');assert.equal(receipts.length,2);for(const [,m]of receipts){assert.ok(m.receipt.amount>0);assert.equal(m.receipt.population,2);assert.equal(m.receipt.eligible,true);}now++;service.frame(host,{...state(182),phase:'results'});assert.equal(sent.filter(([,m])=>m.type==='reward').length,2);await service.close();
});
test('32 contestants cover all safe island sectors without overlap',()=>{
 assert.ok(SPAWN_ISLAND.spawns.length>100);const players=[];let seed=17;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 for(let i=0;i<32;i++){const {point:[x,z],region}=distributedSpawn(players,random),p={x,z,y:groundAt(SPAWN_ISLAND,x,z),health:100,region};assert.ok(canStand(SPAWN_ISLAND,p));assert.ok(players.every(o=>Math.hypot(x-o.x,z-o.z)>3));players.push(p);}
 for(const r of SPAWN_REGIONS){const count=players.filter(p=>p.region===r.id).length;assert.ok(count>=2&&count<=6,`${r.id}: ${count}`);}
});
