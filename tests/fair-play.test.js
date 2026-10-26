import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {TeamingMonitor} from '../server/realtime/teaming-monitor.js';
import {FairPlayService} from '../server/realtime/fair-play.js';
import {OwnerStore} from '../server/realtime/owner-store.js';
import {fixture,until} from './helpers/public-match.js';
import {TOURNAMENT} from '../src/tournament.js';

function scenario({size=1,team=false,mutual=false,shots=false,shared=true,reciprocal=false,stage='active',radius=1000,storm=false,visible=true,group=2,duration=215,gap=false,removeDuringFlag=false}={}){
 const flags=[],players=new Map();
 for(let i=0;i<group;i++)players.set('p'+i,{id:'p'+i,name:'Player '+i,x:0,y:0,z:i*3,team:team?0:i,health:100,contestant:true,connected:true,flight:'ground'});
 for(let i=0;i<3;i++)players.set('v'+i,{id:'v'+i,x:800,y:0,z:800+i*60,team:i+10,health:100,contestant:true,connected:true,flight:'ground'});
 const sim={players,options:{mode:'royale',teamSize:size},stage,phase:'playing',time:0,elapsed:0,storm:{active:storm,x:0,z:0,radius},accessible:()=>visible};
 const identities=new Set(players.keys());
 const monitor=new TeamingMonitor({identity:id=>identities.has(id)?id:null,onFlag:r=>{flags.push(r);if(removeDuringFlag&&r.evidence.enforce)for(const id of r.players)identities.delete(id);}});
 for(let t=0;t<=duration;t++){
  sim.time=sim.elapsed=t;for(let i=0;i<group;i++)players.get('p'+i).x=t;
  if(shared&&[50,110,190].includes(t))for(let i=0;i<group;i++)monitor.combat({type:'hit',time:t,player:'p'+i,target:'v'+[50,110,190].indexOf(t),amount:35},sim);
  if(mutual&&t===75)monitor.combat({type:'hit',time:t,player:'p0',target:'p1',amount:1},sim);
  if(shots&&t===75)monitor.combat({type:'shot',time:t,player:'p0',origin:{x:t,y:1,z:0},shots:[{vx:0,vy:0,vz:100}]},sim);
  if(reciprocal&&[80,85,90,95].includes(t))monitor.transfer({time:t,from:t%10===0?'p0':'p1',to:t%10===0?'p1':'p0',drop:t,item:t<90?'wood':'light',amount:50});
  if(!gap||t%12===0)monitor.sample(sim);
 }
 return {flags,penalties:flags.filter(f=>f.evidence.enforce),monitor,sim};
}
test('sustained repeated coordinated combat auto-detects each of three solo teamers, without transitive guilt',()=>{
 const {penalties}=scenario({group:3,removeDuringFlag:true});assert.equal(new Set(penalties.flatMap(p=>p.players)).size,3);assert.equal(penalties.length,3);assert.ok(penalties.every(p=>p.evidence.closeSeconds>=180&&p.evidence.sharedTargets===3&&p.evidence.encounters===3));
});
test('reciprocal supplies corroborate two distinct shared fights for earlier live removal',()=>{const {penalties}=scenario({reciprocal:true,duration:125});assert.equal(penalties.length,1);assert.equal(penalties[0].evidence.reciprocalSupplies,true);assert.ok(penalties[0].evidence.closeSeconds<180);});
for(const size of [2,3,4])test(`legitimate ${size}-player teammates never trigger detection`,()=>{assert.equal(scenario({size,team:true,reciprocal:true}).flags.length,0);assert.equal(scenario({size}).penalties.length,1,'Opposing teams still monitored');});
for(const [name,options]of Object.entries({proximity:{shared:false},'brief encounter':{duration:100},'ordinary third party':{duration:140},'shooting each other':{mutual:true},'missed hostile shots':{shots:true},'spawn island':{stage:'spawn-island'},'battle bus':{stage:'battle-bus'},'final circle':{radius:50},'storm escape':{radius:100,storm:true},'separated by cover':{visible:false},'long telemetry gaps':{gap:true}}))test(name+' is not automatically punished',()=>{assert.equal(scenario(options).penalties.length,0);});

