import test from 'node:test';
import assert from 'node:assert/strict';
import {activeBotUtility} from '../src/bot-utility.js';
import {executeRoyaleIntent} from '../src/royale-bot-execution.js';
import {botInput} from '../src/bots.js';
import {newBrain} from '../src/bot-perception.js';
import {rng} from '../src/data.js';

function fixture(){
 const p={id:'bot',bot:true,flight:'ground',health:100,shield:100,x:0,y:0,z:0,yaw:0,pitch:0,slot:1,ammo:[0,12,0],reserve:[0,50,0],inventory:[{id:'pickaxe',pickaxe:true},{id:'pip',weapon:true,ammo:12,rarity:1},{id:'popper',count:1}],bank:{light:50},materials:{wood:300,brick:0,metal:0},lastDamage:-100};
 const enemy={id:'enemy',health:100,x:0,y:0,z:-15,yaw:Math.PI,pitch:0,weapon:'pip',slot:0};
 const sim={time:10,round:1,stage:'active',eventId:0,events:[],options:{mode:'royale',difficulty:2,teamSize:1},map:{id:'test',size:100,boxes:[],floorLoot:[]},players:new Map([[p.id,p],[enemy.id,enemy]]),random:rng(43),nav:{path:()=>[]},loot:[],chests:[]};
 p.brain=newBrain(sim,p);return {sim,p};
}
test('expired, missing or already activated item plans cannot suppress gun aiming',()=>{
 for(const failure of ['expired','missing','invalid','consumed']){
  const {sim,p}=fixture();p.brain.utility={slot:2,yaw:0,pitch:.35,until:failure==='expired'?9:11};
  if(failure==='missing')p.inventory[2]=null;if(failure==='invalid')p.brain.utility.until=NaN;if(failure==='consumed')p.inventory[2].count=0;
  const input=botInput(sim,p);assert.equal(p.brain.utility,null,failure);assert.equal(input.combatAim,true,failure);assert.equal(input.slot,1);
 }
});
test('item execution waits for equip, releases a previous trigger, and cannot repeat a consumed plan',()=>{
 const {sim,p}=fixture();p.slot=2;p.equipUntil=10.3;p.brain.utility={slot:2,yaw:0,pitch:.35,until:11};
 const input={slot:2,yaw:0,pitch:.35,fire:true,utilityItem:true,worldMoveX:0,worldMoveZ:0};
 assert.equal(executeRoyaleIntent(sim,p,input).fire,false);
 sim.time=10.31;p.useLatch=true;assert.equal(executeRoyaleIntent(sim,p,input).fire,false);
 p.useLatch=false;assert.equal(executeRoyaleIntent(sim,p,input).fire,true);
 p.use={id:'popper'};assert.equal(executeRoyaleIntent(sim,p,input).fire,false);assert.equal(p.brain.utility,null);
 p.use=null;assert.equal(executeRoyaleIntent(sim,p,input).fire,false);
});
test('an expired cached utility intent stops its trigger while the next budgeted decision resumes combat',()=>{
 const {sim,p}=fixture();p.brain.utility={slot:2,yaw:0,pitch:.35,until:10.2};
 assert.ok(activeBotUtility(p,10));sim.time=10.3;const out=executeRoyaleIntent(sim,p,{slot:2,yaw:0,pitch:0,utilityItem:true,fire:true});assert.equal(out.fire,false);assert.equal(p.brain.utility,null);
 assert.equal(botInput(sim,p).combatAim,true);
});
