import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {VERSION,safeProfile} from '../src/data.js';
import {teammates} from '../src/teams.js';
import {socialMarkup,lobbyMarkup} from '../src/lobby-ui.js';
const wait=async(fn,label='Multiplayer timeout')=>{const end=Date.now()+12000;while(!fn()){assert.ok(Date.now()<end,label);await new Promise(r=>setTimeout(r,15));}};
test('the first private snapshot is discoverable for friend admission before two seconds of uptime',()=>{
 const savedClock=globalThis.performance,savedWindow=globalThis.window;globalThis.performance={now:()=>40};globalThis.window={YOLK_NETWORK:{relay:'ws://127.0.0.1/game'}};
 try{const sim=new Simulation();sim.addPlayer('host',{name:'Early Host'});let listing;const net=Object.assign(Object.create(Network.prototype),{isHost:true,id:'host',code:'ABCDEFGH',visibility:'private',connections:new Map(),members:[],callbacks:{getCheckpoint:()=>sim.checkpoint()},chatRoom:{sequence:0,members:new Map(),muted:new Set(),reports:new Set()},peer:{id:`yolk-yard-v${VERSION}-ABCDEFGH`,protocol:2,publish:r=>listing=r},kicked:new Set()});net.broadcast(sim.snapshot());assert.equal(listing.host,'Early Host');assert.equal(listing.public,false);assert.equal(listing.players,1);}finally{globalThis.performance=savedClock;globalThis.window=savedWindow;}
});
async function fixture(){
 const path=await mkdtemp(tmpdir()+'/ravel-private-');process.env.RAVEL_SOCIAL_DATA_PATH=path+'/social.json';
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),base=`ws://127.0.0.1:${app.server.address().port}`,users=[],games=[];
 app.relay.cpuQuota.snapshot=()=>({available:true,quotaCores:.5});
 globalThis.window={YOLK_NETWORK:{relay:base+'/game'}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 async function user(name){
  const u={profile:safeProfile({name}),launches:[],invites:[],pending:new Map(),serial:0},ws=new globalThis.WebSocket(base+'/social');u.ws=ws;users.push(u);
  ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:u.profile})));
  ws.on('error',()=>{});ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='hello')Object.assign(u,m);if(m.type==='party')u.party=m.party;if(m.type==='invite')u.invites.push(m.invite);if(m.type==='launch')u.launches.push(m.launch);if(m.type==='reply'){const r=u.pending.get(m.request);if(r){u.pending.delete(m.request);clearTimeout(r.timer);m.error?r.reject(Error(m.error)):r.resolve(m.result);}}});
  u.ask=(type,data={})=>new Promise((resolve,reject)=>{const request=++u.serial,timer=setTimeout(()=>reject(Error('No reply '+type)),10000);u.pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({type,...data,request}));});await wait(()=>u.party);return u;
 }
 async function invite(a,b){await a.ask('invite',{id:b.id});await wait(()=>b.invites.length);await b.ask('accept',{id:b.invites.at(-1).id});await wait(()=>a.party.members.some(m=>m.id===b.id));}
 async function launch(u){
  const l=u.launches.at(-1),g={state:null,sim:null,errors:[]};let net;
  const callbacks={onState:s=>g.state=s,onError:e=>g.errors.push(e),getCheckpoint:()=>g.sim?.checkpoint(),getState:()=>g.sim?.snapshot(),onJoin:(id,p,a)=>!!g.sim?.admitPlayer(id,p,a),onInput:(id,i)=>g.sim?.setInput(id,i,true),onPlayerAction:(id,a)=>g.sim?.playerAction(id,a),onRoster:ids=>g.sim?.setConnectedHumans?.(ids),onLeave:id=>g.sim?.leavePlayer(id),onHost:(checkpoint,departed)=>{g.sim=(checkpoint.options.mode==='royale'?new RoyaleSimulation(checkpoint.options):new Simulation(checkpoint.options)).restore(checkpoint);for(const id of departed)g.sim.leavePlayer(id);startClock();}};
  net=g.net=new Network(callbacks);games.push(g);
  function startClock(){clearInterval(g.clock);g.clock=setInterval(()=>{if(!net.isHost||!g.sim)return;for(let i=0;i<3;i++)g.sim.tick(1/60);g.state=g.sim.snapshot();net.broadcast(g.state);},50);}
  if(l.host){await net.host(l.code);if(l.hostRun){g.sim=l.options.mode==='royale'?new RoyaleSimulation(l.options):new Simulation(l.options);const h=g.sim.addPlayer('host',u.profile);g.sim.assignTeam?.(h,l.admission);g.sim.startRound();net.setVisibility('private');g.state=g.sim.snapshot();net.broadcast(g.state);startClock();}else await net.createAuthority(l.options,u.profile,l.visibility,l.ticket);await u.ask('host-ready',{id:l.id});}
  else await net.join(l.code,u.profile,l.ticket);
  await u.ask('joined',{id:l.id});await wait(()=>g.state);return g;
 }
 return {app,user,invite,launch,games,users,async close(){for(const g of games){clearInterval(g.clock);g.net.destroy();}for(const u of users)u.ws.close();await app.close();await rm(path,{recursive:true,force:true});}};
}

