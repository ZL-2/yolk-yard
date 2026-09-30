import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlayer,ROYALE_MOVEMENT,ARENA_BOT_MOVEMENT} from '../src/physics.js';
import {WEAPONS,ROYALE_WEAPONS,weapon} from '../src/data.js';
import {Simulation} from '../src/simulation.js';
const flat={size:256,boxes:[],terrain:null};
function player(bot=false,id='sprinter',royale=false){return {id:'runner',bot,weapon:id,slot:0,x:0,y:0,z:0,yaw:0,pitch:0,vy:0,grounded:true,health:100,...(royale?{inventory:[{id,weapon:true,rarity:0}],flight:'ground',stamina:100}:{} )};}
function distance(p,input){for(let i=0;i<60;i++){const x=p.x,z=p.z;movePlayer(p,{yaw:0,forward:1,...input},flat,1/60);p.vx=(p.x-x)*60;p.vz=(p.z-z)*60;}return Math.hypot(p.x,p.z);}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} !== ${b}`);
test('all arena weapons reduce bot navigation speed 20%, preserving human speed',()=>{for(const w of WEAPONS){near(distance(player(true,w.id)),w.speed*.8);near(distance(player(false,w.id)),w.speed);}near(ARENA_BOT_MOVEMENT.speedScale,.8);near(distance(player(true)),5.92);});
test('arena strafing, diagonal movement, ADS and crouching retain the same pace reduction',()=>{for(const input of [{forward:0,strafe:1},{forward:1,strafe:1},{aim:true},{crouch:true},{aim:true,crouch:true}]){const human=distance(player(false),input),bot=distance(player(true),input);near(bot,human*.8);}near(distance(player(true),{forward:1,strafe:1}),5.92);});
test('all Royale weapons preserve human and bot walking/sprinting/ADS speeds',()=>{for(const w of [...WEAPONS,...ROYALE_WEAPONS]){for(const input of [{},{sprint:true},{aim:true}]){const human=distance(player(false,w.id,true),input),bot=distance(player(true,w.id,true),input);near(bot,human);near(bot,input.sprint?ROYALE_MOVEMENT.sprint:ROYALE_MOVEMENT.walk*(input.aim?w.adsMove:1));}}});
test('FFA and Team Scramble authoritative movement and restored snapshots retain the slower bot pace',()=>{for(const mode of ['ffa','teams']){const sim=new Simulation({mode,bots:0,seed:3}),p=sim.addPlayer('bot',{name:'Runner',weapon:'sprinter'},true);sim.startRound();sim.map={...flat};Object.assign(p,player(true),{id:'bot'});distance(p,{});near(Math.hypot(p.x,p.z),5.92);const snapshot=sim.snapshot().players.find(v=>v.id===p.id);assert.equal(snapshot.bot,true);near(snapshot.z,p.z);const restored=new Simulation().restore(sim.checkpoint()).players.get('bot');assert.equal(restored.bot,true);const before=restored.z;movePlayer(restored,{yaw:0,forward:1},flat,1/60);near(before-restored.z,weapon('sprinter').speed*.8/60);}});
