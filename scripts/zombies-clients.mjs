import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {Network} from '../src/network.js';
import {VERSION,safeProfile} from '../src/data.js';
export async function until(fn,label='Zombies client timeout',ms=12000){const end=Date.now()+ms;while(!fn()){assert.ok(Date.now()<end,label);await new Promise(r=>setTimeout(r,15));}}
export function zombieClients(base,origin='https://zl-2.github.io'){
 const users=[],games=[];globalThis.window={YOLK_NETWORK:{relay:base+'/game'}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin});}};
 async function user(name){const u={profile:safeProfile({name}),launches:[],invites:[],pending:new Map(),serial:0},ws=u.ws=new WebSocket(base+'/social',{origin});users.push(u);ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:u.profile})));ws.on('error',()=>{});ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='hello')Object.assign(u,m);if(m.type==='party')u.party=m.party;if(m.type==='invite')u.invites.push(m.invite);if(m.type==='launch')u.launches.push(m.launch);if(m.type==='reply'){const r=u.pending.get(m.request);if(r){clearTimeout(r.timer);u.pending.delete(m.request);m.error?r.reject(Error(m.error)):r.resolve(m.result);}}});u.ask=(type,data={})=>new Promise((resolve,reject)=>{const request=++u.serial,timer=setTimeout(()=>reject(Error('No response: '+type)),12000);u.pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({type,...data,request}));});await until(()=>u.party);return u;}
 async function invite(a,b){await a.ask('invite',{id:b.id});await until(()=>b.invites.length);await b.ask('accept',{id:b.invites.at(-1).id});await until(()=>a.party.members.some(m=>m.id===b.id));}
 async function launch(u){const l=u.launches.at(-1),g={state:null,errors:[],receipts:[],seq:0};g.net=new Network({onState:s=>g.state=s,onError:e=>g.errors.push(e),onProgress:(type,e)=>{if(type==='reward')g.receipts.push(e.receipt);}});games.push(g);await g.net.join(l.code,u.profile,l.ticket);await u.ask('joined',{id:l.id});await until(()=>g.state);g.send=(input={})=>g.net.inputBatch([{seq:++g.seq,yaw:0,pitch:0,slot:0,...input}]);return g;}
 async function close(){for(const g of games)g.net.destroy();for(const u of users){for(const r of u.pending.values())clearTimeout(r.timer);u.ws.terminate();}}
 return {users,games,user,invite,launch,close};
}
