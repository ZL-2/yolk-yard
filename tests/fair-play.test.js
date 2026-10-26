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

function scenario({size=1,team=false,mutual=false,shots=false,shared=true,reciprocal=false,stage='battle',radius=1000,storm=false,visible=true,group=2,duration=215,gap=false,removeDuringFlag=false}={}){
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
for(const [name,options]of Object.entries({proximity:{shared:false},'brief encounter':{duration:100},'ordinary third party':{duration:140},'shooting each other':{mutual:true},'missed hostile shots':{shots:true},'spawn island':{stage:'spawn-island'},'battle bus':{stage:'bus'},'final circle':{radius:50},'storm escape':{radius:100,storm:true},'separated by cover':{visible:false},'long telemetry gaps':{gap:true}}))test(name+' is not automatically punished',()=>{assert.equal(scenario(options).penalties.length,0);});

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
