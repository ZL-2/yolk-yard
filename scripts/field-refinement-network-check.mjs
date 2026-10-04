import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {VERSION,safeProfile} from '../src/data.js';
import {inventory} from '../src/building.js';
import {watchersFor} from '../src/spectator-status.js';
const temp=await mkdtemp(tmpdir()+'/ravel-refinement-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),authority=app.relay.authority,room=authority.publicRoom,s=room.sim,users=[],games=[],errors=[];
// The test owns the server clock, so socket timing cannot consume countdown time.
clearInterval(authority.timer);authority.now=()=>Date.UTC(2026,9,4,16);
const base='http://127.0.0.1:'+app.server.address().port;
globalThis.window={YOLK_NETWORK:{relay:base.replace('http:','ws:')+'/game'}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
async function wait(fn,label){const end=Date.now()+12000;while(!fn()){assert.ok(Date.now()<end,label);await new Promise(r=>setTimeout(r,20));}}
async function user(name){
 const u={profile:safeProfile({name}),launches:[],pending:new Map(),serial:0},ws=new globalThis.WebSocket(base.replace('http:','ws:')+'/social');u.ws=ws;users.push(u);
 ws.on('error',e=>errors.push(e.message));ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:u.profile})));
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='party')u.party=m.party;if(m.type==='launch')u.launches.push(m.launch);if(m.type==='reply'){const p=u.pending.get(m.request);if(p){clearTimeout(p.timer);u.pending.delete(m.request);m.error?p.reject(Error(m.error)):p.resolve(m.result);}}});
 u.ask=(type,data={})=>new Promise((resolve,reject)=>{const request=++u.serial,timer=setTimeout(()=>reject(Error('Social timeout: '+type)),12000);u.pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({type,...data,request}));});await wait(()=>u.party,'Social hello');return u;
}
async function join(u,spectate=false){
 await u.ask('queue',{publicRoyale:true,spectate});await wait(()=>u.launches.length,'Public admission');const l=u.launches.at(-1),g={};g.net=new Network({onState:state=>g.state=state,onError:e=>errors.push(e)});games.push(g);
 await g.net.join(l.code,u.profile,l.ticket);await u.ask('joined',{id:l.id});await wait(()=>g.state,'Authority welcome');assert.equal(g.net.serverAuthority,true);return g;
}
async function broadcast(predicate,label){authority.broadcast(room);await wait(predicate,label);}
try{
 s.time=100;s.advanceWarmupClock(90);assert.equal(s.queueEnds,0);assert.equal(authority.publicSummary().countdownStarted,false);
 const viewer=await user('Field Viewer'),a=await user('Field First'),b=await user('Field Friend'),gv=await join(viewer,true);assert.equal(s.queueEnds,0,'spectator does not start countdown');
 const ga=await join(a),deadline=s.queueEnds;assert.equal(deadline-s.time,45);s.time+=40;s.advanceWarmupClock();const gb=await join(b);assert.equal(s.queueEnds,deadline);
 await broadcast(()=>[ga,gb,gv].every(g=>g.state.royale.queueEnds===deadline),'Shared deadline');assert.equal(gb.state.royale.countdownStarted,true);
 gv.net.send({type:'player-action',action:'watch:'+ga.net.id});await wait(()=>s.players.get(gv.net.id).watchingId===ga.net.id,'Accepted spectator intent');await broadcast(()=>watchersFor(ga.state,ga.net.id).length===1,'Replicated spectator eye count');
 const p=s.players.get(ga.net.id);s.map={size:256,boxes:[],terrain:null,relays:[]};s.relays=[];s.loot=[];s.chests=[];p.inventory=inventory();for(let i=1;i<=5;i++)p.inventory[i]={id:'sprinter',weapon:true,count:1,rarity:1,ammo:30};Object.assign(p,{x:0,y:0,z:0,flight:'ground',grounded:true,slot:1,lastDamage:-100});s.syncInventory(p);s.dropWeapon({x:1,y:0,z:0},'needle',2);
 ga.net.input({seq:1,interact:true});await wait(()=>s.inputs.get(p.id)?.seq===1,'Held pickup input');s.interact(p,s.inputs.get(p.id),.2);assert.equal(p.inventory[1].id,'sprinter');await broadcast(()=>ga.state.players.find(o=>o.id===p.id).swapProgress>=.19,'Replicated hold progress');s.interact(p,s.inputs.get(p.id),.3);await broadcast(()=>ga.state.players.find(o=>o.id===p.id).inventory[1].id==='needle','Authoritative held swap');
 ga.net.destroy();await wait(()=>s.players.get(ga.net.id)?.connected===false||!s.players.has(ga.net.id),'First disconnect');assert.equal(s.queueEnds,deadline);gb.net.destroy();await wait(()=>s.queueEnds===0,'Final contestant resets countdown');assert.equal(authority.publicSummary().countdownStarted,false);
 gv.net.destroy();await wait(()=>s.players.get(gv.net.id)?.connected===false||!s.players.has(gv.net.id),'Spectator disconnect');const c=await user('Field Fresh'),gc=await join(c);assert.equal(s.queueEnds-s.time,45);assert.equal(gc.state.royale.countdownStarted,true);assert.deepEqual(errors,[]);
 console.log('PASS real Social + WebSocket authority: spectator-only waiting, fresh 45s, inherited deadline, watcher count, hold progress and swap, last-human reset, fresh rejoin.');
}finally{games.forEach(g=>g.net.destroy());users.forEach(u=>u.ws.close());await app.close();await rm(temp,{recursive:true,force:true});}
