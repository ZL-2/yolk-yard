import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {readFileSync} from 'node:fs';
import {Network} from '../src/network.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {VERSION,safeProfile} from '../src/data.js';
import {PUBLIC_ROYALE} from '../src/public-royale.js';
const base=process.env.RAVEL_HEALTH_URL||'https://yolk-yard-relay.onrender.com',front=process.env.RAVEL_FRONTEND_URL||'https://zl-2.github.io/yolk-yard',expected=process.env.GITHUB_SHA||process.env.RAVEL_VERIFY_BUILD,version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version;
const delay=ms=>new Promise(r=>setTimeout(r,ms)),users=[],games=[],errors=[];
const get=async url=>{const r=await fetch(url.includes('/version.json')?url+'?t='+Date.now():url,{signal:AbortSignal.timeout(12000),cache:'no-store'});assert.ok(r.ok,'Live endpoint unavailable');return r.json();};
async function wait(fn,label,ms=20000){const end=Date.now()+ms;while(!await fn()){assert.ok(Date.now()<end,label);await delay(30);}}
globalThis.window={YOLK_NETWORK:{relay:base.replace('https:','wss:').replace('http:','ws:')+'/game'}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:new URL(front).origin,agent:globalThis.RAVEL_SOCKET_AGENT});}};
async function user(name){
 const u={profile:safeProfile({name}),launches:[],pending:new Map(),serial:0},ws=new globalThis.WebSocket(base.replace('https:','wss:').replace('http:','ws:')+'/social');u.ws=ws;users.push(u);
 ws.on('error',e=>errors.push(e.message));ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:u.profile})));
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='hello')u.id=m.id;if(m.type==='party')u.party=m.party;if(m.type==='public-match')u.publicMatch=m.match;if(m.type==='launch')u.launches.push(m.launch);if(m.type==='reply'){const p=u.pending.get(m.request);if(p){clearTimeout(p.timer);u.pending.delete(m.request);m.error?p.reject(Error(m.error)):p.resolve(m.result);}}});
 u.ask=(type,data={})=>new Promise((resolve,reject)=>{const request=++u.serial,timer=setTimeout(()=>{u.pending.delete(request);reject(Error('Live Social timeout: '+type));},12000);u.pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({type,...data,request}));});await wait(()=>u.party,'Live Social connection');return u;
}
async function launch(u){
 const l=u.launches.at(-1),g={};g.net=new Network({onState:s=>g.state=s,onError:e=>errors.push(e),getCheckpoint:()=>g.sim?.checkpoint(),getState:()=>g.sim?.snapshot(),onJoin:(id,p,a)=>!!g.sim?.admitPlayer(id,p,a),onLeave:id=>g.sim?.leavePlayer(id),onRoster:ids=>g.sim?.setConnectedHumans?.(ids),onPlayerAction:(id,a)=>g.sim?.playerAction(id,a),onInput:(id,i)=>g.sim?.setInput(id,i,true)});games.push(g);
 if(l.host){assert.equal(l.hostRun,true);assert.equal(l.visibility,'private');await g.net.host(l.code);g.sim=l.options.mode==='royale'?new RoyaleSimulation(l.options):new Simulation(l.options);g.sim.addPlayer('host',u.profile);g.net.setVisibility('private');g.state=g.sim.snapshot();g.net.broadcast(g.state);g.clock=setInterval(()=>{g.state=g.sim.snapshot();g.net.broadcast(g.state);},50);assert.equal(g.sim.phase,'lobby');await u.ask('host-ready',{id:l.id});}
 else await g.net.join(l.code,u.profile,l.ticket);await u.ask('joined',{id:l.id});await wait(()=>g.state,'Live state');return g;
}
async function leave(u,g){clearInterval(g.clock);g.net.destroy();await u.ask('returned');}
try{
 let health,published;const end=Date.now()+360000;
 while(true){try{[health,published]=await Promise.all([get(base+'/health'),get(front+'/version.json')]);if(health.build===published.build&&(!expected||health.build===expected)&&health.gameVersion===VERSION&&published.appVersion===version&&health.deployment?.updating===false&&health.socialAvailable)break;}catch{}assert.ok(Date.now()<end,'Game and relay did not finish publishing');await delay(2000);}
 assert.deepEqual(health.serverModes,['royale']);assert.deepEqual(health.privateModes,['ffa','royale']);assert.equal(health.customMatches,'private-host');assert.equal(health.capacity.rooms,1);
 const tag=Date.now().toString(36).slice(-5),a=await user('QA Host '+tag),b=await user('QA Code '+tag);await wait(()=>a.publicMatch,'Live public match card data');assert.equal(a.publicMatch.capacity,48);assert.equal(a.publicMatch.difficulty,2);assert.equal(a.publicMatch.code,PUBLIC_ROYALE.code);
 for(const [mode,teamSize]of [['ffa',1],['royale',1],['royale',2],['royale',4]]){
  await a.ask('queue',{custom:true,options:{mode,teamSize,capacity:8,bots:3,fill:true}});const host=await launch(a);await b.ask('queue',{code:a.launches.at(-1).code});const guest=await launch(b);
  assert.equal(guest.state.phase,'lobby');assert.notEqual(host.net.serverAuthority,true);assert.notEqual(guest.net.serverAuthority,true);assert.equal((await get(base+'/health')).capacity.rooms,1);
  assert.notEqual(host.sim.startRound(),false);host.net.broadcast(host.sim.snapshot());await wait(()=>guest.state.phase==='playing','Live manual start');await leave(b,guest);await leave(a,host);
 }
 await assert.rejects(a.ask('select',{mode:'teams'}),/Choose Free/);
 // Join during warmup when enough time remains to leave before departure.
 // A running round is observed without changing other players' gameplay.
 const status=(await get(base+'/public-match')).match,join=status.joinable&&status.countdownSeconds>12;
 await a.ask('queue',{publicRoyale:true,spectate:!join});const publicGame=await launch(a);assert.equal(publicGame.net.serverAuthority,true);assert.equal(publicGame.net.isHost,false);assert.equal(publicGame.state.options.recurring,true);assert.equal(publicGame.state.options.difficulty,2);assert.equal(publicGame.state.options.capacity,48);
 const me=publicGame.state.players.find(p=>p.id===publicGame.net.id);assert.ok(me);if(!join)assert.equal(me.spectating,true);
 assert.equal(publicGame.state.players.filter(p=>p.contestant).length,48);publicGame.net.authorityCommand({type:'configure',options:{mode:'ffa',bots:0}});publicGame.net.authorityCommand({type:'visibility',value:'private'});await delay(200);assert.equal(publicGame.state.options.mode,'royale');assert.equal(publicGame.state.visibility,'public');
 await leave(a,publicGame);const after=await get(base+'/health');assert.equal(after.capacity.rooms,1);assert.equal(after.publicMatch.capacity,48);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',build:health.build,version,qualityUpdate:published.release,protocol:VERSION,serverRooms:1,capacity:48,difficulty:'Intermediate',publicAdmission:join?'Join':'Spectate',lobbySummary:true,manualPrivateModes:['Free For All','Solo','Duos','Squads'],teamScrambleRemoved:true}));
}finally{for(const g of games){clearInterval(g.clock);g.net.destroy();}for(const u of users){if(u.party&&u.ws.readyState===1)await u.ask('returned').catch(()=>{});u.ws.close();}}