function harness(path=null){
 let now=1000000;const db=new OwnerStore({path,now:()=>now}),removed=[],sent=[];
 const cups=[0,1,2].map((i)=>({id:'cup'+i,phase:i?'scheduled':'running',state:{phase:i?'scheduled':'running'},event:{id:'cup'+i,name:'Frontier Cup',teamSize:1,opensAt:now+i*86400000,startsAt:now+i*86400000+60000}}));
 const r={owner:{db,systemEvent:()=>{},disconnectPlayer:id=>removed.push(id)},parties:{store:{identities:new Map(['a','b','c','d'].map(id=>[id,{id,profile:{name:id}}]))},users:new Map(),send:(_,m)=>sent.push(m)},tournament:{events:cups,event:id=>cups.find(c=>c.id===id)}};
 const service=new FairPlayService(r,{now:()=>now});r.fairPlay=service;
 const detect=(ids=['a','b'],extra={})=>service.flag({players:ids,room:'ROOM',matchId:'match1',eventId:'cup0',evidence:{source:'server simulation',enforce:true},...extra});
 return {r,db,cups,removed,sent,service,detect,setTime:n=>{now=n;},now:()=>now};
}
test('automatic penalty is atomic, exactly once per player/match, blocks all modes for precisely one hour',async()=>{
 const h=harness();try{const id=h.detect();assert.deepEqual(h.removed,['a','b']);assert.ok(h.sent.every(m=>m.type==='fair-play'));assert.equal(h.service.status('a').until,4600000);assert.equal(h.service.status('a').cups[0].id,'cup1');assert.throws(()=>h.service.assertPlay('a'),/suspension/);assert.doesNotThrow(()=>h.service.assertPlay('d'));assert.equal(h.service.disqualified('a','cup0'),true);
 h.detect();h.setTime(1000100);h.detect(['a','c']);assert.deepEqual(h.removed,['a','b','c']);assert.equal(h.service.status('a').until,4600000,'Another pair does not extend the first player’s ban');
 h.setTime(4599999);assert.throws(()=>h.service.assertPlay('a'));h.setTime(4600000);assert.doesNotThrow(()=>h.service.assertPlay('a'));assert.throws(()=>h.service.assertCup('a','cup1'),/prohibited/);assert.throws(()=>h.service.assertCup('a','cup0'),/removed/);assert.doesNotThrow(()=>h.service.assertCup('a','cup2'));
 h.service.manage({action:'teaming-revoke',caseId:id,reason:'Reversed after reviewing the saved evidence.'},()=>{});assert.doesNotThrow(()=>h.service.assertCup('b','cup1'));assert.equal(h.service.disqualified('b','cup0'),false);
 }finally{await h.db.close();}
});
test('cancelled cups roll restriction forward, edited dates keep ID, completed cups consume it',async()=>{
 const h=harness();try{h.detect();h.cups[1].event.opensAt+=10000;assert.equal(h.service.status('a').cups[0].opensAt,h.cups[1].event.opensAt);h.cups[1].phase='cancelled';assert.equal(h.service.status('a').cups[0].id,'cup2');h.cups[2].phase='finished';h.cups[2].state.phase='finished';h.cups[2].event.removed=true;assert.deepEqual(h.service.status('a').cups,[]);}finally{await h.db.close();}
});
test('no future cup keeps a pending exclusion and binds the next manually added cup',async()=>{
 const h=harness();try{h.cups.splice(1);h.detect();assert.equal(h.service.status('a').cups[0].pending,true);h.cups.push({id:'manual',phase:'scheduled',event:{name:'Owner Invitational',teamSize:3,opensAt:2000000,startsAt:2060000}});assert.equal(h.service.status('a').cups[0].id,'manual');assert.throws(()=>h.service.assertCup('a','manual'));}finally{await h.db.close();}
});
test('a manually scheduled Cup binds an offline player and is consumed even if they never log in',async()=>{
 const h=harness();try{h.cups.splice(1);h.detect();const manual={id:'offline-cup',phase:'scheduled',state:{phase:'scheduled'},event:{name:'Owner Cup',teamSize:1,opensAt:2000000,startsAt:2060000}};h.cups.push(manual);h.service.reconcileSchedule();manual.phase=manual.state.phase='finished';h.setTime(3000000);h.cups.push({id:'later-cup',phase:'scheduled',event:{name:'Later Cup',teamSize:1,opensAt:4000000,startsAt:4060000}});assert.deepEqual(h.service.status('a').cups,[],'Missing the next Cup consumes the exclusion without requiring a login');}finally{await h.db.close();}
});
test('penalties and automatic evidence survive restart; untrusted/ambiguous reports never punish',async()=>{
 const dir=await mkdtemp(tmpdir()+'/fair-play-'),h=harness(dir+'/owner.sqlite');try{h.detect();h.detect(['c','d'],{evidence:{source:'player report',enforce:true}});assert.deepEqual(h.removed,['a','b']);await h.db.close();const restored=harness(dir+'/owner.sqlite');try{assert.throws(()=>restored.service.assertPlay('a'));assert.equal(restored.service.status('b').cups[0].id,'cup1');assert.equal(restored.service.overview().cases.length,2);assert.doesNotThrow(()=>restored.service.assertPlay('c'));}finally{await restored.db.close();}}finally{await rm(dir,{recursive:true,force:true});}
});

