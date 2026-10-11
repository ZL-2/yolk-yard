import test from 'node:test';import assert from 'node:assert/strict';import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';import {Network} from '../src/network.js';import {safeProfile} from '../src/data.js';
const until=async(fn)=>{const end=Date.now()+10000;while(!fn()){assert.ok(Date.now()<end,'Authority timeout');await new Promise(r=>setTimeout(r,20));}};
test('Royale and private simulation are refused by server authority',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),net=new Network();
 globalThis.window={YOLK_NETWORK:{relay:'ws://127.0.0.1:'+app.server.address().port+'/game'}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 try{await net.host();for(const [mode,visibility]of [['royale','public'],['ffa','private']])await assert.rejects(net.createAuthority({mode,bots:0},safeProfile({name:'Hosted Only'}),visibility),/player host/);assert.equal(app.relay.authority.rooms.size,0);assert.equal(app.relay.authority.capacity.reservations.size,0);}finally{net.destroy();await app.close();}
});
test('legacy public arena commands cannot start or configure a relay-owned world',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),net=new Network();
 globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 try{await net.host();await assert.rejects(net.createAuthority({mode:'ffa',bots:0},safeProfile({name:'Old Client'}),'public'),/player host/);net.authorityCommand({type:'start'});net.authorityCommand({type:'configure',options:{mode:'royale',capacity:48}});await new Promise(r=>setTimeout(r,80));assert.equal(app.relay.authority.rooms.size,0);assert.equal(app.relay.authority.capacity.reservations.size,0);}
 finally{net.destroy();await app.close();}
});

test('a short burst of queued client heartbeats does not disconnect the socket',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'});
 const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/game`,{origin:'https://zl-2.github.io'});let replies=0;
 ws.on('message',raw=>{if(JSON.parse(raw).type==='alive')replies++;});
 try{
  await new Promise((resolve,reject)=>{ws.once('error',reject);ws.once('open',()=>ws.send(JSON.stringify({type:'register'})));ws.once('message',resolve);});
  for(let i=0;i<280;i++)ws.send(JSON.stringify({type:'heartbeat'}));
  await until(()=>replies===280);assert.equal(ws.readyState,WebSocket.OPEN);
 }finally{ws.terminate();await app.close();}
});
