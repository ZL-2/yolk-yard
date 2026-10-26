import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,until} from './helpers/public-match.js';
import {TOURNAMENT,tournamentName,tournamentMode,visibleTournament} from '../src/tournament.js';
import {validateTournament} from '../src/tournament-schedule.js';
import {TournamentService} from '../server/realtime/tournament.js';
import {matchOptions} from '../src/match-options.js';
import {publicMatchOptions,publicPoolKey} from '../src/public-royale.js';
import {isTeamRoyale,teammates,wonRoyale} from '../src/teams.js';
import {chatChannel,audienceFor} from '../src/chat.js';
import {mayDown} from '../src/team-survival.js';
import {tournamentCard,tournamentTeamEntryMarkup} from '../src/tournament-ui.js';
import {competeMarkup} from '../src/compete-ui.js';
const event=size=>({...TOURNAMENT,id:'cup-test-'+size,code:'TESTCUP'+size,teamSize:size,mode:tournamentMode({teamSize:size}),description:'',duplicateReward:10000,capacity:size*3});
async function makeParty(f,size,label){const users=[];for(let i=0;i<size;i++)users.push(await f.user(label+' '+i));const p=f.app.relay.parties,leader=p.users.get(users[0].id);for(const u of users.slice(1))p.join(p.users.get(u.id),leader.party);await until(()=>users[0].party.members.length===size,'Party synced');return users;}
async function load(f,u){const g=await f.game(u);g.net.input({seq:1,dt:1/60,yaw:0,pitch:0});await until(()=>!f.app.relay.tournament.room.sim.players.get(g.net.id)?.loading,'Ready for cutoff');return g;}

test('all cup formats validate, legacy cups remain Solo, titles replace stale suffixes and cards begin at two hours',()=>{
 for(const size of [1,2,3,4]){const e=event(size),expected=['Solos','Duos','Trios','Squads'][size-1],v=validateTournament(e,{id:e.id,code:e.code,now:e.lockAt-10000});assert.equal(v.teamSize,size);assert.equal(tournamentName(v),'Frontier Cup - '+expected);assert.equal(tournamentName({...v,name:'Frontier Cup - Solos'}),'Frontier Cup - '+expected);
 const upcoming={...e,phase:'scheduled'};assert.equal(visibleTournament([upcoming],e.opensAt-7200001),null);assert.equal(visibleTournament([upcoming],e.opensAt-7200000),upcoming);assert.match(tournamentCard({events:[upcoming]},true,e.opensAt-7200000),new RegExp('Frontier Cup - '+expected));
 const html=competeMarkup({tournament:{events:[upcoming]},online:true,now:e.opensAt-7200000},{selected:e.id,tab:'details',bookmarks:[],query:''});assert.match(html,new RegExp(expected.toUpperCase()+' ROYALE'));if(size>1)assert.match(html,/Every teammate earns the full/);
 }
 const legacy={...event(1)};delete legacy.teamSize;assert.equal(validateTournament(legacy,{id:'old',code:'OLD'}).teamSize,1);
 for(const teamSize of [0,5,1.5,'3',NaN])assert.throws(()=>validateTournament({...event(3),teamSize},{id:'invalid',code:'INVALID'}),/Choose/);
 assert.throws(()=>validateTournament({...event(3),capacity:5},{id:'small',code:'SMALL'}),/two full teams/);
});

test('team entry directions are prominent in the lobby and event hero for every team format',()=>{
 for(const size of [2,3,4]){
  const e={...event(size),phase:'entry'},directions=tournamentTeamEntryMarkup(e);
  assert.match(directions,/JOIN YOUR TEAMMATES’ LOBBY PARTY FIRST/);
  assert.match(directions,/party leader then selects JOIN TOURNAMENT/);
  assert.ok(directions.includes(`1–${size} players allowed · ${size} maximum`));
  assert.match(directions,/Smaller parties can enter. No bots or other players fill empty slots/);
  assert.ok(tournamentCard(e,true,e.opensAt).includes(directions));
  const html=competeMarkup({tournament:{events:[e]},online:true,now:e.opensAt},{selected:e.id,tab:'rewards',bookmarks:[],query:''});
  assert.ok(html.includes(directions));assert.ok(html.indexOf(directions)<html.indexOf('compete-hero-actions'),'Directions precede the join action on every event tab');
  assert.equal(tournamentTeamEntryMarkup({...e,phase:'running'}),'');
 }
 assert.equal(tournamentTeamEntryMarkup({...event(1),phase:'entry'}),'');
});

