import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {gun} from '../src/data.js';
import {beginEquip} from '../src/equip.js';
import {resetStance} from '../src/stance.js';
import {reloadRequested,RELOAD_BUFFER_SECONDS} from '../src/reload-buffer.js';

function fixture(){const sim=new Simulation({bots:0}),p=sim.addPlayer('p',{name:'Tester'});sim.time=10;Object.assign(p,{health:100,spectating:false,slot:0,weapon:'sprinter',ammo:[5,5],reserve:[60,30],reloadEnd:0,equipUntil:10.12});return {sim,p};}
test('a released reload tap waits through a brief draw transition and starts once',()=>{
 const {sim,p}=fixture();sim.combatInput(p,{reload:true});assert.equal(p.reloadEnd,0);assert.ok(p.pendingReload);
 sim.time+=.13;sim.combatInput(p,{reload:false});assert.ok(p.reloadEnd>sim.time);assert.equal(p.pendingReload,null);
 const end=p.reloadEnd;sim.time+=.03;sim.combatInput(p,{reload:false});assert.equal(p.reloadEnd,end);assert.equal(sim.events.filter(e=>e.type==='reload').length,1);
});
test('reload expires, does not cross weapon swaps, and is cleared on respawn or conflicting actions',()=>{
 for(const cancel of ['expire','slot','equip','reset','build','drop','downed','use']){
  const {sim,p}=fixture();sim.combatInput(p,{reload:true});
  sim.time+=.13;let input={reload:false};
  if(cancel==='expire')sim.time+=RELOAD_BUFFER_SECONDS;
  if(cancel==='slot')p.slot=1;
  if(cancel==='equip')beginEquip(p,sim.time);
  if(cancel==='reset')resetStance(p);
  if(cancel==='build')input.buildMode=true;
  if(cancel==='drop')input.drop=true;
  if(cancel==='downed')p.downed=true;
  if(cancel==='use')p.use={id:'mini'};
  sim.combatInput(p,input);assert.equal(p.reloadEnd,0,cancel);assert.ok(!p.pendingReload,cancel);
 }
});
test('a coalesced or replayed tap neither disappears nor refreshes its deadline',()=>{
 const {sim,p}=fixture();sim.setInput(p.id,{seq:1,reload:true});sim.setInput(p.id,{seq:2,reload:false});
 const input=sim.inputs.get(p.id);assert.equal(input.reload,true);assert.equal(input.reloadHeld,false);
 sim.combatInput(p,input);const until=p.pendingReload.until;sim.time+=.05;sim.combatInput(p,input);assert.equal(p.pendingReload.until,until);
 p.equipUntil=100;sim.time=until+.01;sim.combatInput(p,input);assert.equal(p.pendingReload,null);
});
test('guest packets retain reload presses through input coalescing and a consumed press is not repeated',()=>{
 const {sim,p}=fixture();p.ack=0;sim.setInput(p.id,{seq:1,reload:true},true);sim.setInput(p.id,{seq:2,reload:false},true);
 const {input}=sim.movementInput(p,1/30);assert.equal(input.reloadPress,1);assert.equal(input.reloadHeld,false);sim.combatInput(p,input);
 sim.time+=.13;sim.combatInput(p,{reloadPress:1,reloadHeld:false});assert.ok(p.reloadEnd>sim.time);
 p.reloadEnd=0;assert.equal(reloadRequested(p,gun(p),{reloadPress:1,reloadHeld:false},sim.time),false);
});
test('held reload and empty-weapon automatic reload still work; a short mantle only delays a tap',()=>{
 const {sim,p}=fixture();sim.combatInput(p,{reload:true});sim.time+=.6;sim.combatInput(p,{reload:true});assert.ok(p.reloadEnd>sim.time);
 p.reloadEnd=0;p.ammo[0]=0;sim.combatInput(p,{fire:true});assert.ok(p.reloadEnd>sim.time);
 p.reloadEnd=0;p.ammo[0]=5;p.mantle={progress:.9};sim.combatInput(p,{reload:false});sim.combatInput(p,{reload:true});assert.equal(p.reloadEnd,0);
 p.mantle=null;sim.time+=.1;sim.combatInput(p,{reload:false});assert.ok(p.reloadEnd>sim.time);
});
