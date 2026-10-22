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
const temp=await mkdtemp('/tmp/ravel203-network-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const app=await startRealtimeServer({host:'127.0.0.1',port:0}),nets=[];globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async(fn,label,ms=14000)=>{const until=Date.now()+ms;while(!fn()){assert.ok(Date.now()<until,label);await delay(15);}};
let sim,clock,pump;
function client(name){const c={state:null,errors:[],seq:0,profile:safeProfile({name})};c.net=new Network({onState:s=>{if(s.royale?.builds)c.builds=s.royale.builds;c.state=s;},onError:e=>c.errors.push(e),getState:()=>sim?.snapshot(),getCheckpoint:()=>sim?.checkpoint(),onJoin:(id,p,a)=>!!sim?.admitPlayer(id,p,a),onInput:(id,i)=>sim?.setInput(id,i,true),onPlayerAction:(id,a)=>sim?.playerAction(id,a),onLeave:id=>sim?.leavePlayer(id)});c.input=i=>c.net.input({seq:++c.seq,dt:1/60,yaw:0,pitch:0,...i});nets.push(c.net);return c;}
try{
 const host=client('Water Host'),guest=client('Lean Guest'),observer=client('Lean Observer'),code=await host.net.host();sim=new RoyaleSimulation({capacity:4,bots:0,fill:false,teamSize:1,seed:203});sim.addPlayer('host',host.profile);sim.startRound();host.net.setVisibility('private');host.state=sim.snapshot();host.net.broadcast(host.state);clock=setInterval(()=>{sim.tick(1/60);host.state=sim.snapshot();host.net.broadcast(host.state);},1000/60);
 await guest.net.join(code,guest.profile);await observer.net.join(code,observer.profile);await wait(()=>sim.players.size===3,'three peers');sim.beginBattle();for(const [id,p]of sim.players)if(p.boss||p.henchman)sim.players.delete(id);
 sim.map={...sim.map,id:'flat',size:1000,boxes:[],terrain:null,helipad:{x:0,y:0,z:0,yaw:0},authored:[],floorLoot:[]};sim.worldBoxes=[];sim.loot=[];sim.chests=[];sim.builds=[];sim.operations=null;sim.stage='active';sim.stormSteps=sim.stormSteps.map(v=>({...v,start:1e9,closeAt:1e9,end:2e9}));
 for(const p of sim.players.values())Object.assign(p,{x:20,y:0,z:0,health:100,shield:100,flight:'ground',grounded:true,loading:false,spectating:false,contestant:true,eliminated:false,shieldUntil:0});
 const pilot=sim.players.get(guest.net.id),target=sim.players.get(observer.net.id);
 sim.map.waterLevel=.5;sim.map.terrain={size:1000,cell:2000,n:2,max:-3,heights:new Float32Array(4).fill(-3)};
 // A dry platform isolates cover controls from the subsequent water fall.
 sim.map.boxes=[{x:0,y:2,z:0,w:20,d:20,h:.4}];sim.worldBoxes=sim.map.boxes;
 Object.assign(pilot,{x:0,y:2.4,z:0,grounded:true,shield:0});Object.assign(target,{x:40,y:-.55,z:0,grounded:true});
 let input={leanRight:true};pump=setInterval(()=>guest.input(input),16);
 await wait(()=>pilot.lean>.9,'host consumes remote lean');await wait(()=>observer.state?.players.some(p=>p.id===pilot.id&&p.lean>.9),'observer sees lean');
 input={leanLeft:true,crouch:true};await wait(()=>pilot.lean<-.9&&pilot.crouching,'remote crouched left lean');await wait(()=>observer.state?.players.some(p=>p.id===pilot.id&&p.lean<-.9&&p.crouching),'observer crouched lean');
 input={};await wait(()=>Math.abs(pilot.lean)<.01&&!pilot.crouching,'lean release');
 Object.assign(pilot,{x:40,y:45,z:0,vy:0,grounded:false,fall:null,health:100,shield:0});
 await wait(()=>pilot.swimming,'remote water landing');assert.equal(pilot.health,100);
 await wait(()=>observer.state?.players.some(p=>p.id===pilot.id&&p.swimming&&p.health===100),'observer water landing');
 input={forward:1};const start=pilot.z;await wait(()=>pilot.z<start-2,'remote surface movement');input={};
 assert.ok([host,guest,observer].every(c=>c.errors.length===0));await mkdir('test-results/update-203',{recursive:true});await writeFile('test-results/update-203/network.json',JSON.stringify({sockets:3,remoteLean:true,crouchedLean:true,leanRelease:true,waterFallHealth:pilot.health,surfaceMovement:true},null,2));console.log('PASS three sockets: lean, crouched lean, release, water fall and surface movement.');
}catch(error){console.error(JSON.stringify({phase:sim?.phase,time:sim?.time,vehicles:sim?.vehicles,builds:sim?.builds}));throw error;}finally{clearInterval(pump);clearInterval(clock);for(const n of nets)n.destroy();await app.close();await rm(temp,{recursive:true,force:true});}
