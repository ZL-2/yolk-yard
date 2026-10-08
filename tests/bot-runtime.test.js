import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledBotInput,suspendBotInput} from '../src/bot-runtime.js';
test('tactical decisions are staggered and bounded while physics can read input on every tick',()=>{
 const sim={time:0,round:1,map:{id:'test'},players:new Map()},bots=Array.from({length:30},(_,i)=>({id:i,bot:true,botSeed:i*.618,joinedOrder:i,lastDamage:-100}));let count=0;for(const p of bots)sim.players.set(p.id,p);
 const think=()=>{count++;return {forward:1,yaw:0,slot:0};};
 for(const p of bots)scheduledBotInput(sim,p,think);
 assert.ok(count<=4);let peak=0;
 for(let tick=1;tick<=60;tick++){sim.time=tick/60;const before=count;for(const p of bots){const input=scheduledBotInput(sim,p,think);if(tick>10)assert.equal(input.forward,1);}peak=Math.max(peak,count-before);}
 assert.ok(peak<=4);assert.ok(count>200&&count<300);
});
test('mass damage and cold recovery stay bounded and every bot gets a turn',()=>{
 const bots=Array.from({length:48},(_,id)=>({id,bot:true,health:100,lastDamage:-100})),sim={time:0,round:1,map:{id:'test'},players:new Map(bots.map(p=>[p.id,p]))},counts=new Map();
 for(let tick=0;tick<90;tick++){sim.time=tick/60;let jobs=0;for(const p of bots){p.lastDamage=sim.time;scheduledBotInput(sim,p,()=>{jobs++;counts.set(p.id,(counts.get(p.id)||0)+1);return {forward:1};});}assert.ok(jobs<=4);}
 assert.equal(counts.size,48);assert.ok(Math.min(...counts.values())>=5);
});
test('elapsed work ceiling defers remaining jobs without dropping them',t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock);
 const bots=Array.from({length:8},(_,id)=>({id,bot:true,health:100})),sim={time:0,round:1,map:{id:'test'},players:new Map(bots.map(p=>[p.id,p]))},seen=new Set();
 for(let tick=0;tick<10;tick++){sim.time=tick/60;let jobs=0;for(const p of bots)scheduledBotInput(sim,p,()=>{clock+=3;seen.add(p.id);jobs++;return {};});assert.equal(jobs,1);}
 assert.equal(seen.size,8);
});
test('a queued bot entering rescue cannot block the remaining queue',()=>{
 const bots=Array.from({length:10},(_,id)=>({id,bot:true,health:100})),sim={time:0,round:1,map:{id:'test'},players:new Map(bots.map(p=>[p.id,p]))};let count=0;
 for(const p of bots)scheduledBotInput(sim,p,()=>{count++;return {};});assert.equal(count,4);suspendBotInput(sim,bots[4]);sim.time=1/60;
 for(const p of bots)if(p!==bots[4])scheduledBotInput(sim,p,()=>{count++;return {};});assert.equal(count,8);
});
test('damage interrupts cached actions; a destroyed target stops firing and tactical pulses are not replayed',()=>{
 const target={id:'enemy',health:100},sim={time:1,round:1,map:{id:'test'},players:new Map([['enemy',target]])},p={botSeed:.5,lastDamage:-100,brain:{target:'enemy',burstUntil:5}};let count=0;
 const think=()=>{count++;return {fire:true,buildMode:true,popper:true,forward:1};};
 assert.equal(scheduledBotInput(sim,p,think).fire,true);sim.time+=.001;const cached=scheduledBotInput(sim,p,think);assert.equal(cached.fire,false);assert.equal(cached.popper,false);assert.equal(cached.forward,1);
 sim.time+=.08;p.lastDamage=sim.time;assert.equal(scheduledBotInput(sim,p,think).fire,true);assert.equal(count,2);
 const shooter={lastDamage:-100,brain:{target:'enemy',burstUntil:5}};scheduledBotInput(sim,shooter,()=>({fire:true}));target.health=0;sim.time+=.001;assert.equal(scheduledBotInput(sim,shooter,()=>({fire:true})).fire,false);
});
