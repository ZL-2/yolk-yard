import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {VERSION,safeProfile} from '../src/data.js';
import {PUBLIC_ROYALE,publicRoyaleOptions} from '../src/public-royale.js';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label,timeout=8000){
 const deadline=Date.now()+timeout;
 while(!check()){assert.ok(Date.now()<deadline,label);await pause(15);}
}

async function fixture(){
 const directory=await mkdtemp(tmpdir()+'/ravel-singleton-');
 const previous={window:globalThis.window,WebSocket:globalThis.WebSocket,social:process.env.RAVEL_SOCIAL_DATA_PATH,reward:process.env.RAVEL_REWARD_DATA_PATH};
 process.env.RAVEL_SOCIAL_DATA_PATH=directory+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=directory+'/rewards.json';
 const app=await startRealtimeServer({port:0,host:'127.0.0.1',mapPath:directory+'/maps.json'});
 const base=`ws://127.0.0.1:${app.server.address().port}`,users=[],games=[];
 globalThis.window={YOLK_NETWORK:{relay:base+'/game'}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 async function user(name){
  const user={profile:safeProfile({name}),launches:[],pending:new Map(),serial:0};
  const ws=user.ws=new globalThis.WebSocket(base+'/social');users.push(user);
  ws.on('error',()=>{});
  ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:user.profile})));
  ws.on('message',raw=>{
   const m=JSON.parse(raw);
   if(m.type==='hello')user.id=m.id;
   if(m.type==='party')user.party=m.party;
   if(m.type==='launch')user.launches.push(m.launch);
   if(m.type==='reply'){
    const request=user.pending.get(m.request);
    if(request){clearTimeout(request.timer);user.pending.delete(m.request);m.error?request.reject(Error(m.error)):request.resolve(m.result);}
   }
  });
  user.ask=(type,data={})=>new Promise((resolve,reject)=>{
   const request=++user.serial,timer=setTimeout(()=>{user.pending.delete(request);reject(Error('No social reply: '+type));},8000);
   user.pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({type,...data,request}));
  });
  await until(()=>user.party,'Social connected');return user;
 }
 async function game(user){
  const launch=user.launches.at(-1),game={errors:[],promotions:0,states:0};games.push(game);
  game.net=new Network({
   getCheckpoint:()=>game.sim?.checkpoint(),getChatState:()=>game.sim?.snapshot()||game.state,
   onState:state=>{game.state=state;game.states++;},onError:error=>game.errors.push(error),
   onJoin:(id,profile,admission)=>!!game.sim?.admitPlayer(id,profile,admission),
   onLeave:id=>game.sim?.leavePlayer(id),onRoster:ids=>game.sim?.setConnectedHumans(ids),
   onSuspendPlayer:id=>game.sim?.suspendPlayer(id),onHostRecovery:ms=>game.sim?.beginHostRecovery(ms),
   onInput:(id,input)=>game.sim?.setInput(id,input,true),
   onHost:(checkpoint,departed)=>{
    game.promotions++;game.sim=new RoyaleSimulation(checkpoint.options).restore(checkpoint);
    for(const p of game.sim.players.values())if(!p.bot)p.connected=p.id===game.net.id;
    for(const id of departed)game.sim.leavePlayer(id);
   }
  });
  game.clock=setInterval(()=>{
   if(game.net.closed||!game.net.isHost||!game.sim)return;
   game.sim.tick(.05);game.state=game.sim.snapshot();game.net.broadcast(game.state);
  },50);
  if(launch.host){
   game.sim=new RoyaleSimulation(publicRoyaleOptions());game.sim.addPlayer('host',user.profile);
   await game.net.host(launch.code,launch.ticket);game.net.visibility='public';game.sim.startRound();
   game.state=game.sim.snapshot();game.net.broadcast(game.state);await user.ask('host-ready',{id:launch.id});
  }else await game.net.join(launch.code,user.profile,launch.ticket);
  await user.ask('joined',{id:launch.id});await until(()=>game.state,'Match snapshot');return game;
 }
 async function close(){
  for(const game of games){clearInterval(game.clock);if(game.net.peer?.socket)delete game.net.peer.socket.bufferedAmount;game.net.destroy();}
  for(const user of users){for(const request of user.pending.values())clearTimeout(request.timer);user.ws.close();}
  await app.close();await rm(directory,{recursive:true,force:true});
  globalThis.window=previous.window;globalThis.WebSocket=previous.WebSocket;
  if(previous.reward===undefined)delete process.env.RAVEL_REWARD_DATA_PATH;else process.env.RAVEL_REWARD_DATA_PATH=previous.reward;
  if(previous.social===undefined)delete process.env.RAVEL_SOCIAL_DATA_PATH;else process.env.RAVEL_SOCIAL_DATA_PATH=previous.social;
 }
 return {app,users,games,user,game,close};
}

