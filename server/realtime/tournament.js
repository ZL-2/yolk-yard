import {randomUUID} from 'node:crypto';
import {VERSION} from '../../src/data.js';
import {RoyaleSimulation} from '../../src/royale.js';
import {ChatRoom} from '../../src/chat.js';
import {TOURNAMENT as EVENT,tournamentPhase,tournamentMessage} from '../../src/tournament.js';

// The result and prizes commit in one durable transaction. The same event can
// never restart or pay twice, including after a process restart.
export class TournamentService{
 constructor(relay,{now=Date.now,autoStart=true}={}){
  this.id=EVENT.id;this.relay=relay;this.now=now;this.db=relay.owner.db;this.key='tournament:'+EVENT.id;this.roster=new Map();
  this.state=this.db.meta(this.key,{phase:'scheduled'});this.entitled=this.db.meta('tournament-entitlements',{});
  if(this.state.phase==='running')this.complete('cancelled','The tournament was interrupted by a server restart. Normal matchmaking is open.');
  if(autoStart){this.tick();this.timer=setInterval(()=>this.tick(),250);this.timer.unref?.();}
 }
 get phase(){return tournamentPhase(this.now(),this.state);}
 get locked(){return ['preparing','entry','starting','running'].includes(this.phase);}
 assertNormal(target){if(this.locked&&(!target||target!==this.room?.key))throw Error(tournamentMessage);}
 summary(){const room=this.room,players=room?[...room.sim.players.values()]:[],phase=this.phase;return {...EVENT,phase,serverNow:this.now(),locked:this.locked,players:players.filter(p=>p.contestant&&!p.bot&&p.connected!==false).length,alive:room?.sim.alive||0,spectators:players.filter(p=>p.lateSpectator&&p.connected!==false).length,joinable:phase==='entry',spectatable:phase==='running',message:this.state.message||'',results:this.state.results||[]};}
 publish(){const event=this.summary();for(const u of this.relay.parties.users.values())this.relay.parties.send(u,{type:'tournament',event});}
 rewards(id){return {identity:id,owned:this.entitled[id]||[]};}
 syncRewards(id){const service=this.relay.parties;service.send(service.users.get(id),{type:'tournament-rewards',record:this.rewards(id)});}
 sanitize(profile,id){return profile?.pickaxe===EVENT.pickaxe&&!this.entitled[id]?.includes(EVENT.pickaxe)?{...profile,pickaxe:''}:profile;}
 lockdown(){
  this.cleared=true;const r=this.relay,p=r.parties;
  for(const party of p.parties.values())if(party.state==='queueing')p.cancel(party,tournamentMessage);
  for(const u of p.users.values()){p.send(u,{type:'owner-session-ended',message:tournamentMessage});u.inMatch=false;u.ready=false;delete u.matchPeer;delete u.joined;delete u.spectateLaunch;delete u.tournamentLaunch;}
  p.tickets.clear();
  for(const peer of [...r.peers.values()])r.remove(peer,1000,'Frontier Cup: return to the lobby');
  r.publicHost.rooms.clear();r.publicHost.members.clear();
  for(const party of p.parties.values()){party.state='idle';delete party.launch;p.sync(party);}
  r.owner.systemEvent('tournament-lock','Frontier Cup matchmaking lock began');
 }
 createRoom(){
  const r=this.relay,key=`yolk-yard-v${VERSION}-${EVENT.code}`;
  const hostPeer={id:key,token:randomUUID(),virtualRoom:true,ws:null,links:new Map(),pending:[],pendingBytes:0,seq:0,acked:0,clientSeq:0,history:[],historyBytes:0,lastSeen:this.now()};
  const sim=new RoyaleSimulation({session:'online',teamSize:1,teamFill:false,capacity:EVENT.capacity,bots:0,fill:false,recurring:false,building:true});
  sim.tournament=true;sim.startRound();sim.queueEnds=sim.time+Math.max(0,(EVENT.startsAt-this.now())/1000);
  const room={key,code:EVENT.code,tournament:true,sim,hostPeer,owner:null,visibility:'public',recurring:false,members:new Map(),encoders:new Map(),eventCursors:new Map(),kicked:new Set(),chat:new ChatRoom(),age:0,frameAt:0,progressAt:0,created:this.now()};
  this.room=room;r.authority.rooms.set(key,room);r.peers.set(key,hostPeer);r.authority.publish(room);
 }
 queue(u,{spectate=false}={}){
  this.tick();const phase=this.phase,p=this.relay.parties;
  this.relay.owner.assertAdmission(u.id,'royale','public');
  if(u.inMatch)throw Error('Return to the lobby before joining the tournament.');
  if(phase!=='entry'&&phase!=='running')throw Error(phase==='scheduled'||phase==='preparing'?'Tournament entry opens at 12:10 p.m. New York time.':'The tournament is over. Normal matchmaking is open.');
  const existing=this.roster.get(u.id),old=existing&&this.room.sim.players.get(existing.player);
  const reconnect=old&&!old.connected&&phase==='running';
  if(old?.connected)throw Error('This identity is already in the tournament.');
  const spectator=reconnect?!!old.spectating:!!(spectate||phase==='running');
  if(phase==='entry'&&spectator)throw Error('Spectating opens when the match starts.');
  const tickets=[...p.tickets.values()].filter(t=>t.tournament&&!t.peer&&t.expires>this.now()),players=[...this.room.sim.players.values()];
  if(!reconnect&&(spectator?players.filter(p=>p.lateSpectator).length+tickets.filter(t=>t.spectator).length>=EVENT.spectators:!reconnect&&players.filter(p=>p.contestant).length+tickets.filter(t=>!t.spectator).length>=EVENT.capacity))throw Error(spectator?'Tournament spectator seats are full. Try again shortly.':'The tournament is full. You can spectate when it starts.');
  if(u.ticket)p.tickets.delete(u.ticket);
  const token=randomUUID(),id=randomUUID(),launch={id,code:EVENT.code,options:this.room.sim.options,host:false,hostRun:false,serverAuthority:true,tournament:true,spectator,ticket:token,created:this.now()};
  p.tickets.set(token,{token,tournament:true,party:u.party,reservationId:id,member:u.id,code:EVENT.code,teamSize:1,teamFill:false,partySize:1,spectator,reconnect:reconnect?existing.player:null,expires:spectator||reconnect?this.now()+90000:EVENT.startsAt});
  u.ticket=token;u.tournamentLaunch=launch;p.send(u,{type:'launch',launch});return id;
 }
 claim(t,peer){
  if(!t?.tournament||!this.room||!['entry','running'].includes(this.phase))return false;
  if(!t.spectator&&!t.reconnect&&this.phase!=='entry')return false;
  const entry=this.roster.get(t.member),old=entry&&this.room.sim.players.get(entry.player);
  if(old?.connected&&this.room.members.get(old.id)!==peer)return false;
  if(t.reconnect&&(!old||old.connected))return false;
  return true;
 }
 admitted(peer,player,admission){
  this.relay.progression.bindPublicPlayer(peer,admission.memberId);
  if(!player.lateSpectator)this.roster.set(admission.memberId,{player:player.id,identity:admission.memberId,name:player.name,progressId:peer.progressId});
 }
 disconnected(room,player){
  if(room!==this.room||!player)return;
  if(this.phase==='running'&&player.contestant&&!player.eliminated){player.flight='ground';room.sim.damage(player,null,player.health+player.shield+1,'Disconnected');}
 }
 complete(phase,message='',results=[]){
  if(['finished','cancelled'].includes(this.state.phase))return;
  const next={phase,message,results,endedAt:this.now()},entitled=structuredClone(this.entitled);
  this.db.transaction(()=>{
   for(const result of results){const amount=EVENT.prizes[result.place-1];if(!amount)continue;
    this.db.run('INSERT OR IGNORE INTO grants VALUES(?,?,?,?,?)',`${EVENT.id}:${result.identity}`,result.identity,this.now(),amount,`Frontier Cup · place ${result.place}`);
    if(result.place===1)entitled[result.identity]=[...new Set([...(entitled[result.identity]||[]),EVENT.pickaxe])];
   }
   this.db.setMeta('tournament-entitlements',entitled);this.db.setMeta(this.key,next);
  });
  this.state=next;this.entitled=entitled;
  for(const result of results){const user=this.relay.parties.users.get(result.identity);this.relay.parties.send(user,{type:'owner-grants',record:this.relay.owner.grantSummary(result.identity)});this.syncRewards(result.identity);this.relay.parties.send(user,{type:'party-notice',message:`Frontier Cup: #${result.place} — ${EVENT.prizes[result.place-1].toLocaleString()} Marks${result.place===1?' and the Frontier Champion pickaxe':''}!`});}
  this.relay.owner.systemEvent('tournament-'+phase,message||'Frontier Cup completed; matchmaking reopened','',{results});this.publish();
 }
 tick(){
  try{
   const now=this.now();if(this.locked&&!this.cleared)this.lockdown();
   if(['preparing','entry'].includes(this.phase)&&!this.room)this.createRoom();
   if(this.room&&this.phase==='entry')this.room.sim.queueEnds=this.room.sim.time+(EVENT.startsAt-now)/1000;
   if(this.phase==='starting'){
    const players=this.room?[...this.room.sim.players.values()].filter(p=>p.contestant&&!p.bot&&p.connected!==false&&!p.loading):[];
    if(players.length<2)this.complete('cancelled','Fewer than two players were ready at the entry cutoff. Normal matchmaking is open.');
    else{
     for(const p of this.room.sim.players.values())if(p.loading){p.contestant=false;p.lateSpectator=true;p.spectating=true;p.health=0;}
     this.state={phase:'running',startedAt:now};this.db.setMeta(this.key,this.state);
     if(!this.room.sim.beginBattle('tournament'))this.complete('cancelled','The tournament could not start. Normal matchmaking is open.');
    }
   }
   if(this.phase==='running'&&this.room?.sim.phase==='results'){
    const sim=this.room.sim,entries=[...this.roster.values()].map(e=>({...e,p:sim.players.get(e.player),result:sim.placements.find(p=>p.id===e.player)})).filter(e=>e.p?.place>0||e.result?.place>0);
    // Deterministic simultaneous-elimination tiebreak: placement, survival,
    // eliminations, then stable identity. No bots or late spectators can win.
    entries.sort((a,b)=>(a.p?.place||a.result.place)-(b.p?.place||b.result.place)||(b.p?.eliminatedAt??Infinity)-(a.p?.eliminatedAt??Infinity)||(b.p?.kills||b.result?.kills||0)-(a.p?.kills||a.result?.kills||0)||a.identity.localeCompare(b.identity));
    const results=entries.slice(0,3).map((e,i)=>({identity:e.identity,name:e.name,place:i+1,marks:EVENT.prizes[i]}));
    this.complete('finished','Tournament complete. Normal matchmaking is open.',results);
   }
   if(this.phase==='running'&&now-EVENT.startsAt>30*60_000)this.complete('cancelled','The tournament exceeded its recovery deadline. Normal matchmaking is open.');
   if(!this.lastPublish||now-this.lastPublish>=1000){this.lastPublish=now;this.publish();}
   if(['finished','cancelled'].includes(this.phase)&&this.room&&now-this.state.endedAt>120000){const room=this.room;this.room=null;this.relay.authority.rooms.delete(room.key);for(const peer of [...room.members.values()]){this.relay.send(peer,{type:'authority-notice',event:'kicked'});this.relay.remove(peer);}this.relay.remove(room.hostPeer);}
  }catch(error){this.error=error.message;this.relay.owner.systemEvent('tournament-error',error.message);}
 }
 close(){clearInterval(this.timer);}
}
