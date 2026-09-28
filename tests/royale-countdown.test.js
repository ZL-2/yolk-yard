import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {matchOptions} from '../src/match-options.js';
const make=(options={})=>{const s=new RoyaleSimulation({capacity:8,bots:7,fill:true,seed:57,...options});s.addPlayer('host',{name:'Host'});s.startRound();return s;};
const rounds=s=>s.events.filter(e=>e.type==='round').length;
test('explicit offline mode waits all ten real seconds, even with a filled roster',()=>{
 const s=make({session:'offline'});assert.equal(s.options.session,'offline');assert.equal(s.queueEnds-s.time,10);assert.equal(s.players.size,8);
 s.advanceWarmupClock(9.99);assert.equal(s.stage,'starting');s.advanceWarmupClock(.02);assert.equal(s.stage,'battle-bus');assert.equal(s.alive,8);assert.equal(rounds(s),1);
 s.advanceWarmupClock(100);s.beginBattle();assert.equal(rounds(s),1);
 const minimal=make({session:'offline',bots:0,fill:false});assert.equal(minimal.players.size,2);minimal.advanceWarmupClock(10);assert.equal(minimal.stage,'battle-bus');
});
test('one online human with bots gets thirty seconds, and midway joins inherit the deadline',()=>{
 const s=make();assert.equal(s.queueEnds-s.time,30);s.advanceWarmupClock(20);const deadline=s.queueEnds;s.admitPlayer('two',{name:'Two'});
 assert.equal(s.stage,'spawn-island');assert.equal(s.queueEnds,deadline);assert.equal(s.snapshot().royale.humanContestants,2);assert.equal(s.snapshot().royale.botContestants,6);assert.equal(s.queueEnds-s.time,10);
 s.advanceWarmupClock(9.9);assert.equal(s.stage,'starting');s.advanceWarmupClock(.2);assert.equal(s.stage,'battle-bus');assert.equal(s.startReason,'timer');assert.equal(rounds(s),1);
});
for(const capacity of [2,8,12,16])test(`custom ${capacity} starts only when every seat contains a connected human`,()=>{
 const s=make({capacity});for(let i=1;i<capacity-1;i++)s.admitPlayer('p'+i,{name:'Player '+i});assert.notEqual(s.stage,'battle-bus');assert.ok(s.queueEnds-s.time>20);
 s.admitPlayer('last',{name:'Last'});assert.equal(s.stage,'battle-bus');assert.equal(s.startReason,'human-full');assert.equal(s.alive,capacity);assert.equal([...s.players.values()].filter(p=>p.bot).length,0);assert.equal(rounds(s),1);
 const late=s.admitPlayer('watch',{name:'Watch'});assert.equal(late.spectating,true);assert.equal(late.contestant,false);s.leavePlayer('last');s.advanceWarmupClock(80);assert.equal(s.stage,'battle-bus');assert.equal(rounds(s),1);
});
test('32 contestant capacity is preserved; sixteen humans plus bots is not full of humans',()=>{
 const s=make({capacity:32});for(let i=1;i<16;i++)s.admitPlayer('p'+i,{name:'Player '+i});assert.equal(s.humanContestants().length,16);assert.equal(s.players.size,32);assert.equal(s.stage,'spawn-island');assert.equal(s.options.capacity,32);
});
test('spectators, duplicate IDs, stale and disconnected records cannot trigger early departure',()=>{
 const s=make({capacity:4});s.admitPlayer('a',{name:'A'});s.admitPlayer('b',{name:'B'});const b=s.players.get('b');b.spectating=true;b.contestant=false;b.lateSpectator=true;
 s.setConnectedHumans(['host','a','a','reserved']);s.admitPlayer('c',{name:'C'});assert.equal(s.humanContestants().length,3);assert.notEqual(s.stage,'battle-bus');
 const a=s.players.get('a');a.connected=false;s.admitPlayer('c',{name:'C'});assert.equal(s.humanContestants().length,2);s.advanceWarmupClock(60);assert.equal(s.stage,'battle-bus');assert.equal(s.players.has('a'),false);assert.equal(s.alive,4);
});
test('final join and expiry commit one Bus transition, and recovery preserves the remaining wait',()=>{
 const s=make({capacity:2});s.advanceWarmupClock(29.9);const restored=new RoyaleSimulation().restore(s.checkpoint());assert.ok(Math.abs(restored.queueEnds-restored.time-.1)<1e-8);
 restored.admitPlayer('last',{name:'Last'});restored.advanceWarmupClock(.2);restored.tick(1/60);assert.equal(rounds(restored),1);assert.equal(restored.stage,'battle-bus');
 const t=make({capacity:2});t.advanceWarmupClock(60);assert.equal(t.admitPlayer('late',{name:'Late'}).spectating,true);assert.equal(rounds(t),1);
 assert.equal(matchOptions({mode:'royale',session:'offline'}).session,'offline');assert.equal(matchOptions({mode:'royale',session:'anything'}).session,'online');
});
