import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';
import {startRealtimeServer} from '../server/realtime/index.js';import {Network} from '../src/network.js';
import {VERSION,safeProfile} from '../src/data.js';import {BOSSES} from '../src/bosses.js';
import {scanBossAwareness,initializeBossAwareness} from '../src/boss-awareness.js';import {requestBossVoice} from '../src/boss-voice.js';
const temp=await mkdtemp(tmpdir()+'/ravel-boss-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),authority=app.relay.authority,room=authority.publicRoom,s=room.sim,users=[],games=[],errors=[];
clearInterval(authority.timer);authority.now=()=>Date.UTC(2026,9,5,16);const base='http://127.0.0.1:'+app.server.address().port;
globalThis.window={YOLK_NETWORK:{relay:base.replace('http:','ws:')+'/game'}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
async function wait(fn,label){const end=Date.now()+12000;while(!fn()){assert.ok(Date.now()<end,label);await new Promise(r=>setTimeout(r,20));}}
async function join(name,spectate=false){
 const u={profile:safeProfile({name}),pending:new Map(),serial:0},ws=new globalThis.WebSocket(base.replace('http:','ws:')+'/social');u.ws=ws;users.push(u);
 ws.on('error',e=>errors.push(e.message));ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:u.profile})));
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='party')u.party=m.party;if(m.type==='launch')u.launch=m.launch;if(m.type==='reply'){const p=u.pending.get(m.request);if(p){clearTimeout(p.timer);u.pending.delete(m.request);m.error?p.reject(Error(m.error)):p.resolve(m.result);}}});
 u.ask=(type,data={})=>new Promise((resolve,reject)=>{const request=++u.serial,timer=setTimeout(()=>reject(Error('Social timeout '+type)),12000);u.pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({type,...data,request}));});await wait(()=>u.party,'social ready');await u.ask('queue',{publicRoyale:true,spectate});await wait(()=>u.launch,'admission');
 const g={events:new Map()};g.net=new Network({onState:state=>{g.state=state;for(const e of state.events||[])g.events.set(e.id,e);},onError:e=>errors.push(e)});games.push(g);await g.net.join(u.launch.code,u.profile,u.launch.ticket);await u.ask('joined',{id:u.launch.id});await wait(()=>g.state,'first snapshot');return g;
}
async function broadcast(fn,label){await wait(()=>{if(fn())return true;authority.broadcast(room);return false;},label);}
try{
 const a=await join('Boss First'),b=await join('Boss Second'),viewer=await join('Boss Viewer',true);assert.equal(s.beginBattle(),true);const human=s.players.get(a.net.id);
 for(const p of s.players.values())if(!p.boss&&p!==human){p.spectating=true;p.flight='out';}
 s.map={size:256,boxes:[],terrain:null,relays:[]};s.builds=[];s.smokes=[];const def=BOSSES[0],boss=s.players.get(def.id);Object.assign(boss,{x:0,y:0,z:0,yaw:0,home:{x:0,y:0,z:0},bossWindup:null,bossVeil:null});Object.assign(human,{x:0,y:0,z:-12,health:100,spectating:false,flight:'ground',contestant:true});initializeBossAwareness(s,boss);
 const scan=()=>scanBossAwareness(s,boss,def,()=>false);scan();await broadcast(()=>games.every(g=>g.state.players.find(p=>p.id===boss.id)?.bossAlert==='suspicious'),'question marker on both players and spectator');
 const first=games.map(g=>g.state.players.find(p=>p.id===boss.id).bossSuspicion);assert.ok(first.every(n=>n===first[0]&&n>0&&n<1));
 for(let i=0;i<10&&boss.bossAlert!=='alerted';i++){s.time+=.2;scan();}const contact=s.events.findLast(e=>e.type==='boss-voice'&&e.cue==='alerted');assert.ok(contact);
 await broadcast(()=>games.every(g=>g.state.players.find(p=>p.id===boss.id)?.bossAlert==='alerted'&&g.events.get(contact.id)?.clip===contact.clip),'same confirmed alert and exact voice clip for every peer');
 assert.ok(games.every(g=>g.state.players.find(p=>p.id===boss.id).bossVoice===undefined),'private schedules stay off normal snapshots');
 human.z=100;s.time+=1.4;scan();await broadcast(()=>games.every(g=>g.state.players.find(p=>p.id===boss.id)?.bossAlert==='searching'),'shared last-known-position search');
 s.time+=8;scan();await broadcast(()=>games.every(g=>g.state.players.find(p=>p.id===boss.id)?.bossAlert==='unaware'),'shared return to patrol');
 const before=s.events.filter(e=>e.type==='boss-voice').length;for(let i=0;i<30;i++)requestBossVoice(s,boss,'alerted',{chance:false});assert.ok(s.events.filter(e=>e.type==='boss-voice').length<=before+1,'no event flood');assert.deepEqual(errors,[]);
 console.log('PASS real Social/WebSocket authority: synchronized suspicion, confirmed targeting, same selected voice clip, spectator replication, bounded cue events and search/reset on all peers.');
}finally{games.forEach(g=>g.net.destroy());users.forEach(u=>u.ws.close());await app.close();await rm(temp,{recursive:true,force:true});}