for(const size of [2,3,4])for(let count=1;count<size;count++)test(`${count}-player parties can enter ${size}-player cups and start with empty slots unfilled`,async()=>{
 const E=event(size);let now=E.opensAt;const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>now,autoStart:false}}});try{
  const t=f.app.relay.tournament,a=await makeParty(f,count,'Small Alpha'),b=await makeParty(f,count,'Small Bravo');
  await a[0].ask('tournament-join');await b[0].ask('tournament-join');
  const tickets=[...f.app.relay.parties.tickets.values()];assert.equal(tickets.length,count*2);assert.ok(tickets.every(x=>x.partySize===count&&x.teamSize===size&&x.teamFill===false));
  const gamesA=[],gamesB=[];for(const u of a)gamesA.push(await load(f,u));for(const u of b)gamesB.push(await load(f,u));
  now=E.startsAt;t.tick();assert.equal(t.phase,'running');const sim=t.room.sim,players=[...sim.players.values()].filter(p=>p.contestant);
  assert.equal(players.length,count*2);assert.ok(players.every(p=>!p.bot&&!p.lateSpectator));assert.ok([...sim.players.values()].filter(p=>p.bot).every(p=>p.boss||p.henchman),'Only map NPCs exist; no filler competitors');
  assert.equal(sim.options.bots,0);assert.equal(sim.options.teamFill,false);assert.equal(sim.options.fill,false);
  const teamA=gamesA.map(g=>sim.players.get(g.net.id).team),teamB=gamesB.map(g=>sim.players.get(g.net.id).team);
  assert.equal(new Set(teamA).size,1);assert.equal(new Set(teamB).size,1);assert.notEqual(teamA[0],teamB[0],'Separate parties never fill each other’s empty slots');
 }finally{await f.close();}
});

for(const size of [2,3])test(`oversized ${size}-player cup entries reject the whole party, including retries`,async()=>{
 const E=event(size);let now=E.opensAt;const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>now,autoStart:false}}});try{
  const t=f.app.relay.tournament,p=f.app.relay.parties,a=await makeParty(f,size+1,'Too Many');
  await assert.rejects(a[0].ask('tournament-join'),error=>error.message.includes(`Your party has ${size+1} players`)&&error.message.includes(`at most ${size} players`)&&error.message.includes('ask 1 player to leave'));
  assert.equal(t.active.entryTeams.size,0);assert.equal(p.tickets.size,0);assert.ok(a.every(u=>u.launches.length===0));
  await a.at(-1).ask('leave');await a[0].ask('tournament-join');const original=t.active.entryTeams.get(a[0].id);
  await a[0].ask('returned');p.join(p.users.get(a.at(-1).id),p.users.get(a[0].id).party);
  const before=[...p.tickets.keys()],launchCount=a[0].launches.length;
  await assert.rejects(a[0].ask('tournament-join'),/at most/);assert.deepEqual([...p.tickets.keys()],before);assert.equal(a[0].launches.length,launchCount);assert.equal(t.active.entryTeams.get(a[0].id),original);
  await a.at(-1).ask('leave');await a[0].ask('tournament-join');assert.equal(p.tickets.get(p.users.get(a[0].id).ticket).reservationId,original.id);
 }finally{await f.close();}
});

test('Squads parties cannot add a fifth player before cup entry',async()=>{
 const E=event(4);const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>E.opensAt,autoStart:false}}});try{
  const a=await makeParty(f,4,'Full Squad'),extra=await f.user('Extra Player'),p=f.app.relay.parties;
  assert.throws(()=>p.join(p.users.get(extra.id),p.users.get(a[0].id).party),/full \(4 players\)/);
  await a[0].ask('tournament-join');assert.equal(f.app.relay.tournament.active.entryTeams.size,4);assert.equal(extra.launches.length,0);
 }finally{await f.close();}
});

