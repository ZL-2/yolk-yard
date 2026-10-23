import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,until,pause} from './helpers/public-match.js';
import {TournamentService} from '../server/realtime/tournament.js';
import {TOURNAMENT as E,tournamentPhase} from '../src/tournament.js';
import {EggWallet,purchase,normalizeWallet} from '../src/egg-wallet.js';
import {shopItem} from '../src/shop-catalog.js';
import {makeShopPickaxe} from '../src/shop-models.js';
import {MatchEndUI} from '../src/match-end-ui.js';

function clock(f,now=E.lockAt-1){const t=f.app.relay.tournament;t.close();t.now=()=>now;return {t,set(n){now=n;t.tick();}};}
async function join(f,user){await user.ask('tournament-join');const g=await f.game(user);g.net.input({seq:1,dt:1/60,yaw:0,pitch:0});await until(()=>!f.app.relay.tournament.room.sim.players.get(g.net.id)?.loading,'Player loaded');return g;}

test('dated EDT event has exact lockdown, one-minute entry, and no next-day recurrence',()=>{
 assert.equal(new Date(E.startsAt).toISOString(),'2026-10-23T16:11:00.000Z');
 assert.equal(E.startsAt-E.opensAt,60000);assert.equal(E.opensAt-E.lockAt,180000);
 assert.equal(tournamentPhase(E.lockAt-1),'scheduled');assert.equal(tournamentPhase(E.lockAt),'preparing');assert.equal(tournamentPhase(E.opensAt),'entry');assert.equal(tournamentPhase(E.startsAt),'starting');assert.equal(tournamentPhase(E.startsAt+86400000,{phase:'finished'}),'finished');
});
test('real sockets: clear ordinary rooms, enforce cutoff, spectate after death/late join, pay podium once and reopen',async()=>{
 const f=await fixture({serverOptions:{tournamentOptions:{now:()=>E.lockAt-1,autoStart:false}}});try{
  const {t,set}=clock(f),a=await f.user('Cup Alpha'),b=await f.user('Cup Bravo'),c=await f.user('Cup Charlie'),late=await f.user('Cup Watcher'),messages=[];
  a.ws.on('message',raw=>messages.push(JSON.parse(raw)));
  await a.ask('select',{mode:'ffa',access:'private'});await a.ask('queue');const normal=await f.game(a);
  set(E.lockAt);await until(()=>!f.app.relay.peers.has(normal.net.peer.id),'Existing match evicted');
  await until(()=>messages.some(m=>m.type==='owner-session-ended'&&m.message.includes('12:10')),'Tournament announcement delivered');
  for(const mode of ['royale','ffa','zonewars','boxfight']){await b.ask('select',{mode,access:'public'});await assert.rejects(b.ask('queue'),/Frontier Cup/);}
  await assert.rejects(b.ask('tournament-join'),/opens at 12:10/);
  set(E.opensAt);const ga=await join(f,a),gb=await join(f,b),gc=await join(f,c),sim=t.room.sim;
  assert.equal(sim.options.bots,0);assert.equal(sim.options.recurring,false);assert.equal(f.app.relay.authority.rooms.size,1);
  sim.time+=65;sim.advanceWarmupClock();assert.equal(sim.stage,'spawn-island','Simulation time cannot close entry early');
  set(E.startsAt-1);assert.equal(t.summary().joinable,true);set(E.startsAt);assert.equal(t.phase,'running');assert.equal(sim.stage,'battle-bus');
  await late.ask('tournament-join');const watch=await f.game(late);assert.equal(sim.players.get(watch.net.id).lateSpectator,true);assert.equal(sim.players.get(watch.net.id).contestant,false);
  const p3=sim.players.get(gc.net.id);p3.flight='ground';sim.damage(p3,null,10000,'Disconnected');assert.equal(p3.spectating,true);assert.equal(p3.place,3);
  const frames=gc.states;await until(()=>gc.states>frames,'Eliminated competitor keeps receiving live snapshots');
  const oldId=gc.net.id;gc.net.destroy();await until(()=>!p3.connected,'Eliminated client leaves');await c.ask('returned');await c.ask('tournament-join');const rejoined=await f.game(c);assert.equal(rejoined.net.id,oldId);assert.equal(sim.players.get(oldId).health,0);assert.equal(sim.players.get(oldId).spectating,true);
  sim.time+=1;const p2=sim.players.get(gb.net.id);p2.flight='ground';sim.damage(p2,null,10000,'Disconnected');sim.finish();t.tick();
  assert.equal(t.phase,'finished');assert.equal(t.locked,false);assert.deepEqual(t.state.results.map(p=>p.identity),[a.id,b.id,c.id]);
  assert.equal(f.app.owner.grantSummary(a.id).marks,5000);assert.equal(f.app.owner.grantSummary(b.id).marks,2500);assert.equal(f.app.owner.grantSummary(c.id).marks,1000);assert.equal(f.app.owner.grantSummary(late.id).marks,0);
  assert.deepEqual(t.rewards(a.id).owned,[E.pickaxe]);assert.deepEqual(t.rewards(b.id).owned,[]);assert.equal(t.sanitize({pickaxe:E.pickaxe},b.id).pickaxe,'');assert.equal(t.sanitize({pickaxe:E.pickaxe},a.id).pickaxe,E.pickaxe);
  for(let i=0;i<3;i++)t.tick();assert.equal(f.app.owner.grantSummary(a.id).marks,5000);
  const restored=new TournamentService(f.app.relay,{now:()=>E.startsAt+10000,autoStart:false});assert.equal(restored.phase,'finished');assert.deepEqual(restored.rewards(a.id).owned,[E.pickaxe]);restored.close();
  const fresh=await f.user('Cup After');await fresh.ask('select',{mode:'ffa',access:'public'});await fresh.ask('queue');assert.ok(fresh.launches.length,'Ordinary matchmaking reopened');
 }finally{await f.close();}
});
test('empty/one-player event cancels, releases lock and cannot fabricate a winner',async()=>{
 const f=await fixture({serverOptions:{tournamentOptions:{now:()=>E.lockAt-1,autoStart:false}}});try{const {t,set}=clock(f);set(E.opensAt);const a=await f.user('Cup Solo');await join(f,a);set(E.startsAt);assert.equal(t.phase,'cancelled');assert.equal(t.locked,false);assert.deepEqual(t.state.results,[]);assert.equal(f.app.owner.grantSummary(a.id).marks,0);}finally{await f.close();}
});
test('unclaimed last-second ticket cannot admit a contestant after the cutoff',async()=>{
 const f=await fixture({serverOptions:{tournamentOptions:{now:()=>E.lockAt-1,autoStart:false}}});try{const {t,set}=clock(f);set(E.opensAt);const a=await f.user('Cup First'),b=await f.user('Cup Second'),c=await f.user('Cup Last');await join(f,a);await join(f,b);await c.ask('tournament-join');const ticket=f.app.relay.parties.tickets.get(f.app.relay.parties.users.get(c.id).ticket);set(E.startsAt);assert.equal(t.claim(ticket,{id:'late-peer'}),false);await c.ask('tournament-join');const g=await f.game(c);assert.equal(t.room.sim.players.get(g.net.id).lateSpectator,true);}finally{await f.close();}
});
test('winner pickaxe is exclusive, one merged mesh and owner grants credit full prizes exactly once',async()=>{
 assert.equal(shopItem(E.pickaxe).tournamentReward,true);assert.throws(()=>purchase(normalizeWallet(null),E.pickaxe),/only/);
 const g=makeShopPickaxe(E.pickaxe),meshes=[];g.traverse(m=>{if(m.isMesh)meshes.push(m);});assert.equal(meshes.length,1);assert.ok(meshes[0].geometry.attributes.position.count>1000);
 const values=new Map(),wallet=new EggWallet({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}),start=wallet.value.balance;
 await wallet.syncOwnerGrants({id:'champion',marks:5000});await wallet.syncOwnerGrants({id:'champion',marks:5000});assert.equal(wallet.value.balance,start+5000);
 await wallet.syncTournamentRewards({identity:'champion',owned:[E.pickaxe]});assert.ok(wallet.value.owned.includes(E.pickaxe));
 await wallet.syncTournamentRewards({identity:'other',owned:[]});assert.ok(!wallet.value.owned.includes(E.pickaxe));
});
test('an eliminated spectator sees final results and the lobby button when the tournament finishes',()=>{
 const old=globalThis.document,root={hidden:true,setAttribute(){},contains(){return false;}};globalThis.document={createElement:()=>root,body:{append(){}},activeElement:null};
 try{const ui=new MatchEndUI(),state={round:1,phase:'playing',tournament:{id:E.id},options:{mode:'royale',teamSize:1},royale:{matchId:'cup'},players:[{id:'me',health:0,contestant:true,spectating:true,eliminatedAt:1,place:3},{id:'winner',health:100,contestant:true}]};
  ui.update(state,'me',true,1000);ui.watch();assert.equal(ui.update(state,'me',true,1100).phase,'watching');state.phase='results';state.royale.winnerId='winner';const result=ui.update(state,'me',true,1200);assert.equal(result.phase,'placement');assert.equal(result.hold,false);assert.match(root.innerHTML,/RETURN TO LOBBY/);assert.ok(!root.innerHTML.includes('PLAY AGAIN'));
 }finally{globalThis.document=old;}
});
