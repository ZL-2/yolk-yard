import test from 'node:test';
import assert from 'node:assert/strict';
import {RealtimeRelay} from '../server/realtime/relay.js';
import {RoyaleSimulation} from '../src/royale.js';
import {PUBLIC_ROYALE,publicRoyaleOptions} from '../src/public-royale.js';
import {MODES,safeProfile,VERSION} from '../src/data.js';
import {EXPERIENCES,lobbyMarkup,publicRoyaleMarkup} from '../src/lobby-ui.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {rewardFrame} from '../src/rewards.js';
const bots=sim=>[...sim.players.values()].filter(p=>p.bot&&p.contestant);
function fixture(){
 const relay=new RealtimeRelay();relay.authority.now=()=>Date.parse("2026-10-02T16:00:00Z");clearInterval(relay.authority.timer);const room=relay.authority.ensurePublicRoyale();
 function user(id){const messages=[],ws={readyState:1,bufferedAmount:0,send:raw=>messages.push(JSON.parse(raw)),close(){}};const u={id,profile:safeProfile({name:id}),ready:true,sessions:new Map([[ws,{}]]),ws};relay.parties.users.set(id,u);relay.parties.create(u);return {u,messages};}
 function peer(id){const messages=[],p={id,links:new Map([[room.key,room.hostPeer]]),pending:[],pendingBytes:0,history:[],historyBytes:0,seq:0,acked:0,progressId:id};p.ws={readyState:1,bufferedAmount:0,send:raw=>{const m=JSON.parse(raw);messages.push(m);if(m.relaySeq)relay.ack(p,m.relaySeq);},close(){}};relay.peers.set(id,p);return {p,messages};}
 function admit(person){relay.parties.command(person.u,{type:'queue',publicRoyale:true});const ticket=person.u.ticket,{p,messages}=peer('player-'+person.u.id);relay.authority.data(p,room.hostPeer,{channel:'test',data:{type:'hello',version:VERSION,ticket,profile:person.u.profile}});assert.ok(p.authorityRoom,'Public admission succeeds');return {p,messages};}
 return {relay,room,user,peer,admit,async close(){relay.close();await relay.parties.store.flush();}};
}
test('server owns exactly one 48-seat Intermediate Solo match and waits for its first human',async()=>{
 const f=fixture();try{const {sim}=f.room;
  assert.equal(f.relay.authority.ensurePublicRoyale(),f.room);assert.equal(f.relay.authority.rooms.size,1);
  assert.equal(sim.options.difficulty,2);assert.equal(sim.options.teamSize,1);assert.equal(bots(sim).length,48);
  for(let n=0;n<3;n++){assert.equal(sim.queueEnds,0);sim.time+=50;sim.advanceWarmupClock();assert.equal(sim.stage,'spawn-island');assert.equal(sim.queueEnds,0);assert.equal(f.relay.authority.publicSummary().countdownStarted,false);}
  assert.equal(f.relay.authority.publicSummary().humanPlayers,0);assert.equal(f.room.owner,'server');
 }finally{await f.close();}
});
test('each human replaces one bot, all 48 humans retain the complete 45-second join window, and leaving restores a bot',()=>{
 const sim=new RoyaleSimulation({...publicRoyaleOptions(),seed:37});sim.startRound();
 for(let n=0;n<48;n++){assert.ok(sim.admitPlayer('human-'+n,safeProfile({name:'Human '+n})));assert.equal(bots(sim).length,47-n);assert.equal(sim.players.size,48);assert.equal(sim.stage,'spawn-island');}
 assert.equal(sim.queueEnds-sim.time,45);assert.equal(sim.admitPlayer('extra',safeProfile({name:'Extra'})),null);
 sim.leavePlayer('human-47');assert.equal(bots(sim).length,1);assert.equal(sim.players.size,48);
 sim.time=sim.queueEnds;sim.advanceWarmupClock();assert.equal(sim.stage,'battle-bus');assert.equal(sim.alive,48);
 const late=sim.admitPlayer('late',safeProfile({name:'Late'}));assert.equal(late.contestant,false);assert.equal(late.spectating,true);assert.equal(bots(sim).length,1);
});
test('public tickets are rechecked at cutoff; late humans only spectate, and connected watchers enter the next warmup',async()=>{
 const f=fixture();try{
  const a=f.admit(f.user('Early'));const before=f.relay.authority.publicSummary();assert.equal(before.humanPlayers,1);assert.equal(before.botPlayers,47);
  const b=f.user('Cutoff');f.relay.parties.command(b.u,{type:'queue',publicRoyale:true});const ticket=b.u.ticket;
  f.room.sim.time=f.room.sim.queueEnds;f.room.sim.advanceWarmupClock();
  const {p}=f.peer('player-Cutoff');f.relay.authority.data(p,f.room.hostPeer,{channel:'test',data:{type:'hello',version:VERSION,ticket,profile:b.u.profile}});
  const spectator=f.room.sim.players.get(p.id);assert.equal(spectator.health,0);assert.equal(spectator.lateSpectator,true);assert.equal(f.room.sim.alive,48);
  const inv=JSON.stringify(spectator.inventory),builds=f.room.sim.builds.length;
  f.relay.authority.command(p,{command:{type:'player-action',action:'rejoin'}});f.relay.authority.command(p,{command:{type:'player-action',action:'build-wall'}});
  assert.equal(spectator.health,0);assert.equal(JSON.stringify(spectator.inventory),inv);assert.equal(f.room.sim.builds.length,builds);
  assert.equal(f.relay.authority.publicSummary().humanPlayers,1);assert.equal(f.relay.authority.publicSummary().spectators,1);
  f.room.sim.phase='results';f.room.sim.stage='finished';f.room.restartAt=f.room.age;const old=f.room.sim.matchId;f.relay.authority.tick(f.relay.authority.last);
  assert.notEqual(f.room.sim.matchId,old);assert.equal(f.room.sim.queueEnds-f.room.sim.time,45);assert.equal(spectator.contestant,true);assert.equal(bots(f.room.sim).length,46);
  assert.ok(a.p.authorityRoom);
 }finally{await f.close();}
});
test('generic Spectate tickets require no friend link, cannot control the public round, and last departure never deletes the recurring room',async()=>{
 const f=fixture();try{
  const a=f.admit(f.user('Pilot'));f.room.sim.time=f.room.sim.queueEnds;f.room.sim.advanceWarmupClock();const old=f.room.sim.matchId;
  const b=f.admit(f.user('Viewer'));const watcher=f.room.sim.players.get(b.p.id);assert.equal(watcher.spectating,true);assert.equal(watcher.friendSpectator,false);
  for(const command of [{type:'configure',options:{mode:'ffa',bots:0}},{type:'visibility',value:'private'},{type:'start'},{type:'kick',id:a.p.id}])f.relay.authority.command(a.p,{command});
  assert.equal(f.room.sim.options.capacity,48);assert.equal(f.room.visibility,'public');assert.equal(f.room.sim.matchId,old);assert.equal(f.room.owner,'server');
  f.relay.authority.disconnect(a.p);f.relay.authority.disconnect(b.p);assert.equal(f.relay.authority.rooms.size,1);assert.equal(f.room.hostPeer.virtualRoom,true);
  assert.equal(f.relay.authority.publicSummary().humanPlayers,0);assert.equal(f.relay.authority.publicSummary().spectators,0);
 }finally{await f.close();}
});
test('public active round resets when the final connected viewer leaves, including bus and transport loss',async()=>{
 const f=fixture();try{
  const a=f.admit(f.user('Empty Reset Pilot'));const sim=f.room.sim;
  sim.time=sim.queueEnds;sim.advanceWarmupClock();assert.equal(sim.stage,'battle-bus');
  const b=f.admit(f.user('Empty Reset Viewer'));assert.equal(sim.players.get(b.p.authorityId).lateSpectator,true);
  f.relay.authority.disconnect(a.p);assert.equal(sim.stage,'battle-bus','A real spectator still keeps the round running');
  const old=sim.matchId;f.relay.authority.disconnect(b.p);
  assert.notEqual(sim.matchId,old);assert.equal(sim.stage,'spawn-island');assert.equal(sim.queueEnds,0);assert.equal(bots(sim).length,48);
  sim.time+=5;f.relay.authority.tick(f.relay.authority.last);assert.equal(sim.queueEnds,0,'Empty warmup must stay unstarted');
  const c=f.admit(f.user('Transport Pilot'));sim.time=sim.queueEnds;sim.advanceWarmupClock();
  sim.stage='active';sim.builds.push({id:'old-build'});sim.projectiles.push({id:'old-shot'});const active=sim.matchId;c.p.ws=null;
  f.relay.authority.tick(f.relay.authority.last);assert.notEqual(sim.matchId,active);assert.equal(sim.stage,'spawn-island');assert.equal(sim.queueEnds,0);
  assert.equal(sim.projectiles.length,0);assert.equal(sim.builds.length,0);assert.equal(bots(sim).length,48);assert.equal(f.relay.authority.publicSummary().joinable,true);assert.equal(f.relay.authority.rooms.size,1);
 }finally{await f.close();}
});
test('private FFA and every Royale team size are host-based; Team Scramble and all client-created server rooms are rejected',async()=>{
 const f=fixture();try{
  for(const [mode,teamSize]of [['ffa',1],['royale',1],['royale',2],['royale',4]]){
   const {u,messages}=f.user(mode+teamSize);f.relay.parties.command(u,{type:'queue',custom:true,options:{mode,teamSize,recurring:true},visibility:'public'});
   const l=messages.find(m=>m.type==='launch').launch;assert.equal(l.hostRun,true);if(l.options.mode==='royale'){assert.equal(l.options.capacity,48);assert.equal(l.options.fill,true);assert.equal(l.options.bots,47);}assert.equal(l.visibility,'private');assert.equal(l.options.recurring??false,false);assert.notEqual(l.code,PUBLIC_ROYALE.code);
   const sim=mode==='royale'?new RoyaleSimulation(l.options):null;if(sim){sim.addPlayer('host',u.profile);assert.equal(sim.phase,'lobby');assert.equal(sim.queueEnds,0);}
  }
  const retired=f.user('Retired');assert.throws(()=>f.relay.parties.command(retired.u,{type:'select',mode:'teams'}),/Choose Free/);assert.throws(()=>f.relay.parties.command(retired.u,{type:'queue',custom:true,options:{mode:'teams'}}),/retired/);
  const {p,messages}=f.peer(`yolk-yard-v${VERSION}-ABCDEFGH`);f.relay.authority.create(p,{options:{mode:'ffa'},visibility:'public'});assert.match(messages.at(-1).reason,/only server-run/);assert.equal(f.relay.authority.rooms.size,1);
  assert.deepEqual(MODES.map(m=>m.id),['royale','ffa']);assert.ok(EXPERIENCES.every(e=>e.mode!=='teams'));
 }finally{await f.close();}
});
test('a ready four-person party joins the same Solo round as independent opponents; its private selection stays intact',async()=>{
 const f=fixture();try{
  const people=Array.from({length:4},(_,n)=>f.user('Party'+n));const party=f.relay.parties.parties.get(people[0].u.party);
  party.selection={mode:'royale',teamSize:4,teamFill:true};for(const {u}of people.slice(1)){f.relay.parties.parties.delete(u.party);u.party=party.id;party.members.push(u.id);}
  f.relay.parties.command(people[0].u,{type:'queue',publicRoyale:true});
  for(const {u}of people){const {p}=f.peer('player-'+u.id);f.relay.authority.data(p,f.room.hostPeer,{channel:'test',data:{type:'hello',version:VERSION,ticket:u.ticket,profile:u.profile}});assert.ok(p.authorityRoom);assert.equal(f.room.sim.players.get(p.id).team,-1);}
  assert.equal(f.relay.authority.publicSummary().humanPlayers,4);assert.equal(bots(f.room.sim).length,44);assert.equal(party.selection.teamSize,4);assert.equal(f.relay.authority.capacity.pending(f.room.key),0);
 }finally{await f.close();}
});
test('48 contestants and 16 spectators fit the wire codec and server-verified public progression without rewarding spectators',async()=>{
 const f=fixture();try{
  const a=f.admit(f.user('Rewards'));f.room.sim.time=f.room.sim.queueEnds;f.room.sim.advanceWarmupClock();
  for(let i=0;i<16;i++)assert.ok(f.room.sim.admitPlayer('watch-'+i,safeProfile({name:'Watch '+i}),{spectator:true,publicSpectator:true}));
  const state=f.room.sim.snapshot(),wire={type:'authority-state',state};assert.equal(state.players.filter(p=>!p.boss).length,64);assert.equal(state.players.filter(p=>p.boss).length,3);
  assert.deepEqual(new SnapshotDecoder().decode(JSON.parse(JSON.stringify(new SnapshotEncoder().encode(wire).frame))),JSON.parse(JSON.stringify(wire)));
  f.relay.progression.frame(f.room.hostPeer,rewardFrame(state,'server',{}));const at=f.relay.progression.clock();f.relay.progression.clock=()=>at+1;f.relay.progression.frame(f.room.hostPeer,rewardFrame(state,'server',{}));const match=[...f.relay.progression.matches.values()].at(-1);assert.ok(match);assert.equal(match.custom,false);assert.equal(match.players.size,48);assert.equal(match.players.get(a.p.id).identity,a.p.progressId);
  assert.equal([...match.players.values()].filter(p=>!p.bot).length,1);
 }finally{await f.close();}
});
test('lobby has only the private button below, a separate public Join/Spectate card, human counts, and estimated time',()=>{
 const model={profile:{name:'Test'},id:'a',online:true,balance:0,party:{leader:'a',state:'idle',members:[{id:'a',profile:{name:'Test'},ready:true}]},publicMatch:{phase:'playing',stage:'spawn-island',humanPlayers:7,capacity:48,joinable:true,countdownSeconds:45,estimatedSeconds:590,availableSeats:41,availableSpectators:16}};
 const lobby=lobbyMarkup(model);assert.match(lobby,/public-royale-card/);assert.match(lobby,/data-action="public-join"/);assert.match(lobby,/>7<\/b> REAL PLAYERS/);assert.match(lobby,/45s to departure/);assert.match(lobby,/Est. remaining/);
 const bottom=lobby.match(/<section class="yard-play-card[\s\S]*?<\/section>/)[0];assert.equal((bottom.match(/<button/g)||[]).length,1);assert.match(bottom,/CUSTOM PRIVATE MATCH/);assert.doesNotMatch(lobby,/FIND PUBLIC MATCH|Team Scramble/);
 assert.match(publicRoyaleMarkup({...model,publicMatch:{...model.publicMatch,joinable:false,stage:'active'}}),/data-action="public-spectate"/);
});

test('public admissions and issued tickets close at 7pm while private creation remains available',async()=>{const f=fixture();try{const u=f.user('Closing');f.relay.parties.command(u.u,{type:'queue',publicRoyale:true});const ticket=u.u.ticket;assert.ok(ticket);f.relay.authority.now=()=>Date.parse('2026-10-02T23:00:00Z');assert.equal(f.relay.authority.publicSummary().availability.open,false);const {p,messages}=f.peer('closing-peer');f.relay.authority.data(p,f.room.hostPeer,{channel:'test',data:{type:'hello',version:VERSION,ticket,profile:u.u.profile}});assert.equal(p.authorityRoom,undefined);assert.match(JSON.stringify(messages),/7 AM/);const late=f.user('Closed');assert.throws(()=>f.relay.parties.command(late.u,{type:'queue',publicRoyale:true}),/7 AM/);assert.ok(!late.u.ticket);}finally{await f.close();}});
