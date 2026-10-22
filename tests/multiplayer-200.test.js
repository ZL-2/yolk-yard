import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,until,pause} from './helpers/public-match.js';
import {RelayPeer} from '../src/relay-peer.js';
import {MatchAuthority} from '../server/realtime/authority.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
async function pair(f){const a=await f.user('Recovery Host');await a.ask('queue');const host=await f.game(a);const b=await f.user('Recovery Guest');await b.ask('queue');return {host,guest:await f.game(b)};}

test('initial transient handshake failure retries before reporting an error',async()=>{
 const f=await fixture(),Socket=globalThis.WebSocket;let peer,attempts=0;try{
  globalThis.WebSocket=class extends Socket{constructor(url){super(++attempts===1?url.replace('/game','/missing'):url);}};
  peer=new RelayPeer();let opened=false;const errors=[];peer.on('open',()=>opened=true);peer.on('error',e=>errors.push(e));
  await until(()=>opened,'Initial connection recovered');assert.ok(attempts>=2);assert.deepEqual(errors,[]);assert.equal(peer.retryAttempt,0);
 }finally{peer?.destroy();await f.close();}
});

test('congested command acknowledgements bound in-flight work and preserve every action in order',async()=>{
 const f=await fixture();try{
  const {host,guest}=await pair(f);clearInterval(host.clock);clearInterval(guest.clock);const peer=guest.net.peer;
  await until(()=>peer.unacked.size===0,'Handshake drained');
  const remote=f.app.relay.peers.get(peer.id),send=remote.ws.send.bind(remote.ws),acks=[];
  remote.ws.send=raw=>{const m=JSON.parse(raw);if(m.type==='command-ack')acks.push(raw);else send(raw);};
  const received=[];host.net.callbacks.onPlayerAction=(id,action)=>received.push(action);
  for(let i=0;i<100;i++){peer.control({type:'batch',messages:[{type:'data',channel:guest.net.hostConnection.channel,data:{type:'player-action',action:'ping-ordered-'+i}}]});assert.ok(peer.unacked.size<=32);}
  await until(()=>acks.length===32&&received.length===32,'First window delivered to host');assert.equal(received.length,32);assert.ok(peer.deferredControls.length>0);
  remote.ws.send=send;send(acks.at(-1));await until(()=>received.length===100&&peer.unacked.size===0,'Queued reliable actions drained');
  assert.deepEqual(received,Array.from({length:100},(_,i)=>'ping-ordered-'+i));assert.equal(peer.unackedBytes,0);assert.equal(peer.deferredControls.length,0);assert.deepEqual(guest.errors,[]);
 }finally{await f.close();}
});

test('lost snapshot baseline restores full world collections without a loot/build version change',async()=>{
 const f=await fixture();try{
  const {host,guest}=await pair(f);host.sim.beginBattle();host.sim.stage='active';host.sim.botInput=()=>({});await until(()=>guest.state?.royale?.stage==='active','Battle arrived');
  const initial=host.sim.snapshot(),version=initial.royale.lootVersion;assert.ok(initial.royale.chests.length>0);
  let restored;guest.net.callbacks.onState=s=>{guest.state=s;guest.states++;if(s.royale?.chests)restored=s.royale;};const before=guest.states;guest.net.hostConnection.decoder=new SnapshotDecoder();
  await until(()=>guest.states>before+3&&restored,'Decoder recovered');
  assert.equal(host.sim.snapshot().royale.lootVersion,version);assert.deepEqual(restored.chests,JSON.parse(JSON.stringify(initial.royale.chests)));assert.deepEqual(restored.builds,initial.royale.builds);assert.deepEqual(guest.errors,[]);
 }finally{await f.close();}
});


test('authoritative baseline recovery requests once and only resets the authenticated member',()=>{
 const requests=[],states=[],peer=Object.assign(Object.create(RelayPeer.prototype),{control:m=>requests.push(m),emit:(type,s)=>states.push(s)});
 const gap={type:'authority-frame',frame:{base:8,seq:9,patch:{}}};peer.message(gap);peer.message(gap);assert.equal(requests.length,1);
 const member={authorityId:'one'},room={owner:'one',members:new Map([['one',member]]),sim:{},encoders:new Map([['one',new SnapshotEncoder()]])},authority={roomFor:()=>room};
 MatchAuthority.prototype.command.call(authority,{authorityId:'one'},requests[0]);assert.equal(room.encoders.size,1);
 MatchAuthority.prototype.command.call(authority,member,requests[0]);assert.equal(room.encoders.size,0);
 const full=new SnapshotEncoder().encode({type:'state',state:{time:1,players:[],royale:{loot:[],chests:[],builds:[],worldDamage:{}}}});
 peer.message({type:'authority-frame',frame:full.frame});assert.equal(states.length,1);assert.deepEqual(states[0].royale.chests,[]);assert.equal(peer.authorityReset,false);
});
