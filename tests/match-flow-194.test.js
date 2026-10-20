import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,until,pause} from './helpers/public-match.js';
import {ZoneWarsSimulation} from '../src/zone-wars.js';
import {BoxFightSimulation} from '../src/box-fights.js';
import {publicMatchOptions} from '../src/public-royale.js';
import {matchOptions} from '../src/match-options.js';
import {rewardFrame} from '../src/rewards.js';
import {celebrationTarget} from '../src/celebration-state.js';
import {needsMouseCapture,matchInviteURL} from '../src/gameplay-access.js';
import {publicJoinMode} from '../src/public-join-notice.js';
import {PartyService} from '../server/realtime/parties.js';

for(const mode of ['boxfight','zonewars'])test(mode+' guest emotes traverse the actual relay, play while fighting and reach the spectator between rounds',async()=>{
 const f=await fixture();try{
  const a=await f.user('Emote Host'),b=await f.user('Emote Guest');for(const u of [a,b])await u.ask('select',{mode,teamSize:1});await a.ask('queue');const host=await f.game(a);await b.ask('queue');const guest=await f.game(b);
  clearInterval(host.clock);const s=host.sim;s.beginBoxRound();s.boxEnd=s.time;s.tick(1/30);const p=s.players.get(guest.net.id);
  guest.net.send({type:'player-action',action:'emote-shuffle'});await until(()=>p.emote?.id==='shuffle','Guest emote accepted by host');
  for(let i=0;i<35;i++){s.setInput(p.id,{seq:i+1,round:s.round,yaw:1.2,pitch:.2,slot:p.slot},true);s.tick(1/60);}
  assert.equal(p.emote?.id,'shuffle');assert.equal(p.yaw,p.emote.yaw,'Looking does not rotate the dancing guest');host.net.broadcast(s.snapshot());await until(()=>guest.state.players.find(q=>q.id===p.id)?.emote?.id==='shuffle','Guest sees their emote');
  guest.net.send({type:'player-action',action:'emote-cancel'});await until(()=>!p.emote,'Cancel travels through the relay');
  const loser=s.players.get('host');s.damage(loser,p,1000,'sprinter');s.tick(1/30);assert.equal(s.boxStage,'intermission');guest.net.send({type:'player-action',action:'emote-cheer'});await until(()=>p.emote?.id==='cheer','Guest winner can celebrate');
  s.tick(1/30);host.net.broadcast(s.snapshot());await until(()=>guest.state.players.find(q=>q.id===p.id)?.emote?.id==='cheer','Winner animation broadcasts');assert.equal(celebrationTarget(s.snapshot(),'host'),p.id);
  s.time+=1;s.completeBoxSeries(mode==='zonewars'?p.id:p.team);guest.net.send({type:'player-action',action:'emote-shuffle'});await until(()=>p.emote?.id==='shuffle','Guest can emote on series results');s.tick(1/30);assert.equal(p.emote?.id,'shuffle');
  s.phase='playing';s.beginBoxRound();assert.equal(p.emote,null);assert.deepEqual(guest.errors,[]);
 }finally{await f.close();}
});

test('public Zone Wars credits every round exactly once and survives host migration without ending after five wins',async()=>{
 const f=await fixture();try{
  const a=await f.user('Infinite Host'),b=await f.user('Round Winner');for(const u of [a,b])await u.ask('select',{mode:'zonewars'});await a.ask('queue');const host=await f.game(a);await b.ask('queue');const guest=await f.game(b);clearInterval(host.clock);
  const s=host.sim;assert.equal(s.options.scoreLimit,0);
  for(let n=1;n<=7;n++){
   s.beginBoxRound();s.boxEnd=s.time;s.tick(1/30);host.net.broadcast(s.snapshot());await pause(25);
   s.damage(s.players.get('host'),s.players.get(guest.net.id),1000,'sprinter');s.tick(1/30);assert.equal(s.phase,'playing');assert.equal(s.boxStage,'intermission');
   // The public progress throttle is intentionally real; repeat delivery also
   // exercises persistent per-round kill/win deduplication.
   await pause(510);host.net.broadcast(s.snapshot());await until(()=>f.app.relay.progression.leaderboards(b.id,{mode:'zonewars'}).wins.self?.wins===n,'Round '+n+' credited');
   host.net.broadcast(s.snapshot());assert.equal(f.app.relay.progression.leaderboards(b.id,{mode:'zonewars'}).wins.self.wins,n);
  }
  const board=f.app.relay.progression.leaderboards(b.id,{mode:'zonewars'});assert.equal(board.kills.self.kills,7);assert.equal(s.roundWins[guest.net.id],7);
  await pause(550);host.net.broadcast(s.snapshot());await pause(80);host.net.destroy();await a.ask('returned');await until(()=>guest.net.isHost&&guest.sim,'Infinite room transfers',15000);
  assert.equal(guest.sim.options.scoreLimit,0);assert.equal(guest.sim.phase,'playing');assert.equal(f.app.relay.progression.leaderboards(b.id,{mode:'zonewars'}).wins.self.wins,7);
 }finally{await f.close();}
});