test('a lost public guest channel reconnects to the live lease instead of creating a second main-match simulation',async()=>{
 const f=await fixture();
 try{
  const a=await f.user('Singleton Host'),b=await f.user('Singleton Guest'),c=await f.user('Singleton Arrival');
  await a.ask('queue',{publicRoyale:true});await b.ask('queue',{code:PUBLIC_ROYALE.code});
  assert.equal(a.launches.length,1);assert.equal(a.launches[0].host,true);
  assert.equal(b.launches.length,0,'Concurrent code join waits for the one pending public host');
  const host=await f.game(a);await until(()=>b.launches.length,'Pending public guest dispatched');
  const guest=await f.game(b);await until(()=>guest.net.lastCheckpoint?.simulation,'Recovery checkpoint delivered');
  const lease=f.app.relay.publicHost.host.peer,round=host.sim.matchId,states=guest.states;
  // A channel can close while both WebSocket sessions and the public host lease
  // remain alive. This is not authority to start an independent simulation.
  host.net.connections.get(guest.net.id).close();
  await pause(150);
  await c.ask('queue',{publicRoyale:true});const arrival=await f.game(c);
  assert.equal(f.app.relay.publicHost.host.peer,lease,'The canonical host never left');
  assert.equal(arrival.state.royale.matchId,round,'New arrivals still reach the original main match');
  assert.equal(guest.net.isHost,false,'An isolated guest must not run a second host while the relay lease is live');
  assert.equal(guest.promotions,0,'Simulation restoration must wait for an authorized host lease');
  await until(()=>!guest.net.migrating&&guest.states>states&&host.net.connections.has(guest.net.id),'The isolated guest rejoins the canonical public host');
  assert.equal(guest.state.royale.matchId,round);assert.equal(guest.net.hostId,host.net.id);
  assert.equal(f.games.filter(game=>game.net.isHost&&!game.net.closed).length,1);
  assert.deepEqual(f.games.flatMap(game=>game.errors),[]);
 }finally{await f.close();}
});

test('six public players survive a congested battle checkpoint and every guest catches up',async()=>{
 const f=await fixture();
 try{
  const users=[];for(let i=0;i<6;i++)users.push(await f.user('Checkpoint '+i));
  await Promise.all(users.map(user=>user.ask('queue',{publicRoyale:true})));
  const owner=users.find(u=>u.launches.some(l=>l.host));
  assert.equal(users.flatMap(u=>u.launches).filter(l=>l.host).length,1,'Concurrent public joins reserve one creator');
  const host=await f.game(owner);
  for(const user of users.filter(u=>u!==owner)){await until(()=>user.launches.length,'Waiting player dispatched');await f.game(user);}
  await until(()=>host.net.connections.size===5,'All six players share one host');
  // A real uplink can be writable but have more than the transport flush limit
  // queued. Every receiver still needs the new world and its recovery state.
  Object.defineProperty(host.net.peer.socket,'bufferedAmount',{configurable:true,get:()=>100000});
  host.sim.beginBattle();const matchId=host.sim.matchId;
  host.net.broadcast(host.sim.snapshot());
  assert.equal(host.net.peer.destroyed,false,'A checkpoint burst must not destroy the shared host transport');
  assert.ok(host.net.peer.queueBytes<=1800000,'Pending traffic remains bounded');
  delete host.net.peer.socket.bufferedAmount;host.net.peer.flush();
  await until(()=>f.games.slice(1).every(g=>g.state?.royale.stage==='battle-bus'&&g.net.lastCheckpoint?.simulation.stage==='battle-bus'),'All recipients receive world and checkpoint after congestion',12000);
  assert.equal(f.app.relay.publicHost.host.peer,host.net.peer.id);
  assert.ok(f.games.every(g=>g.state.royale.matchId===matchId));
  assert.deepEqual(f.games.flatMap(g=>g.errors),[]);
 }finally{await f.close();}
});

