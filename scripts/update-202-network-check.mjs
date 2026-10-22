import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {safeProfile} from '../src/data.js';
import {spawnHelicopter} from '../src/helicopter.js';
import {exitVehicle,seatPlayer} from '../src/vehicles.js';
import {rebuildMap} from '../src/building.js';
const temp=await mkdtemp('/tmp/ravel202-network-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const app=await startRealtimeServer({host:'127.0.0.1',port:0}),nets=[];globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async(fn,label,ms=14000)=>{const until=Date.now()+ms;while(!fn()){assert.ok(Date.now()<until,label);await delay(15);}};
let sim,clock,pump;
function client(name){const c={state:null,errors:[],seq:0,profile:safeProfile({name})};c.net=new Network({onState:s=>{if(s.royale?.builds)c.builds=s.royale.builds;c.state=s;},onError:e=>c.errors.push(e),getState:()=>sim?.snapshot(),getCheckpoint:()=>sim?.checkpoint(),onJoin:(id,p,a)=>!!sim?.admitPlayer(id,p,a),onInput:(id,i)=>sim?.setInput(id,i,true),onPlayerAction:(id,a)=>sim?.playerAction(id,a),onLeave:id=>sim?.leavePlayer(id)});c.input=i=>c.net.input({seq:++c.seq,dt:1/60,yaw:0,pitch:0,...i});nets.push(c.net);return c;}
try{
 const host=client('Flight Host'),guest=client('Flight Guest'),observer=client('Flight Observer'),code=await host.net.host();sim=new RoyaleSimulation({capacity:4,bots:0,fill:false,teamSize:1,seed:202});sim.addPlayer('host',host.profile);sim.startRound();host.net.setVisibility('private');host.state=sim.snapshot();host.net.broadcast(host.state);clock=setInterval(()=>{sim.tick(1/60);host.state=sim.snapshot();host.net.broadcast(host.state);},1000/60);
 await guest.net.join(code,guest.profile);await observer.net.join(code,observer.profile);await wait(()=>sim.players.size===3,'three peers');sim.beginBattle();for(const [id,p]of sim.players)if(p.boss||p.henchman)sim.players.delete(id);
 sim.map={...sim.map,id:'flat',size:1000,boxes:[],terrain:null,helipad:{x:0,y:0,z:0,yaw:0},authored:[],floorLoot:[]};sim.worldBoxes=[];sim.loot=[];sim.chests=[];sim.builds=[];sim.operations=null;sim.stage='active';sim.stormSteps=sim.stormSteps.map(v=>({...v,start:1e9,closeAt:1e9,end:2e9}));
 for(const p of sim.players.values())Object.assign(p,{x:20,y:0,z:0,health:100,shield:100,flight:'ground',grounded:true,loading:false,spectating:false,contestant:true,eliminated:false,shieldUntil:0});
 const pilot=sim.players.get(guest.net.id),target=sim.players.get(observer.net.id);
 const atv={id:'atv-test',x:0,y:0,z:0,yaw:0,pitch:0,roll:0,speed:0,vx:0,vy:0,vz:0,health:400,boost:100,seats:[null,null],grounded:true,revision:0};sim.vehicles=[atv];Object.assign(pilot,{x:2,y:0,z:0});Object.assign(target,{x:0,y:0,z:-12});
 let input={interact:true};pump=setInterval(()=>guest.input(input),16);await wait(()=>pilot.vehicleId===atv.id,'remote ATV boarding');input={forward:1};await wait(()=>target.health+target.shield<200,'ordinary ATV ram');const atvDamage=200-target.health-target.shield;assert.ok(atvDamage>0);await wait(()=>observer.state?.players.find(p=>p.id===target.id)?.shield<100,'remote ram health');input={};Object.assign(atv,{speed:0,vx:0,vz:0});target.x=100;
 await wait(()=>sim.time>pilot.vehicleLock,'seat cooldown');input={reload:true};await wait(()=>pilot.vehicleSeat===1,'ATV passenger switch');pilot.inventory[1]={id:'needle',weapon:true,rarity:2,ammo:1};pilot.equipUntil=0;sim.syncInventory(pilot);input={perspective:'third',aim:true,slot:1};await wait(()=>pilot.aim&&pilot.perspective==='third','remote ATV scope input');await wait(()=>observer.state?.players.some(p=>p.id===pilot.id&&p.aim&&p.perspective==='third'&&p.vehicleSeat===1),'observer passenger camera state');
 input={};exitVehicle(sim,pilot,{force:true});const craft=spawnHelicopter(sim.map);sim.vehicles=[craft];Object.assign(pilot,{x:3,y:0,z:0,vehicleLock:0,vehicleInteractHeld:false});input={interact:true};await wait(()=>pilot.vehicleId===craft.id,'remote helicopter boarding');
 sim.builds=[{id:'ram-wall',type:'wall',x:0,y:0,z:-6,rotation:0,material:'metal',health:500,maxHealth:500,constructionRemaining:0,revision:0,mask:0,created:sim.time}];sim.buildVersion++;rebuildMap(sim);input={};await wait(()=>observer.builds?.some(b=>b.id==='ram-wall'),'observer receives intact metal wall');
 Object.assign(craft,{y:.1,grounded:false,rotor:1,speed:35,vz:-35,boostTime:1.5,boostCooldown:6.5,boosting:true});seatPlayer(pilot,craft);Object.assign(target,{x:0,y:0,z:-12,health:100,shield:100,vy:0,grounded:true,launchVelocity:null,fall:null});
 input={forward:1,heliBoost:true};
 await wait(()=>!sim.builds.some(b=>b.id==='ram-wall'),'boosted metal wall destruction');await wait(()=>target.health+target.shield<200,'helicopter ram after breakthrough');input={};const helicopterDamage=200-target.health-target.shield;await wait(()=>observer.builds?.every(b=>b.id!=='ram-wall')&&observer.state?.players.find(p=>p.id===target.id)?.shield<100,'observer destruction and damage');
 assert.ok([host,guest,observer].every(c=>c.errors.length===0));await mkdir('test-results/update-202',{recursive:true});await writeFile('test-results/update-202/network.json',JSON.stringify({sockets:3,atvDamage,helicopterDamage,normalSpeedRam:true,remotePassengerScope:true,boostedMetalBreakthrough:true,sharedDamage:true},null,2));console.log('PASS three sockets: normal ATV ram, passenger scope state, boosted helicopter build destruction and ram damage.');
}catch(error){console.error(JSON.stringify({phase:sim?.phase,time:sim?.time,vehicles:sim?.vehicles,builds:sim?.builds}));throw error;}finally{clearInterval(pump);clearInterval(clock);for(const n of nets)n.destroy();await app.close();await rm(temp,{recursive:true,force:true});}
