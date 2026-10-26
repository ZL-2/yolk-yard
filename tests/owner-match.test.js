import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,until,pause} from './helpers/public-match.js';
import {ChatRoom,ChatInbox,chatPayload} from '../src/chat.js';
import {FILTER_VERSION} from '../src/moderation.js';
import {VERSION} from '../src/data.js';
import {TOURNAMENTS} from '../src/tournament.js';
const code='89271406539284756012';
async function setup(mode='royale'){
 const f=await fixture({serverOptions:{ownerCode:code}}),users=[],messages=new Map();
 for(const name of ['Owner Operator','Player Alpha','Player Bravo']){const u=await f.user(name);users.push(u);messages.set(u.id,[]);u.ws.on('message',raw=>messages.get(u.id).push(JSON.parse(raw)));await u.ask('select',{mode,access:'public'});await u.ask('queue');await f.game(u);}
 const base='http://127.0.0.1:'+f.app.server.address().port;let token;
 const post=async(path,body={},auth=true)=>{const r=await fetch(base+'/owner/'+path,{method:'POST',headers:{Origin:'https://zl-2.github.io','Content-Type':'text/plain'},body:JSON.stringify({...body,...(auth?{token}:{})})});return {status:r.status,data:await r.json()};};
 token=(await post('login',{code})).data.token;
 const context={code:f.games[0].net.code,matchId:f.games[0].sim.matchId};
 const action=(action,players=[],more={})=>post('match',{...context,action,players,requestId:randomUUID(),reason:'Observed repeated unfair play in this match.',...more});
 return {...f,users,messages,post,action,context};
}
test('slash commands never enter chat payloads, history, recipients, or lobby chat',async()=>{
 const state={options:{mode:'royale',teamSize:1},phase:'playing',players:[{id:'a',name:'Alpha'},{id:'b',name:'Bravo'}]},room=new ChatRoom(),inbox=new ChatInbox();
 for(const text of ['/'+code,'/unknown',' /anything']){const payload={version:FILTER_VERSION,channel:'room',text};assert.equal(chatPayload(payload),null);assert.equal(room.submit('a',payload,state,Date.now()).ok,false);assert.equal(inbox.accept({...payload,id:1,sender:'a'},state,'b'),null);}
 assert.equal(inbox.rows.length,0);assert.equal(room.sequence,0);
 const f=await fixture();try{const u=await f.user('Slash Test');await assert.rejects(u.ask('lobby-chat',{channel:'universal',text:'/'+code}),/Private commands/);const history=await u.ask('lobby-history',{channel:'universal'});assert.equal(history.messages.length,0);}finally{await f.close();}
});
test('owner match authorization, exact context, warning delivery, durable notices, safe retries, and mute enforcement',async()=>{
 const f=await setup();try{
  const [owner,a,b]=f.users,read=await f.post('match',f.context);assert.equal(read.status,200);assert.equal(read.data.roster.length,3);
  assert.equal((await f.post('match',f.context,false)).status,401);assert.equal((await f.post('replay',{id:'0'.repeat(32)},false)).status,401);
  assert.equal((await f.post('match',{...f.context,matchId:'stale'})).status,409);
  const requestId=randomUUID(),warn=await f.action('warn',[a.id],{requestId,reason:'Stop coordinating with opposing players.'});assert.equal(warn.status,200);
  assert.equal((await f.action('warn',[a.id],{requestId,reason:'Stop coordinating with opposing players.'})).status,200);
  assert.equal((await f.action('warn',[b.id],{requestId,reason:'Stop coordinating with opposing players.'})).status,409);
  await until(()=>f.messages.get(a.id).some(m=>m.type==='owner-match-status'&&m.status.notices.some(n=>n.kind==='warn')),'Target warned');assert.equal(f.messages.get(b.id).some(m=>m.type==='owner-match-status'&&m.status.notices.some(n=>n.kind==='warn')),false);
  const status=await a.ask('owner-match-status');assert.equal(status.notices.filter(n=>n.kind==='warn').length,1);const note=status.notices[0];await a.ask('owner-match-ack',{ids:[note.id]});assert.equal((await a.ask('owner-match-status')).notices.length,0);
  assert.equal((await f.action('mute',[a.id],{hours:1})).status,200);assert.ok((await a.ask('owner-match-status')).mute);const peer=f.app.relay.peers.get(f.games[1].net.peer.id);
  assert.equal(f.app.owner.match.chatAllowed(peer,{type:'chat-send'}),false);assert.equal(f.app.owner.match.chatAllowed(f.app.relay.peers.get(f.games[0].net.peer.id),{type:'chat-message',message:{sender:f.games[1].net.id}}),false,'Host cannot forward silenced text');
  assert.equal((await f.action('unmute',[a.id])).status,200);assert.equal(f.app.owner.match.chatAllowed(peer,{type:'chat-send'}),true);
  assert.equal((await f.action('announce',[],{reason:'Stay in the match; play continues normally.'})).status,200);await until(()=>f.users.every(u=>f.messages.get(u.id).some(m=>m.type==='owner-match-status'&&m.status.notices.some(n=>n.kind==='announce'))),'Announcement delivered to room');
  assert.equal((await f.action('warn',['not-in-room'])).status,400);assert.equal((await f.post('match',{...f.context})).data.history.filter(h=>h.action==='warn').length,1);
 }finally{await f.close();}
});
test('owner can impose and reverse the complete teaming penalty during a match without owner being host',async()=>{
 const f=await setup();try{
  const target=f.users[1],requestId=randomUUID();const result=await f.action('teaming',[target.id],{requestId,reason:'I observed repeated deliberate cooperation with an opponent.'});assert.equal(result.status,200,JSON.stringify(result.data));
  await until(()=>!f.app.relay.parties.users.get(target.id).inMatch,'Immediate removal');const status=await target.ask('fair-play-status');assert.ok(status.until>status.serverNow);assert.equal(status.cups.length,0);assert.throws(()=>f.app.owner.assertAdmission(target.id,'ffa','public'),/suspension/);
  const again=await f.action('teaming',[target.id],{requestId,reason:'I observed repeated deliberate cooperation with an opponent.'});assert.equal(again.status,200);assert.equal(f.app.relay.fairPlay.penalties(target.id).length,1);
  const view=(await f.post('match',f.context)).data;const c=view.cases.find(c=>c.players.some(p=>p.id===target.id));assert.equal(c.decision.automatic,false);assert.equal(view.roster.find(p=>p.id===target.id).present,false);
  const reversal=await f.action('reverse-teaming',[],{caseId:c.id,reason:'Review showed this was a mistaken removal.'});assert.equal(reversal.status,200,JSON.stringify(reversal.data));assert.doesNotThrow(()=>f.app.relay.fairPlay.assertPlay(target.id));assert.deepEqual(f.app.relay.fairPlay.status(target.id).cups,[]);
  await until(()=>f.messages.get(target.id).some(m=>m.type==='owner-match-status'&&m.status.notices.some(n=>n.kind==='reversal')),'Reversal explained to player');
 }finally{await f.close();}
});
test('timed owner suspension explains its end, blocks all modes, can be lifted, and rejects stale targets',async()=>{
 const f=await setup('ffa');try{const a=f.users[1];const r=await f.action('ban',[a.id],{hours:1,reason:'Repeated abuse after an owner warning.'});assert.equal(r.status,200,JSON.stringify(r.data));await until(()=>!f.app.relay.parties.users.get(a.id).inMatch,'Suspended player removed');
  const status=await a.ask('owner-match-status');assert.ok(status.ban.expires>status.serverNow);assert.ok(status.notices.some(n=>n.kind==='ban'&&n.expires));for(const mode of ['royale','ffa','zonewars','boxfight','zombies','training'])assert.throws(()=>f.app.owner.assertAdmission(a.id,mode,'private'),/suspended/);
  assert.equal((await f.action('kick',[a.id])).status,400);assert.equal((await f.action('unban',[a.id])).status,200);assert.doesNotThrow(()=>f.app.owner.assertPlayer(a.id));
 }finally{await f.close();}
});

