import {randomUUID,randomInt} from 'node:crypto';
import {VERSION} from '../../src/data.js';
import {RoyaleSimulation} from '../../src/royale.js';
import {ChatRoom} from '../../src/chat.js';
import {TOURNAMENT,TOURNAMENTS,tournamentPhase,eventAnnouncement,eventTime,visibleTournament,tournamentTeamSize,tournamentName,tournamentMode} from '../../src/tournament.js';
import {livingTeams} from '../../src/teams.js';
import {validateTournament,TOURNAMENT_RULE_FIELDS} from '../../src/tournament-schedule.js';

// The result and prizes commit in one durable transaction. The same event can
// never restart or pay twice, including after a process restart.
class TournamentEvent{
 constructor(relay,{now=Date.now,event=TOURNAMENT,onPublish=()=>{}}={}){
  this.event={...event,teamSize:tournamentTeamSize(event),mode:tournamentMode(event)};this.entryTeams=new Map();this.id=event.id;this.relay=relay;this.now=now;this.db=relay.owner.db;this.key='tournament:'+event.id;this.roster=new Map();this.onPublish=onPublish;
  this.state=this.db.meta(this.key,{phase:'scheduled'});this.entitled=this.db.meta('tournament-entitlements',{});
  if(this.state.phase==='running')this.complete('cancelled','The tournament was interrupted by a server restart. Normal matchmaking is open.');
 }
 get phase(){return this.event.removed?'cancelled':tournamentPhase(this.now(),this.state,this.event);}
 get locked(){return ['preparing','entry','starting','running'].includes(this.phase);}
 assertNormal(target){if(this.locked&&(!target||target!==this.room?.key))throw Error(eventAnnouncement(this.event));}
 standings(){
  const sim=this.room?.sim,teamCup=tournamentTeamSize(this.event)>1;
  const aliveTeams=sim?livingTeams(sim.options,sim.players.values()):new Set();
  return [...this.roster.values()].filter(e=>sim?.players.get(e.player)?.contestant&&!this.relay.fairPlay?.disqualified(e.identity,this.id)).map(e=>{const p=sim.players.get(e.player);return {identity:e.identity,name:e.name,team:p.team,place:p.place||null,kills:p.kills||0,alive:!p.eliminated&&p.health>0,teamAlive:teamCup&&aliveTeams.has(p.team),connected:p.connected!==false};}).sort((a,b)=>Number(b.alive||b.teamAlive)-Number(a.alive||a.teamAlive)||(a.place||Infinity)-(b.place||Infinity)||(teamCup?a.team-b.team:0)||b.kills-a.kills||a.name.localeCompare(b.name));
 }
 summary(){const room=this.room,players=room?[...room.sim.players.values()]:[],phase=this.phase;return {...this.event,name:tournamentName(this.event),phase,serverNow:this.now(),locked:this.locked,players:players.filter(p=>p.contestant&&!p.bot&&p.connected!==false).length,alive:room?.sim.alive||0,spectatorCapacity:this.event.spectators,spectators:players.filter(p=>p.lateSpectator&&p.connected!==false).length,joinable:phase==='entry',spectatable:phase==='running',message:this.state.message||'',endedAt:this.state.endedAt||null,startedAt:this.state.startedAt||null,standingsComplete:!!this.state.standingsComplete,results:this.state.results||[],standings:phase==='running'?this.standings():[]};}
 publish(){this.onPublish();}
 rewards(id){return {identity:id,owned:this.db.meta('tournament-entitlements',{})[id]||[]};}
 syncRewards(id){const service=this.relay.parties;service.send(service.users.get(id),{type:'tournament-rewards',record:this.rewards(id)});}
 sanitize(profile,id){return profile?.pickaxe===this.event.pickaxe&&!this.rewards(id).owned.includes(this.event.pickaxe)?{...profile,pickaxe:''}:profile;}
 lockdown(){
  this.cleared=true;const r=this.relay,p=r.parties,tournamentMessage=eventAnnouncement(this.event);
  for(const party of p.parties.values())if(party.state==='queueing')p.cancel(party,tournamentMessage);
  for(const u of p.users.values()){p.send(u,{type:'owner-session-ended',message:tournamentMessage});u.inMatch=false;u.ready=false;delete u.matchPeer;delete u.joined;delete u.spectateLaunch;delete u.tournamentLaunch;}
  p.tickets.clear();
  for(const peer of [...r.peers.values()])r.remove(peer,1000,'Frontier Cup: return to the lobby');
  r.publicHost.rooms.clear();r.publicHost.members.clear();
  for(const party of p.parties.values()){party.state='idle';delete party.launch;p.sync(party);}
  r.owner.systemEvent('tournament-lock','Frontier Cup matchmaking lock began');
 }
 createRoom(){
  const EVENT=this.event,r=this.relay,key=`yolk-yard-v${VERSION}-${EVENT.code}`;
  const hostPeer={id:key,token:randomUUID(),virtualRoom:true,ws:null,links:new Map(),pending:[],pendingBytes:0,seq:0,acked:0,clientSeq:0,history:[],historyBytes:0,lastSeen:this.now()};
  const sim=new RoyaleSimulation({session:'online',teamSize:tournamentTeamSize(EVENT),teamFill:false,capacity:EVENT.capacity,bots:0,fill:false,recurring:false,building:true});
  sim.tournament=true;sim.startRound();sim.queueEnds=sim.time+Math.max(0,(EVENT.startsAt-this.now())/1000);
  const room={key,code:EVENT.code,tournament:true,eventId:this.id,eventName:EVENT.name,sim,hostPeer,owner:null,visibility:'public',recurring:false,members:new Map(),encoders:new Map(),eventCursors:new Map(),kicked:new Set(),chat:new ChatRoom(),age:0,frameAt:0,progressAt:0,created:this.now()};
  this.room=room;r.authority.rooms.set(key,room);r.peers.set(key,hostPeer);r.authority.publish(room);
 }
 queue(u,{spectate=false}={}){
  this.tick();const EVENT=this.event,phase=this.phase,p=this.relay.parties,size=tournamentTeamSize(EVENT);
  this.relay.owner.assertAdmission(u.id,'royale','public');this.relay.fairPlay?.assertCup(u.id,this.id);
  if(u.inMatch)throw Error('Return to the lobby before joining the tournament.');
  if(phase!=='entry'&&phase!=='running')throw Error(phase==='scheduled'||phase==='preparing'?`Tournament entry opens at ${eventTime(EVENT.opensAt)} New York time.`:'The tournament is over. Normal matchmaking is open.');
  const existing=this.roster.get(u.id),old=existing&&this.room.sim.players.get(existing.player);
  const reconnect=old&&!old.connected&&phase==='running';
  if(old?.connected)throw Error('This identity is already in the tournament.');
  const spectator=reconnect?!!old.spectating:!!(spectate||phase==='running');
  if(phase==='entry'&&spectator)throw Error('Spectating opens when the match starts.');
  const party=p.parties.get(u.party),ids=size>1?party?.members||[u.id]:[u.id];
  // A retry keeps its original team, but must still respect the current lobby limit.
  if(!spectator&&!reconnect&&ids.length>size)throw Error(`Your party has ${ids.length} players. ${tournamentName(EVENT)} allows at most ${size} players per team. Leave this party or ask ${ids.length-size} ${ids.length-size===1?'player':'players'} to leave, then try again. Smaller parties can enter; empty slots stay empty.`);
  let group=this.entryTeams.get(u.id),members=[u];
  if(!spectator&&!reconnect&&group&&ids.some(id=>!group.members.includes(id)))throw Error('Your tournament team is already entered. Rejoin the lobby party you entered with before retrying. New party members cannot be added to this entry.');
  if(!spectator&&!reconnect&&!group){
   if(size>1&&ids.length>1&&party.leader!==u.id)throw Error('Your party leader must enter the team into this tournament. Join the same lobby party as your chosen teammates first, then ask the leader to select JOIN TOURNAMENT.');
   members=ids.map(id=>p.users.get(id));
   for(const member of members){
    if(!member||!p.connected(member)||member.inMatch)throw Error('Every party member must be online and in the lobby before entering.');
    if(this.entryTeams.has(member.id))throw Error('A party member already has a tournament team. They must rejoin their original entry.');
    this.relay.owner.assertAdmission(member.id,'royale','public');this.relay.fairPlay?.assertCup(member.id,this.id);
   }
   group={id:randomUUID(),members:members.map(m=>m.id)};
  }
  // Retries retain the original roster and team, even after lobby party changes.
  const pending=[...p.tickets.values()].filter(t=>t.tournament&&t.eventId===this.id&&!t.peer&&t.expires>this.now()&&!members.some(m=>m.id===t.member));
  const players=[...this.room.sim.players.values()];
  if(!reconnect&&(spectator?players.filter(p=>p.lateSpectator).length+pending.filter(t=>t.spectator).length+1>EVENT.spectators:this.entryTeams.size+members.filter(m=>!this.entryTeams.has(m.id)).length>EVENT.capacity))throw Error(spectator?'Tournament spectator seats are full. Try again shortly.':'The tournament does not have enough seats for your party. You can spectate when it starts.');
  const launches=[];
  for(const member of members){
   if(member.ticket)p.tickets.delete(member.ticket);
   const token=randomUUID(),id=randomUUID(),reservation=group?.id||id;
   const launch={id,code:EVENT.code,options:this.room.sim.options,host:false,hostRun:false,serverAuthority:true,tournament:true,spectator,ticket:token,created:this.now()};
   p.tickets.set(token,{token,tournament:true,eventId:this.id,party:member.party,reservationId:reservation,member:member.id,code:EVENT.code,teamSize:size,teamFill:false,partySize:group?.members.length||1,spectator,reconnect:reconnect?existing.player:null,expires:spectator||reconnect?this.now()+90000:EVENT.startsAt});
   if(!spectator&&!reconnect)this.entryTeams.set(member.id,group);
   member.ticket=token;member.tournamentLaunch=launch;launches.push([member,launch]);
  }
  for(const [member,launch]of launches)p.send(member,{type:'launch',launch});return u.tournamentLaunch.id;
 }
 claim(t,peer){
  if(!t?.tournament||!this.room||!['entry','running'].includes(this.phase))return false;
  try{this.relay.fairPlay?.assertCup(t.member,this.id);}catch{return false;}
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
  const EVENT=this.event,entitled=this.db.meta('tournament-entitlements',{});
  const awarded=results.filter(r=>!this.relay.fairPlay?.disqualified(r.identity,this.id)).map(r=>{const bonusMarks=r.place===1&&EVENT.pickaxe&&entitled[r.identity]?.includes(EVENT.pickaxe)?EVENT.duplicateReward||0:0;return {...r,marks:(EVENT.prizes[r.place-1]||0)+bonusMarks,bonusMarks,pickaxeAwarded:r.place===1&&!bonusMarks?EVENT.pickaxe:null};});
  const next={phase,message,results:awarded,endedAt:this.now(),startedAt:this.state.startedAt||null,standingsComplete:true};
  this.db.transaction(()=>{
   for(const result of awarded){const amount=result.marks;
    if(amount)this.db.run('INSERT OR IGNORE INTO grants VALUES(?,?,?,?,?)',`${EVENT.id}:${result.identity}`,result.identity,this.now(),amount,`${tournamentName(EVENT)} · place ${result.place}`);
    if(result.place===1&&EVENT.pickaxe)entitled[result.identity]=[...new Set([...(entitled[result.identity]||[]),EVENT.pickaxe])];
   }
   this.db.setMeta('tournament-entitlements',entitled);this.db.setMeta(this.key,next);
  });
  this.state=next;this.entitled=entitled;
  for(const result of awarded){const user=this.relay.parties.users.get(result.identity);this.relay.parties.send(user,{type:'owner-grants',record:this.relay.owner.grantSummary(result.identity)});this.syncRewards(result.identity);this.relay.parties.send(user,{type:'party-notice',message:`${tournamentName(EVENT)}: #${result.place} — ${result.marks.toLocaleString()} Marks${result.pickaxeAwarded?' and the Frontier Champion pickaxe':result.bonusMarks?' (includes '+result.bonusMarks.toLocaleString()+' repeat-winner bonus)':''}!`});}
  this.relay.owner.systemEvent('tournament-'+phase,message||'Frontier Cup completed; matchmaking reopened','',{results});this.publish();
 }
 tick(){
  try{
   const EVENT=this.event,now=this.now();
   if(this.phase==='starting'&&!this.room){this.complete('cancelled','The entry window was missed while the server was unavailable. Normal matchmaking is open.');return;}
   if(this.locked&&!this.cleared)this.lockdown();
   if(['preparing','entry'].includes(this.phase)&&!this.room)this.createRoom();
   if(this.room&&this.phase==='entry')this.room.sim.queueEnds=this.room.sim.time+(EVENT.startsAt-now)/1000;
   if(this.phase==='starting'){
    const players=this.room?[...this.room.sim.players.values()].filter(p=>p.contestant&&!p.bot&&p.connected!==false&&!p.loading):[];
    if(players.length<2||tournamentTeamSize(EVENT)>1&&livingTeams(this.room.sim.options,players).size<2)this.complete('cancelled','Fewer than two opposing players or teams were ready at the entry cutoff. Normal matchmaking is open.');
    else{
     for(const p of this.room.sim.players.values())if(p.loading){p.contestant=false;p.lateSpectator=true;p.spectating=true;p.health=0;}
     this.state={phase:'running',startedAt:now};this.db.setMeta(this.key,this.state);
     if(!this.room.sim.beginBattle('tournament'))this.complete('cancelled','The tournament could not start. Normal matchmaking is open.');
    }
   }
   if(this.phase==='running'&&this.room?.sim.phase==='results'){
    const sim=this.room.sim,entries=[...this.roster.values()].map(e=>({...e,p:sim.players.get(e.player),result:sim.placements.find(p=>p.id===e.player)})).filter(e=>e.p?.place>0||e.result?.place>0);
    // Rank complete teams as a unit; every member receives the team's place.
    // Simultaneous team eliminations use last survival, total eliminations, then identity.
    const teamCup=tournamentTeamSize(EVENT)>1,groups=new Map();
    for(const e of entries.filter(e=>!this.relay.fairPlay?.disqualified(e.identity,this.id))){const key=teamCup?(e.p?.team??e.result.team):e.identity;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
    const rank=members=>({place:Math.min(...members.map(e=>e.p?.place||e.result.place)),survival:Math.max(...members.map(e=>e.p?.eliminatedAt??Infinity)),kills:members.reduce((n,e)=>n+(e.p?.kills||e.result?.kills||0),0),identity:members.map(e=>e.identity).sort()[0]});
    const teams=[...groups.values()].map(members=>({members,...rank(members)})).sort((a,b)=>a.place-b.place||b.survival-a.survival||b.kills-a.kills||a.identity.localeCompare(b.identity));
    const results=teams.flatMap((team,i)=>team.members.sort((a,b)=>a.identity.localeCompare(b.identity)).map(e=>({identity:e.identity,name:e.name,team:e.p?.team??e.result?.team,place:i+1,kills:e.p?.kills||e.result?.kills||0,marks:EVENT.prizes[i]||0})));
    this.complete('finished','Tournament complete. Normal matchmaking is open.',results);
   }
   if(this.phase==='running'&&now-EVENT.startsAt>30*60_000)this.complete('cancelled','The tournament exceeded its recovery deadline. Normal matchmaking is open.');
   if(!this.lastPublish||now-this.lastPublish>=1000){this.lastPublish=now;this.publish();}
   if(['finished','cancelled'].includes(this.phase)&&this.room&&now-this.state.endedAt>120000){const room=this.room;this.room=null;this.relay.authority.rooms.delete(room.key);for(const peer of [...room.members.values()]){this.relay.send(peer,{type:'authority-notice',event:'kicked'});this.relay.remove(peer);}this.relay.remove(room.hostPeer);}
  }catch(error){this.error=error.message;this.relay.owner.systemEvent('tournament-error',error.message);}
 }
 close(){clearInterval(this.timer);}
 releaseRoom(message){
  const room=this.room;if(!room)return;this.room=null;const r=this.relay;r.authority.rooms.delete(room.key);
  for(const [token,t]of r.parties.tickets)if(t.eventId===this.id)r.parties.tickets.delete(token);
  for(const u of r.parties.users.values())if(u.tournamentLaunch?.code===this.event.code){r.parties.send(u,{type:'owner-session-ended',message});u.inMatch=false;u.ready=false;delete u.matchPeer;delete u.tournamentLaunch;delete u.ticket;delete u.joined;const party=r.parties.parties.get(u.party);if(party){party.state='idle';delete party.launch;r.parties.sync(party);}}
  for(const peer of [...room.members.values()]){r.send(peer,{type:'authority-notice',event:'kicked'});r.remove(peer);}r.remove(room.hostPeer);
 }
}

// Each dated event has independent durable results and idempotent reward keys.
export class TournamentService{
 constructor(relay,{now=Date.now,autoStart=true,events=TOURNAMENTS}={}){
  this.relay=relay;this.now=now;this.db=relay.owner.db;
  this.catalog=this.db.meta('tournament-schedule',{revision:0,events:events.map(e=>({...e}))});
  this.events=this.catalog.events.map(event=>new TournamentEvent(relay,{event,now:()=>this.now(),onPublish:()=>this.publish()}));
  // One-time owner-requested correction to the saved October 26 Solo Cup.
  // Keep other events, completed results and subsequent manual edits intact.
  const correction='tournament-capacity-oct26-48-v1';
  if(this.db.meta('tournament-schedule')&&!this.db.meta(correction)){
   const target=this.event('frontier-cup-2026-10-26');
   const apply=target?.phase==='scheduled'&&!target.event.removed&&tournamentTeamSize(target.event)===1&&target.event.capacity===23;
   const catalog=apply?{...this.catalog,revision:this.catalog.revision+1,events:this.catalog.events.map(e=>e.id===target.id?{...e,capacity:48}:e)}:this.catalog;
   this.db.transaction(()=>{
    if(apply){this.db.setMeta('tournament-schedule',catalog);this.relay.owner.systemEvent('tournament-capacity-corrected','Owner requested 48 competitor seats for the October 26 Solo Cup.',target.id,{before:23,after:48});}
    this.db.setMeta(correction,{at:this.now(),applied:!!apply});
   });
   if(apply){this.catalog=catalog;target.event={...target.event,capacity:48};}
  }
  if(autoStart){this.tick();this.timer=setInterval(()=>this.tick(),250);this.timer.unref?.();}
 }
 get active(){return this.events.find(e=>e.locked)||this.events.find(e=>!['finished','cancelled'].includes(e.phase))||this.events.at(-1);}
 get id(){return this.active.id;} get room(){return this.active.room;} get phase(){return this.active.phase;} get state(){return this.active.state;} get roster(){return this.active.roster;} get locked(){return this.events.some(e=>e.locked);}
 event(id){return this.events.find(e=>e.id===id)||null;}
 summary(){const events=this.events.filter(e=>!e.event.removed).map(e=>e.summary()),focus=visibleTournament(events,this.now())||events.find(e=>e.phase==='scheduled')||events.at(-1);return {...focus,serverNow:this.now(),locked:this.locked,events,scheduleRevision:this.catalog.revision};}
 overview(){return {revision:this.catalog.revision,serverNow:this.now(),events:this.events.map(e=>({...e.summary(),definition:{...e.event,description:e.event.description||''}}))};}
 career(identity){
  const results=this.events.filter(e=>e.state.phase==='finished').flatMap(e=>{const r=e.state.results?.find(r=>r.identity===identity);if(!r)return [];
   const paid=this.db.get('SELECT amount FROM grants WHERE id=? AND player=?',e.id+':'+identity,identity);
   return [{id:e.id,name:tournamentName(e.event),at:e.state.endedAt||e.event.startsAt,place:r.place,kills:Number.isFinite(r.kills)?r.kills:null,marks:paid?.amount||0,bonusMarks:r.bonusMarks||0,pickaxe:r.pickaxeAwarded||null,complete:!!e.state.standingsComplete}];
  }).sort((a,b)=>b.at-a.at);
  const known=results.filter(r=>r.kills!==null);
  return {identity,at:this.now(),results,stats:{events:results.length,wins:results.filter(r=>r.place===1).length,podiums:results.filter(r=>r.place<=3).length,top10:results.filter(r=>r.place<=10).length,best:results.length?Math.min(...results.map(r=>r.place)):null,average:results.length?results.reduce((n,r)=>n+r.place,0)/results.length:null,marks:results.reduce((n,r)=>n+r.marks,0),bonusMarks:results.reduce((n,r)=>n+r.bonusMarks,0),kills:known.reduce((n,r)=>n+r.kills,0),killsRecorded:known.length}};
 }
 manage(body,audit){
  if(body.revision!==this.catalog.revision)throw Object.assign(Error('The schedule changed in another session. Refresh before saving.'),{status:409});
  const existing=body.eventId?this.event(body.eventId):null,before=existing?.event||null;
  if(body.eventId&&!existing)throw Error('Tournament not found.');
  let next,cancelState;
  if(body.action==='tournament-save'){
   if(existing?.event.removed)throw Error('This event was removed. Duplicate it to schedule a new event.');
   const id=existing?.id||'cup-'+randomUUID();let code=existing?.event.code;
   if(!code)do{code=Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');}while(this.events.some(e=>e.event.code===code)||this.relay.peers.has(`yolk-yard-v${VERSION}-${code}`));
   const frozen=existing&&existing.phase!=='scheduled';
   next=validateTournament(body.event,{id,code,...(!frozen?{now:this.now()}:{})});
   if(frozen&&TOURNAMENT_RULE_FIELDS.some(k=>JSON.stringify(next[k])!==JSON.stringify(k==='teamSize'?tournamentTeamSize(before):before[k])))throw Error('Team size, dates, seats and rewards are locked after matchmaking closes. Cancel an active event or duplicate a past event; saved results cannot be rewritten.');
   if(!frozen)for(const other of this.events){if(other===existing||other.event.removed||['finished','cancelled'].includes(other.phase))continue;const e=other.event;if(next.lockAt<e.startsAt+32*60000&&next.startsAt+32*60000>e.lockAt)throw Error('This overlaps '+e.name+'. Reserve 32 minutes after its start for the match and room cleanup.');}
  }else if(body.action==='tournament-cancel'){
   if(!existing||['finished','cancelled'].includes(existing.phase))throw Error('Only an upcoming or active event can be cancelled.');
   // If the simulation already decided the result, let the normal result writer
   // commit it instead of allowing a last-millisecond cancellation to erase it.
   if(existing.room?.sim.phase==='results')throw Error('This match has completed. Refresh to see its durable result.');
   next={...before};cancelState={phase:'cancelled',message:`${before.name} cancelled by the owner: ${String(body.reason).slice(0,300)}. Normal matchmaking is open.`,endedAt:this.now(),startedAt:existing.state.startedAt||null,results:[],standingsComplete:true};
  }else if(body.action==='tournament-remove'){
   if(!existing||existing.locked)throw Error('Cancel the active tournament before removing it from Compete.');
   next={...before,removed:true};
   if(existing.phase==='scheduled')cancelState={phase:'cancelled',message:'Removed from the schedule by the owner.',endedAt:this.now(),results:[],standingsComplete:true};
  }else throw Error('Unknown tournament action.');
  const events=existing?this.catalog.events.map(e=>e.id===next.id?next:e):[...this.catalog.events,next];events.sort((a,b)=>a.opensAt-b.opensAt);
  const catalog={revision:this.catalog.revision+1,events},result={ok:true,eventId:next.id,revision:catalog.revision};
  this.db.transaction(()=>{this.db.setMeta('tournament-schedule',catalog);if(cancelState)this.db.setMeta(existing.key,cancelState);audit(result,before,next);});
  this.catalog=catalog;
  if(existing){existing.event=next;if(cancelState){existing.state=cancelState;existing.releaseRoom(cancelState.message);}}
  else this.events.push(new TournamentEvent(this.relay,{event:next,now:()=>this.now(),onPublish:()=>this.publish()}));
  this.events.sort((a,b)=>a.event.opensAt-b.event.opensAt);this.relay.fairPlay?.reconcileSchedule();this.lastKey=null;this.publish();return result;
 }
 publish(){if(!this.events)return;const event=this.summary(),key=JSON.stringify({...event,serverNow:0,events:event.events.map(e=>({...e,serverNow:0}))});if(key===this.lastKey&&this.now()-(this.lastPublish||0)<15000)return;this.lastKey=key;this.lastPublish=this.now();for(const u of this.relay.parties.users.values())this.relay.parties.send(u,{type:'tournament',event});}
 assertNormal(target){for(const e of this.events)e.assertNormal(target);}
 queue(u,options={}){const e=options.eventId?this.event(options.eventId):this.active;if(!e||e.event.removed)throw Error('Tournament not found.');return e.queue(u,options);}
 claim(t,peer){return (this.event(t?.eventId)||this.active).claim(t,peer);}
 admitted(peer,player,admission){return (this.event(admission.eventId)||this.active).admitted(peer,player,admission);}
 disconnected(room,player){this.events.find(e=>e.room===room)?.disconnected(room,player);}
 rewards(id){return {identity:id,owned:this.db.meta('tournament-entitlements',{})[id]||[]};} syncRewards(id){const p=this.relay.parties;p.send(p.users.get(id),{type:'tournament-rewards',record:this.rewards(id)});} sanitize(profile,id){return profile?.pickaxe===TOURNAMENT.pickaxe&&!this.rewards(id).owned.includes(TOURNAMENT.pickaxe)?{...profile,pickaxe:''}:profile;}
 tick(){for(const e of this.events)e.tick();this.publish();}
 close(){clearInterval(this.timer);for(const e of this.events)e.close();}
}
