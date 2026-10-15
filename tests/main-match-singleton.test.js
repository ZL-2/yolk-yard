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
 const previous={window:globalThis.window,WebSocket:globalThis.WebSocket,social:process.env.RAVEL_SOCIAL_DATA_PATH};
 process.env.RAVEL_SOCIAL_DATA_PATH=directory+'/social.json';
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
  for(const game of games){clearInterval(game.clock);game.net.destroy();}
  for(const user of users){for(const request of user.pending.values())clearTimeout(request.timer);user.ws.close();}
  await app.close();await rm(directory,{recursive:true,force:true});
  globalThis.window=previous.window;globalThis.WebSocket=previous.WebSocket;
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
