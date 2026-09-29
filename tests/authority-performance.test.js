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

test('server timing separates transitions, broadcast work and new rounds',async()=>{
 const {recordTiming,roomTiming,timingPhase}=await import('../server/realtime/timing.js');
 const room={sim:{matchId:'a',round:1,stage:'spawn-island'}};
 recordTiming(room,timingPhase(room.sim),'stepMaxMs',703);
 room.sim.stage='battle-bus';room.sim.departureMs=15;
 recordTiming(room,'departure','stepMaxMs',18);recordTiming(room,timingPhase(room.sim),'broadcastMaxMs',43);
 recordTiming(room,timingPhase(room.sim),'gapMaxMs',1500);
 assert.equal(room.timing.phases.spawn.stepMaxMs,703);assert.equal(room.timing.phases.bus.stepMaxMs,0);
 assert.equal(room.timing.phases.bus.broadcastMaxMs,43);assert.equal(room.timing.departureMs,15);
 room.sim.round++;room.sim.departureMs=null;assert.deepEqual(roomTiming(room),{stepMaxMs:0,gapMaxMs:0,phases:{}});
});

test('CPU timings stay paired with the slowest elapsed sample',async()=>{
 const {recordTiming,startTiming,finishTiming}=await import('../server/realtime/timing.js');
 const room={sim:{round:1}};
 recordTiming(room,'bus','stepMaxMs',800,9);recordTiming(room,'bus','stepMaxMs',100,95);
 recordTiming(room,'bus','broadcastMaxMs',400,12);
 assert.equal(room.timing.phases.bus.stepCpuAtMaxMs,9);assert.equal(room.timing.phases.bus.broadcastCpuAtMaxMs,12);
 recordTiming(room,'bus','stepMaxMs',900,15);assert.equal(room.timing.phases.bus.stepCpuAtMaxMs,15);
 const measured=finishTiming(startTiming());assert.ok(measured.wallMs>=0);assert.ok(measured.cpuMs>=0);
});

test('CPU quota monitor handles v2/v1 units, unavailable data and counter deltas',async()=>{
 const {parseCpuQuota,CpuQuotaMonitor}=await import('../server/realtime/cpu-quota.js');
 assert.equal(parseCpuQuota(2,'15000 100000','', 'nr_periods 20\nnr_throttled 10\nthrottled_usec 500000').quotaCores,.15);
 assert.equal(parseCpuQuota(1,'-1','100000','nr_periods 20\nnr_throttled 10\nthrottled_time 500000000').throttledMs,500);
 assert.equal(parseCpuQuota(2,'max 100000','','usage_usec 10'),null);
 let periods=20;
 const files={'/proc/self/cgroup':'0::/','/sys/fs/cgroup/cpu.max':'15000 100000'};
 const monitor=new CpuQuotaMonitor(async name=>{if(name.endsWith('/cpu.stat'))return `nr_periods ${periods}\nnr_throttled ${periods/2}\nthrottled_usec ${periods*1000}`;if(name in files)return files[name];throw Error('missing');});
 try{await monitor.start();periods=30;await monitor.sample();const s=monitor.snapshot();assert.equal(s.periods,10);assert.equal(s.throttledPeriods,5);assert.equal(s.throttledMs,10);assert.equal(s.quotaCores,.15);assert.ok(!JSON.stringify(s).includes('/sys/'));}finally{monitor.close();}
 const missing=new CpuQuotaMonitor(async()=>{throw Error('missing');});await missing.start();assert.equal(missing.snapshot().available,false);missing.close();
});

function referenceRayBox(o, d, b, max = Infinity) {
  let lo = 0,
    hi = max;
  for (const [axis, min, maxV] of [
    ["x", b.x - b.w / 2, b.x + b.w / 2],
    ["y", b.y, b.y + b.h],
    ["z", b.z - b.d / 2, b.z + b.d / 2],
  ]) {
    if (Math.abs(d[axis]) < 1e-8) {
      if (o[axis] < min || o[axis] > maxV) return Infinity;
      continue;
    }
    let a = (min - o[axis]) / d[axis],
      c = (maxV - o[axis]) / d[axis];
    if (a > c) [a, c] = [c, a];
    lo = Math.max(lo, a);
    hi = Math.min(hi, c);
    if (lo > hi) return Infinity;
  }
  return lo;
}

test('allocation-free ray intersection preserves collision distances and edge cases',async()=>{
 const {rayBox}=await import('../src/physics.js');let seed=91;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<20000;i++){
  const b={x:random()*40-20,y:random()*10,z:random()*40-20,w:random()*12,d:random()*12,h:random()*10};
  const o=i%7===0?{x:b.x,y:b.y,z:b.z}:{x:random()*40-20,y:random()*20,z:random()*40-20};
  const d={x:i%3===0?0:random()*2-1,y:i%5===0?1e-10:random()*2-1,z:i%11===0?0:random()*2-1};
  const max=i%2?Infinity:random()*60;
  assert.equal(rayBox(o,d,b,max),referenceRayBox(o,d,b,max));
 }
});

test('movement-only snapshots skip world copying without changing full snapshots',()=>{
 const s=new RoyaleSimulation({capacity:2,fill:true,seed:29});s.addPlayer('host',{name:'Host'});s.startRound();s.beginBattle();
 const full=s.snapshot();assert.ok(full.royale.loot.length>100);
 s.loot.map=()=>{throw Error('Unneeded world clone');};
 const sparse=s.snapshot({includeLoot:false,includeBuilds:false});delete s.loot.map;
 assert.equal('loot' in sparse.royale,false);assert.equal('builds' in sparse.royale,false);
 assert.deepEqual(sparse.players,full.players);assert.deepEqual(s.snapshot().royale.loot,full.royale.loot);
 full.players[0].materials.wood=999;assert.notEqual(s.snapshot().players[0].materials.wood,999);
});
