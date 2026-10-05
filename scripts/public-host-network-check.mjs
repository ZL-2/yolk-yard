import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {VERSION,safeProfile} from '../src/data.js';
import {publicRoyaleOptions} from '../src/public-royale.js';

const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),base=`ws://127.0.0.1:${app.server.address().port}`,users=[],games=[];
globalThis.window={YOLK_NETWORK:{relay:base+'/game'}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,ms=18000){const end=Date.now()+ms;while(!fn()){assert.ok(Date.now()<end,label);await delay(20);}}
async function user(name){
 const u={profile:safeProfile({name}),launches:[],pending:new Map(),serial:0},ws=new globalThis.WebSocket(base+'/social');u.ws=ws;users.push(u);
 ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:u.profile})));
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='party')u.party=m.party;if(m.type==='public-match')u.match=m.match;if(m.type==='launch')u.launches.push(m.launch);if(m.type==='reply'){const p=u.pending.get(m.request);if(p){clearTimeout(p.timer);u.pending.delete(m.request);m.error?p.reject(Error(m.error)):p.resolve(m.result);}}});
 u.ask=(type,data={})=>new Promise((resolve,reject)=>{const request=++u.serial,timer=setTimeout(()=>reject(Error('Social timeout: '+type)),12000);u.pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({type,...data,request}));});await until(()=>u.party,'Social ready');return u;
}
async function game(u,host=false){
 const launch=u.launches.at(-1),g={errors:[],states:0};games.push(g);
 g.net=new Network({getCheckpoint:()=>g.sim?.checkpoint(),getChatState:()=>g.sim?.snapshot()||g.state,onState:s=>{g.state=s;g.states++;},onJoin:(id,p,a)=>!!g.sim?.admitPlayer(id,p,a),onLeave:id=>g.sim?.leavePlayer(id),onRoster:ids=>g.sim?.setConnectedHumans(ids),onInput:(id,input)=>g.sim?.setInput(id,input,true),onError:e=>g.errors.push(e),onHost:(checkpoint,departed)=>{g.sim=new RoyaleSimulation(checkpoint.options).restore(checkpoint);for(const p of g.sim.players.values())if(!p.bot)p.connected=p.id===g.net.id;for(const id of departed)g.sim.leavePlayer(id);}});
 g.clock=setInterval(()=>{if(!g.net.isHost||!g.sim||g.net.closed)return;g.sim.setInput(g.net.id,{yaw:0,forward:0});g.sim.tick(1/60);if((g.frame=(g.frame||0)+1)%3===0){g.state=g.sim.snapshot();g.net.broadcast(g.state);}},1000/60);
 if(host){g.sim=new RoyaleSimulation(publicRoyaleOptions());g.sim.addPlayer('host',u.profile);await g.net.host(launch.code,launch.ticket);g.net.visibility='public';g.sim.startRound();g.net.broadcast(g.sim.snapshot());await u.ask('host-ready',{id:launch.id});}
 else await g.net.join(launch.code,u.profile,launch.ticket);
 await u.ask('joined',{id:launch.id});await until(()=>g.state&&g.net.ready,'Game state');return g;
}
try{
 assert.equal(app.relay.authority.rooms.size,0,'Relay owns no simulated public world');assert.equal(app.relay.publicHost.summary().joinable,true);
 const a=await user('Public Host One'),b=await user('Public Host Two'),c=await user('Public Host Three');
 await a.ask('queue',{publicRoyale:true});assert.equal(a.launches.at(-1).host,true);assert.equal(a.launches.at(-1).visibility,'public');
 await b.ask('queue',{publicRoyale:true});assert.equal(b.launches.length,0,'Concurrent join waits for the first browser to load');
 const h=await game(a,true);await until(()=>b.launches.length,'Waiting join dispatched');const j=await game(b);await c.ask('queue',{publicRoyale:true});const k=await game(c);
 await until(()=>h.sim.players.size>=48&&app.relay.publicHost.summary().humanPlayers===3,'Three humans replace bots');
 assert.equal(h.sim.options.capacity,48);assert.equal(h.sim.options.difficulty,2);assert.ok(h.sim.queueEnds-h.sim.time<=30);assert.notEqual(h.net.serverAuthority,true);assert.notEqual(j.net.serverAuthority,true);
 assert.equal(h.sim.snapshot().players.filter(p=>p.contestant).length,48);assert.equal(h.sim.snapshot().players.filter(p=>p.bot&&p.contestant).length,45);
 const statsPeer=app.relay.peers.get(h.net.peer.id);app.relay.progression.recordPublicStat({identity:statsPeer.progressId,bot:false},'kills');const board=await a.ask('leaderboards');assert.equal(board.kills.self.you,true);assert.equal(board.kills.self.name,'Public Host One');assert.ok(board.kills.self.kills>=1);
 const owner=app.relay.publicHost.host.peer;h.net.peer.socket.terminate();await until(()=>h.net.peer.socket?.readyState===1&&!h.net.peer.reconnecting,'Brief host disconnect resumes');assert.equal(app.relay.publicHost.host.peer,owner);assert.equal(j.net.isHost,false);
 const round=h.sim.matchId;h.sim.chests.push({id:'handoff-chest',x:3,y:0,z:4,opened:true});h.sim.lootVersion++;h.net.broadcast(h.sim.snapshot());await until(()=>j.net.lastCheckpoint?.simulation.chests.some(x=>x.id==='handoff-chest'),'World transaction checkpoint delivered');
 h.net.destroy();await a.ask('returned');await until(()=>j.net.isHost&&app.relay.publicHost.host?.peer===j.net.peer.id,'Graceful host handoff');await until(()=>k.net.hostId===j.net.id&&!k.net.migrating,'Third player follows new host');
 assert.equal(app.relay.peers.get(app.relay.publicHost.key).progressId,app.relay.peers.get(j.net.peer.id).progressId,'Host alias keeps the elected member’s progression identity');
 assert.equal(j.sim.matchId,round);assert.equal(j.sim.chests.find(x=>x.id==='handoff-chest').opened,true);assert.equal(j.sim.players.has('host'),false);assert.equal(j.sim.players.get(k.net.id).connected,true);
 // An unannounced loss follows the same checkpoint election, not a fresh match.
 app.relay.remove(app.relay.peers.get(j.net.peer.id),1001,'Test permanent host loss');j.net.destroy();await b.ask('returned');await until(()=>k.net.isHost&&app.relay.publicHost.host?.peer===k.net.peer.id,'Abrupt host handoff');assert.equal(k.sim.matchId,round);assert.equal(k.sim.chests.find(x=>x.id==='handoff-chest').opened,true);
 // A browser that responds to pings but stops advancing cannot retain its lease.
 const d=await user('Public Host Four');await d.ask('queue',{publicRoyale:true});const next=await game(d);await until(()=>app.relay.publicHost.summary().humanPlayers===2,'Join after migration');
 app.relay.publicHost.host.advancedAt=Date.now()-16000;app.relay.publicHost.sweep();k.net.destroy();await c.ask('returned');await until(()=>next.net.isHost&&app.relay.publicHost.host?.peer===next.net.peer.id,'Frozen host lease transfers');assert.equal(next.sim.matchId,round);
 next.sim.time=next.sim.queueEnds;next.sim.advanceWarmupClock();next.net.broadcast(next.sim.snapshot());next.net.publishRoom();assert.equal(next.sim.stage,'battle-bus');
 const e=await user('Public Late Viewer');await e.ask('queue',{publicRoyale:true});const viewer=await game(e);await until(()=>next.sim.players.has(viewer.net.id),'Late viewer arrives');assert.equal(next.sim.players.get(viewer.net.id).lateSpectator,true);assert.equal(next.sim.players.get(viewer.net.id).contestant,false);
 assert.equal(app.relay.authority.rooms.size,0);for(const g of [h,j,k,next,viewer])assert.deepEqual(g.errors,[]);
 console.log(JSON.stringify({result:'PASS',protocol:VERSION,serverSimulations:0,firstPlayerHost:true,concurrentJoins:true,briefReconnect:true,gracefulTransfer:true,abruptTransfer:true,frozenHostTransfer:true,checkpointWorldPreserved:true,joinAfterMigration:true,lateSpectator:true,authenticatedLeaderboards:true}));
}catch(e){console.error(JSON.stringify({summary:app.relay.publicHost.summary(),members:[...app.relay.publicHost.members.values()].map(x=>({id:x.id,spectator:x.admission.spectator})),games:games.map(g=>({id:g.net.id,host:g.net.isHost,errors:g.errors,players:g.sim?[...g.sim.players.values()].filter(p=>!p.bot).map(p=>({id:p.id,contestant:p.contestant,connected:p.connected,spec:p.spectating})):null}))}));throw e;}finally{for(const g of games){clearInterval(g.clock);g.net.destroy();}for(const u of users)u.ws.close();await app.close();}
