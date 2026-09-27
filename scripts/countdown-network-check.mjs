import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {safeProfile} from '../src/data.js';
const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),nodes=[],timers=[];
globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
const wait=async(fn)=>{const end=Date.now()+20000;while(!fn()){assert.ok(Date.now()<end,'Countdown relay check timed out');await new Promise(r=>setTimeout(r,20));}};
function client(name){const n={state:null,sim:null,errors:[]};n.profile=safeProfile({name});n.net=new Network({getCheckpoint:()=>n.sim?.checkpoint(),getChatState:()=>n.sim?.snapshot()||n.state,onJoin:(id,p)=>!!n.sim.admitPlayer(id,p),onLeave:id=>n.sim?.leavePlayer(id),onRoster:ids=>n.sim?.setConnectedHumans(ids),onState:s=>{n.state=s;},onError:e=>n.errors.push(e)});nodes.push(n);let ticks=0;timers.push(setInterval(()=>{if(n.sim&&!n.net.closed){n.sim.tick(1/60);if(++ticks%3===0)n.net.broadcast(n.sim.snapshot());}},1000/60));return n;}
try{
 const host=client('Clock Host');host.sim=new RoyaleSimulation({capacity:16,fill:true,bots:15,seed:57});host.sim.addPlayer('host',host.profile);await host.net.host();host.sim.startRound();host.net.broadcast(host.sim.snapshot());
 assert.equal(host.sim.queueEnds-host.sim.time,60);host.sim.advanceWarmupClock(20);const deadline=host.sim.queueEnds;
 const first=client('Clock Guest 1');await first.net.join(host.net.code,first.profile);await wait(()=>first.state?.royale?.humanContestants===2);
 assert.equal(first.state.royale.queueEnds,deadline);assert.ok(first.state.royale.queueEnds-first.state.time<41);assert.equal(first.state.royale.botContestants,14);assert.equal(first.state.royale.stage,'spawn-island');
 console.log('PASS midway guest sees the existing remaining countdown; bots do not trigger an early start');
 for(let i=2;i<16;i++){const guest=client('Clock Guest '+i);await guest.net.join(host.net.code,guest.profile);await wait(()=>guest.state?.royale);if(i<15)assert.notEqual(host.sim.stage,'battle-bus');}
 await wait(()=>nodes.every(n=>n===host||n.state?.royale?.stage==='battle-bus'));
 assert.equal(host.sim.startReason,'human-full');assert.equal(host.sim.alive,16);assert.equal(host.sim.events.filter(e=>e.type==='round').length,1);assert.ok(host.sim.time<20);assert.equal(host.sim.players.size,16);
 for(const n of nodes.slice(1)){assert.equal(n.state.royale.humanContestants,16);assert.equal(n.state.royale.botContestants,0);assert.equal(n.state.royale.startReason,'human-full');assert.equal(n.state.royale.matchId,host.sim.matchId);assert.equal(n.state.royale.queueEnds,0);}
 console.log('PASS sixteen connected real contestants replace fill bots and enter one shared Bus phase early');
 const late=client('Clock Observer');await late.net.join(host.net.code,late.profile);await wait(()=>late.state?.players.some(p=>p.id===late.net.id));assert.equal(late.state.players.find(p=>p.id===late.net.id).lateSpectator,true);assert.equal(host.sim.alive,16);
 first.net.destroy();await wait(()=>!host.sim.players.has(first.net.id));assert.equal(host.sim.queueEnds,0);assert.equal(host.sim.events.filter(e=>e.type==='round').length,1);assert.deepEqual(nodes.flatMap(n=>n.errors),[]);
 console.log('PASS late arrivals spectate; disconnecting after the cutoff cannot restart or duplicate departure');
}finally{timers.forEach(clearInterval);nodes.forEach(n=>n.net.destroy());await app.close();}
