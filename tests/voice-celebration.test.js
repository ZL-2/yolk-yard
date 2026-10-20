import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {VoiceService} from '../server/realtime/voice.js';
import {BoxFightSimulation} from '../src/box-fights.js';
import {ZoneWarsSimulation} from '../src/zone-wars.js';
import {preferredSpectator} from '../src/match-presentation.js';
import {celebrationTarget,canCelebrate} from '../src/celebration-state.js';
import {snapshotBuilds} from '../src/build-snapshot.js';
import {constructionTick} from '../src/building.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';

class Socket extends EventEmitter{constructor(){super();this.readyState=1;this.bufferedAmount=0;this.sent=[];}send(v){this.sent.push(v);}close(code,reason){this.readyState=3;this.code=code;this.reason=reason;this.emit('close');}ping(){}message(m){this.emit('message',Buffer.isBuffer(m)?m:Buffer.from(JSON.stringify(m)),Buffer.isBuffer(m));}}
function voiceFixture(){
 const blocks=new Set(),friends=new Map(),relay={peers:new Map(),parties:{store:{blocked:(a,b)=>blocks.has(a+':'+b)||blocks.has(b+':'+a),friends},limit:()=>{}},authority:{roomFor:()=>null},publicHost:{roomFor:()=>null}};
 const voice=new VoiceService(relay),host={id:'room',token:'host-proof',ws:new Socket(),listing:{mode:'boxfight',teamSize:2,boxFormat:'teams'},links:new Map()};relay.peers.set(host.id,host);
 function user(id,party='alpha',team=0){const peer={id,token:'proof-'+id,ws:new Socket(),links:new Map([['host',host]])},social=new Socket(),u={id,party,profile:{name:id},sessions:new Map([[social,{}]])};host.links.set(id,peer);relay.peers.set(id,peer);voice.contexts.set(social,{peer,user:u,at:Date.now()});const t=voice.command(u,{type:'voice-ticket'},social),ws=new Socket();voice.attach(ws);ws.message({type:'join',token:t.token,micMuted:false,codec:'opus'});return {u,peer,social,ws,session:voice.sessions.get(id),team};}
 function roster(users){voice.rosters.set(host.id,{host,owner:host,hostId:'host',at:Date.now(),rows:new Map(users.map(u=>[u.peer.id,{team:u.team,spectator:false}]))});voice.sync();}
 const frame=()=>{const data=Buffer.alloc(1286);data[0]=0;return data;};return {voice,relay,host,blocks,friends,user,roster,frame};
}
test('voice enforces party, assigned team, supported game modes, mute/block and departure on every packet',()=>{
 const f=voiceFixture();try{
  const a=f.user('Alice','partyA',0),b=f.user('Bobby','partyA',0),c=f.user('Casey','partyB',1);f.roster([a,b,c]);
  const received=p=>p.ws.sent.filter(Buffer.isBuffer).length;
  a.ws.message(f.frame());assert.equal(received(b),1);assert.equal(received(c),0);
  for(const p of [a,b,c])p.ws.message({type:'settings',channel:'game',micMuted:false,codec:'opus'});
  a.ws.message(f.frame());assert.equal(received(b),2);assert.equal(received(c),1);
  b.ws.message({type:'settings',channel:'game',micMuted:false,muted:[a.u.id],codec:'opus'});a.ws.message(f.frame());assert.equal(received(b),2);assert.ok(b.session.last.includes('Alice'),'muted player remains available to unmute');
  f.blocks.add('Alice:Casey');a.ws.message(f.frame());assert.equal(received(c),2,'block takes effect without waiting for roster refresh');
  f.blocks.clear();for(const p of [a,b,c])p.ws.message({type:'settings',channel:'team',micMuted:false,codec:'opus'});a.ws.message(f.frame());assert.equal(received(b),3);assert.equal(received(c),2);
  for(const mode of ['royale','zombies']){f.host.listing.mode=mode;f.voice.sync();assert.equal(f.voice.keys(a.session).game,null);}
  f.host.listing.mode='zonewars';f.voice.sync();assert.ok(f.voice.keys(a.session).game);
  f.host.listing.mode='ffa';f.voice.sync();assert.ok(f.voice.keys(a.session).game);assert.equal(f.voice.keys(a.session).team,null);
  a.ws.message({type:'settings',channel:'game',micMuted:false,codec:'opus'});b.ws.message({type:'settings',channel:'game',micMuted:false,codec:'opus'});
  a.peer.ws.close();a.ws.message(f.frame());assert.equal(received(b),3,'detached game socket loses room voice');
 }finally{f.voice.close();}
});
test('voice tickets are one use, proof cannot claim another peer, queues and audio are bounded',()=>{
 const f=voiceFixture();try{
  const a=f.user('Alice'),b=f.user('Bobby');f.roster([a,b]);
  const token=f.voice.command(a.u,{type:'voice-ticket'},a.social).token,ws=new Socket();f.voice.attach(ws);ws.message({type:'join',token});assert.equal(a.ws.code,4001);
  const replay=new Socket();f.voice.attach(replay);replay.message({type:'join',token});assert.equal(replay.code,1008);
  f.voice.command(b.u,{type:'voice-context',peer:a.peer.id,proof:'wrong'},b.social);assert.equal(f.voice.location(b.session),null);
  const s=f.voice.sessions.get('Alice');s.micMuted=false;b.ws.bufferedAmount=32768;ws.message(f.frame());assert.equal(b.ws.sent.filter(Buffer.isBuffer).length,0);
  ws.message(Buffer.alloc(5000));assert.equal(ws.code,1008);
 }finally{f.voice.close();}
});
test('public host aliases and server-owned squads use authenticated roster membership',()=>{
 const f=voiceFixture();try{
  const a=f.user('Alice','a',0),b=f.user('Bobby','b',0),c=f.user('Casey','c',1),room={key:f.host.id,host:{peer:a.peer.id,address:f.host.id},members:new Map([[a.peer.id,{id:'host'}],[b.peer.id,{id:b.peer.id}],[c.peer.id,{id:c.peer.id}]])};f.relay.publicHost.roomFor=()=>room;
  f.voice.command(a.u,{type:'voice-context',peer:a.peer.id,proof:a.peer.token,host:f.host.id,hostId:'host',roster:[{id:'host',team:0},{id:b.peer.id,team:0},{id:c.peer.id,team:1}]},a.social);f.voice.sync();
  assert.equal(f.voice.keys(a.session).game,f.voice.keys(b.session).game);assert.equal(f.voice.keys(a.session).team,f.voice.keys(b.session).team);assert.notEqual(f.voice.keys(a.session).team,f.voice.keys(c.session).team);
  a.ws.message({type:'settings',channel:'game',preferred:'game',micMuted:false});f.host.listing.mode='royale';f.voice.sync();assert.equal(a.session.channel,'party');f.host.listing.mode='zonewars';f.voice.sync();assert.equal(a.session.channel,'game','preferred game channel joins when a supported mode becomes available');
  f.relay.publicHost.roomFor=()=>null;f.host.listing.mode='zombies';const sim={players:new Map([[a.peer.id,{team:0,zSquad:'one'}],[b.peer.id,{team:0,zSquad:'one'}],[c.peer.id,{team:0,zSquad:'two'}]])};for(const p of [a,b,c])p.peer.authorityId=p.peer.id;f.relay.authority.roomFor=()=>({hostPeer:f.host,sim});f.voice.sync();
  assert.equal(f.voice.keys(a.session).game,null);assert.equal(f.voice.keys(a.session).team,f.voice.keys(b.session).team);assert.notEqual(f.voice.keys(a.session).team,f.voice.keys(c.session).team);
 }finally{f.voice.close();}
});
test('friends-only, nobody, deafen and cross-channel controls prevent audio forwarding',()=>{
 const f=voiceFixture();try{
  const a=f.user('Alice'),b=f.user('Bobby');f.roster([a,b]);const received=()=>b.ws.sent.filter(Buffer.isBuffer).length,send=()=>{a.session.tokens=8;a.ws.message(f.frame());};
  b.ws.message({type:'settings',access:'friends'});send();assert.equal(received(),0);f.friends.set(a.u.id,new Set([b.u.id]));f.friends.set(b.u.id,new Set([a.u.id]));send();assert.equal(received(),1);
  b.ws.message({type:'settings',access:'off'});send();assert.equal(received(),1);b.ws.message({type:'settings',access:'everybody',deafened:true});send();assert.equal(received(),1);
  b.ws.message({type:'settings',access:'everybody',deafened:false,channel:'game'});send();assert.equal(received(),1);a.ws.message({type:'settings',channel:'game',micMuted:false});send();assert.equal(received(),2);
 }finally{f.voice.close();}
});
for(const Type of [BoxFightSimulation,ZoneWarsSimulation])test(Type.name+' follows the killer, carries celebration to spectators and resets the next round',()=>{
 const s=new Type({bots:0,fill:false,teamSize:2,capacity:4}),a=s.addPlayer('a',{name:'Alpha'}),b=s.addPlayer('b',{name:'Bravo'}),c=s.addPlayer('c',{name:'Charlie'});s.startRound();s.boxEnd=s.time;s.tick(1/30);
 s.damage(a,b,1000,'needle');const state=s.snapshot();assert.equal(a.killerId,b.id);assert.equal(preferredSpectator(state,a.id),b.id);
 s.boxStage='fight';const winner=s.options.boxFormat==='ffa'?b.id:b.team;s.endBoxRound(winner);s.inputs.set(b.id,{fire:true,forward:1});s.playerAction(b.id,'emote-cheer');assert.equal(b.emote?.id,'cheer');
 const pos=[b.x,b.y,b.z];s.tick(1/30);assert.equal(b.emote.id,'cheer');assert.deepEqual([b.x,b.y,b.z],pos);assert.equal(celebrationTarget(s.snapshot(),a.id),b.id);
 const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();assert.equal(decoder.decode(encoder.encode({state:s.snapshot()}).frame).state.players.find(p=>p.id===b.id).emote.id,'cheer');
 s.completeBoxSeries(winner);s.playerAction(b.id,'emote-cancel');s.time+=1;s.playerAction(b.id,'emote-salute');assert.equal(b.emote.id,'salute');s.time+=5;s.tick(1/30);assert.equal(b.emote,null);
 s.phase='playing';s.beginBoxRound();assert.equal(b.emote,null);assert.equal(a.killerId,null);
});
test('static building snapshots are reused, isolated from mutations and invalidated for repairs and resets',()=>{
 const sim={builds:[{id:'wall',type:'wall',material:'wood',mask:0,path:[],health:150,maxHealth:150,constructionRemaining:0,repairRemaining:0}],worldDamage:{rock:{health:20}},buildVersion:1,round:1,matchId:'m',time:10};
 const first=snapshotBuilds(sim);assert.equal(first,snapshotBuilds(sim));constructionTick(sim);
 sim.builds[0].health=100;sim.builds[0].repairRemaining=50;sim.builds[0].constructionTick=10;sim.buildVersion++;constructionTick(sim);assert.ok(sim.builds[0].health>100);assert.equal(first.builds[0].health,150);assert.notEqual(snapshotBuilds(sim),first);
 const previous=snapshotBuilds(sim);sim.builds[0].path.push(2);sim.worldDamage.rock.health=5;sim.buildVersion++;const changed=snapshotBuilds(sim);assert.deepEqual(previous.builds[0].path,[]);assert.equal(previous.worldDamage.rock.health,20);assert.deepEqual(changed.builds[0].path,[2]);assert.equal(changed.worldDamage.rock.health,5);sim.round++;assert.notEqual(snapshotBuilds(sim),changed);const current=snapshotBuilds(sim);sim.builds=[];assert.notEqual(snapshotBuilds(sim),current);
});
test('Royale winning teammates and extracted operators can celebrate without changing active players cameras',()=>{
 const winner={id:'a',team:0,contestant:true,health:100},mate={id:'b',team:0,contestant:true,health:0,spectating:true},rival={id:'c',team:1,contestant:true,health:100},state={phase:'results',options:{mode:'royale',teamSize:2},royale:{winnerId:'a',winnerTeam:0},players:[winner,mate,rival]};
 assert.ok(canCelebrate(state,mate));assert.equal(canCelebrate(state,rival),false);assert.equal(celebrationTarget(state,rival.id),winner.id);
 const extracted={...mate,zExtracted:true},z={phase:'playing',options:{mode:'zombies'},zombies:{},players:[winner,extracted]};assert.ok(canCelebrate(z,extracted));assert.equal(celebrationTarget(z,winner.id),null);assert.equal(celebrationTarget(z,extracted.id),extracted.id);z.phase='results';assert.equal(celebrationTarget(z,winner.id),extracted.id);
});
