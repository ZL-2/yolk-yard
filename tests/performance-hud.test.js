import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionHealth,PERFORMANCE_DEFAULTS} from '../src/performance-hud.js';
import {RelayPeer} from '../src/relay-peer.js';
test('default-on HUD distinguishes delays, interruption and local play',()=>{
 assert.deepEqual(PERFORMANCE_DEFAULTS,{showFps:true,netDebugStats:true,connectionWarnings:true});
 const net={serverAuthority:true,lastState:1000,peer:{relayLatency:40,bufferedAmount:0}};
 assert.equal(connectionHealth(net,1100),'healthy');
 assert.equal(connectionHealth(net,1300),'degraded');
 assert.equal(connectionHealth(net,2600),'critical');
 net.lastState=3000;net.peer.reconnecting=true;assert.equal(connectionHealth(net,3100),'critical');
 net.peer.reconnecting=false;net.peer.relayLatency=200;assert.equal(connectionHealth(net,3100),'degraded');
 net.peer.relayLatency=700;assert.equal(connectionHealth(net,3100),'critical');
 assert.equal(connectionHealth(null,9000),'healthy');
});
test('wire telemetry counts UTF-8 payload bytes and only actual sends',()=>{
 const peer={sentBytes:0,sentPackets:0,byteEncoder:new TextEncoder()},sent=[];
 RelayPeer.prototype.sendRaw.call(peer,{readyState:0},'hello');assert.equal(peer.sentPackets,0);
 const text='{"name":"Zoë 🧭"}';RelayPeer.prototype.sendRaw.call(peer,{readyState:1,send:raw=>sent.push(raw)},text);
 assert.equal(peer.sentBytes,Buffer.byteLength(text));assert.equal(peer.sentPackets,1);assert.deepEqual(sent,[text]);
});
