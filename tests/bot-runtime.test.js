import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledBotInput} from '../src/bot-runtime.js';
test('tactical decisions are staggered and bounded while physics can read input on every tick',()=>{
 const sim={time:0,round:1,map:{id:'test'},players:new Map()},bots=Array.from({length:30},(_,i)=>({id:i,botSeed:i*.618,joinedOrder:i,lastDamage:-100}));let count=0;
 const think=()=>{count++;return {forward:1,yaw:0,slot:0};};
 for(const p of bots)assert.equal(scheduledBotInput(sim,p,think).forward,1);
 assert.equal(count,30);let peak=0;
 for(let tick=1;tick<=60;tick++){sim.time=tick/60;const before=count;for(const p of bots)assert.equal(scheduledBotInput(sim,p,think).forward,1);peak=Math.max(peak,count-before);}
 assert.ok(peak<=4);assert.ok(count>200&&count<300);
});
test('damage interrupts cached actions; a destroyed target stops firing and tactical pulses are not replayed',()=>{
 const target={id:'enemy',health:100},sim={time:1,round:1,map:{id:'test'},players:new Map([['enemy',target]])},p={botSeed:.5,lastDamage:-100,brain:{target:'enemy',burstUntil:5}};let count=0;
 const think=()=>{count++;return {fire:true,buildMode:true,popper:true,forward:1};};
 assert.equal(scheduledBotInput(sim,p,think).fire,true);sim.time+=.001;const cached=scheduledBotInput(sim,p,think);assert.equal(cached.fire,false);assert.equal(cached.popper,false);assert.equal(cached.forward,1);
 sim.time+=.08;p.lastDamage=sim.time;assert.equal(scheduledBotInput(sim,p,think).fire,true);assert.equal(count,2);
 const shooter={lastDamage:-100,brain:{target:'enemy',burstUntil:5}};scheduledBotInput(sim,shooter,()=>({fire:true}));target.health=0;sim.time+=.001;assert.equal(scheduledBotInput(sim,shooter,()=>({fire:true})).fire,false);
});
