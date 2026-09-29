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

test('a 600ms scheduling stall is recovered across bounded callbacks',()=>{
 const authority=new MatchAuthority({});clearInterval(authority.timer);let ticks=0;
 authority.broadcast=()=>{};authority.rooms.set('test',{age:0,frameAt:0,sim:{tick(){ticks++;}}});
 const start=authority.last;authority.tick(start+600);assert.equal(ticks,6);
 for(let i=0;i<6;i++){const before=ticks;authority.tick(start+600);assert.ok(ticks-before<=6);}
 assert.equal(ticks,36);assert.ok(authority.accumulator<1/60);authority.close();
});

test('indexed loot support matches a full geometry scan on every authored socket',async()=>{
 const {ROYALE_MAP}=await import('../src/royale-map.js'),{supportBelow}=await import('../src/royale-loot.js'),{groundAt}=await import('../src/terrain.js');
 for(const p of [...ROYALE_MAP.floorLoot,...ROYALE_MAP.chests])for(const y of [p.y,p.y+3,p.y-1]){
  let expected=groundAt(ROYALE_MAP,p.x,p.z);
  for(const b of ROYALE_MAP.boxes)if(b.y+b.h<=y+.24&&Math.abs(p.x-b.x)<b.w/2&&Math.abs(p.z-b.z)<b.d/2)expected=Math.max(expected,b.y+b.h);
  assert.equal(supportBelow(ROYALE_MAP,p.x,p.z,y),expected);
 }
});

test('staged battle preparation stays isolated and survives warmup checkpoint recovery',()=>{
 const make=()=>{const s=new RoyaleSimulation({capacity:2,bots:1,fill:true,seed:31});s.addPlayer('host',{name:'Host'});s.startRound();return s;};
 const staged=make(),direct=make();let batches=0;
 while(!staged.prepareBattleWorld(0).done){staged.prepareBattleWorld(2);assert.ok(++batches<2000);}
 assert.ok(batches>1);assert.equal(staged.loot.length,0);assert.equal(staged.map.id,'hatchery-atoll');
 const restored=new RoyaleSimulation().restore(staged.checkpoint());
 for(const s of [staged,direct,restored])assert.equal(s.beginBattle(),true);
 assert.ok(staged.loot.length>100);assert.deepEqual(staged.loot,direct.loot);assert.deepEqual(staged.chests,direct.chests);
 assert.deepEqual(staged.loot,restored.loot);assert.deepEqual(staged.chests,restored.chests);
});
