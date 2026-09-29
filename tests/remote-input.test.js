import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {movePlayer,sanitizeInput} from '../src/physics.js';
import {RemoteInputBuffer,MAX_INPUT_BACKLOG} from '../src/remote-input.js';

for(const Type of [Simulation,RoyaleSimulation])test(Type.name+' prediction matches acknowledgements under burst delivery',()=>{
 // Keep this movement fixture on Spawn Island: a full human roster now departs immediately.
 const sim=new Type({map:'yard',bots:0,fill:false,capacity:4,seed:12});
 const p=sim.addPlayer('guest',{name:'Guest'});sim.addPlayer('host',{name:'Host'});sim.startRound();
 if(Type===Simulation)sim.spawn(p);
 sim.map={size:1000,boxes:[]};
 Object.assign(p,{health:100,spectating:false,x:0,y:0,z:0,vy:0,grounded:true,flight:Type===RoyaleSimulation?'ground':undefined,yaw:0,pitch:0});
 const predicted=structuredClone(p),pending=[];let seq=0;
 for(let frame=0;frame<360;frame++){
  const i=sanitizeInput({seq:++seq,forward:1,strafe:frame%80<40?.3:-.3,yaw:frame*.004,slot:p.slot,jump:frame===90});
  pending.push(i);movePlayer(predicted,i,sim.map,1/60);
  // Several client commands arrive together, as they do through the relay.
  if(frame%4===3)for(const command of pending.filter(c=>c.seq>(sim.inputs.get(p.id)?.seq||0)))sim.setInput(p.id,command,true);
  sim.tick(1/60);
  const replay=structuredClone(p);
  for(const command of pending.filter(c=>c.seq>p.ack))movePlayer(replay,command,sim.map,1/60);
  assert.ok(Math.hypot(replay.x-predicted.x,replay.y-predicted.y,replay.z-predicted.z)<1e-6,`prediction corrected at frame ${frame}, ack ${p.ack}`);
 }
});
test('remote catch-up cannot simulate more time than the host grants',()=>{
 const buffer=new RemoteInputBuffer();for(let seq=1;seq<=120;seq++)assert.equal(buffer.push({seq}),true);
 assert.equal(buffer.push({seq:121}),true);
 assert.equal(buffer.queue.length,30);
 assert.equal(buffer.queue[0].seq,92);
 assert.equal(buffer.take(1/60).length,1);
 assert.equal(buffer.take(1/60).length,1);
 assert.equal(buffer.take(10).length,5);
});

test('a server running at 74 percent speed stays on current input without a speed boost',()=>{
 const buffer=new RemoteInputBuffer();let executed=0,ack=0,ticks=0;
 for(let seq=1;seq<=3600;seq++){
  buffer.push({seq,forward:seq<3500?1:0,fire:false});
  if(Math.floor(seq*.74)>ticks){ticks++;const steps=buffer.take(1/60);executed+=steps.length;ack=steps.at(-1)?.seq||ack;}
  assert.ok(buffer.queue.length<=MAX_INPUT_BACKLOG+1);
  assert.ok(seq-ack<=MAX_INPUT_BACKLOG+2);
 }
 assert.ok(executed<=ticks);assert.equal(buffer.last.forward,0);
});

test('delayed packets use earned time without dropping legitimate movement',()=>{
 const buffer=new RemoteInputBuffer();buffer.take(.3);for(let seq=1;seq<=18;seq++)buffer.push({seq});
 assert.deepEqual(buffer.take(0).map(i=>i.seq),Array.from({length:18},(_,i)=>i+1));
});
test('server catch-up preserves queued commands but cannot execute unearned time',()=>{
 const buffer=new RemoteInputBuffer();for(let seq=1;seq<=30;seq++)buffer.push({seq});
 for(let seq=1;seq<=30;seq++)assert.equal(buffer.take(1/60,true)[0].seq,seq);
 assert.equal(buffer.queue.length,0);
});