test('owner ends a public room with notices and cannot apply a stale action to a replacement round',async()=>{
 const f=await setup('ffa');try{
  const saved={...f.context},requestId=randomUUID();const end=await f.action('end-match',[],{requestId,reason:'Ending this test room after a confirmed disruption.'});assert.equal(end.status,200,JSON.stringify(end.data));
  await until(()=>f.users.every(u=>!f.app.relay.parties.users.get(u.id).inMatch),'Room occupants removed');
  assert.ok(f.users.every(u=>f.messages.get(u.id).some(m=>m.type==='owner-session-ended'&&m.message.includes('Ending this test room'))));
  assert.equal((await f.action('end-match',[],{requestId,reason:'Ending this test room after a confirmed disruption.'})).status,200,'Retry returns the committed outcome');
  assert.equal((await f.post('match',{...saved,action:'warn',players:[f.users[1].id],reason:'Stale action must not follow a player.',requestId:randomUUID()})).status,400);
 }finally{await f.close();}
});
test('private match moderation follows authenticated roster and never logs the owner key',async()=>{
 const f=await fixture({serverOptions:{ownerCode:code}});try{const owner=await f.user('Private Owner'),guest=await f.user('Private Guest');await owner.ask('select',{mode:'ffa',access:'private',options:{fill:false,capacity:4}});await owner.ask('queue');const host=await f.game(owner);await guest.ask('queue',{code:host.net.code});await f.game(guest);
  const base='http://127.0.0.1:'+f.app.server.address().port;const post=async(path,body)=>{const r=await fetch(base+'/owner/'+path,{method:'POST',headers:{Origin:'https://zl-2.github.io','Content-Type':'text/plain'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  const login=await post('login',{code}),token=login.data.token,context={code:host.net.code,matchId:host.sim.matchId,token};const view=await post('match',context);assert.equal(view.status,200);assert.equal(view.data.roster.length,2);
  const mute=await post('match',{...context,action:'mute',players:[guest.id],hours:1,reason:'Temporary text restriction for repeated abuse.',requestId:randomUUID()});assert.equal(mute.status,200);const hp=f.app.relay.peers.get(host.net.peer.id);assert.equal(f.app.owner.match.chatAllowed(hp,{type:'chat-message',message:{sender:f.games[1].net.id}}),false);
  assert.equal(JSON.stringify(f.app.owner.db.all('SELECT * FROM events')).includes(code),false);assert.equal((await post('match',{...context,token:'0'.repeat(64)})).status,401);
 }finally{await f.close();}
});

test('suspended identity reconnects to durable notices and reversals while gameplay and chat stay blocked',async()=>{
 const f=await fixture(),clients=[];try{
  async function connect(token){const ws=new globalThis.WebSocket('ws://127.0.0.1:'+f.app.server.address().port+'/social'),messages=[];clients.push(ws);ws.on('message',raw=>messages.push(JSON.parse(raw)));ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:{name:'Reconnect Test'},token})));await until(()=>messages.some(m=>m.type==='party'),'Authenticated lobby connection');return {ws,messages,hello:messages.find(m=>m.type==='hello')};}
  const first=await connect(),id=first.hello.id,now=Date.now();f.app.owner.db.run('INSERT INTO sanctions VALUES(?,?,?,?,?,NULL,?)',randomUUID(),id,'ban',now,now+3600000,'Repeated disruption after an owner warning.');f.app.owner.match.notice(id,'reconnect-notice',{title:'Gameplay suspension',message:'All game modes suspended for one hour.',kind:'ban',expires:now+3600000});first.ws.close();
  const second=await connect(first.hello.token);assert.equal(second.hello.id,id);assert.ok(second.messages.some(m=>m.type==='owner-match-status'&&m.status.ban&&m.status.notices.some(n=>n.kind==='ban')));
  const u=f.app.relay.parties.users.get(id);assert.ok(f.app.relay.parties.command(u,{type:'owner-match-status'}).ban);assert.throws(()=>f.app.relay.parties.command(u,{type:'queue'}),/suspended/);assert.throws(()=>f.app.relay.parties.command(u,{type:'lobby-chat',text:'Cannot send this'}),/suspended/);
  f.app.owner.db.run('UPDATE sanctions SET revoked=? WHERE player=?',now+1,id);f.app.owner.match.sync(id);await until(()=>second.messages.some(m=>m.type==='owner-match-status'&&!m.status.ban),'Reversal reaches reconnected player');assert.doesNotThrow(()=>f.app.owner.assertPlayer(id));
 }finally{for(const ws of clients)ws.close();await f.close();}
});