test('a party member failing to join cannot cancel the public host or another party in the match',async()=>{
 const f=await fixture();
 try{
  const a=await f.user('Party Host'),b=await f.user('Slow Partner'),c=await f.user('Other Party');
  await a.ask('invite',{id:b.id});const invite=[...f.app.relay.parties.invites.values()].find(i=>i.to===b.id);
  await b.ask('accept',{id:invite.id});await b.ask('ready',{value:true});
  await a.ask('queue',{publicRoyale:true});const host=await f.game(a);
  await c.ask('queue',{publicRoyale:true});const guest=await f.game(c),states=guest.states;
  const launch=b.launches.at(-1);assert.ok(launch);
  await b.ask('failed',{id:launch.id,reason:'Test interrupted load'});
  const user=f.app.relay.parties.users.get(a.id),party=f.app.relay.parties.parties.get(user.party);
  assert.equal(user.inMatch,true,'Established host remains admitted');assert.equal(party.state,'playing');
  assert.equal(f.app.relay.publicHost.host.peer,host.net.peer.id);
  await until(()=>guest.states>states,'Other party keeps playing');
 }finally{await f.close();}
});

test('cancelled initial reservations immediately release the public room for the next join',async()=>{
 const f=await fixture();
 try{
  const a=await f.user('Cancel First'),b=await f.user('Cancel Next');
  await a.ask('queue',{publicRoyale:true});await a.ask('cancel');
  assert.equal(f.app.relay.publicHost.pending,null);
  await b.ask('queue',{publicRoyale:true});assert.equal(b.launches.at(-1)?.host,true);
  const host=await f.game(b);assert.equal(f.app.relay.publicHost.host.peer,host.net.peer.id);
 }finally{await f.close();}
});

test('old protocol tabs cannot register a parallel FRONTIER room',async()=>{
 const f=await fixture();let ws;
 try{
  const old=`yolk-yard-v${VERSION-1}-${PUBLIC_ROYALE.code}`;
  ws=new globalThis.WebSocket(window.YOLK_NETWORK.relay);
  const closed=new Promise(resolve=>ws.on('close',(code)=>resolve(code)));
  ws.on('open',()=>ws.send(JSON.stringify({type:'register',id:old})));
  assert.equal(await closed,1008);assert.equal(f.app.relay.peers.has(old),false);
 }finally{ws?.terminate();await f.close();}
});

test('an active public guest keeps its contestant and inventory across a brief channel interruption',async()=>{
 const f=await fixture();
 try{
  const a=await f.user('Continuity Host'),b=await f.user('Continuity Guest');
  await a.ask('queue',{publicRoyale:true});const host=await f.game(a);
  await b.ask('queue',{publicRoyale:true});const guest=await f.game(b);
  host.sim.beginBattle();const player=host.sim.players.get(guest.net.id);player.materials.wood=123;
  host.net.broadcast(host.sim.snapshot());
  await until(()=>guest.state?.royale.stage==='battle-bus','Guest entered battle');
  const states=guest.states;host.net.connections.get(guest.net.id).close();
  await until(()=>!guest.net.migrating&&guest.states>states&&host.net.connections.has(guest.net.id),'Guest reconnected');
  assert.equal(host.sim.players.get(guest.net.id),player,'Reconnect retains the existing contestant');
  assert.equal(player.materials.wood,123);assert.equal(player.lateSpectator,false);
 }finally{await f.close();}
});

test('a spectator elected during host transfer preserves the active round while a survivor reconnects',async()=>{
 const f=await fixture();
 try{
  const users=[];for(let i=0;i<3;i++)users.push(await f.user('Transfer '+i));
  await users[0].ask('queue',{publicRoyale:true});const host=await f.game(users[0]);
  for(const user of users.slice(1)){await user.ask('queue',{publicRoyale:true});await f.game(user);}
  host.sim.beginBattle();const elected=f.games[1],survivor=f.games[2],p=host.sim.players.get(elected.net.id);
  Object.assign(p,{health:0,spectating:true,eliminated:true});const matchId=host.sim.matchId;
  host.net.broadcast(host.sim.snapshot());
  await until(()=>elected.net.lastCheckpoint?.simulation.stage==='battle-bus','Recovery state ready');
  host.net.destroy();await users[0].ask('returned');
  await until(()=>elected.net.isHost&&!survivor.net.migrating&&elected.net.connections.has(survivor.net.id),'Single host handoff completes',12000);
  assert.equal(elected.sim.matchId,matchId,'Recovery does not start a second round');
  assert.equal(elected.sim.players.get(survivor.net.id).lateSpectator,false);
  assert.equal(f.games.filter(g=>g.net.isHost&&!g.net.closed).length,1);
 }finally{await f.close();}
});