test('changing a valid-size lobby party cannot silently add or swap tournament teammates on retry',async()=>{
 const E=event(3);const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>E.opensAt,autoStart:false}}});try{
  const a=await makeParty(f,2,'Original'),extra=await f.user('New Teammate'),p=f.app.relay.parties,t=f.app.relay.tournament;
  await a[0].ask('tournament-join');const original=t.active.entryTeams.get(a[0].id);await a[0].ask('returned');
  p.join(p.users.get(extra.id),p.users.get(a[0].id).party);await assert.rejects(a[0].ask('tournament-join'),/Rejoin the lobby party you entered with/);
  assert.equal(extra.launches.length,0);assert.equal(t.active.entryTeams.size,2);assert.equal(p.users.get(a[0].id).ticket,undefined);
  await extra.ask('leave');await a[0].ask('tournament-join');assert.equal(p.tickets.get(p.users.get(a[0].id).ticket).reservationId,original.id);
 }finally{await f.close();}
});

test('Trios uses its own public pool and enables team combat, downing, shared wins and team-only chat',()=>{
 const options=matchOptions({mode:'royale',teamSize:3,bots:0,capacity:6});assert.equal(options.teamSize,3);assert.equal(publicMatchOptions(options).teamSize,3);assert.equal(publicPoolKey(options),'royale:3');assert.ok(isTeamRoyale(options));
 const players=[{id:'a',team:7,health:100,contestant:true},{id:'b',team:7,health:100,contestant:true},{id:'c',team:7,health:100,contestant:true},{id:'enemy',team:8,health:100,contestant:true}],state={options,players,royale:{winnerTeam:7,winnerId:'a'}};
 assert.ok(teammates(options,players[0],players[2]));assert.ok(mayDown({options,players:new Map(players.map(p=>[p.id,p]))},players[0],'Service Rifle'));assert.ok(wonRoyale(state,'c'));assert.equal(wonRoyale(state,'enemy'),false);assert.equal(chatChannel(players[0],'team',state),'team');assert.deepEqual(audienceFor(players[0],'team',state),['a','b','c']);
});

for(const size of [2,3,4])test(`${size}-player cups reserve parties together, reject oversized parties, retain team placement and pay every teammate once`,async()=>{
 const E=event(size);let now=E.lockAt-1;const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>now,autoStart:false}}});try{
  const t=f.app.relay.tournament,a=await makeParty(f,size,'Alpha'),b=await makeParty(f,size,'Bravo'),c=await makeParty(f,size,'Charlie');
  if(size<4){const oversized=await makeParty(f,size+1,'Oversized');now=E.opensAt;t.tick();await assert.rejects(oversized[0].ask('tournament-join'),/at most/);assert.equal(oversized[0].launches.length,0);}
  now=E.opensAt;t.tick();await assert.rejects(a[1].ask('tournament-join'),/leader/);
  await a[0].ask('tournament-join');await b[0].ask('tournament-join');
  const tickets=[...f.app.relay.parties.tickets.values()];assert.equal(new Set(tickets.filter(x=>a.some(u=>u.id===x.member)).map(x=>x.reservationId)).size,1);assert.ok(tickets.every(x=>x.teamSize===size&&x.partySize===size&&x.teamFill===false));
  await c[0].ask('tournament-join');const gamesA=[],gamesB=[],gamesC=[];for(const u of a)gamesA.push(await load(f,u));for(const u of b)gamesB.push(await load(f,u));for(const u of c)gamesC.push(await load(f,u));
  const sim=t.room.sim,teamA=gamesA.map(g=>sim.players.get(g.net.id)),teamB=gamesB.map(g=>sim.players.get(g.net.id));assert.equal(new Set(teamA.map(p=>p.team)).size,1);assert.equal(new Set(teamA.map(p=>p.teamSlot)).size,size);assert.notEqual(teamA[0].team,teamB[0].team);assert.equal(sim.options.bots,0);
  // A veteran champion receives the bonus; other teammates receive the pickaxe.
  f.app.owner.db.setMeta('tournament-entitlements',{[a[0].id]:[E.pickaxe]});
  now=E.startsAt;t.tick();assert.equal(t.phase,'running');
  const last=teamA.at(-1);last.flight='ground';sim.damage(last,null,10000,'Disconnected');assert.equal(last.place,0,'A teammate stays unplaced while their team survives');assert.equal(t.active.standings().find(r=>r.identity===a.at(-1).id).teamAlive,true);
  for(const g of gamesC){const p=sim.players.get(g.net.id);p.flight='ground';sim.damage(p,null,10000,'Disconnected');sim.time+=1;}
  for(const p of teamB){p.flight='ground';sim.damage(p,null,10000,'Disconnected');sim.time+=1;}sim.finish();t.tick();assert.equal(t.phase,'finished');assert.equal(t.state.results.length,size*3);
  for(const u of a){const r=t.state.results.find(r=>r.identity===u.id);assert.equal(r.place,1);assert.equal(r.marks,u===a[0]?15000:5000);assert.deepEqual(t.rewards(u.id).owned,[E.pickaxe]);assert.equal(f.app.owner.grantSummary(u.id).marks,u===a[0]?15000:5000);}
  for(const u of b){assert.equal(t.state.results.find(r=>r.identity===u.id).place,2);assert.equal(f.app.owner.grantSummary(u.id).marks,2500);}
  for(const u of c){assert.equal(t.state.results.find(r=>r.identity===u.id).place,3);assert.equal(f.app.owner.grantSummary(u.id).marks,1000);}
  const awards=t.state.results.map(r=>[r.identity,f.app.owner.grantSummary(r.identity).marks]);t.tick();const restored=new TournamentService(f.app.relay,{events:[E],now:()=>now,autoStart:false});restored.tick();assert.deepEqual(restored.state,t.state);assert.deepEqual(awards,t.state.results.map(r=>[r.identity,f.app.owner.grantSummary(r.identity).marks]));restored.close();
 }finally{await f.close();}
});

