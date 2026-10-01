import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {WEAPONS,ROYALE_WEAPONS,safeProfile} from '../src/data.js';
const temp=await mkdtemp(tmpdir()+'/ravel-weapons-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';
const app=await startRealtimeServer({host:'127.0.0.1',port:0}),nets=[];
globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label,ms=10000)=>{const end=Date.now()+ms;while(!fn()){assert.ok(Date.now()<end,label);await pause(15);}};
let sim,clock;
function client(name){const c={state:null,errors:[],seq:0,profile:safeProfile({name})};c.net=new Network({onState:s=>c.state=s,onError:e=>c.errors.push(e),getState:()=>sim?.snapshot(),getCheckpoint:()=>sim?.checkpoint(),onJoin:(id,p,a)=>!!sim?.admitPlayer(id,p,a),onInput:(id,i)=>sim?.setInput(id,i,true),onLeave:id=>sim?.leavePlayer(id)});c.input=i=>c.net.isHost?sim.setInput(c.net.id,i,true):c.net.input(i);c.inputBatch=list=>c.net.isHost?list.forEach(i=>sim.setInput(c.net.id,i,true)):c.net.inputBatch(list);nets.push(c.net);return c;}
try{
 const host=client('Balance Host'),guest=client('Balance Guest'),observer=client('Balance Observer');
 const code=await host.net.host();sim=new RoyaleSimulation({capacity:4,bots:0,fill:false,teamSize:1,seed:9});sim.addPlayer('host',host.profile);sim.startRound();host.net.setVisibility('private');host.state=sim.snapshot();host.net.broadcast(host.state);clock=setInterval(()=>{sim.tick(1/60);host.state=sim.snapshot();host.net.broadcast(host.state);},1000/60);
 await guest.net.join(code,guest.profile);await observer.net.join(code,observer.profile);
 assert.equal(app.relay.authority.rooms.size,0);await wait(()=>sim.players.size===3,'Three independent players');sim.beginBattle();
 sim.map={...sim.map,boxes:[],terrain:null,size:1200};sim.worldBoxes=[];sim.loot=[];sim.chests=[];sim.stormSteps=sim.stormSteps.map(v=>({...v,start:1e9,closeAt:1e9,end:2e9}));sim.route.duration=1e9;
 sim.moveWithCommands=(p,input,dt,commands)=>{p.yaw=input.yaw??p.yaw;p.pitch=input.pitch??p.pitch;p.motionFresh=true;p.motionVX=p.motionVZ=0;p.ack=Math.max(p.ack,...(commands?.steps.map(v=>v.seq)||[input.seq||0]));};
 const report=[];
 for(const w of [...WEAPONS,...ROYALE_WEAPONS])for(const head of [false,true]){
  const results=[];
  for(const c of [host,guest]){
   sim.projectiles=[];sim.events=[];sim.inputs.clear();sim.remoteInputs.clear();
   for(const p of sim.players.values())Object.assign(p,{x:80,y:0,z:0,health:100,shield:100,flight:'ground',grounded:true,slot:1,loading:false,spectating:false,contestant:true,eliminated:false,shieldUntil:0,nextShot:0,equipUntil:0,reloadEnd:0,weaponCooldowns:{},shotgunReadyAt:0,pendingFireUntil:0,lastFirePress:0,fireLatch:false,burstLeft:0,burstWeapon:null,aim:true,accuracyState:Array.from({length:6},()=>({spread:0,adsBlend:1})),inventory:[{id:'pickaxe',pickaxe:true},{id:w.id,weapon:true,rarity:0,ammo:100},null,null,null,null],bank:{light:100,medium:100,shells:48,heavy:36,rockets:8},use:null});
   const shooter=sim.players.get(c.net.id),target=sim.players.get(observer.net.id);Object.assign(shooter,{x:0,z:12,yaw:0,pitch:Math.atan2((head?1.68:1.19)-1.7,12)});Object.assign(target,{x:0,z:0,yaw:0});for(const p of sim.players.values()){p.crouching=p.sliding=p.sprinting=false;sim.syncInventory(p);}
   const settledSeq=++c.seq;c.input({seq:settledSeq,fire:false,aim:true,slot:1,yaw:shooter.yaw,pitch:shooter.pitch,dt:1/60});await wait(()=>{if(shooter.ack>=settledSeq&&shooter.aim&&shooter.accuracyState[1].adsBlend>.999)return true;c.input({seq:++c.seq,fire:false,aim:true,slot:1,yaw:shooter.yaw,pitch:shooter.pitch,dt:1/60});return false;},w.name+' settled ADS');
   // Compare identical settled accuracy, rather than different ADS transition frames.
   Object.assign(shooter.accuracyState[1],{adsBlend:1,spread:w.adsSpread,shot:w.adsSpread,bloom:0,recoilPitch:0,recoilYaw:0});
   const ammo=shooter.ammo[1],seq=++c.seq,input={seq,fire:true,aim:true,slot:1,yaw:shooter.yaw,pitch:shooter.pitch,dt:1/60};
   c.inputBatch([input,input]);await wait(()=>shooter.ammo[1]<ammo,w.name+' accepted shot');c.input({seq:++c.seq,fire:false,aim:true,slot:1,yaw:shooter.yaw,pitch:shooter.pitch,dt:1/60});
   await wait(()=>!shooter.burstLeft&&!sim.projectiles.length,w.name+' shot resolution');await wait(()=>[host,guest,observer].every(n=>n.state?.players.find(p=>p.id===target.id)?.health===target.health&&n.state?.players.find(p=>p.id===target.id)?.shield===target.shield),w.name+' synchronized damage');
   assert.equal(ammo-shooter.ammo[1],w.burst||1,w.name+' duplicate sequence consumed one trigger');let damage=200-target.health-target.shield;if(!damage)console.log('Shot diagnostic',JSON.stringify({stage:sim.stage,head,players:[...sim.players.values()].map(p=>({id:p.id,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,health:p.health,shield:p.shield,flight:p.flight,crouching:p.crouching,spread:p.accuracyState[1]})),events:sim.events}));assert.ok(damage>0,w.name+' registered contact');
   if(w.projectile){const e=sim.events.findLast(e=>e.type==='explosion'),distance=Math.hypot(e.x-target.x,e.y-(target.y+.85),e.z-target.z);damage/=1-distance/(w.splashRadius*w.splashFalloff);}
   results.push(damage);assert.ok([host,guest,observer].every(n=>n.errors.length===0));
  }
  assert.ok(Math.abs(results[0]-results[1])<.01,w.name+' host/guest damage agreement '+JSON.stringify({head,results}));report.push({weapon:w.name,head,host:results[0],guest:results[1]});
 }
 const c=guest,p=sim.players.get(c.net.id);sim.events=[];sim.inputs.clear();sim.remoteInputs.clear();Object.assign(p,{inventory:[{id:'pickaxe',pickaxe:true},{id:'zipper',weapon:true,ammo:100,rarity:0}],slot:1,fireLatch:false,burstLeft:0,nextShot:0,weaponCooldowns:{},equipUntil:0,pendingFireUntil:0,health:100,shield:100});sim.syncInventory(p);
 for(let n=0;n<36;n++)c.net.inputBatch([{seq:++c.seq,fire:true,slot:1,yaw:1,pitch:0,dt:1/60}]);await pause(400);c.net.input({seq:++c.seq,fire:false,slot:1,yaw:1,pitch:0,dt:1/60});await pause(120);
 const shots=sim.events.filter(e=>e.type==='shot'&&e.player===p.id);assert.ok(shots.length>0&&shots.length<=8);for(let n=1;n<shots.length;n++)assert.ok(shots[n].time-shots[n-1].time>=5/60-1e-8);
 const health=p.health,shield=p.shield;c.net.send({type:'damage',damage:999999,target:p.id});c.net.send({type:'state',players:[]});await pause(100);assert.equal(p.health,health);assert.equal(p.shield,shield);
 const checkpoint=sim.checkpoint();assert.deepEqual(checkpoint.players.find(v=>v.id===p.id).weaponCooldowns,p.weaponCooldowns);
 await mkdir('test-results/weapon-balance',{recursive:true});await writeFile('test-results/weapon-balance/network.json',JSON.stringify({sockets:3,weapons:11,comparisons:report,cadenceShots:shots.length,duplicatesRejected:true,forgedDamageRejected:true},null,2));
 console.log('PASS all 11 firearms: host/guest body/head rules, three independent sockets, accepted ammo, physical trajectories, duplicate sequences, cadence and forged-damage rejection');
}finally{clearInterval(clock);for(const net of nets)net.destroy();await app.close();await rm(temp,{recursive:true,force:true});}
