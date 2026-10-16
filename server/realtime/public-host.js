import {randomInt} from 'node:crypto';
import {VERSION} from '../../src/data.js';
import {PUBLIC_ROYALE,publicMatchOptions,publicPoolKey} from '../../src/public-royale.js';
import {crownRecord} from '../../src/crowns.js';
import {publicWindow} from '../../src/season-one.js';

// Discovery, admission and host leases only. No world, bots or simulation ticks.
export class PublicRoom {
 constructor(relay,code=PUBLIC_ROYALE.code,options=publicMatchOptions()){this.code=code;this.options=options;this.relay=relay;this.enabled=false;this.members=new Map();this.joinSerial=0;this.order=0;this.key=`yolk-yard-v${VERSION}-${code}`;}
 enable(){this.enabled=true;return this;}
 report(action,reason){console.info(JSON.stringify({event:'public-match',code:this.code,pool:publicPoolKey(this.options),action,reason,members:this.members.size,round:this.state?.round||0,stage:this.state?.stage,alive:this.state?.alive,stalledMs:this.host?Date.now()-this.host.advancedAt:undefined}));}
 successor(){return [...this.members.values()].filter(x=>x.peer!==this.host?.peer&&x.peer!==this.host?.address&&x.ready&&Date.now()-x.readyAt<8000&&x.readyMatch===this.state?.matchId&&!x.admission.friendSpectator&&this.relay.peers.get(x.peer)?.ws?.readyState===1).sort((a,b)=>a.order-b.order)[0];}
 pendingCount(spectator=false){return [...this.relay.parties.tickets.values()].filter(t=>t.recurring&&t.code===this.code&&!!t.spectator===spectator&&!this.members.has(t.peer)&&t.expires>Date.now()).length;}
 reserve(p,u){
  if(this.host||this.pending)return false;
  if(this.members.size)throw Error('The public host is transferring. Try again shortly.');
  this.pending={party:p.id,leader:u.id,expires:Date.now()+35000};return true;
 }
 authorize(m){
  const ticket=this.relay.parties.tickets.get(m.publicTicket);
  if(!this.host&&this.pending&&this.pending.expires>Date.now()&&ticket?.recurring&&ticket.code===this.code&&ticket.member===this.pending.leader&&ticket.party===this.pending.party&&ticket.expires>Date.now())return true;
  const proof=m.publicHostProof,peer=this.relay.peers.get(proof?.id);
  if(!peer||peer.token!==proof.token||!peer.ws||!this.members.has(peer.id)||this.host)return false;
  const next=this.successor();
  return next?.peer===peer.id;
 }
 ready(peer,m){const member=this.members.get(peer.id);if(!member||typeof m.matchId!=='string'||m.matchId.length>80)return;member.ready=m.ready!==false;member.readyMatch=m.matchId;member.readyAt=Date.now();}
 registered(peer,m){
  const owner=m.publicHostProof?.id||peer.id;
  this.host={address:peer.id,peer:owner,id:owner===peer.id?'host':owner,at:Date.now(),time:null,advancedAt:Date.now()};
  peer.publicHostOwner=owner;peer.rewardPublic=true;this.pending=null;
  this.report(m.publicHostProof?'host-transferred':'host-created');
 }
 admission(peer,admission){
  if(!admission?.recurring||admission.code&&admission.code!==this.code||(admission.teamSize||1)!==this.options.teamSize||this.options.mode==='royale'&&admission.partySize>this.options.teamSize)return null;
  const previous=this.members.get(peer.id);if(previous)return previous.admission;
  const status=this.summary(),spectator=!!admission.spectator||this.state&&!status.joinable;
  const reserved=[...this.relay.parties.tickets.values()].some(t=>t.code===this.code&&t.peer===peer.id&&t.member===admission.memberId&&t.expires>Date.now()&&!!t.spectator===spectator);
  if((spectator?status.availableSpectators:status.availableSeats)<(reserved?0:1))return null;
  const record={...admission,spectator:!!spectator,publicSpectator:!!spectator,crownRecord:crownRecord(this.relay.progression.account(peer.progressId).crowns)};
  this.relay.progression.bindPublicPlayer?.(peer,record.memberId,{participant:!spectator});
  this.members.set(peer.id,{peer:peer.id,id:peer.id===this.host?.peer?this.host.id:peer.id,order:++this.order,admission:record});
  peer.publicMember=true;if(!spectator){this.joinSerial++;const player=this.relay.parties.store?.identities.get(record.memberId);this.lastJoin={serial:this.joinSerial,name:player?.profile?.name||'A player',at:Date.now()};}return record;
 }
 isTarget(peer){return peer.id===this.host?.address||peer.id===this.host?.peer;}
 publish(peer,r){
  if(!this.isTarget(peer)||!r?.recurring||r.hostId!==this.host.id||(r.mode&&r.mode!==this.options.mode)||(r.teamSize&&r.teamSize!==this.options.teamSize))return false;
  const s=r.publicState;
  if(!s||!(this.options.mode==='ffa'?['arena','finished']:['spawn-island','starting','battle-bus','drop','active','ending','finished']).includes(s.stage)||!['playing','results'].includes(s.phase)||!Number.isFinite(s.time))return false;
  const now=Date.now();this.host.at=now;
  if(s.time!==this.host.time){this.host.time=s.time;this.host.advancedAt=now;}
  const count=(n,max)=>Math.max(0,Math.min(max,Math.floor(n)||0));
  this.state={stage:s.stage,phase:s.phase,time:s.time,queueEnds:Number(s.queueEnds)||0,elapsed:Number(s.elapsed)||0,round:count(s.round,1e7),matchId:String(s.matchId||'').slice(0,80),alive:count(s.alive,48),botPlayers:count(s.botPlayers,48),estimatedSeconds:count(s.estimatedSeconds,3600)};
  // Public spectators enter the next round; deliberate friend observers remain.
  if(Array.isArray(s.contestants))for(const member of this.members.values())if(!member.admission.friendSpectator){member.admission.spectator=!s.contestants.includes(member.id);member.admission.publicSpectator=member.admission.spectator;}
  return true;
 }
 summary(){
  const s=this.state,warmup=!s||this.options.mode==='ffa'||['spawn-island','starting'].includes(s.stage),recovering=!this.host&&(!!this.members.size||!!this.pending)||!!(s&&this.host&&Date.now()-this.host.advancedAt>15000);
  const members=[...this.members.values()],humanPlayers=members.filter(x=>!x.admission.spectator).length,spectators=members.length-humanPlayers;
  const countdownSeconds=warmup&&s?.queueEnds?Math.max(0,Math.ceil(s.queueEnds-s.time)):0;
  return {availability:publicWindow(Date.now()),code:this.code,mode:this.options.mode,teamSize:this.options.teamSize,version:VERSION,hosting:'player',hostReady:!!this.host&&!!s,recovering,joinSerial:this.joinSerial,lastJoin:this.lastJoin,round:s?.round||0,matchId:s?.matchId||null,stage:s?.stage||'spawn-island',phase:s?.phase||'playing',capacity:this.options.capacity,difficulty:2,humanPlayers,spectators,botPlayers:s?.botPlayers??this.options.capacity,alive:warmup?this.options.capacity:s.alive,joinable:warmup&&!recovering,countdownStarted:countdownSeconds>0,countdownSeconds,estimatedSeconds:s?.estimatedSeconds||0,restartSeconds:s?.phase==='results'?s.estimatedSeconds:0,availableSeats:Math.max(0,this.options.capacity-humanPlayers-this.pendingCount()),availableSpectators:Math.max(0,16-spectators-this.pendingCount(true))};
 }
 left(peer){
  const member=this.members.get(peer.id);if(this.options.mode==='royale'&&member&&!member.admission.spectator&&peer.progressId&&this.state?.phase==='playing'&&!['spawn-island','starting'].includes(this.state?.stage)){const account=this.relay.progression.account(peer.progressId);account.crowns={...crownRecord(account.crowns),owned:false};this.relay.progression.dirty=true;void this.relay.progression.save();}
  this.members.delete(peer.id);peer.publicMember=false;
  for(const [token,ticket] of this.relay.parties.tickets)if(ticket.code===this.code&&ticket.peer===peer.id)this.relay.parties.tickets.delete(token);
  if(this.host&&(peer.id===this.host.peer||peer.id===this.host.address)){
   const old=this.host;this.host=null;
   const other=this.relay.peers.get(peer.id===old.peer?old.address:old.peer);
   if(other&&other!==peer)this.relay.remove(other,1001,'Public host transferred');
  }
  if(!this.members.size&&!this.host){this.state=null;this.pending=null;}
 }
 sweep(){
  if(!this.enabled)return;
  if(this.pending){const p=this.relay.parties.parties.get(this.pending.party);if(!p||p.state!=='queueing'||!p.launch?.recurring||p.launch.code!==this.code)this.pending=null;else if(this.pending.expires<Date.now()){this.pending=null;this.relay.parties.cancel(p,'The public host did not finish loading. Try joining again.');}}
  if(this.host&&Date.now()-this.host.advancedAt>(this.state?15000:35000)){
   const peer=this.relay.peers.get(this.host.peer);
   // A stalled render is not a lost socket. Never destroy the only copy of a
   // live round when there is nobody synchronized to take over. Disconnected
   // sockets are reclaimed by the relay after their transport recovery window.
   if(peer?.ws?.readyState===1&&(!this.state||this.successor()))this.relay.remove(peer,1001,'Public host stopped advancing');
  }

 }
 saveCrown(peer,value){if(this.options.mode!=='royale'||!peer.publicMember||this.members.get(peer.id)?.admission.spectator)return;this.relay.progression.account(peer.progressId).crowns=crownRecord(value);this.relay.progression.dirty=true;void this.relay.progression.save();}
}

