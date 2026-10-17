import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,until,pause} from './helpers/public-match.js';
import {PublicHost} from '../server/realtime/public-host.js';
import {publicMatchOptions} from '../src/public-royale.js';
import {RoyaleSimulation} from '../src/royale.js';
import {Simulation} from '../src/simulation.js';
import {VERSION} from '../src/data.js';
import {lobbyMarkup,lobbyOptionsMarkup,modeMarkup} from '../src/lobby-ui.js';

const party=async(a,members)=>{await a.ask('privacy',{value:'open'});for(const member of members)await member.ask('join',{id:a.party.id});await until(()=>a.party.members.length===members.length+1,'Party roster');};

test('mode and team-size pools isolate pending hosts and dispatch each waiting party exactly once',async()=>{
 const f=await fixture();try{
  const a=await f.user('Pool Solo Host'),b=await f.user('Pool Solo Guest'),c=await f.user('Pool Duo Host'),d=await f.user('Pool Duo Guest'),e=await f.user('Pool Arena Host');
  for(const u of [c,d])await u.ask('select',{mode:'royale',teamSize:2});await e.ask('select',{mode:'ffa'});
  await Promise.all([a,b,c,d,e].map(u=>u.ask('queue')));
  assert.equal([a,b].flatMap(u=>u.launches).filter(l=>l.host).length,1);assert.equal([c,d].flatMap(u=>u.launches).filter(l=>l.host).length,1);
  const soloHost=[a,b].find(u=>u.launches.length),soloGuest=[a,b].find(u=>!u.launches.length),duoHost=[c,d].find(u=>u.launches.length),duoGuest=[c,d].find(u=>!u.launches.length);
  const solo=await f.game(soloHost);await until(()=>soloGuest.launches.length===1,'Solo guest dispatch');assert.equal(duoGuest.launches.length,0,'Unrelated pending room stays pending');
  const duo=await f.game(duoHost);await until(()=>duoGuest.launches.length===1,'Duo guest dispatch');assert.notEqual(duo.net.code,solo.net.code);assert.equal(soloGuest.launches.length,1);
  await soloHost.ask('host-ready',{id:soloHost.launches[0].id});assert.equal(soloGuest.launches.length,1,'Repeated ready must be idempotent');
  const arena=await f.game(e);assert.equal(arena.state.options.mode,'ffa');assert.equal(arena.state.phase,'playing');assert.equal(f.app.relay.publicHost.summary().roomCount,3);
  await f.game(soloGuest);await f.game(duoGuest);assert.deepEqual(f.games.flatMap(g=>g.errors),[]);
 }finally{await f.close();}
});

test('Play creates another Royale after departure and later arrivals fill it without touching the first round',async()=>{
 const f=await fixture();try{
  const a=await f.user('First Battle'),b=await f.user('Next Battle'),c=await f.user('Next Arrival');await a.ask('queue');const first=await f.game(a);
  first.sim.beginBattle();first.net.broadcast(first.sim.snapshot());first.net.publishRoom();await until(()=>f.app.relay.publicHost.roomFor(f.app.relay.peers.get(first.net.peer.id)).state?.stage==='battle-bus','Departure published');
  const firstId=first.sim.matchId;await b.ask('queue');const second=await f.game(b);await c.ask('queue');const arrival=await f.game(c);
  assert.notEqual(first.net.code,second.net.code);assert.equal(arrival.net.code,second.net.code);assert.equal(arrival.state.royale.matchId,second.sim.matchId);assert.equal(first.sim.matchId,firstId);assert.equal(first.sim.phase,'playing');assert.equal(first.net.closed,false);
  const target=f.app.relay.peers.get(first.net.peer.id),other=f.app.relay.peers.get(second.net.peer.id),ticket=f.app.relay.parties.tickets.get(c.launches[0].ticket);
  assert.equal(f.app.relay.parties.claim(ticket.token,arrival.net.id,target.id),null,'Tickets cannot be spent in another room');assert.equal(f.app.relay.publicHost.admission(f.app.relay.peers.get(arrival.net.peer.id)),null,'Missing admission is rejected');assert.notEqual(target,other);
 }finally{await f.close();}
});

