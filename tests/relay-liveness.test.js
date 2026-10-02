import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
test('native WebSocket replies preserve a connected browser without application heartbeats',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'});
 const socket=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/game`,{origin:'https://zl-2.github.io'});
 try{
  await new Promise((resolve,reject)=>{socket.once('error',reject);socket.once('open',()=>socket.send(JSON.stringify({type:'register'})));socket.once('message',resolve);});
  // The recurring public room is virtual and may precede this real socket.
  const peer=[...app.relay.peers.values()].find(p=>p.ws);peer.lastSeen=Date.now()-14000;
  const pong=new Promise(resolve=>peer.ws.once('pong',resolve));app.relay.sweep();await pong;
  assert.ok(Date.now()-peer.lastSeen<1000);assert.equal(socket.readyState,WebSocket.OPEN);
  // Truly silent sockets still expire under the existing deadline.
  peer.lastSeen=Date.now()-16000;app.relay.sweep();assert.notEqual(peer.ws.readyState,WebSocket.OPEN);
 }finally{socket.terminate();await app.close();}
});
test('relay room ownership prevents a guest promotion on delayed gameplay replies',t=>{
 let poll,migrations=0;t.mock.method(globalThis,'setInterval',fn=>{poll=fn;return 0;});
 const network=new Network({});network.peer={protocol:2};network.ready=true;network.send=()=>{};network.beginMigration=()=>migrations++;
 network.startHeartbeat();network.hostHeartbeat.expired=()=>true;poll();assert.equal(migrations,0);
 network.peer.protocol=1;poll();assert.equal(migrations,1,'direct connections retain their own host liveness check');
});
