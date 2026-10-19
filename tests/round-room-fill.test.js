import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicHost} from '../server/realtime/public-host.js';
import {BoxFightSimulation} from '../src/box-fights.js';
import {ZoneWarsSimulation} from '../src/zone-wars.js';
import {fixture,until} from './helpers/public-match.js';

test('round modes fill the busiest room at every stage, regardless of age, including reserved and waiting seats',()=>{
 for(const mode of ['boxfight','zonewars']){
  const relay={peers:new Map(),parties:{tickets:new Map()},progression:{}},pool=new PublicHost(relay).enable();
  const room=pool.findRoom({mode,teamSize:2},1);room.host={id:'host',peer:room.key,address:room.key,at:Date.now()-7200000,advancedAt:Date.now()};
  room.members.set('host',{admission:{}});room.members.set('waiting',{admission:{},waitingRound:true});room.members.set('friend',{admission:{spectator:true,friendSpectator:true}});
  for(const stage of ['box-waiting','box-prepare','box-fight','box-intermission','finished']){
   room.state={stage,phase:stage==='finished'?'results':'playing',time:7200,queueEnds:7201,matchId:'old-series'};
   assert.equal(room.summary().joinable,true);assert.equal(pool.findRoom({mode,teamSize:2},1),room);
   assert.equal(room.summary().availableSeats,room.options.capacity-2);
   room.publish({id:room.key},{recurring:true,hostId:'host',mode,teamSize:room.options.teamSize,publicState:{...room.state,contestants:['host']}});assert.equal(room.members.get('waiting').admission.spectator,undefined,'A stale host listing cannot release a reserved player seat');assert.equal(room.summary().availableSeats,room.options.capacity-2);
  }
  const spare=room.options.capacity-2;for(let i=0;i<spare;i++)relay.parties.tickets.set('t'+i,{code:room.code,recurring:true,expires:Date.now()+60000});
  assert.equal(room.summary().availableSeats,0);const next=pool.findRoom({mode,teamSize:2},1);assert.notEqual(next,room);next.pending={};
  relay.parties.tickets.delete('t0');assert.equal(pool.findRoom({mode,teamSize:2},1),room,'An opened seat is filled before the empty second room');
  room.host=null;assert.equal(pool.findRoom({mode,teamSize:2},1),room,'Host transfer cannot fragment a non-full room');
 }
});

test('late entrants wait through preparation, combat, intermission and results, survive recovery, and spawn next round',()=>{
 for(const Sim of [BoxFightSimulation,ZoneWarsSimulation])for(const stage of ['prepare','fight','intermission','results']){
  const s=new Sim({teamSize:2,recurring:true});s.addPlayer('a',{name:'Alpha'});s.addPlayer('b',{name:'Bravo'});s.startRound();s.beginBoxRound();s.boxStage=stage==='results'?'intermission':stage;if(stage==='results')s.phase='results';
  const late=s.admitPlayer('late',{name:'Late'}, {exactMatch:s.matchId,partySize:1});assert.ok(late);assert.equal(late.health,0);assert.equal(late.waitingRound,true);assert.equal(late.spectating,true);assert.equal(late.friendSpectator,false);assert.equal(late.contestant,true);assert.equal(late.lateSpectator,true);
  const copy=new Sim(s.options).restore(s.checkpoint());assert.equal(copy.players.get('late').waitingRound,true);if(copy.phase==='results')copy.startRound();copy.beginBoxRound();const spawned=copy.players.get('late');assert.equal(spawned.health,100);assert.equal(spawned.spectating,false);assert.equal(spawned.waitingRound,false);assert.equal(spawned.lateSpectator,false);
 }
});

test('real Play and notification joins enter the existing active room and deploy on its next round',async()=>{
 for(const mode of ['boxfight','zonewars']){const f=await fixture();try{
  const users=[];for(let i=0;i<4;i++){const u=await f.user(mode+' Filler '+i);await u.ask('select',{mode,teamSize:2});users.push(u);}
  await users[0].ask('queue');const host=await f.game(users[0]);await users[1].ask('queue');await f.game(users[1]);host.sim.beginBoxRound();host.sim.boxStage='fight';host.sim.boxStarted=host.sim.time;host.net.broadcast(host.sim.snapshot());host.net.publishRoom();
  const room=f.app.relay.publicHost.rooms.get(host.net.code);await until(()=>room.state.stage==='box-fight','Active round published');room.host.at=Date.now()-3600000;const count=f.app.relay.publicHost.rooms.size,round=host.sim.boxRound;
  await users[2].ask('queue');const late=await f.game(users[2]);assert.equal(late.net.code,host.net.code);assert.equal(f.app.relay.publicHost.rooms.size,count);assert.equal(host.sim.boxRound,round);assert.equal(host.sim.players.get(late.net.id).waitingRound,true);assert.equal(room.summary().humanPlayers,3);
  await users[3].ask('queue',{targetPublic:room.code,targetMatch:host.sim.matchId});const targeted=await f.game(users[3]);assert.equal(targeted.net.code,room.code);assert.equal(host.sim.players.get(targeted.net.id).waitingRound,true);assert.equal(room.summary().humanPlayers,4);
  if(mode==='boxfight'){assert.equal(room.summary().availableSeats,0);const overflow=await f.user('Full Room Overflow');await overflow.ask('select',{mode,teamSize:2});await overflow.ask('queue');assert.notEqual(overflow.launches.at(-1).code,room.code);await overflow.ask('cancel');}
  host.sim.endBoxRound(0,'elimination');host.sim.boxEnd=host.sim.time;await until(()=>host.sim.boxRound===round+1,'Next round automatically starts');await until(()=>late.state.players.find(p=>p.id===late.net.id)?.health===100,'Late entrant spawns on guest');assert.equal(host.sim.players.get(late.net.id).waitingRound,false);assert.equal(host.sim.players.get(targeted.net.id).waitingRound,false);assert.deepEqual(f.games.flatMap(g=>g.errors),[]);
 }finally{await f.close();}}
});

test('a Play request during host recovery waits for the same room instead of opening another',async()=>{
 const f=await fixture();try{
  const a=await f.user('Recovery Host'),b=await f.user('Recovery Successor'),c=await f.user('Recovery Arrival');for(const u of [a,b,c])await u.ask('select',{mode:'boxfight',teamSize:2});await a.ask('queue');const host=await f.game(a);await b.ask('queue');const guest=await f.game(b);host.sim.beginBoxRound();host.net.broadcast(host.sim.snapshot());
  await until(()=>guest.state.boxfight.stage==='prepare','Successor has round checkpoint');await new Promise(r=>setTimeout(r,400));clearInterval(host.clock);const room=f.app.relay.publicHost.rooms.get(host.net.code),rooms=f.app.relay.publicHost.rooms.size;room.host.advancedAt=Date.now()-20000;
  await c.ask('queue');assert.equal(c.launches.length,0);assert.equal(f.app.relay.parties.parties.get(c.party.id).launch.code,room.code);assert.equal(f.app.relay.publicHost.rooms.size,rooms);
  host.net.destroy();await a.ask('returned');await until(()=>guest.net.isHost&&c.launches.length,'Queued player dispatched after host transfer',15000);const arrival=await f.game(c);assert.equal(arrival.net.code,room.code);assert.equal(f.app.relay.publicHost.rooms.size,rooms);assert.deepEqual(arrival.errors,[]);
 }finally{await f.close();}
});