test('eight concurrent Arena reservations fill one room; ninth opens a separate room and cancellation cannot reach it',async()=>{
 const f=await fixture();try{
  const users=[];for(let i=0;i<9;i++){const u=await f.user('Arena Pool '+i);await u.ask('select',{mode:'ffa'});users.push(u);}
  // Sequential requests still leave all hosts pending, exercising reserved seats.
  for(const u of users)await u.ask('queue');
  assert.equal(users.filter(u=>u.launches[0]?.host).length,2);const first=await f.game(users[0]);
  for(const u of users.slice(1,8)){await until(()=>u.launches.length,'Reserved arena guest');await f.game(u);}
  const second=await f.game(users[8]);assert.equal(first.sim.players.size,8);assert.equal([...first.sim.players.values()].filter(p=>!p.bot).length,8);assert.notEqual(first.net.code,second.net.code);
  assert.equal(first.sim.admitPlayer('overflow',{name:'Overflow'}),null);
  assert.equal(f.app.relay.publicHost.roomFor(f.app.relay.peers.get(first.net.peer.id)).summary().availableSeats,0);
  const secondId=second.sim.matchId;first.net.destroy();await users[0].ask('returned');await until(()=>f.games.slice(1,8).some(g=>g.net.isHost),'Full room host transfer');assert.equal(second.sim.matchId,secondId);assert.equal(second.net.isHost,true);
  const previous=second.sim.matchId;second.sim.finish();second.sim.time=second.sim.publicRestartAt;second.sim.tick(1/60);assert.notEqual(second.sim.matchId,previous);assert.equal(second.sim.phase,'playing');assert.deepEqual(second.errors,[]);
 }finally{await f.close();}
});

test('Duos and Squads keep each ready party on one team and reset readiness when rules or membership change',async()=>{
 for(const size of [2,4]){const f=await fixture();try{
  const users=[];for(let i=0;i<size;i++)users.push(await f.user('Team '+size+' Member '+i));const [leader,...mates]=users;await party(leader,mates);
  assert.equal(leader.party.selection.teamSize,size);await assert.rejects(leader.ask('select',{mode:'royale',teamSize:1}),/fit|Duos|Squads/);await assert.rejects(mates[0].ask('queue'),/leader/);await assert.rejects(leader.ask('queue'),/ready/);
  for(const u of mates)await u.ask('ready',{value:true});await leader.ask('select',{mode:'royale',teamSize:size,access:'public',options:{capacity:2,bots:0,building:false,difficulty:4}});await until(()=>leader.party.members.every(m=>!m.ready),'Rule change resets readiness');
  for(const u of mates)await u.ask('ready',{value:true});await leader.ask('queue');const host=await f.game(leader);for(const u of mates){await until(()=>u.launches.length,'Teammate launch');await f.game(u);}
  const humans=[...host.sim.players.values()].filter(p=>!p.bot);assert.equal(humans.length,size);assert.equal(new Set(humans.map(p=>p.team)).size,1);assert.equal(new Set(humans.map(p=>p.teamSlot)).size,size);assert.equal(host.sim.options.capacity,48);assert.equal(host.sim.options.building,true);assert.equal(host.sim.options.difficulty,2);assert.ok(host.sim.beginBattle());assert.equal(humans.every(p=>p.contestant),true);
 }finally{await f.close();}}
});

test('a public party arriving partly at departure spectates together instead of splitting into combat',()=>{
 const sim=new RoyaleSimulation(publicMatchOptions({teamSize:2}));const host=sim.addPlayer('host',{name:'Partial Team'});sim.assignTeam(host,{partyId:'pair',partySize:2,teamSize:2,teamFill:true});sim.startRound();sim.admitPlayer('other',{name:'Other Team'},{partyId:'other',partySize:1,teamSize:2,teamFill:true});sim.beginBattle();assert.equal(host.contestant,false);const late=sim.admitPlayer('late',{name:'Late Partner'},{partyId:'pair',partySize:2,teamSize:2,teamFill:true});assert.equal(late.contestant,false);assert.equal(host.lateSpectator,true);
});

