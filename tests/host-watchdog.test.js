import test from 'node:test';
import assert from 'node:assert/strict';
import {HostWatchdog} from '../server/realtime/host-watchdog.js';
import {HOST_RECOVERY_MS,HOST_STALL_MS,HOST_TIMEOUT_REASON,MATCH_ENDED_REASON} from '../src/host-timeout.js';
import {fixture,until,pause} from './helpers/public-match.js';
import {SnapshotEncoder} from '../src/snapshot-codec.js';
function watchFixture(){const messages=[],removed=[],relay={peers:new Map(),publicHost:{roomByAddress:()=>null},demoteHost(p){this.demoted=p;},send:(p,m)=>messages.push([p.id,m]),remove(p,code,reason){removed.push([p.id,code,reason]);this.peers.delete(p.id);}},host={id:'host-address',ws:{readyState:1},links:new Map()},guest={id:'guest',ws:{readyState:1},links:new Map([[1,host]])};host.links.set(1,guest);relay.peers.set(host.id,host);relay.peers.set(guest.id,guest);const watchdog=new HostWatchdog(relay);watchdog.publish(host,{hostId:'host',watch:{phase:'playing',time:1,matchId:'round'}});return {relay,watchdog,host,guest,messages,removed};}
test('ten-second visible wait, compact advancing frames, and authority demotion',()=>{
 const f=watchFixture(),w=f.watchdog.rooms.get(f.host.id),encoder=new SnapshotEncoder();f.watchdog.ready(f.guest,{hostAddress:f.host.id,matchId:'round',ready:true});
 w.advancedAt=Date.now()-HOST_STALL_MS+200;f.watchdog.sweep();assert.equal(f.removed.length,0);
 encoder.encode({type:'state',state:{time:1,players:[]}});w.advancedAt=1;f.watchdog.observe(f.host,encoder.encode({type:'state',state:{time:2,players:[]}}));assert.ok(Date.now()-w.advancedAt<100);f.watchdog.sweep();assert.equal(f.removed.length,0);
 w.advancedAt=Date.now()-HOST_STALL_MS-1;f.watchdog.sweep();assert.deepEqual(f.removed,[]);assert.equal(f.relay.demoted,f.host);assert.deepEqual(f.messages[0][1].candidates,['guest']);assert.equal(f.relay.peers.has('guest'),true);
});
test('hidden, unsynchronized and stale guests cannot keep an abandoned match open',()=>{
 for(const ready of [undefined,{address:'host-address',matchId:'old-round',ready:true,at:Date.now()},{address:'host-address',matchId:'round',ready:false,at:Date.now()},{address:'host-address',matchId:'round',ready:true,at:Date.now()-9000}]){const f=watchFixture();f.guest.hostReady=ready;f.watchdog.rooms.get(f.host.id).advancedAt=1;f.watchdog.sweep();assert.equal(f.relay.peers.size,0);assert.ok(f.removed.some(([id,,reason])=>id==='guest'&&reason===MATCH_ENDED_REASON));assert.equal(f.messages.length,0);}
});
test('public frozen host recovers as the same player after an active guest takes over',async()=>{
 const f=await fixture();try{
  const a=await f.user('Frozen Host');await a.ask('queue');const first=await f.game(a);
  const b=await f.user('Next Host');await b.ask('queue');const next=await f.game(b);await until(()=>next.net.lastCheckpoint?.simulation,'Recovery checkpoint');
  const id=first.sim.matchId,watch=f.app.relay.hostWatchdog.rooms.get(first.net.peer.id);assert.ok(watch);next.net.lastReadySent=0;next.net.publicReady();await until(()=>f.app.relay.publicHost.members.get(next.net.peer.id)?.ready,'Successor ready');
  clearInterval(first.clock);await pause(120);watch.advancedAt=Date.now()-HOST_STALL_MS-1;f.app.relay.hostWatchdog.sweep();
  await until(()=>next.net.isHost&&next.sim?.matchId===id,'Guest elected',12000);assert.equal(next.promotions,1);await until(()=>!first.net.isHost&&!first.net.migrating&&next.net.connections.has('host'),'Old host recovers');assert.deepEqual(first.errors,[]);assert.equal(next.sim.players.has('host'),true);assert.equal(next.net.members.filter(m=>m.id==='host').length,1);assert.equal(f.app.relay.publicHost.members.get(first.net.peer.id).id,'host');
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
  const match=sim.matchId;clearInterval(clock);await pause(100);f.app.relay.hostWatchdog.rooms.get(host.peer.id).advancedAt=1;f.app.relay.hostWatchdog.sweep();await until(()=>guest.isHost&&guest.aliasPeer?.protocol===2,'Private successor claims address');assert.equal(restored.matchId,match);await until(()=>!host.isHost&&!host.migrating&&guest.connections.has('host'),'Private old host recovers');assert.deepEqual(errors,[]);const before=restored.time;await until(()=>restored.time>before+.1,'Private match advances');
 }finally{clearInterval(clock);clearInterval(guestClock);host?.destroy();guest?.destroy();await f.close();}
});

