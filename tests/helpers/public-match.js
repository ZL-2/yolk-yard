import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {startRealtimeServer} from '../../server/realtime/index.js';
import {Network} from '../../src/network.js';
import {Simulation} from '../../src/simulation.js';
import {RoyaleSimulation} from '../../src/royale.js';
import {VERSION,safeProfile} from '../../src/data.js';
import {PUBLIC_ROYALE,publicRoyaleOptions} from '../../src/public-royale.js';

export const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function until(check,label,timeout=8000){
 const deadline=Date.now()+timeout;
 while(!check()){assert.ok(Date.now()<deadline,label);await pause(15);}
}

export async function fixture(){
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
   onSuspendPlayer:id=>game.sim?.suspendPlayer(id),onHostRecovery:ms=>game.sim?.beginHostRecovery?.(ms),
   onInput:(id,input)=>game.sim?.setInput(id,input,true),
   onHost:(checkpoint,departed)=>{
    game.promotions++;game.sim=(checkpoint.options.mode==='royale'?new RoyaleSimulation(checkpoint.options):new Simulation(checkpoint.options)).restore(checkpoint);
    for(const p of game.sim.players.values())if(!p.bot)p.connected=p.id===game.net.id;
    for(const id of departed)game.sim.leavePlayer(id);
   }
  });
  game.clock=setInterval(()=>{
   if(game.net.closed||!game.net.isHost||!game.sim)return;
   game.sim.tick(.05);game.state=game.sim.snapshot();game.net.broadcast(game.state);
  },50);
  if(launch.host){
   game.sim=launch.options.mode==='royale'?new RoyaleSimulation(launch.options):new Simulation(launch.options);const player=game.sim.addPlayer('host',user.profile);game.sim.assignTeam(player,launch.admission);
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