test('real Cup removal disconnects players, blocks reservations and rewards, keeps status accessible, and protects review endpoints',async()=>{
 const code='89271406539284756012',E={...TOURNAMENT,id:'live-test',code:'TESTCUP2',teamSize:1},next={...E,id:'next-test',code:'NEXTCUP2',teamSize:2,opensAt:E.opensAt+86400000,startsAt:E.startsAt+86400000,lockAt:E.lockAt+86400000};let now=E.opensAt;
 const f=await fixture({serverOptions:{ownerCode:code,tournamentOptions:{events:[E,next],now:()=>now,autoStart:false}}});
 try{
  f.app.owner.now=()=>now;const r=f.app.relay,players=[];for(const name of ['Alpha Teaming','Bravo Teaming','Charlie Fair']){const u=await f.user(name);players.push(u);await u.ask('tournament-join');const game=await f.game(u);game.net.input({seq:1,dt:1/60,yaw:0,pitch:0});await until(()=>!r.tournament.room.sim.players.get(game.net.id)?.loading,'Player loaded');}
  now=E.startsAt;r.tournament.tick();assert.equal(r.tournament.phase,'running');const current=r.tournament.event(E.id),room=current.room,sim=room.sim;
  const id=r.fairPlay.flag({players:players.slice(0,2).map(u=>u.id),room:E.code,matchId:sim.matchId,eventId:E.id,evidence:{source:'server simulation',enforce:true}});
  for(const u of players.slice(0,2)){assert.equal(r.parties.users.get(u.id).inMatch,false);assert.equal(room.members.has(current.roster.get(u.id).player),false);await assert.rejects(u.ask('tournament-join'),/suspension/);assert.ok((await u.ask('fair-play-status')).until);for(const mode of ['royale','ffa','zonewars','boxfight','zombies','training'])for(const access of ['public','private'])assert.throws(()=>f.app.owner.assertAdmission(u.id,mode,access),/suspension/);}
  r.tournament.event(E.id).complete('finished','Fixture result',players.map((u,i)=>({identity:u.id,name:u.profile.name,place:i+1,kills:1})));for(const u of players.slice(0,2))assert.equal(f.app.owner.grantSummary(u.id).marks,0);
  now+=3600000;for(const u of players.slice(0,2)){assert.doesNotThrow(()=>f.app.owner.assertAdmission(u.id,'ffa','public'));await assert.rejects(u.ask('tournament-join',{eventId:next.id}),/prohibited/);}
  now=next.opensAt;r.tournament.event(next.id).tick();
  assert.equal(r.tournament.claim({tournament:true,eventId:next.id,member:players[0].id,spectator:false},{}),false,'A pre-issued Cup reservation is rechecked after the hourly ban');
  const partyService=r.parties;partyService.join(partyService.users.get(players[0].id),partyService.users.get(players[2].id).party);
  await assert.rejects(players[2].ask('tournament-join',{eventId:next.id}),/prohibited/);assert.equal(r.tournament.event(next.id).entryTeams.size,0,'A banned teammate rejects the whole party');
  const post=async(path,body)=>{const response=await fetch('http://127.0.0.1:'+f.app.server.address().port+'/owner/'+path,{method:'POST',headers:{Origin:'https://zl-2.github.io','Content-Type':'text/plain'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
  assert.equal((await post('fair-play',{})).status,401);assert.equal((await post('action',{action:'teaming-revoke',caseId:id,requestId:randomUUID(),reason:'Untrusted penalty reversal attempt.'})).status,401);
  const token=(await post('login',{code})).data.token;const requestId=randomUUID(),body={token,action:'teaming-revoke',caseId:id,requestId,reason:'Verified fixture reversal of the automated penalty.'};assert.equal((await post('action',body)).status,200);assert.equal((await post('action',body)).status,200);assert.equal((await post('action',{...body,caseId:'different'})).status,409);assert.doesNotThrow(()=>r.fairPlay.assertCup(players[0].id,next.id));
 }finally{await f.close();}
});

test('public Battle Royale requires host plus two distinct non-accused observations before the same automatic penalties',async()=>{
 const h=harness();try{
  const {penalties}=scenario(),flag=penalties[0],ids=['p0','p1','v0','v1','v2'];
  for(const id of ids)h.r.parties.store.identities.set(id,{id,profile:{name:id}});
  const room={code:'PUBLIC22',options:{mode:'royale',teamSize:1},host:{peer:'v0',id:'v0'},state:{matchId:'public-match',phase:'playing',stage:'active',time:215},members:new Map(ids.map(id=>[id,{id,admission:{memberId:id,partyId:id}}]))};
  h.r.publicHost={roomFor:peer=>room.members.has(peer.id)?room:null};const service=h.service.publicMatches;
  const send=(id,flag,extra={})=>service.receive({id},{hostId:'v0',matchId:'public-match',flag,...extra});
  for(let t=0;t<=180;t+=5){h.setTime(1000000+t*1000);for(const id of ids)send(id);}
  send('v1',flag);send('v2',flag);service.flush();assert.deepEqual(h.removed,[],'Two clients cannot bypass missing host evidence');
  send('v0',flag);service.flush();assert.deepEqual(h.removed,['p0','p1']);assert.throws(()=>h.service.assertPlay('p0'),/suspension/);assert.equal(h.service.status('p1').cups[0].id,'cup1');
  const row=h.service.overview().cases[0];assert.equal(row.evidence.source,'corroborated public match');assert.deepEqual(row.evidence.witnesses.sort(),['v1','v2']);assert.equal(row.decision.automatic,true);
  send('v0',flag);service.flush();assert.equal(h.removed.length,2,'Replay cannot extend a penalty');
 }finally{await h.db.close();}
});

test('public evidence rejects single-host accusations, accused witnesses, short sessions, malformed data, mismatched trails and stale hosts',async()=>{
 const h=harness();try{
  const flag=scenario().penalties[0],ids=['p0','p1','v0','v1','v2'];for(const id of ids)h.r.parties.store.identities.set(id,{id,profile:{name:id}});
  const room={code:'PUBLIC22',options:{mode:'royale',teamSize:1},host:{peer:'v0',id:'v0'},state:{matchId:'m',phase:'playing',stage:'active',time:215},members:new Map(ids.map(id=>[id,{id,admission:{memberId:id,partyId:id}}]))};h.r.publicHost={roomFor:()=>room};const service=h.service.publicMatches;
  const send=(id,flag,extra={})=>service.receive({id},{hostId:'v0',matchId:'m',flag,...extra});
  for(const id of ids)send(id,flag);service.flush();assert.deepEqual(h.removed,[],'Fresh connections cannot submit three minutes of invented history');
  for(let t=5;t<=180;t+=5){h.setTime(1000000+t*1000);for(const id of ids)send(id);}
  send('v0',flag);send('p0',flag);send('p1',flag);service.flush();assert.deepEqual(h.removed,[],'Accused cannot corroborate their own case');
  send('outsider',flag);send('v1',{...flag,evidence:{...flag.evidence,trail:null}});send('v2',flag,{hostId:'old-host'});service.flush();assert.deepEqual(h.removed,[]);
  const divergent=structuredClone(flag);for(const p of divergent.evidence.trail){p.a.x+=100;p.b.x+=100;}
  send('v1',divergent);send('v2',flag);service.flush();assert.deepEqual(h.removed,[],'Observers must agree on actual movement, not just a verdict');
  room.host={peer:'v1',id:'v1'};send('v0',flag);service.flush();assert.deepEqual(h.removed,[],'Demoted host evidence is fenced');
 }finally{await h.db.close();}
});

test('actual Royale active/drop phase names are monitored and a new server match discards old evidence',async()=>{
 assert.equal(scenario({stage:'active'}).penalties.length,1);assert.equal(scenario({stage:'drop'}).penalties.length,1);assert.equal(scenario({stage:'battle'}).penalties.length,0);
 const h=harness();try{h.r.progression={accounts:new Map()};const room={code:'S',members:new Map(),sim:{...scenario().sim,matchId:'first'}};
 h.service.observe(room);const first=room.teamingMonitor;room.sim.matchId='second';h.service.observe(room);assert.notEqual(room.teamingMonitor,first);assert.equal(room.teamingMatch,'second');
 }finally{await h.db.close();}
});

test('regular client snapshot monitoring emits automatic evidence without a report button',async()=>{
 const {RoyaleFairPlay}=await import('../src/royale-fair-play.js');const messages=[],client=new RoyaleFairPlay(m=>messages.push(m));
 const {sim}=scenario();let eventId=0;
 for(let time=0;time<=215;time++){
  for(const p of sim.players.values()){p.y=100;if(p.id.startsWith('p'))p.x=time;}
  const events=[];if([50,110,190].includes(time))for(const player of ['p0','p1'])events.push({id:++eventId,type:'hit',time,player,target:'v'+[50,110,190].indexOf(time),amount:35});
  client.observe({options:{mode:'royale',teamSize:1,map:'sunnybreak'},time,phase:'playing',players:[...sim.players.values()],events,royale:{matchId:'real-snapshot-shape',stage:'active',elapsed:time,storm:sim.storm,builds:[],worldDamage:{},buildVersion:0}},'v0');
 }
 assert.ok(messages.filter(m=>!m.flag).length>=40,'Automatic authenticated heartbeats establish observation duration');assert.equal(messages.filter(m=>m.flag).length,1);assert.deepEqual(messages.find(m=>m.flag).flag.players,['p0','p1']);
 client.observe({options:{mode:'royale',teamSize:1,map:'sunnybreak'},time:216,phase:'playing',players:[...sim.players.values()],events:[],royale:{matchId:'real-snapshot-shape',stage:'active',elapsed:216,storm:sim.storm,builds:[],worldDamage:{}}},'v1');assert.equal(client.monitor.pairs.size,1);assert.equal(client.monitor.pairs.values().next().value.seconds,0,'Host transfer starts fresh evidence');
});

test('regular live socket enforcement removes an accused host and guest, retains other players, and blocks rejoining',async()=>{
 const f=await fixture();try{
  const users=[];for(const name of ['Fair Host','Fair Guest','Fair Witness One','Fair Witness Two','Fair Witness Three'])users.push(await f.user(name));
  const games=[];for(const u of users){await u.ask('queue');games.push(await f.game(u));}
  for(const g of games)clearInterval(g.clock);
  const relay=f.app.relay,room=relay.publicHost.roomFor(relay.peers.get(games[0].net.peer.id)),sim=games[0].sim;
  sim.beginBattle();sim.time=215;sim.elapsed=215;sim.stage='active';games[0].net.broadcast(sim.snapshot());games[0].net.publishRoom();
  await until(()=>room.state?.stage==='active','Active public match');
  let now=1000000;relay.fairPlay.publicMatches.now=()=>now;
  const send=(game,flag)=>game.net.peer.control({type:'royale-fair-play',matchId:sim.matchId,hostId:games[0].net.id,flag});
  for(let t=0;t<=180;t+=5){now=1000000+t*1000;for(const game of games)send(game);await new Promise(resolve=>setTimeout(resolve,3));}
  await until(()=>room.fairPlayObservers?.size===5,'All authenticated observers registered');
  // Timing uses the server clock. Ensure the asynchronous socket queue observed
  // the whole window even on a slow test runner.
  for(const observer of room.fairPlayObservers.values())observer.since=now-180000;
  const flag=structuredClone(scenario().penalties[0]);const ids=new Map(['p0','p1','v0','v1','v2'].map((id,i)=>[id,games[i].net.id]));
  flag.players=flag.players.map(id=>ids.get(id));for(const hit of flag.evidence.hits){hit.player=ids.get(hit.player);hit.target=ids.get(hit.target);}
  for(const game of [games[0],games[2],games[3]])send(game,flag);
  await until(()=>relay.fairPlay.status(users[0].id).until,'Automatic public-match penalty');
  for(const i of [0,1]){assert.equal(relay.parties.users.get(users[i].id).inMatch,false);assert.equal(room.members.has(games[i].net.peer?.id),false);assert.throws(()=>relay.fairPlay.assertPlay(users[i].id),/suspension/);assert.ok((await users[i].ask('fair-play-status')).until);}
  for(const i of [2,3,4]){assert.doesNotThrow(()=>relay.fairPlay.assertPlay(users[i].id));assert.equal(relay.parties.users.get(users[i].id).inMatch,true);}
  assert.equal(relay.fairPlay.disqualifiedMatch(users[0].id,room.key,sim.matchId),true,'No final rewards for the removed player');
  await until(()=>games.slice(2).some(g=>g.promotions>0),'An innocent player takes over the removed host',12000);
 }finally{await f.close();}
});

test('corroborated three-player rings are collected before the first removal changes membership',async()=>{
 const h=harness();try{
  const flags=scenario({group:3}).penalties,ids=['p0','p1','p2','v0','v1','v2'];for(const id of ids)h.r.parties.store.identities.set(id,{id,profile:{name:id}});
  const room={code:'PUBLIC22',options:{mode:'royale',teamSize:1},host:{peer:'v0',id:'v0'},state:{matchId:'ring',phase:'playing',stage:'active',time:215},members:new Map(ids.map(id=>[id,{id,admission:{memberId:id,partyId:id}}]))};h.r.publicHost={roomFor:()=>room};const service=h.service.publicMatches;
  h.r.owner.disconnectPlayer=id=>{h.removed.push(id);room.members.delete(id);};
  const send=(id,flag)=>service.receive({id},{hostId:'v0',matchId:'ring',flag});
  for(let t=0;t<=180;t+=5){h.setTime(1000000+t*1000);for(const id of ['v0','v1','v2'])send(id);}
  for(const flag of flags)for(const id of ['v0','v1','v2'])send(id,flag);
  service.flush();assert.deepEqual(h.removed.sort(),['p0','p1','p2']);assert.equal(h.service.penalties('p0').length,1);
 }finally{await h.db.close();}
});

test('regular-match settlement cannot award a removed player after the hourly suspension expires',async()=>{
 const {ProgressionService}=await import('../server/realtime/progression.js');const h=harness();try{
  h.detect(['a','b'],{eventId:null});h.setTime(5000000);assert.doesNotThrow(()=>h.service.assertPlay('a'));
  const progression=new ProgressionService(h.r,{path:null});await progression.ready;const account=progression.account('progress-a');account.socialId='a';
  const match={id:'settlement',room:'yolk-yard-v87-ROOM',state:{matchId:'match1'},players:new Map([['a',{id:'a',identity:'progress-a'}]])};progression.settle(match);assert.equal(match.finished,true);assert.deepEqual(account.receipts,[]);
 }finally{await h.db.close();}
});
