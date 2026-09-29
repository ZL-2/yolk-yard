import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchAuthority} from '../server/realtime/authority.js';
import {RoyaleSimulation} from '../src/royale.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
test('populated authority broadcasts sleep unchanged world data and respect socket backpressure',()=>{
 const sent=[],relay={peers:new Map(),send:(p,m)=>sent.push([p.id,m]),progression:{frame(){}}};
 const authority=new MatchAuthority(relay);clearInterval(authority.timer);
 try{
 const sim=new RoyaleSimulation({map:'sunnybreak',mode:'royale',capacity:32,fill:true,bots:16,seed:12});
 const members=new Map();for(let i=0;i<16;i++){const id=i?'p'+i:'host';sim.addPlayer(id,{name:'Operator '+i});const peer={id,ws:{bufferedAmount:0}};members.set(id,peer);relay.peers.set(id,peer);}
 sim.startRound();sim.beginBattle();
 const room={sim,members,hostPeer:members.get('host'),owner:'host',code:'ABCDEFGH',visibility:'private',chat:{enabled:true,muted:new Set(),sequence:0},encoders:new Map(),eventCursors:new Map(),age:1,progressAt:1};
 authority.broadcast(room);assert.equal(sent.length,16);const decoder=new SnapshotDecoder();const initial=decoder.decode(sent[0][1].frame);assert.ok(initial.state.royale.loot.length>100);
 sent.length=0;authority.broadcast(room);const second=sent[0][1].frame;assert.deepEqual(second.omitWorld,['loot','chests','builds','worldDamage']);assert.equal(decoder.decode(second).state.royale.loot,undefined);
 const encoder=room.encoders.get('host'),seq=encoder.seq;members.get('host').ws.bufferedAmount=70000;authority.broadcast(room);assert.equal(encoder.seq,seq);members.get('host').ws.bufferedAmount=0;
 sim.loot.pop();sim.lootVersion++;sent.length=0;authority.broadcast(room);assert.equal(decoder.decode(sent[0][1].frame).state.royale.loot.length,initial.state.royale.loot.length-1);
 // Same full-world fixture and recipient count for both CPU measurements.
 const legacy=Array.from({length:16},()=>new SnapshotEncoder());let start=performance.now();
 for(let frame=0;frame<40;frame++){const state=sim.snapshot();state.time+=frame/20;for(const encoder of legacy)encoder.encode({type:'authority-state',state:{...state,royale:{...state.royale}}});}
 const before=(performance.now()-start)/40;start=performance.now();
 for(let frame=0;frame<40;frame++){sim.time+=.05;sent.length=0;authority.broadcast(room);}
 const after=(performance.now()-start)/40;
 console.log(JSON.stringify({recipients:16,contestants:sim.players.size,loot:sim.loot.length,fullWorldMs:before,sparseWorldMs:after}));
 }finally{authority.close();}
});