test('a reused room address tracks the replacement owner even before the next sweep',()=>{
 const f=watchFixture(),replacement={...f.host,hostOwner:'successor'};f.relay.peers.set(replacement.id,replacement);f.watchdog.publish(replacement,{hostId:'successor',watch:{phase:'playing',matchId:'round',time:2}});
 const watch=f.watchdog.rooms.get(replacement.id);assert.equal(watch.owner,'successor');assert.equal(watch.hostId,'successor');watch.advancedAt=1;f.watchdog.observe({id:'successor'},{type:'state',state:{time:3}});assert.ok(watch.advancedAt>1);
});

test('repeated public transfers preserve identity, health, inventory and team, including the original host returning to authority',async()=>{
 const f=await fixture();try{
  const a=await f.user('First Captain');await a.ask('queue');const first=await f.game(a);
  const b=await f.user('Second Captain');await b.ask('queue');const second=await f.game(b);
  const original=first.sim.players.get('host');original.health=73;original.shield=42;original.team=7;original.materials=321;const inventory=JSON.stringify(original.inventory);
  await until(()=>second.net.lastCheckpoint?.simulation?.players?.some(p=>p.id==='host'&&p.health===73),'Updated checkpoint');
  const identity=first.sim.matchId;
  const transfer=async(from,to)=>{
   to.net.lastReadySent=0;to.net.publicReady();await until(()=>f.app.relay.publicHost.members.get(to.net.peer.id)?.ready,'Successor ready');
   const address=from.net.aliasPeer?.id||from.net.peer.id;clearInterval(from.clock);await pause(100);
   f.app.relay.hostWatchdog.rooms.get(address).advancedAt=1;f.app.relay.hostWatchdog.sweep();
   await until(()=>to.net.isHost&&!from.net.isHost&&!from.net.migrating&&to.net.connections.has(from.net.id),'Handoff completes',12000);
   assert.equal(to.sim.matchId,identity);assert.equal(to.sim.players.get('host').health,73);assert.equal(to.sim.players.get('host').shield,42);assert.equal(to.sim.players.get('host').team,7);assert.equal(to.sim.players.get('host').materials,321);assert.equal(JSON.stringify(to.sim.players.get('host').inventory),inventory);
  };
  await transfer(first,second);
  // Restart the first player's frame loop: it will only simulate after election.
  first.clock=setInterval(()=>{if(first.net.isHost){first.sim.tick(.05);first.net.broadcast(first.sim.snapshot());}},50);
  await until(()=>first.net.lastCheckpoint?.simulation?.time>0,'Recovered player checkpoint');
  await transfer(second,first);
  assert.equal(f.app.relay.publicHost.roomFor(f.app.relay.peers.get(first.net.peer.id)).host.id,'host');
  const before=second.states;await until(()=>second.states>before,'Former replacement receives new authority frames');
  assert.deepEqual(first.errors,[]);assert.deepEqual(second.errors,[]);
 }finally{await f.close();}
});

