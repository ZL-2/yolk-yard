import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
test('production listener allows public game/social sockets and keeps owner routes private',async()=>{
 const app=await startRealtimeServer({port:0,host:'0.0.0.0'}),sockets=[];
 try{
  const base=`http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await (await fetch(base+'/health')).json()).maintenance,false);
  for(const path of ['/game','/social']){const ws=new WebSocket(base.replace('http:','ws:')+path,{origin:'https://zl-2.github.io'});sockets.push(ws);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});assert.equal(ws.readyState,WebSocket.OPEN);}
  assert.equal((await fetch(base+'/owner/summary',{headers:{origin:'https://zl-2.github.io'}})).status,401);
 }finally{for(const ws of sockets)ws.terminate();await app.close();}
});
test('explicit maintenance still rejects unauthenticated game connections',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1',maintenance:true});
 try{const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/game`,{origin:'https://zl-2.github.io'});const status=await new Promise(resolve=>{ws.once('unexpected-response',(_req,res)=>{res.resume();ws.terminate();resolve(res.statusCode);});ws.on('error',()=>{});});assert.equal(status,503);}finally{await app.close();}
});
