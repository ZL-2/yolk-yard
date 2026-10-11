import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionHealth,PERFORMANCE_DEFAULTS,PerformanceHUD} from '../src/performance-hud.js';
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
test('offline HUD never shows a connection warning, including after leaving a disconnected match',()=>{
 const previous=globalThis.document;
 class Node{hidden=false;dataset={};nodes=new Map();setAttribute(){}querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Node());return this.nodes.get(selector);}}
 try{globalThis.document={createElement:()=>new Node()};const hud=new PerformanceHUD({append(){}});hud.update(1000,16,null,PERFORMANCE_DEFAULTS,true);assert.equal(hud.signal.hidden,true);assert.equal(hud.signal.dataset.health,'healthy');hud.update(1300,16,{closed:true,peer:{}},PERFORMANCE_DEFAULTS,true);assert.equal(hud.signal.hidden,false);hud.update(1400,16,null,PERFORMANCE_DEFAULTS,false);hud.update(1700,16,null,PERFORMANCE_DEFAULTS,true);assert.equal(hud.signal.hidden,true);assert.equal(hud.signal.dataset.health,'healthy');}
 finally{globalThis.document=previous;}
});