test('one entered trio cannot win an uncontested cup',async()=>{
 const E=event(3);let now=E.opensAt;const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>now,autoStart:false}}});try{const users=await makeParty(f,3,'Only Team');await users[0].ask('tournament-join');for(const u of users)await load(f,u);now=E.startsAt;f.app.relay.tournament.tick();assert.equal(f.app.relay.tournament.phase,'cancelled');assert.deepEqual(f.app.relay.tournament.state.results,[]);}finally{await f.close();}
});

test('incomplete trio spectates together at cutoff while two ready opponents compete',async()=>{
 const E=event(3);let now=E.opensAt;const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>now,autoStart:false}}});try{
 const t=f.app.relay.tournament,partial=await makeParty(f,3,'Partial'),x=await f.user('Ready Alpha'),y=await f.user('Ready Bravo');await partial[0].ask('tournament-join');const g0=await load(f,partial[0]),g1=await load(f,partial[1]);await f.game(partial[2]);
 for(const u of [x,y]){await u.ask('tournament-join');await load(f,u);}now=E.startsAt;t.tick();assert.equal(t.phase,'running');for(const g of [g0,g1]){const p=t.room.sim.players.get(g.net.id);assert.equal(p.contestant,false);assert.equal(p.lateSpectator,true);}assert.equal(t.active.standings().length,2);assert.equal(t.room.sim.options.bots,0);
 }finally{await f.close();}
});

test('team reservations cannot overbook remaining seats and retries retain the original team',async()=>{
 const E={...event(3),capacity:6};let now=E.opensAt;const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>now,autoStart:false}}});try{
 const t=f.app.relay.tournament,a=await makeParty(f,3,'Reserved'),b=await makeParty(f,3,'Second'),extra=await f.user('Overflow');await a[0].ask('tournament-join');const p=f.app.relay.parties,original=p.tickets.get(p.users.get(a[1].id).ticket).reservationId;await a[1].ask('returned');await b[0].ask('tournament-join');await assert.rejects(extra.ask('tournament-join'),/enough seats/);await a[1].ask('tournament-join');assert.equal(p.tickets.get(p.users.get(a[1].id).ticket).reservationId,original);assert.equal(t.active.entryTeams.size,6);
 }finally{await f.close();}
});
