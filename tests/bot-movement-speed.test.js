import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlayer,ROYALE_MOVEMENT} from '../src/physics.js';
import {WEAPONS,ROYALE_WEAPONS,weapon} from '../src/data.js';
import {Simulation} from '../src/simulation.js';
const flat={size:256,boxes:[],terrain:null};
function player(bot=false,id='sprinter',royale=false){return {id:'runner',bot,weapon:id,slot:0,x:0,y:0,z:0,yaw:0,pitch:0,vy:0,grounded:true,health:100,...(royale?{inventory:[{id,weapon:true,rarity:0}],flight:'ground',stamina:100}:{} )};}
function distance(p,input){for(let i=0;i<60;i++){const x=p.x,z=p.z;movePlayer(p,{yaw:0,forward:1,...input},flat,1/60);p.vx=(p.x-x)*60;p.vz=(p.z-z)*60;}return Math.hypot(p.x,p.z);}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} !== ${b}`);
test('all arena weapons preserve normal bot and human navigation speed',()=>{for(const w of WEAPONS){near(distance(player(true,w.id)),w.speed);near(distance(player(false,w.id)),w.speed);}near(distance(player(true)),7.4);});
test('arena strafing, diagonal movement, ADS and crouching preserve normal base movement',()=>{for(const input of [{forward:0,strafe:1},{forward:1,strafe:1},{aim:true},{crouch:true},{aim:true,crouch:true}]){const human=distance(player(false),input),bot=distance(player(true),input);near(bot,human);}near(distance(player(true),{forward:1,strafe:1}),7.4);});
test('all Royale weapons preserve human and bot walking/sprinting/ADS speeds',()=>{for(const w of [...WEAPONS,...ROYALE_WEAPONS]){for(const input of [{},{sprint:true},{aim:true}]){const human=distance(player(false,w.id,true),input),bot=distance(player(true,w.id,true),input);near(bot,human);near(bot,input.sprint?ROYALE_MOVEMENT.sprint:ROYALE_MOVEMENT.walk*(input.aim?w.adsMove:1));}}});
test('FFA and Team Scramble authoritative movement and restored snapshots retain normal bot travel speed',()=>{for(const mode of ['ffa','teams']){const sim=new Simulation({mode,bots:0,seed:3}),p=sim.addPlayer('bot',{name:'Runner',weapon:'sprinter'},true);sim.startRound();sim.map={...flat};Object.assign(p,player(true),{id:'bot'});distance(p,{});near(Math.hypot(p.x,p.z),7.4);const snapshot=sim.snapshot().players.find(v=>v.id===p.id);assert.equal(snapshot.bot,true);near(snapshot.z,p.z);const restored=new Simulation().restore(sim.checkpoint()).players.get('bot');assert.equal(restored.bot,true);const before=restored.z;movePlayer(restored,{yaw:0,forward:1},flat,1/60);near(before-restored.z,weapon('sprinter').speed/60);}});

import {ARENA_BOT_COMBAT,smoothArenaCombatMovement} from '../src/bot-movement.js';
import {navigate} from '../src/bot-navigation.js';
test('arena combat lateral movement is capped and reversals accelerate through zero',()=>{
 const brain={};let now=0,input;for(let i=0;i<30;i++){now+=1/60;input=smoothArenaCombatMovement(brain,{mx:1,mz:0},0,now,true);assert.ok(input.strafe<=.6);}
 near(input.strafe,.6);let crossedZero=false,previous=brain.arenaCombatMove.mx;
 for(let i=0;i<60;i++){now+=1/60;input=smoothArenaCombatMovement(brain,{mx:-1,mz:0},0,now,true);const current=brain.arenaCombatMove.mx;assert.ok(Math.abs(current-previous)<=ARENA_BOT_COMBAT.directionAcceleration/60+1e-8);if(Math.abs(current)<.041)crossedZero=true;previous=current;}
 assert.ok(crossedZero);near(input.strafe,-.6);const p=player(true);near(distance(p,{forward:0,strafe:input.strafe}),7.4*.6);
});
test('travel and Royale bypass combat smoothing without losing running speed',()=>{const brain={};smoothArenaCombatMovement(brain,{mx:1,mz:0},0,1,true);assert.deepEqual(smoothArenaCombatMovement(brain,{mx:-1,mz:0},0,1.1,false),{forward:0,strafe:-1});assert.equal(brain.arenaCombatMove,null);near(smoothArenaCombatMovement(brain,{mx:0,mz:-1},0,1.2,false).forward,1);});
test('arriving at an arena combat peek keeps the planned dwell; other navigation retains arrival replanning',()=>{for(const [royale,kind,expected] of [[false,'fight',10],[false,'survey',1.2],[true,'fight',1.2]]){const p=player(true,'sprinter',royale),brain={task:{kind},decision:10,checkAt:999},sim={time:1,map:flat,players:new Map([[p.id,p]]),random:()=>.5};navigate(sim,p,brain,{x:.3,y:0,z:0},{decision:1});near(brain.decision,expected);}});

test('arena combat slows into a peek without repeated lateral reversals',()=>{const p=player(true),brain={task:{kind:'fight'},decision:999,checkAt:999},sim={time:0,map:flat,players:new Map([[p.id,p]]),random:()=>.5},goal={x:3,y:0,z:0};let reversals=0,lastSign=0;for(let i=0;i<180;i++){sim.time+=1/60;const m=navigate(sim,p,brain,goal,{decision:1}),input=smoothArenaCombatMovement(brain,m,0,sim.time,true),sign=Math.sign(input.strafe);if(sign&&lastSign&&sign!==lastSign)reversals++;if(sign)lastSign=sign;movePlayer(p,{yaw:0,...input},flat,1/60);}assert.equal(reversals,0);assert.ok(Math.abs(p.x-goal.x)<1.3);near(brain.decision,999);});