test('ready parties launch private host customs without server capacity; friends spectate without consuming contestant seats',async()=>{
 const f=await fixture();try{
  const a=await f.user('Custom Leader'),b=await f.user('Custom Mate'),c=await f.user('Watching Friend'),stranger=await f.user('Stranger');
  await f.invite(a,b);await b.ask('ready',{value:true});f.app.relay.authority.capacity.overloaded=true;
  await a.ask('queue',{custom:true,visibility:'public',options:{mode:'royale',teamSize:2,teamFill:false,capacity:8,bots:6,fill:true}});
  await wait(()=>a.launches.length);assert.equal(a.launches[0].hostRun,true);assert.equal(a.launches[0].visibility,'private');assert.equal(f.app.relay.authority.capacity.reservations.size,0);
  const host=await f.launch(a);await wait(()=>b.launches.length);const guest=await f.launch(b);await wait(()=>a.party.state==='playing'&&guest.state.players.length===8);
  assert.equal(host.net.serverAuthority,undefined);assert.equal(f.app.relay.authority.rooms.size,0);assert.equal(host.sim.players.get('host').team,host.sim.players.get(guest.net.id).team);
  await assert.rejects(stranger.ask('spectate-friend',{id:a.id}),/Only friends/);
  await c.ask('friend-send',{id:a.id});await a.ask('friend-accept',{id:c.id});const social=await c.ask('social');assert.ok(social.friends.find(p=>p.id===a.id).spectatable);assert.match(socialMarkup(c.party,c.id,social),/Spectate Friend/);
  await c.ask('spectate-friend',{id:a.id});await wait(()=>c.launches.length);const watcher=await f.launch(c);await wait(()=>watcher.state.players.find(p=>p.id===watcher.net.id)?.friendSpectator);
  const p=host.sim.players.get(watcher.net.id);assert.equal(p.health,0);assert.equal(p.contestant,false);assert.equal(p.spectating,true);assert.equal(p.watchId,'host');assert.equal(host.sim.players.size,9);assert.equal(host.sim.players.get('host').team,host.sim.players.get(guest.net.id).team);
  const bots=[...host.sim.players.values()].filter(p=>p.bot).length;
  watcher.net.send({type:'player-action',action:'rejoin'});watcher.net.send({type:'player-action',action:'inventory-drop-1'});watcher.net.input({seq:1,forward:1,fire:true,interact:true,dt:1/60});await new Promise(r=>setTimeout(r,120));assert.equal(p.health,0);assert.equal(p.spectating,true);assert.equal([...host.sim.players.values()].filter(p=>p.bot).length,bots);
  assert.ok(host.sim.beginBattle());assert.equal(host.sim.alive,8);assert.equal(p.contestant,false);assert.equal(p.team,-1);
  // Watchers remain spectators across rounds and cannot take over the host.
  host.sim.phase='results';host.sim.startRound();assert.equal(p.friendSpectator,true);assert.equal(p.contestant,false);
  host.net.broadcast(host.sim.snapshot());await wait(()=>guest.net.lastCheckpoint&&watcher.net.lastCheckpoint);host.net.destroy();clearInterval(host.clock);await wait(()=>guest.net.isHost);await wait(()=>!watcher.net.migrating);assert.equal(watcher.net.isHost,false);assert.ok(guest.sim.players.get(watcher.net.id).friendSpectator);
  assert.deepEqual(f.games.flatMap(g=>g.errors),[]);
 }finally{await f.close();}
});