// Each room owns its reservation, membership, checkpoint lease and election.
// Queue allocation is synchronous with ticket insertion, so concurrent Play
// requests see reservations before choosing a room.
export class PublicHost {
 constructor(relay){this.relay=relay;this.enabled=false;this.rooms=new Map();this.legacy=new PublicRoom(relay);this.rooms.set(this.legacy.code,this.legacy);}
 enable(){this.enabled=true;for(const room of this.rooms.values())room.enable();return this;}
 roomFor(peer){if(!peer)return null;return [...this.rooms.values()].find(r=>r.key===peer.id||r.members.has(peer.id)||r.isTarget(peer))||null;}
 roomByAddress(id){return [...this.rooms.values()].find(r=>r.key===id)||null;}
 findRoom(selection,partySize){
  const options=publicMatchOptions(selection),pool=publicPoolKey(options);
  const rooms=[...this.rooms.values()].filter(r=>publicPoolKey(r.options)===pool&&(r.host||r.pending)&&(!r.state||r.summary().joinable&&(r.options.mode==='ffa'||!r.state.queueEnds||r.state.queueEnds-r.state.time>8)||r.pending)&&r.summary().availableSeats>=partySize);
  // Fill the busiest compatible room; pending hosts retain their reserved seats.
  rooms.sort((a,b)=>(b.members.size+b.pendingCount())-(a.members.size+a.pendingCount()));
  if(rooms.length)return rooms[0];
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;
  do{code='RF'+Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(this.rooms.has(code)||this.relay.peers.has(`yolk-yard-v${VERSION}-${code}`));
  const room=new PublicRoom(this.relay,code,options).enable();this.rooms.set(code,room);return room;
 }
 authorize(m){return (m.id?this.roomByAddress(m.id):this.legacy)?.authorize(m)||false;}
 registered(peer,m){return this.roomByAddress(peer.id)?.registered(peer,m);}
 ready(peer,m){return this.roomFor(peer)?.ready(peer,m);}
 admission(peer,admission,target=peer){const room=this.roomFor(target)||this.rooms.get(admission?.code)||this.legacy,previous=this.roomFor(peer);if(previous&&previous!==room)return null;return room.admission(peer,admission);}
 isTarget(peer){return !!this.roomFor(peer)?.isTarget(peer);}
 publish(peer,r){return this.roomByAddress(peer.id)?.publish(peer,r)||false;}
 left(peer){this.roomFor(peer)?.left(peer);}
 saveCrown(peer,value){this.roomFor(peer)?.saveCrown(peer,value);}
 cancelReservation(party){for(const room of this.rooms.values())if(room.pending?.party===party)room.pending=null;}
 sweep(){if(!this.enabled)return;for(const [code,room] of this.rooms){room.sweep();if(room!==this.legacy&&!room.host&&!room.pending&&!room.members.size)this.rooms.delete(code);}this.relay.parties.publishPublicMatch(this.summary());}
 summary(){const active=[...this.rooms.values()].filter(r=>r.host||r.pending||r.members.size);return {...(active[0]||this.legacy).summary(),rooms:active.map(r=>r.summary()),roomCount:active.length};}
 report(action,reason,peer){(this.roomFor(peer)||this.legacy).report(action,reason);}
 get members(){if(this.rooms.size===1)return this.legacy.members;return new Map([...this.rooms.values()].flatMap(r=>[...r.members]));}
 // Legacy reservation API remains isolated for old internal callers/tests.
 primary(){return [...this.rooms.values()].find(r=>r.host||r.pending||r.members.size)||this.legacy;}
 get joinSerial(){return this.primary().joinSerial;}get key(){return this.primary().key;}get host(){return this.primary().host;}set host(v){this.primary().host=v;}get state(){return this.primary().state;}set state(v){this.primary().state=v;}get pending(){return this.primary().pending||null;}set pending(v){this.primary().pending=v;}
 reserve(p,u){return this.legacy.reserve(p,u);}
}
