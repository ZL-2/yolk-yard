import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicHost} from '../server/realtime/public-host.js';
import {fixture,until,pause} from './helpers/public-match.js';

function leaseFixture(){
 const removed=[],relay={peers:new Map(),parties:{tickets:new Map(),parties:new Map(),publishPublicMatch(){}},remove(peer){removed.push(peer.id);}};
 const registry=new PublicHost(relay).enable(),room=registry.legacy;
 const peer={id:room.key,ws:{readyState:1}};relay.peers.set(peer.id,peer);
 room.host={peer:peer.id,address:peer.id,id:'host',advancedAt:Date.now()-20000};
 room.state={matchId:'final-two',stage:'active',phase:'playing',time:500,alive:2};
 room.members.set(peer.id,{peer:peer.id,id:'host',order:1,admission:{}});
 return {relay,room,peer,removed};
}
test('public lease registry delegates frozen simulation removal to the host watchdog',()=>{
 const {room,removed}=leaseFixture();room.sweep();assert.deepEqual(removed,[]);
 assert.equal(room.state.alive,2);assert.equal(room.state.matchId,'final-two');
 room.state.stage='spawn-island';assert.equal(room.summary().joinable,false,'New arrivals avoid a stalled host');
});
test('lease sweeping cannot authorize eviction without the watchdog deadline',()=>{
 const {relay,room,peer,removed}=leaseFixture();
 relay.peers.set('guest',{id:'guest',ws:{readyState:1}});
 const guest={peer:'guest',order:2,ready:true,readyAt:Date.now(),readyMatch:'previous-round',admission:{}};room.members.set('guest',guest);
 room.sweep();assert.deepEqual(removed,[],'A previous-round checkpoint cannot rescue this round');
 guest.readyMatch='final-two';guest.readyAt=Date.now()-9000;room.sweep();assert.deepEqual(removed,[],'A frozen guest cannot rescue the host');
 guest.readyAt=Date.now();peer.ws=null;room.sweep();assert.deepEqual(removed,[],'The transport owns its reconnect deadline');
 peer.ws={readyState:1};room.sweep();assert.deepEqual(removed,[],'The dedicated watchdog owns simulation timeout removal');
});
test('another public room can start and close while a stalled solo final-two match resumes intact',async()=>{
 const f=await fixture();try{
  const a=await f.user('Final Two Host');await a.ask('queue');const first=await f.game(a);clearInterval(first.clock);
  first.sim.beginBattle();first.sim.stage='active';first.sim.alive=2;
  const survivors=[...first.sim.players.values()].filter(p=>p.contestant).slice(0,2);
  for(const p of first.sim.players.values())if(p.contestant&&!survivors.includes(p)){p.health=0;p.eliminated=true;}
  first.net.broadcast(first.sim.snapshot());first.net.publishRoom();
  const room=f.app.relay.publicHost.roomByAddress(first.net.peer.id);
  await until(()=>room.state?.stage==='active','Active round published');
  const match=first.sim.matchId,inventory=JSON.stringify(first.sim.players.get('host').inventory);
  room.host.advancedAt=Date.now()-20000;room.sweep();assert.ok(room.host,'Solo lease survives stalled rendering');
  const b=await f.user('Independent Host');await b.ask('queue');const second=await f.game(b);
  assert.notEqual(second.net.code,first.net.code);second.net.destroy();await b.ask('returned');
  first.sim.time+=1;first.net.broadcast(first.sim.snapshot());first.net.publishRoom();
  await until(()=>room.state.time===first.sim.time,'Original host resumes publishing');
  assert.equal(first.sim.matchId,match);assert.equal(JSON.stringify(first.sim.players.get('host').inventory),inventory);assert.deepEqual(first.errors,[]);
 }finally{await f.close();}
});
test('a brief transport outage can resume before the host-transfer deadline',async()=>{
 const f=await fixture();try{
  const u=await f.user('Recovering Operator');await u.ask('queue');const game=await f.game(u);clearInterval(game.clock);
  const transport=game.net.peer,start=transport.start.bind(transport),peer=f.app.relay.peers.get(transport.id),room=f.app.relay.publicHost.roomByAddress(peer.id),match=game.sim.matchId;
  transport.start=()=>{};transport.socket.terminate();await until(()=>transport.reconnecting&&peer.detachedAt,'Socket detached');
  peer.detachedAt=Date.now()-1000;room.host.advancedAt=Date.now()-1000;f.app.relay.sweep();
  assert.equal(f.app.relay.peers.get(peer.id),peer,'Authenticated session survives a brief outage');
  await pause(2000);assert.equal(transport.destroyed,false,'Client retries before the simulation deadline');
  transport.start=start;start();await until(()=>!transport.reconnecting,'Original session resumes');
  game.sim.time+=1;game.net.broadcast(game.sim.snapshot());game.net.publishRoom();await until(()=>room.state.time===game.sim.time,'Same room resumes');
  assert.equal(game.sim.matchId,match);assert.equal(f.app.relay.peers.get(peer.id),peer);assert.deepEqual(game.errors,[]);
 }finally{await f.close();}
});