test('in-Cup owner teaming removal disqualifies selected competitors, applies next Cup exclusion and preserves other rewards',async()=>{
 const E={...TOURNAMENTS[0],id:'manual-owner-cup',code:'OWNERCUP',opensAt:Date.now()+300000,lockAt:Date.now()+120000,startsAt:Date.now()+360000},next={...TOURNAMENTS[1],id:'next-owner-cup',code:'NEXTCUPP',opensAt:E.startsAt+7200000,lockAt:E.startsAt+7020000,startsAt:E.startsAt+7260000};let now=E.lockAt-1;
 const f=await fixture({serverOptions:{ownerCode:code,tournamentOptions:{events:[E,next],now:()=>now,autoStart:false}}});try{
  const service=f.app.relay.tournament,users=[];now=E.opensAt;service.tick();
  for(const name of ['Cup Owner','Cup Accused One','Cup Accused Two','Cup Fair Player']){const u=await f.user(name);users.push(u);await u.ask('tournament-join',{eventId:E.id});const g=await f.game(u);g.net.input({seq:1,dt:1/60,yaw:0,pitch:0});}
  const event=service.event(E.id),sim=event.room.sim;await until(()=>[...sim.players.values()].every(p=>!p.loading),'Cup players ready');now=E.startsAt;service.tick();assert.equal(event.phase,'running');
  const base='http://127.0.0.1:'+f.app.server.address().port;let token;const post=async(path,body)=>{const r=await fetch(base+'/owner/'+path,{method:'POST',headers:{Origin:'https://zl-2.github.io','Content-Type':'text/plain'},body:JSON.stringify({...body,token})});return {status:r.status,data:await r.json()};};token=(await post('login',{code})).data.token;
  const context={code:E.code,matchId:sim.matchId};assert.equal((await post('match',context)).data.cup,true);
  const removed=await post('match',{...context,action:'teaming',players:[users[1].id,users[2].id],reason:'Owner observed these opponents deliberately cooperating.',requestId:randomUUID()});assert.equal(removed.status,200,JSON.stringify(removed.data));
  for(const u of users.slice(1,3)){assert.equal(f.app.relay.parties.users.get(u.id).inMatch,false);assert.equal(f.app.relay.fairPlay.disqualified(u.id,E.id),true);assert.equal(f.app.relay.fairPlay.status(u.id).cups[0].id,next.id);}
  const survivor=sim.players.get(f.games[3].net.id);survivor.flight='ground';sim.damage(survivor,null,10000,'Disconnected');sim.finish();service.tick();
  assert.equal(event.phase,'finished');for(const u of users.slice(1,3))assert.equal(f.app.owner.grantSummary(u.id).marks,0);assert.equal(f.app.owner.grantSummary(users[0].id).marks,E.prizes[0]);
 }finally{await f.close();}
});
