import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fixture,until} from './helpers/public-match.js';
import {TOURNAMENTS} from '../src/tournament.js';
import {parseTournamentTime,tournamentLocalTime} from '../src/tournament-schedule.js';
import {tournamentCard} from '../src/tournament-ui.js';
import {competeMarkup} from '../src/compete-ui.js';
const code='89271406539284756012',origin='https://zl-2.github.io'; // Local test only.
const definition=(at=Date.parse('2026-10-27T16:00Z'))=>({...TOURNAMENTS[1],name:'Owner Invitational',description:'Owner-created event',opensAt:at,lockAt:at-180000,startsAt:at+60000});
async function setup(){
 const dir=await mkdtemp(tmpdir()+'/tournament-owner-');let now=Date.parse('2026-10-23T18:00Z');
 const f=await fixture({serverOptions:{ownerCode:code,ownerPath:dir+'/owner.sqlite',tournamentOptions:{now:()=>now,autoStart:false}}});let token;
 const raw=async(path,body={},auth=true,requestOrigin=origin)=>{const response=await fetch('http://127.0.0.1:'+f.app.server.address().port+'/owner/'+path,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'text/plain'},body:JSON.stringify({...body,...(auth?{token}:{})})});return {status:response.status,data:await response.json()};};
 const post=async(path,body={})=>{const r=await raw(path,body);if(r.status!==200)throw Object.assign(Error(r.data.error),{status:r.status});return r.data;};
 const login=async()=>{token=(await post('login',{code})).token;};await login();
 const action=body=>post('action',{requestId:randomUUID(),revision:f.app.relay.tournament.catalog.revision,reason:'Owner schedule verification',...body});
 return {f,raw,post,action,login,setTime:at=>{now=at;},close:async()=>{await f.close();await rm(dir,{recursive:true,force:true});}};
}
test('New York calendar conversion handles EDT, EST and rejects missing / ambiguous dates',()=>{
 assert.equal(new Date(parseTournamentTime('2026-10-26T12:00')).toISOString(),'2026-10-26T16:00:00.000Z');
 assert.equal(new Date(parseTournamentTime('2026-11-09T12:00')).toISOString(),'2026-11-09T17:00:00.000Z');
 assert.equal(tournamentLocalTime(Date.parse('2026-11-09T17:00Z')),'2026-11-09T12:00');
 for(const v of ['2026-03-08T02:30','2026-11-01T01:30','2026-02-30T12:00','garbage'])assert.throws(()=>parseTournamentTime(v));
});
test('schedule read and all mutations require real owner authentication and permitted origin',async()=>{
 const t=await setup();try{
  for(const [path,body] of [['tournaments',{}],...['save','remove','cancel'].map(a=>['action',{action:'tournament-'+a,event:definition(),requestId:randomUUID()}])])assert.equal((await t.raw(path,body,false)).status,401);
  assert.equal((await t.raw('tournaments',{},true,'https://evil.example')).status,403);
  assert.equal((await t.post('tournaments')).events.length,2);
  assert.equal(t.f.app.owner.db.meta('tournament-schedule'),null);
 }finally{await t.close();}
});
test('create, edit, concurrency, idempotency and disk restart preserve schedule, archive and entitlements',async()=>{
 const t=await setup();try{
  const service=t.f.app.relay.tournament;service.event(TOURNAMENTS[0].id).complete('finished','Old archive',[{identity:'old-winner',name:'Historical winner',place:1}]);const archive=structuredClone(service.event(TOURNAMENTS[0].id).state);
  const command={action:'tournament-save',requestId:randomUUID(),revision:0,event:definition()},created=await t.action(command);
  assert.deepEqual(await t.action(command),created);assert.equal(service.events.length,3);
  await assert.rejects(t.action({...command,event:{...definition(),name:'Changed retry'}}),/already used/);
  await assert.rejects(t.action({action:'tournament-save',eventId:created.eventId,event:definition(),revision:0}),/another session/);
  const edit={...definition(),name:'Revised Cup',teamSize:3,prizes:[7000,3500,1500],duplicateReward:12000,capacity:24,spectators:8};await t.action({action:'tournament-save',eventId:created.eventId,event:edit});
  assert.deepEqual(service.event(created.eventId).event.prizes,[7000,3500,1500]);assert.equal(service.overview().events.find(e=>e.id===created.eventId).definition.spectators,8);
  assert.equal(t.f.app.owner.db.get("SELECT count(*) n FROM events WHERE kind='tournament-save'").n,2);
  await t.f.restart();await t.login();const restored=t.f.app.relay.tournament;
  assert.equal(restored.catalog.revision,2);assert.equal(restored.event(created.eventId).event.name,'Revised Cup');assert.equal(restored.event(created.eventId).event.teamSize,3);assert.deepEqual(restored.event(TOURNAMENTS[0].id).state,archive);assert.deepEqual(restored.rewards('old-winner').owned,[TOURNAMENTS[0].pickaxe]);
 }finally{await t.close();}
});
test('invalid schedules and overlapping events fail before writes, audit or broadcasts',async()=>{
 const t=await setup();try{
  for(const event of [{...definition(),prizes:[-1,1,0]},{...definition(),capacity:49},{...definition(),spectators:17},{...definition(),pickaxe:'not-real'},{...definition(),lockAt:Date.parse('2026-01-01')},{...definition(),startsAt:definition().opensAt},{...definition(),name:''},{...definition(),pickaxe:null,duplicateReward:10},{...definition(TOURNAMENTS[1].opensAt)}])await assert.rejects(t.action({action:'tournament-save',event}));
  assert.equal(t.f.app.relay.tournament.catalog.revision,0);assert.equal(t.f.app.owner.db.meta('tournament-schedule'),null);
  const event=definition();await t.action({action:'tournament-save',event});await assert.rejects(t.action({action:'tournament-save',event:definition(event.startsAt+31*60000)}),/overlaps/);
 }finally{await t.close();}
});
test('active cancellation removes only tournament room, releases reservations and reopens matchmaking without payout',async()=>{
 const t=await setup();try{
  const event=definition(),created=await t.action({action:'tournament-save',event}),service=t.f.app.relay.tournament;
  t.setTime(event.opensAt);service.tick();const a=await t.f.user('Schedule Alpha'),b=await t.f.user('Schedule Bravo');
  for(const u of [a,b]){await u.ask('tournament-join',{eventId:created.eventId});const g=await t.f.game(u);g.net.input({seq:1,dt:1/60,yaw:0,pitch:0});}
  await until(()=>[...service.event(created.eventId).room.sim.players.values()].every(p=>!p.loading),'competitors loaded');
  t.setTime(event.startsAt);service.tick();assert.equal(service.event(created.eventId).phase,'running');
  await assert.rejects(t.action({action:'tournament-save',eventId:created.eventId,event:{...event,prizes:[9999,2,1]}}),/locked/);
  await t.action({action:'tournament-save',eventId:created.eventId,event:{...event,name:'Renamed live event'}});
  await assert.rejects(t.action({action:'tournament-save',eventId:created.eventId,event:{...event,teamSize:3}}),/locked/);
  await assert.rejects(t.action({action:'tournament-remove',eventId:created.eventId}),/Cancel/);
  await t.action({action:'tournament-cancel',eventId:created.eventId});assert.equal(service.locked,false);assert.equal(service.event(created.eventId).room,null);assert.equal(t.f.app.relay.parties.tickets.size,0);assert.equal(t.f.app.owner.grantSummary(a.id).marks,0);assert.deepEqual(service.event(created.eventId).state.results,[]);
  const after=await t.f.user('After Cancellation');await after.ask('select',{mode:'ffa',access:'public'});await after.ask('queue');assert.ok(after.launches.length);
 }finally{await t.close();}
});
test('removal stays removed after restart; archived results cannot be changed or awarded twice',async()=>{
 const t=await setup();try{
  const id=TOURNAMENTS[1].id;await t.action({action:'tournament-remove',eventId:id});assert.equal(t.f.app.relay.tournament.summary().events.some(e=>e.id===id),false);
  await t.f.restart();await t.login();assert.equal(t.f.app.relay.tournament.event(id).event.removed,true);
  const e=t.f.app.relay.tournament.event(TOURNAMENTS[0].id);e.complete('finished','Archive',[{identity:'winner',name:'Winner',place:1}]);const old=structuredClone(e.state);
  await assert.rejects(t.action({action:'tournament-save',eventId:e.id,event:{...e.event,description:'',prizes:[1000000,0,0]}}),/locked/);
  await assert.rejects(t.action({action:'tournament-cancel',eventId:e.id}),/Only/);
  await t.action({action:'tournament-remove',eventId:e.id});assert.deepEqual(e.state,old);assert.deepEqual(t.f.app.relay.tournament.summary().events,[]);assert.equal(t.f.app.owner.grantSummary('winner').marks,5000);
 }finally{await t.close();}
});
test('custom title, entry duration, capacities and awards reach public cards; zero Marks still awards exclusive tool',async()=>{
 const t=await setup();try{
  const event={...definition(),name:'Cup <unsafe>',prizes:[0,200,100],duplicateReward:750,capacity:12,spectators:3,startsAt:definition().opensAt+120000},created=await t.action({action:'tournament-save',event});
  const e=t.f.app.relay.tournament.event(created.eventId),summary=e.summary(),card=tournamentCard({events:[summary]},true,event.opensAt-1);
  assert.match(card,/Cup &lt;unsafe&gt;/);assert.match(card,/750 extra/);assert.match(card,/2 MIN TO ENTER/);assert.ok(!card.includes('5,000'));
  const state={selected:e.id,tab:'details',query:'',bookmarks:[]},html=competeMarkup({tournament:{events:[summary]},online:true},state);assert.match(html,/Up to 12/);assert.match(html,/3 additional seats/);assert.match(html,/2-minute entry/);
  e.complete('finished','Winner',[{identity:'zero-winner',name:'Zero',place:1}]);assert.deepEqual(e.rewards('zero-winner').owned,[event.pickaxe]);assert.equal(t.f.app.owner.grantSummary('zero-winner').marks,0);
 }finally{await t.close();}
});
