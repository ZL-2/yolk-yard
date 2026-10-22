import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {safeProfile} from '../src/data.js';
const temp=await mkdtemp('/tmp/ravel204-network-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const app=await startRealtimeServer({host:'127.0.0.1',port:0}),nets=[];globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async(fn,label,ms=14000)=>{const until=Date.now()+ms;while(!fn()){assert.ok(Date.now()<until,label);await delay(15);}};
let sim,clock,pump;const clients=[];
function client(name){const c={state:null,errors:[],seq:0,profile:safeProfile({name})};c.net=new Network({onState:s=>{if(s.royale?.builds)c.builds=s.royale.builds;c.state=s;},onError:e=>c.errors.push(e),getState:()=>sim?.snapshot(),getCheckpoint:()=>sim?.checkpoint(),onJoin:(id,p,a)=>!!sim?.admitPlayer(id,p,a),onInput:(id,i)=>sim?.setInput(id,i,true),onPlayerAction:(id,a)=>sim?.playerAction(id,a),onLeave:id=>sim?.leavePlayer(id)});c.input=i=>c.net.input({seq:++c.seq,dt:1/60,yaw:0,pitch:0,...i});nets.push(c.net);clients.push(c);return c;}
try{
 const host=client('Combat Host'),code=await host.net.host();sim=new RoyaleSimulation({capacity:12,bots:0,fill:false,teamSize:1,seed:204});sim.addPlayer('host',host.profile);sim.startRound();host.net.setVisibility('private');host.state=sim.snapshot();host.net.broadcast(host.state);
 const gaps=[],ticks=[];let last=performance.now();clock=setInterval(()=>{const now=performance.now();gaps.push(now-last);last=now;const start=performance.now();sim.tick(1/60);ticks.push(performance.now()-start);host.state=sim.snapshot();host.net.broadcast(host.state);},1000/60);
 for(let i=1;i<8;i++){const c=client('Combat '+i);await c.net.join(code,c.profile);}
 await wait(()=>sim.players.size===8,'eight connected humans');sim.beginBattle();for(const [id,p]of sim.players)if(p.bot)sim.players.delete(id);sim.operations=null;sim.stage='active';sim.stormSteps=sim.stormSteps.map(v=>({...v,start:1e9,closeAt:1e9,end:2e9}));
 const actors=[...sim.players.values()],site=sim.map.helipad;for(let i=0;i<actors.length;i++){const p=actors[i],a=i/actors.length*Math.PI*2;Object.assign(p,{x:site.x+Math.sin(a)*8,y:site.y+.2,z:site.z+Math.cos(a)*8,health:10000,shield:0,shieldUntil:0,flight:'ground',grounded:true,slot:1,contestant:true,connected:true,loading:false,spectating:false,equipUntil:0});p.inventory[1]={id:'sprinter',weapon:true,rarity:3,ammo:999};p.bank={medium:9999};sim.syncInventory(p);}
 const wireBefore=host.net.peer.socket._socket.bytesWritten,logicalBefore=host.net.peer.sentBytes,cpuBefore=process.cpuUsage();let frame=0;
 pump=setInterval(()=>{frame++;for(const c of clients){const p=sim.players.get(c.net.id);if(!p)continue;c.input({yaw:Math.atan2(p.x-site.x,p.z-site.z),pitch:-.004,aim:true,fire:frame%60<42,slot:1,shotTime:sim.time-.08,strafe:Math.sin(frame*.03)*.15});}},16);
 await wait(()=>frame>=210,'sustained human combat',20000);
 assert.ok(sim.eventId>100);assert.ok(actors.some(p=>p.health<10000),'actual combat damage');
 for(const c of clients){assert.match(c.net.peer.socket.extensions,/permessage-deflate/);if(c===host)continue;const own=c.state.players.find(p=>p.id===c.net.id),other=c.state.players.find(p=>p.id!==c.net.id);assert.ok(own.ack>30);assert.ok(own.combatState);assert.equal(other.combatState,undefined);assert.ok(own.health>0);}
 const wireBytes=host.net.peer.socket._socket.bytesWritten-wireBefore,logicalBytes=host.net.peer.sentBytes-logicalBefore,cpu=process.cpuUsage(cpuBefore);assert.ok(wireBytes<logicalBytes*.65,`compression ${wireBytes}/${logicalBytes}`);
 const reconnect=clients[1],oldSocket=reconnect.net.peer.socket,previousAck=reconnect.state.players.find(p=>p.id===reconnect.net.id).ack;oldSocket.terminate();
 await wait(()=>reconnect.net.peer.socket!==oldSocket&&reconnect.net.peer.socket.readyState===1,'compressed socket resumes',15000);await wait(()=>reconnect.state.players.find(p=>p.id===reconnect.net.id).ack>previousAck+15,'combat input continues after recovery',15000);
 assert.ok(clients.every(c=>c.errors.length===0),JSON.stringify(clients.map(c=>c.errors)));const sorted=gaps.slice(30).sort((a,b)=>a-b);const report={clients:clients.length,combatEvents:sim.eventId,compressed:true,wireBytes,logicalBytes,wireReductionPercent:Math.round((1-wireBytes/logicalBytes)*100),cpuMs:(cpu.user+cpu.system)/1000,gapP95Ms:sorted[Math.floor(sorted.length*.95)],maxGapMs:sorted.at(-1),recovered:true,ownerPrediction:true,remoteDamage:true};
 await mkdir('test-results/update-204',{recursive:true});await writeFile('test-results/update-204/network.json',JSON.stringify(report,null,2));console.log('PASS '+JSON.stringify(report));
}catch(error){console.error(JSON.stringify({phase:sim?.phase,time:sim?.time,events:sim?.eventId,clients:clients.map(c=>({id:c.net.id,errors:c.errors,ready:c.net.ready}))}));throw error;}
finally{clearInterval(pump);clearInterval(clock);for(const n of nets)n.destroy();await app.close();await rm(temp,{recursive:true,force:true});}