test('public arena queues consolidate pending and running rooms until eight real seats are full',async()=>{
 for(const mode of ['ffa','teams']){const f=await fixture();try{
  const a=await f.user('Public One'),b=await f.user('Public Two');for(const u of [a,b])await u.ask('select',{mode});
  await a.ask('queue',{options:{mode,fill:true,bots:7}});await b.ask('queue',{options:{mode,fill:true,bots:7}});
  assert.equal(b.launches.length,0,'wait for the pending host');assert.equal(f.app.relay.parties.parties.get(b.party.id).launch.code,a.launches[0].code);
  const host=await f.launch(a);host.net.authorityCommand({type:'start'});await wait(()=>b.launches.length);await f.launch(b);assert.equal(f.app.relay.authority.rooms.size,1);
  for(let i=2;i<8;i++){const u=await f.user('Public '+i);await u.ask('select',{mode});await u.ask('queue',{options:{mode,fill:true,bots:7}});assert.equal(u.launches[0].code,a.launches[0].code);await f.launch(u);}
  const room=f.app.relay.authority.rooms.get(host.net.peer.id);assert.equal([...room.sim.players.values()].filter(p=>!p.bot).length,8);assert.equal([...room.sim.players.values()].filter(p=>p.bot).length,0);
  const next=await f.user('Public Nine');await next.ask('select',{mode});await next.ask('queue',{options:{mode,fill:true,bots:7}});assert.notEqual(next.launches[0].code,a.launches[0].code);await f.launch(next);assert.equal(f.app.relay.authority.rooms.size,2);
  // A spectator enters the full arena without displacing a real contestant.
  const viewer=await f.user('Arena Viewer');await viewer.ask('friend-send',{id:a.id});await a.ask('friend-accept',{id:viewer.id});await viewer.ask('spectate-friend',{id:a.id});const watch=await f.launch(viewer);const spectator=room.sim.players.get(watch.net.id);assert.ok(spectator.friendSpectator);assert.equal(room.sim.players.size,9);watch.net.send({type:'player-action',action:'respawn'});await new Promise(r=>setTimeout(r,100));assert.equal(spectator.health,0);
  room.sim.phase='results';room.restartAt=room.age;f.app.relay.authority.tick();assert.equal(room.sim.phase,'playing');assert.equal(spectator.spectating,true);assert.equal(spectator.awaitingEntry,false);
  assert.equal(f.app.relay.authority.capacity.pending(room.key,true),0);assert.equal(f.app.relay.authority.capacity.roundPlan(room).cost,98);
  const departed=f.games[1];departed.net.destroy();await b.ask('returned');await wait(()=>!room.sim.players.has(departed.net.id));
  const replacement=await f.user('Reused Seat');await replacement.ask('select',{mode});await replacement.ask('queue',{options:{mode,fill:true}});assert.equal(replacement.launches[0].code,a.launches[0].code,'returned tickets cannot hold an empty seat');await f.launch(replacement);
 }finally{await f.close();}}
});

