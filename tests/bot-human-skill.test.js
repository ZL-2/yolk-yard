import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {gun,weapon} from '../src/data.js';
import {skillFor} from '../src/bot-config.js';
import {botTargetAim,botCombatReady,steadyBotFire,botBurstGap} from '../src/bot-aim.js';
import {executeRoyaleIntent} from '../src/royale-bot-execution.js';
const skill=skillFor({options:{mode:'royale',difficulty:2}});
function room(bot=true,id='duet',distance=12,seed=1){
 const s=new Simulation({mode:'ffa',bots:0,difficulty:2,seed}),p=s.addPlayer('shooter-'+seed,{name:'Shooter',weapon:id},bot),enemy=s.addPlayer('target',{name:'Target'});
 s.map={id:'duel',size:200,boxes:[]};s.time=5;
 Object.assign(p,{x:0,y:0,z:0,yaw:0,pitch:Math.atan2(1.24-1.43,distance),health:100,shieldUntil:0,lastDamage:-100,equipUntil:0,reloadEnd:0,slot:1,nextShot:0,weaponCooldowns:{},accuracyState:[{},{}],ammo:[0,9999],reserve:[0,0],aim:true,grounded:true,flight:'ground',inventory:[null,{id,weapon:true,rarity:2,ammo:9999}],brain:{aimAt:0,memory:{},target:enemy.id}});
 Object.assign(enemy,{x:0,y:0,z:-distance,yaw:0,health:1e6,shieldUntil:0,spectating:false});return {s,p,enemy};
}
function burst(bot,fps,hurt=false){
 const {s,p,enemy}=room(bot),start=s.time;
 for(let n=0;n<fps;n++){
  s.time=start+n/fps;
  if(hurt&&n===1)s.damage(p,enemy,1,'Test hit');
  s.combatInput(p,{fire:n===0,botBurstReady:true});p.fireLatch=n===0;
 }
 const shots=s.events.filter(e=>e.type==='shot'&&e.player===p.id),hits=s.events.filter(e=>e.type==='hit'&&e.target===enemy.id);
 return {shots,hits,w:gun(p)};
}
test('Rare bot bursts cannot deliver three body rounds in the native 167 ms window; player cadence and damage stay intact',()=>{
 for(const fps of [30,60,120]){
  const human=burst(false,fps),bot=burst(true,fps);
  assert.equal(human.shots.length,3);assert.equal(bot.shots.length,3);
  assert.ok(human.shots[2].time-human.shots[0].time<=.201);
  assert.ok(bot.shots[2].time-bot.shots[0].time>=botBurstGap(bot.w,skill)*2-1e-9);
  assert.equal(bot.w.damage,34);assert.equal(human.w.damage,34);
  assert.ok(bot.hits.filter(e=>e.time<=bot.shots[0].time+.25).reduce((a,e)=>a+e.amount,0)<=34);
  assert.ok(human.hits.reduce((a,e)=>a+e.amount,0)>=102);
 }
});
test('taking damage interrupts a pending bot burst even if the cached tactical intent still requests it',()=>{
 assert.equal(burst(true,60,true).shots.length,1);
});
test('a flinch recovers under sustained fire and cannot stack into a permanent stun',()=>{
 const p={lastDamage:1},brain={aimAt:0};assert.equal(botCombatReady(brain,p,skill,1),false);
 p.lastDamage=1.2;assert.equal(botCombatReady(brain,p,skill,1.2),false);
 p.lastDamage=1.5;assert.equal(botCombatReady(brain,p,skill,1.5),true);
 p.lastDamage=2;assert.equal(botCombatReady(brain,p,skill,2),false);
});
test('Intermediate reactions and high-impact weapon handling leave time to respond at every tick rate',()=>{
 assert.ok(skill.reaction>=.7);
 for(const fps of [30,60,120])for(const id of ['sprinter','scatter','needle','anchor']){
  const p={id:'reaction',shotSerial:0,lastDamage:-100},brain={aimAt:skill.reaction},w=gun({slot:1,inventory:[null,{id,weapon:true,rarity:2}]}),times=[];
  for(let i=0;i<fps*12;i++)if(steadyBotFire(brain,p,w,skill,i/fps,true)){times.push(i/fps);p.shotSerial++;}
  assert.ok(times.length>=2);assert.ok(times[0]>=skill.reaction);
  if(w.damage*w.pellets>=90)assert.ok(times[0]>=1.35);
 }
});
test('tracking follows observed motion with a delay and does not instantly follow a reversal or a target switch',()=>{
 const p={x:0,y:0,z:0},brain={},target={id:'first',x:0,y:0,z:-25,vx:6,vz:0,seenAt:1},w=weapon('sprinter');
 botTargetAim(brain,p,target,w,skill,25,1,1/60);
 Object.assign(target,{x:-2,vx:-6,seenAt:1.1});botTargetAim(brain,p,target,w,skill,25,1.1,1/60);assert.equal(brain.trackVX,6);
 botTargetAim(brain,p,target,w,skill,25,1.3,1/60);assert.equal(brain.trackVX,-6);assert.ok(brain.trackedX>-2);
 botTargetAim(brain,p,{...target,id:'second',x:15},w,skill,25,1.31,1/60);assert.equal(brain.trackedX,15);assert.equal(brain.trackTarget,'second');
});
test('actual scoped shots include close and medium-range misses instead of perfect center-body tracking',()=>{
 const rates=[];
 for(const distance of [10,28,58]){
  let shots=0,hits=0;
  for(let seed=1;seed<=6;seed++){
   const {s,p,enemy}=room(true,'anchor',distance,seed);s.options.mode='royale';
   const memory=p.brain.memory[enemy.id]={id:enemy.id,x:enemy.x,y:enemy.y,z:enemy.z,vx:0,vz:0,visible:true,seenAt:s.time};
   const input={slot:1,combatAim:true,yaw:0,pitch:0};
   for(let i=0;i<2400;i++){
    s.time+=1/60;memory.seenAt=s.time;const out=executeRoyaleIntent(s,p,input);p.yaw=out.yaw;p.pitch=out.pitch;
    s.updateAccuracy(p,p,1/60);const serial=p.shotSerial||0,before=enemy.health;s.combatInput(p,out);
    if((p.shotSerial||0)>serial){shots++;if(enemy.health<before)hits++;}p.fireLatch=out.fire;
   }
  }
  assert.ok(shots>100);rates.push(hits/shots);
 }
 assert.ok(rates[0]<.95&&rates[0]>.25,JSON.stringify(rates));
 assert.ok(rates[1]<.7&&rates[1]>.15,JSON.stringify(rates));
 assert.ok(rates[2]<rates[1],JSON.stringify(rates));
});
