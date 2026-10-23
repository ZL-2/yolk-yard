import test from 'node:test';
import assert from 'node:assert/strict';
import {HostWatchdog} from '../server/realtime/host-watchdog.js';
import {HOST_STALL_MS,HOST_TIMEOUT_REASON,MATCH_ENDED_REASON} from '../src/host-timeout.js';
import {fixture,until,pause} from './helpers/public-match.js';
import {SnapshotEncoder} from '../src/snapshot-codec.js';
function watchFixture(){const messages=[],removed=[],relay={peers:new Map(),publicHost:{roomByAddress:()=>null},send:(p,m)=>messages.push([p.id,m]),remove(p,code,reason){removed.push([p.id,code,reason]);this.peers.delete(p.id);}},host={id:'host-address',ws:{readyState:1},links:new Map()},guest={id:'guest',ws:{readyState:1},links:new Map([[1,host]])};host.links.set(1,guest);relay.peers.set(host.id,host);relay.peers.set(guest.id,guest);const watchdog=new HostWatchdog(relay);watchdog.publish(host,{hostId:'host',watch:{phase:'playing',time:1,matchId:'round'}});return {relay,watchdog,host,guest,messages,removed};}
test('ten-second visible wait, compact advancing frames, and canonical removal',()=>{
 const f=watchFixture(),w=f.watchdog.rooms.get(f.host.id),encoder=new SnapshotEncoder();f.watchdog.ready(f.guest,{hostAddress:f.host.id,matchId:'round',ready:true});
 w.advancedAt=Date.now()-HOST_STALL_MS+200;f.watchdog.sweep();assert.equal(f.removed.length,0);
 encoder.encode({type:'state',state:{time:1,players:[]}});w.advancedAt=1;f.watchdog.observe(f.host,encoder.encode({type:'state',state:{time:2,players:[]}}));assert.ok(Date.now()-w.advancedAt<100);f.watchdog.sweep();assert.equal(f.removed.length,0);
 w.advancedAt=Date.now()-HOST_STALL_MS-1;f.watchdog.sweep();assert.deepEqual(f.removed,[[f.host.id,1008,HOST_TIMEOUT_REASON]]);assert.deepEqual(f.messages[0][1].candidates,['guest']);assert.equal(f.relay.peers.has('guest'),true);
});
test('hidden, unsynchronized and stale guests cannot keep an abandoned match open',()=>{
 for(const ready of [undefined,{address:'host-address',matchId:'old-round',ready:true,at:Date.now()},{address:'host-address',matchId:'round',ready:false,at:Date.now()},{address:'host-address',matchId:'round',ready:true,at:Date.now()-9000}]){const f=watchFixture();f.guest.hostReady=ready;f.watchdog.rooms.get(f.host.id).advancedAt=1;f.watchdog.sweep();assert.equal(f.relay.peers.size,0);assert.ok(f.removed.some(([id,,reason])=>id==='guest'&&reason===MATCH_ENDED_REASON));assert.equal(f.messages.length,0);}
});
test('public frozen host is kicked; an active guest restores the same match once',async()=>{
 const f=await fixture();try{
  const a=await f.user('Frozen Host');await a.ask('queue');const first=await f.game(a);
  const b=await f.user('Next Host');await b.ask('queue');const next=await f.game(b);await until(()=>next.net.lastCheckpoint?.simulation,'Recovery checkpoint');
  const id=first.sim.matchId,watch=f.app.relay.hostWatchdog.rooms.get(first.net.peer.id);assert.ok(watch);next.net.lastReadySent=0;next.net.publicReady();await until(()=>f.app.relay.publicHost.members.get(next.net.peer.id)?.ready,'Successor ready');
  clearInterval(first.clock);await pause(120);watch.advancedAt=Date.now()-HOST_STALL_MS-1;f.app.relay.hostWatchdog.sweep();
  await until(()=>next.net.isHost&&next.sim?.matchId===id,'Guest elected',12000);assert.equal(next.promotions,1);await until(()=>first.errors.some(e=>e.includes('stopped sending match updates')),'Old host receives explanation');
  const before=next.sim.time;await until(()=>next.sim.time>before+.1,'New simulation advances');assert.equal(f.app.relay.publicHost.roomFor(f.app.relay.peers.get(next.net.peer.id)).host.peer,next.net.peer.id);
 }finally{await f.close();}
});

