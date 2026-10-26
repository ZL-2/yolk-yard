import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,until} from './helpers/public-match.js';
import {TournamentService} from '../server/realtime/tournament.js';
import {TOURNAMENTS,visibleTournament,placementReward} from '../src/tournament.js';
import {tournamentCard,standingsMarkup} from '../src/tournament-ui.js';
import {competeMarkup} from '../src/compete-ui.js';
const [friday,monday]=TOURNAMENTS;
test('Monday schedule uses noon EDT, one-minute entry, three-minute lockdown and no recurring events',()=>{
 assert.equal(new Date(monday.opensAt).toISOString(),'2026-10-26T16:00:00.000Z');assert.equal(monday.startsAt-monday.opensAt,60000);assert.equal(monday.opensAt-monday.lockAt,180000);assert.equal(monday.duplicateReward,10000);assert.equal(friday.duplicateReward,0);assert.deepEqual(monday.prizes,[5000,2500,1000]);
});
test('lobby spotlight opens exactly two hours before entry and expires exactly two hours after completion',()=>{
 const upcoming={...monday,phase:'scheduled'},finished={...friday,phase:'finished',endedAt:friday.startsAt+180000};
 assert.equal(visibleTournament([upcoming],monday.opensAt-7200001),null);assert.equal(visibleTournament([upcoming],monday.opensAt-7200000).id,monday.id);
 assert.equal(visibleTournament([finished],finished.endedAt+7199999).id,friday.id);assert.equal(visibleTournament([finished],finished.endedAt+7200000),null);
 assert.equal(visibleTournament([finished,{...upcoming,phase:'running'}],monday.startsAt).id,monday.id);
 assert.equal(tournamentCard({events:[upcoming],serverNow:monday.opensAt-7200001},true),'');
});
test('real second event preserves the archive, saves all placements, pays repeat winner once and reopens',async()=>{
 let now=friday.lockAt-1;const f=await fixture({serverOptions:{tournamentOptions:{now:()=>now,autoStart:false}}});try{
  const t=f.app.relay.tournament,users=[];for(const name of ['Repeat Champion','Silver Player','Bronze Player','Fourth Player'])users.push(await f.user(name));
  t.event(friday.id).complete('finished','Archived result',users.map((u,i)=>({identity:u.id,name:u.name||'Player '+i,place:i+1})));
  const old=structuredClone(t.event(friday.id).state);assert.equal(f.app.owner.grantSummary(users[0].id).marks,5000);
  now=monday.lockAt;t.tick();assert.equal(t.locked,true);assert.equal(t.room.eventId,monday.id);await assert.rejects(users[0].ask('tournament-join',{eventId:friday.id}),/over/);
  now=monday.opensAt;t.tick();const games=[];for(const u of users){await u.ask('tournament-join',{eventId:monday.id});const g=await f.game(u);g.net.input({seq:1,dt:1/60,yaw:0,pitch:0});games.push(g);}
  await until(()=>[...t.room.sim.players.values()].filter(p=>!p.loading).length===4,'All competitors loaded');now=monday.startsAt;t.tick();assert.equal(t.phase,'running');assert.equal(t.summary().events.find(e=>e.id===monday.id).standings.length,4);
  const sim=t.room.sim;for(const g of games.slice(1).reverse()){const p=sim.players.get(g.net.id);p.flight='ground';sim.damage(p,null,10000,'Disconnected');sim.time+=1;}sim.finish();t.tick();
  const result=t.event(monday.id).state;assert.equal(result.phase,'finished');assert.equal(t.locked,false);assert.equal(result.results.length,4);assert.equal(result.standingsComplete,true);assert.deepEqual(result.results.map(r=>r.marks),[15000,2500,1000,0]);assert.equal(result.results[0].bonusMarks,10000);assert.equal(result.results[0].pickaxeAwarded,null);
  assert.equal(f.app.owner.grantSummary(users[0].id).marks,20000);assert.deepEqual(t.rewards(users[0].id).owned,[monday.pickaxe]);assert.deepEqual(t.event(friday.id).state,old);
  t.tick();t.event(monday.id).complete('finished','repeat',result.results);assert.equal(f.app.owner.grantSummary(users[0].id).marks,20000);
  const restored=new TournamentService(f.app.relay,{now:()=>now,autoStart:false});assert.equal(restored.summary().events.length,2);assert.equal(restored.event(monday.id).state.results[0].marks,15000);assert.deepEqual(restored.event(friday.id).state,old);restored.close();
  const fresh=await f.user('After Second Cup');await fresh.ask('select',{mode:'ffa',access:'public'});await fresh.ask('queue');assert.ok(fresh.launches.length);
 }finally{await f.close();}
});
test('first-time Monday champion receives the pickaxe and 5000, not the duplicate bonus',async()=>{
 const f=await fixture({serverOptions:{tournamentOptions:{events:[monday],now:()=>monday.lockAt-1,autoStart:false}}});try{const t=f.app.relay.tournament,u=await f.user('New Champion');t.event(monday.id).complete('finished','Finished',[{identity:u.id,name:'New Champion',place:1}]);const r=t.state.results[0];assert.equal(r.marks,5000);assert.equal(r.bonusMarks,0);assert.equal(r.pickaxeAwarded,monday.pickaxe);assert.equal(f.app.owner.grantSummary(u.id).marks,5000);assert.deepEqual(t.rewards(u.id).owned,[monday.pickaxe]);}finally{await f.close();}
});
test('catalog renders real archived awards, escapes player names, and never presents live survivors as final winners',()=>{
 const result={identity:'me',name:'<img onerror=alert(1)>',place:1,marks:15000,bonusMarks:10000,pickaxeAwarded:null},e={...monday,phase:'finished',endedAt:monday.startsAt+1000,results:[result],standingsComplete:true};
 assert.match(placementReward(e,result),/15,000.*10,000/);assert.ok(!placementReward(e,result).includes('Frontier Champion'));
 const markup=standingsMarkup(e,{identity:'me'});assert.ok(!markup.includes('<img'));assert.match(markup,/&lt;img/);assert.match(markup,/YOU/);
 const live=standingsMarkup({...e,phase:'running',standings:[{...result,place:null,alive:true}]});assert.match(live,/Still competing/);assert.match(live,/provisional/);
 const html=competeMarkup({tournament:{events:[e,{...friday,phase:'finished',results:[]}]},online:true,id:'me'},{filter:'all',view:'week',cursor:monday.opensAt,day:'',selected:monday.id,tab:'rewards',query:'',bookmarks:[]});assert.match(html,/10,000 Marks instead/);assert.match(html,/12:00 PM/);assert.ok(!html.includes('12:10 PM'));
});
test('missed event cancels safely without clearing unrelated matchmaking or inventing results',async()=>{
 const f=await fixture({serverOptions:{tournamentOptions:{events:[monday],now:()=>monday.startsAt+1,autoStart:false}}});try{const t=f.app.relay.tournament;let clears=0;t.event(monday.id).lockdown=()=>clears++;t.tick();assert.equal(t.phase,'cancelled');assert.equal(t.locked,false);assert.equal(clears,0);assert.deepEqual(t.state.results,[]);}finally{await f.close();}
});