test('private rules persist through selection and launch; public settings are normalized on the server',async()=>{
 const f=await fixture();try{const u=await f.user('Rules Captain');await u.ask('select',{mode:'royale',teamSize:2,access:'private',teamFill:false,options:{capacity:8,bots:3,fill:false,building:false,storm:'quick',difficulty:4}});await u.ask('queue');const launch=u.launches[0];assert.equal(launch.visibility,'private');assert.equal(launch.options.capacity,8);assert.equal(launch.options.bots,3);assert.equal(launch.options.fill,false);assert.equal(launch.options.building,false);assert.equal(launch.options.teamFill,false);assert.equal(launch.options.storm,'quick');await u.ask('cancel');await u.ask('select',{mode:'ffa',access:'public',options:{minutes:60,bots:0,weaponPool:'precision'}});await u.ask('queue');assert.equal(u.launches.at(-1).options.minutes,5);assert.equal(u.launches.at(-1).options.weaponPool,'all');}finally{await f.close();}
});

test('disconnected members retain seats, unrelated rooms do not count their reservations, and stale tickets cannot elect another host',()=>{
 const relay={peers:new Map(),parties:{tickets:new Map()},progression:{}};const pool=new PublicHost(relay).enable();const a=pool.findRoom({mode:'ffa'},1);a.host={id:'host',peer:a.key,address:a.key};for(let i=0;i<7;i++)a.members.set('p'+i,{peer:'p'+i,admission:{}});relay.parties.tickets.set('a',{code:a.code,recurring:true,member:'last',party:'p',expires:Date.now()+1000});assert.equal(a.summary().availableSeats,0);
 const b=pool.findRoom({mode:'ffa'},1);assert.notEqual(a,b);assert.equal(b.summary().availableSeats,8);b.pending={leader:'last',party:'p',expires:Date.now()+1000};assert.equal(b.authorize({publicTicket:'a'}),false);assert.equal(pool.authorize({id:`yolk-yard-v${VERSION}-RFZZZZZZ`,publicTicket:'a'}),false);
});

test('Arena checkpoints retain round identity, timer and spectator roles',()=>{
 const sim=new Simulation(publicMatchOptions({mode:'ffa'}));sim.addPlayer('host',{name:'Arena Host'});sim.startRound();const watcher=sim.admitPlayer('watcher',{name:'Arena Watcher'},{spectator:true,watchId:'host'});sim.finish();const copy=new Simulation(sim.options).restore(sim.checkpoint());assert.equal(copy.matchId,sim.matchId);assert.equal(copy.publicRestartAt,sim.publicRestartAt);copy.time=copy.publicRestartAt;copy.tick(1/60);assert.notEqual(copy.matchId,sim.matchId);assert.equal(copy.players.get(watcher.id).spectating,true);assert.equal(copy.players.get(watcher.id).friendSpectator,true);
});

test('mode discovery and options distinguish available modes, coming soon, fixed public rules and party readiness',()=>{
 const mode=modeMarkup({mode:'ffa'});assert.equal((mode.match(/COMING SOON/g)||[]).length,1);for(const name of ['Box Fights','Zone Wars','Zombies','Training','Free For All','Frontier Royale'])assert.ok(mode.includes(name));assert.match(lobbyOptionsMarkup({...publicMatchOptions(),access:'public'}),/fieldset class="lobby-rule-fields" disabled/);assert.doesNotMatch(lobbyOptionsMarkup({...publicMatchOptions(),access:'private'}),/fieldset class="lobby-rule-fields" disabled/);
 const p={leader:'a',state:'idle',selection:{mode:'royale',teamSize:2,access:'public'},members:[{id:'a',profile:{name:'Captain'},ready:false},{id:'b',profile:{name:'Partner'},ready:true}]};const html=lobbyMarkup({profile:p.members[0].profile,party:p,id:'a',online:true,balance:0});assert.match(html,/data-lobby-player="0"/);assert.match(html,/NOT READY/);assert.match(html,/is-ready/);assert.doesNotMatch(html,/HOLD THE FRONTIER|ONE PUBLIC MATCH|public-royale-card/);assert.ok(html.indexOf('data-action="career"')<html.indexOf('data-action="feature-request"'));assert.ok(html.indexOf('data-action="feature-request"')<html.indexOf('class="yard-wallet"'));
});
