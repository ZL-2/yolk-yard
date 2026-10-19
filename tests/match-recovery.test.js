import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {deserialize,serialize} from 'node:v8';
import {fixture,until} from './helpers/public-match.js';
import {RelayPeer} from '../src/relay-peer.js';

test('election with a checkpoint but no first snapshot publishes the restored state',async()=>{
 const f=await fixture();try{
  const a=await f.user('Original Host');await a.ask('queue');const host=await f.game(a);
  const b=await f.user('Next Host');await b.ask('queue');const guest=await f.game(b);
  await until(()=>guest.net.lastCheckpoint?.simulation,'Guest checkpoint');
  clearInterval(host.clock);clearInterval(guest.clock);
  const room=f.app.relay.publicHost.roomByAddress(host.net.peer.id),match=host.sim.matchId;
  guest.net.snapshot=null;guest.state=null;
  // This is the ordering from the failed live handoff: welcome/checkpoint first,
  // host disappears before the guest's first rendered simulation frame.
  f.app.relay.remove(f.app.relay.peers.get(host.net.peer.id),1001,'Public host stopped advancing');
  await until(()=>guest.promotions===1&&room.host?.id===guest.net.id,'New host elected');
  await until(()=>room.state?.matchId===match&&guest.net.aliasPeer.unacked.size===0,'Restored publication acknowledged');
  assert.equal(guest.net.snapshot.royale.matchId,match);assert.ok(guest.net.aliasPeer.socket.readyState===1);assert.deepEqual(guest.errors,[]);
  guest.sim.time+=1;guest.net.broadcast(guest.sim.snapshot());guest.net.publishRoom();
  await until(()=>room.state.time===guest.sim.time,'New host advances original round');
 }finally{await f.close();}
});

test('an incomplete public publication cannot poison command replay or disconnect gameplay',async()=>{
 const f=await fixture();try{
  const a=await f.user('Stable Host');await a.ask('queue');const game=await f.game(a);clearInterval(game.clock);
  const peer=game.net.peer,room=f.app.relay.publicHost.roomByAddress(peer.id),closes=[];peer.on('transport-close',e=>closes.push(e));
  peer.publish(null);game.sim.time+=1;game.net.broadcast(game.sim.snapshot());game.net.publishRoom();
  await until(()=>room.state?.time===game.sim.time&&peer.unacked.size===0,'Next valid publication commits');
  assert.deepEqual(closes,[]);assert.deepEqual(game.errors,[]);
 }finally{await f.close();}
});

test('a real relay restart preserves public match, authenticated channels and exactly-once actions',async()=>{
 const f=await fixture({recovery:true});try{
  const a=await f.user('Restart Host');await a.ask('queue');const host=await f.game(a);
  const b=await f.user('Restart Guest');await b.ask('queue');const guest=await f.game(b);
  await until(()=>guest.net.snapshot?.royale,'Guest receives original match');
  host.sim.beginBattle();host.sim.stage='active';host.net.broadcast(host.sim.snapshot());host.net.publishRoom();
  await until(()=>guest.net.snapshot?.royale.stage==='active','Active match synchronized');
  const inventory=JSON.stringify(host.sim.players.get('host').inventory);
  const match=host.sim.matchId,code=host.net.code,ids=[host.net.peer.id,guest.net.peer.id],tokens=[host.net.peer.resume.resume,guest.net.peer.resume.resume],channel=guest.net.hostConnection.channel;
  const received=[];host.net.callbacks.onPlayerAction=(id,action)=>received.push(action);
  guest.net.send({type:'player-action',action:'ping-before-restart'});await until(()=>received.length===1,'Action before restart');
  // Drop one command acknowledgement after application. Recovery must replay
  // its command without applying the action twice after the process is replaced.
  const serverPeer=f.app.relay.peers.get(guest.net.peer.id),send=serverPeer.ws.send.bind(serverPeer.ws);
  serverPeer.ws.send=raw=>{if(JSON.parse(raw).type!=='command-ack')send(raw);};
  guest.net.send({type:'player-action',action:'ping-committed-before-restart'});await until(()=>received.length===2,'Unacknowledged action applied');
  clearInterval(host.clock);clearInterval(guest.clock);
  await f.restart();
  guest.net.send({type:'player-action',action:'ping-during-restart'});
  await until(()=>!host.net.peer.reconnecting&&!guest.net.peer.reconnecting&&received.length===3,'Both sockets resume and queued action arrives');
  assert.deepEqual(received,['ping-before-restart','ping-committed-before-restart','ping-during-restart']);
  assert.deepEqual([host.net.peer.id,guest.net.peer.id],ids);assert.deepEqual([host.net.peer.resume.resume,guest.net.peer.resume.resume],tokens);
  assert.equal(guest.net.hostConnection.channel,channel);assert.equal(guest.net.hostConnection.open,true);
  assert.equal(guest.net.migrating,false);assert.equal(guest.promotions,0);
  host.sim.time+=1;host.net.broadcast(host.sim.snapshot());host.net.publishRoom();
  const room=f.app.relay.publicHost.rooms.get(code);await until(()=>room.state?.time===host.sim.time&&guest.net.snapshot?.time===host.sim.time,'Same round advances on both sides after restart');
  assert.equal(room.state.matchId,match);assert.equal(room.state.stage,'active');assert.equal(JSON.stringify(host.sim.players.get('host').inventory),inventory);assert.equal(room.members.size,2);assert.deepEqual(host.errors,[]);assert.deepEqual(guest.errors,[]);
  // Resume remains authenticated, even when its session came from disk.
  const attacker=new globalThis.WebSocket(window.YOLK_NETWORK.relay);const rejected=new Promise(resolve=>attacker.once('close',(code,reason)=>resolve({code,reason:String(reason)})));
  attacker.once('open',()=>attacker.send(JSON.stringify({type:'register',id:ids[0],resume:'wrong-secret',cursor:0})));
  assert.deepEqual(await rejected,{code:1008,reason:'Expired resume'});assert.equal(host.net.peer.socket.readyState,1);
  f.app.relay.recovery.save();const file=f.directory+'/relay.bin';assert.equal((await stat(file)).mode&0o777,0o600);
  const saved=deserialize(await readFile(file));saved.at-=60000;await writeFile(file,serialize(saved));
  // Expired files never resurrect abandoned rooms or credentials.
  assert.equal(f.app.relay.recovery.restore(),false);
 }finally{await f.close();}
});

test('a rejected resume terminates once rather than resetting an endless recovery loop',async()=>{
 const f=await fixture();let peer;try{
  peer=new RelayPeer();let opened=false,ended=0;peer.on('open',()=>opened=true);peer.on('disconnected',()=>ended++);
  await until(()=>opened,'Relay connected');
  const p=f.app.relay.peers.get(peer.id);f.app.relay.peers.delete(peer.id);p.ws.close(1001,'Server stopping');
  await until(()=>peer.destroyed,'Unrecoverable resume ends');assert.equal(ended,1);
 }finally{peer?.destroy();await f.close();}
});