test('a frozen solo public host ends its match and frees the room',async()=>{
 const f=await fixture();try{const u=await f.user('Solo Host');await u.ask('queue');const game=await f.game(u);clearInterval(game.clock);await until(()=>f.app.relay.hostWatchdog.rooms.has(game.net.peer.id),'Host tracked');await pause(100);const room=f.app.relay.publicHost.roomByAddress(game.net.peer.id);f.app.relay.hostWatchdog.rooms.get(game.net.peer.id).advancedAt=1;f.app.relay.hostWatchdog.sweep();await until(()=>game.errors.length,'Host notified');assert.equal(room.host,null);assert.equal(room.state,null);assert.equal(room.members.size,0);}finally{await f.close();}
});
test('private host transfers use authenticated ownership and the current checkpoint',async()=>{
 const {Network}=await import('../src/network.js'),{Simulation}=await import('../src/simulation.js');const f=await fixture();let host,guest,sim,restored,clock,guestClock,errors=[];
 try{
  sim=new Simulation({mode:'ffa',bots:0});sim.addPlayer('host',{name:'Private Host'});host=new Network({getCheckpoint:()=>sim.checkpoint(),getChatState:()=>sim.snapshot(),onJoin:(id,p)=>{sim.addPlayer(id,p);return true;},onError:e=>errors.push(e)});await host.host();host.visibility='private';sim.startRound();clock=setInterval(()=>{sim.tick(.05);host.broadcast(sim.snapshot());},50);
  guest=new Network({onHost:(checkpoint)=>{restored=new Simulation(checkpoint.options).restore(checkpoint);guestClock=setInterval(()=>{restored.tick(.05);guest.broadcast(restored.snapshot());},50);},getCheckpoint:()=>restored?.checkpoint(),getChatState:()=>restored?.snapshot(),onError:e=>errors.push(e)});await guest.join(host.code,{name:'Private Guest'});await until(()=>guest.lastCheckpoint?.simulation,'Private checkpoint');guest.lastReadySent=0;guest.publicReady();await until(()=>f.app.relay.peers.get(guest.peer.id)?.hostReady?.ready,'Private guest ready');
  const match=sim.matchId;clearInterval(clock);await pause(100);f.app.relay.hostWatchdog.rooms.get(host.peer.id).advancedAt=1;f.app.relay.hostWatchdog.sweep();await until(()=>guest.isHost&&guest.aliasPeer?.protocol===2,'Private successor claims address');assert.equal(restored.matchId,match);await until(()=>errors.some(e=>e.includes('stopped sending match updates')),'Private old host explained');const before=restored.time;await until(()=>restored.time>before+.1,'Private match advances');
 }finally{clearInterval(clock);clearInterval(guestClock);host?.destroy();guest?.destroy();await f.close();}
});

test('a reused room address tracks the replacement owner even before the next sweep',()=>{
 const f=watchFixture(),replacement={...f.host,hostOwner:'successor'};f.relay.peers.set(replacement.id,replacement);f.watchdog.publish(replacement,{hostId:'successor',watch:{phase:'playing',matchId:'round',time:2}});
 const watch=f.watchdog.rooms.get(replacement.id);assert.equal(watch.owner,'successor');assert.equal(watch.hostId,'successor');watch.advancedAt=1;f.watchdog.observe({id:'successor'},{type:'state',state:{time:3}});assert.ok(watch.advancedAt>1);
});