test('infinite private Zone Wars survives many draws; finite private rules and Box Fights still finish',()=>{
 assert.equal(publicMatchOptions({mode:'zonewars',scoreLimit:3}).scoreLimit,0);assert.equal(publicMatchOptions({mode:'boxfight'}).scoreLimit,5);
 assert.equal(matchOptions({mode:'zonewars',scoreLimit:0}).scoreLimit,0);assert.equal(matchOptions({mode:'zonewars',scoreLimit:7}).scoreLimit,7);
 for(const [Type,target]of [[ZoneWarsSimulation,0],[ZoneWarsSimulation,3],[BoxFightSimulation,5]]){
  const s=new Type({scoreLimit:target,bots:0,fill:false,capacity:2});s.addPlayer('a',{name:'Alfa'});s.addPlayer('b',{name:'Bravo'});s.startRound();
  for(let n=0;n<(target||55);n++){s.boxStage='fight';s.boxRound++;s.endBoxRound(target?(s.options.boxFormat==='ffa'?'a':0):null);}
  assert.equal(s.phase,target?'results':'playing');assert.ok(s.roundHistory.length<=20);
  if(!target){const recovered=new Type().restore(s.checkpoint());assert.equal(recovered.options.scoreLimit,0);assert.equal(recovered.phase,'playing');}
 }
});

test('game populations count only public admitted humans while preserving private friend presence',()=>{
 const service=Object.create(PartyService.prototype),publicUser={id:'pub'},privateUser={id:'priv'},legacy={id:'legacy'},training={id:'train'};
 service.users=new Map([publicUser,privateUser,legacy,training].map(u=>[u.id,u]));service.playingMode=u=>u===training?'training':'zonewars';service.matchLocation=u=>u===publicUser?{listing:{public:true}}:u===privateUser?{listing:{public:false}}:null;
 assert.deepEqual(service.modeCounts(),{royale:0,ffa:0,zonewars:1,boxfight:0,zombies:0,training:1});assert.equal(service.playingMode(privateUser),'zonewars');
});
test('join notices identify each supported team format and invite URLs carry only the exact room',()=>{
 for(const [mode,teamSize,label]of [['royale',1,'Solos'],['royale',2,'Duos'],['royale',3,'Trios'],['royale',4,'Squads'],['boxfight',3,'3v3'],['zonewars',1,'Solos'],['zombies',3,'Trios'],['ffa',1,'Solo']])assert.ok(publicJoinMode({mode,teamSize}).endsWith(label));
 assert.ok(publicJoinMode({mode:'boxfight',boxFormat:'ffa'}).endsWith('Free For All'));
 const url=new URL(matchInviteURL('https://zl-2.github.io/yolk-yard/?qa&build=old&ref=abc#career','ABCD-EFGH'));assert.equal(url.pathname,'/yolk-yard/');assert.equal(url.search,'?room=ABCDEFGH');assert.equal(url.hash,'');assert.throws(()=>matchInviteURL(url.href,undefined),/not ready/);
});
test('capture recovery detects lost input without covering intentional menus or spectator/results views',()=>{
 const options={screen:'game',phase:'playing',player:{health:100,spectating:false},locked:false};assert.ok(needsMouseCapture(options));
 for(const key of ['locked','paused','dialog','chat','hidden','coarse','pending'])assert.equal(needsMouseCapture({...options,[key]:true}),false,key);
 assert.equal(needsMouseCapture({...options,phase:'results'}),false);assert.equal(needsMouseCapture({...options,player:{health:0,spectating:true}}),false);
});

test('private match codes join the exact room and neither private player enters the public population',async()=>{
 const f=await fixture();try{
  const a=await f.user('Private Host'),b=await f.user('Private Guest');await a.ask('select',{mode:'zonewars',access:'private',options:{scoreLimit:0}});await a.ask('queue');const host=await f.game(a);
  const url=matchInviteURL('https://zl-2.github.io/yolk-yard/?build=old#play',host.net.code),code=new URL(url).searchParams.get('room');await b.ask('queue',{code});const guest=await f.game(b);assert.equal(guest.net.code,host.net.code);
  host.net.publishRoom();await pause(100);const service=f.app.relay.parties;assert.equal(service.playingMode(service.users.get(a.id)),'zonewars');assert.equal(service.playingMode(service.users.get(b.id)),'zonewars');assert.equal(service.modeCounts().zonewars,0);assert.equal(guest.state.options.scoreLimit,0);
  await b.ask('profile',{profile:{...b.profile,name:'Renamed Guest'}});guest.net.profile({...b.profile,name:'Renamed Guest'});await until(()=>host.sim.players.get(guest.net.id)?.name==='Renamed Guest','Updated name reaches live roster');assert.equal(service.store.identities.get(b.id).profile.name,'Renamed Guest');
 }finally{await f.close();}
});