test('an unresponsive former host retains a bounded recovery window, then leaves without evicting the successor',async()=>{
 const f=await fixture();try{
  const a=await f.user('Absent Captain');await a.ask('queue');const first=await f.game(a);
  const b=await f.user('Active Captain');await b.ask('queue');const next=await f.game(b);await until(()=>next.net.lastCheckpoint?.simulation,'Checkpoint');
  next.net.lastReadySent=0;next.net.publicReady();await until(()=>f.app.relay.publicHost.members.get(next.net.peer.id)?.ready,'Ready');
  first.net.hostDemoted=()=>{};clearInterval(first.clock);await pause(100);
  const old=f.app.relay.peers.get(first.net.peer.id);f.app.relay.hostWatchdog.rooms.get(old.id).advancedAt=1;f.app.relay.hostWatchdog.sweep();
  await until(()=>next.net.isHost,'Successor elected');assert.ok(next.sim.players.has('host'));assert.ok(old.hostRecovery.expires>Date.now());
  // Keep the recovery deadline real to verify both relay and simulation cleanup.
  await until(()=>!f.app.relay.peers.has(old.id)&&!next.net.members.some(m=>m.id==='host'),'Expired player removed',HOST_RECOVERY_MS+6000);
  assert.equal(next.net.isHost,true);assert.deepEqual(next.errors,[]);
 }finally{await f.close();}
});

test('a detached original host resumes with its original credential after the address changes hands',async()=>{
 const f=await fixture();try{
  const a=await f.user('Detached Captain');await a.ask('queue');const first=await f.game(a);
  const b=await f.user('Resumed Captain');await b.ask('queue');const next=await f.game(b);await until(()=>next.net.lastCheckpoint?.simulation,'Checkpoint');
  next.net.lastReadySent=0;next.net.publicReady();await until(()=>f.app.relay.publicHost.members.get(next.net.peer.id)?.ready,'Ready');
  clearInterval(first.clock);const address=first.net.peer.id,peer=f.app.relay.peers.get(address),socket=peer.ws;
  // Keep the real client unaware of demotion until it reconnects at the old address.
  peer.ws=null;socket.terminate();peer.detachedAt=Date.now();f.app.relay.hostWatchdog.rooms.get(address).advancedAt=1;f.app.relay.hostWatchdog.sweep();
  await until(()=>next.net.isHost&&!first.net.isHost&&!first.net.migrating,'Detached host recovered',15000);
  assert.notEqual(first.net.peer.id,address);assert.equal(first.net.id,'host');assert.equal(next.net.connections.has('host'),true);assert.deepEqual(first.errors,[]);
  // Stale publications are consumed and acknowledged rather than disconnecting the recovered player.
  first.net.peer.control({type:'publish',room:{bogus:true}});await pause(100);assert.equal(peer.ws?.readyState,1);
 }finally{await f.close();}
});

test('warmup cannot drop a recovering host when its departure countdown expires',async()=>{
 const {RoyaleSimulation}=await import('../src/royale.js');const {publicRoyaleOptions}=await import('../src/public-royale.js');
 const sim=new RoyaleSimulation(publicRoyaleOptions());sim.addPlayer('host',{name:'Recovering Player'});sim.addPlayer('successor',{name:'Active Player'});sim.startRound();sim.players.get('host').connected=false;sim.beginHostRecovery(HOST_RECOVERY_MS);sim.queueEnds=sim.time-1;
 sim.advanceWarmupClock(60);assert.equal(sim.beginBattle('timer'),false);assert.ok(sim.players.has('host'));assert.equal(sim.stage,'spawn-island');
 sim.admitPlayer('host',{name:'Recovering Player'});assert.equal(sim.recoveringHumans(),false);
});