test('private party arenas run combat on the host and public pending cancellations free every reservation',async()=>{
 for(const mode of ['ffa','teams']){const f=await fixture();try{
  const a=await f.user('Arena Captain'),b=await f.user('Arena Mate');await f.invite(a,b);await b.ask('ready',{value:true});
  await a.ask('queue',{custom:true,options:{mode,fill:true,bots:6}});const host=await f.launch(a);await wait(()=>b.launches.length);const guest=await f.launch(b);
  assert.equal(f.app.relay.authority.rooms.size,0);assert.equal(f.app.relay.authority.capacity.reservations.size,0);assert.equal(guest.state.visibility,'private');
  if(mode==='teams')assert.equal(host.sim.players.get('host').team,host.sim.players.get(guest.net.id).team);
  host.sim.playerAction('host','rejoin');guest.net.send({type:'player-action',action:'rejoin'});await wait(()=>host.sim.players.get(guest.net.id)?.health>0);const p=host.sim.players.get(guest.net.id),start={x:p.x,z:p.z};
  for(let i=1;i<=12;i++){guest.net.input({seq:i,forward:1,dt:1/60});await new Promise(r=>setTimeout(r,20));}assert.ok(Math.hypot(p.x-start.x,p.z-start.z)>.1,'host simulates remote movement');
 }finally{await f.close();}}
 const f=await fixture();try{
  const a=await f.user('Pending Creator'),b=await f.user('Pending Guest');for(const u of [a,b]){await u.ask('select',{mode:'ffa'});await u.ask('queue',{options:{fill:true}});}
  assert.equal(f.app.relay.authority.capacity.reservations.size,2);assert.equal(b.launches.length,0);await a.ask('cancel');await wait(()=>b.party.state==='idle');
  assert.equal(f.app.relay.parties.tickets.size,0);assert.equal(f.app.relay.authority.capacity.reservations.size,0);
 }finally{await f.close();}
});

test('Fill bot teammates are committed at departure; human Fill has priority and No Fill stays alone',()=>{
 for(const size of [2,4]){
  const sim=new RoyaleSimulation({capacity:12,teamSize:size,teamFill:true,fill:true,bots:11,seed:19});const h=sim.addPlayer('h',safeProfile({name:'Fill Host'}));sim.startRound();
  assert.equal([...sim.players.values()].filter(p=>p.bot&&teammates(sim.options,h,p)).length,0);
  const solo=sim.admitPlayer('solo',safeProfile({name:'No Fill'}),{partyId:'solo',partySize:1,teamSize:size,teamFill:false});
  const fill=size===4?sim.admitPlayer('f',safeProfile({name:'Human Fill'}),{partyId:'f',partySize:1,teamSize:size,teamFill:true}):null;
  if(fill)assert.equal(fill.team,h.team);const count=sim.players.size;assert.ok(sim.beginBattle());assert.equal(sim.players.size,count);
  const mates=[...sim.players.values()].filter(p=>teammates(sim.options,h,p));assert.equal(mates.length,size-1);assert.equal(mates.filter(p=>p.bot).length,size-(fill?2:1));assert.equal([...sim.players.values()].filter(p=>teammates(sim.options,solo,p)).length,0);
  const slots=[h,...mates].map(p=>p.teamSlot);assert.equal(new Set(slots).size,size);assert.ok(mates.every(p=>Math.abs(p.botDrop-h.botDrop)<1||!p.bot));
  const restored=new RoyaleSimulation().restore(sim.checkpoint());assert.equal([...restored.players.values()].filter(p=>teammates(restored.options,restored.players.get('h'),p)).length,size-1);
 }
 const html=lobbyMarkup({profile:safeProfile({name:'Player'}),party:null,id:'me',online:true,balance:0});assert.match(html,/aria-label="Settings">⚙ <span>SETTINGS<\/span>/);assert.match(html,/CUSTOM PRIVATE MATCH/);
});
