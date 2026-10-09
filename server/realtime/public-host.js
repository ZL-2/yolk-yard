import {VERSION} from '../../src/data.js';
import {PUBLIC_ROYALE,publicRoyaleOptions} from '../../src/public-royale.js';
import {crownRecord} from '../../src/crowns.js';
import {publicWindow} from '../../src/season-one.js';

// Discovery, admission and host leases only. No world, bots or simulation ticks.
export class PublicHost {
 constructor(relay){this.relay=relay;this.enabled=false;this.members=new Map();this.joinSerial=0;this.order=0;this.key=`yolk-yard-v${VERSION}-${PUBLIC_ROYALE.code}`;}
 enable(){this.enabled=true;return this;}
 pendingCount(spectator=false){return [...this.relay.parties.tickets.values()].filter(t=>t.recurring&&!!t.spectator===spectator&&!t.peer&&t.expires>Date.now()).length;}
 reserve(p,u){
  if(this.host||this.pending)return false;
  if(this.members.size)throw Error('The public host is transferring. Try again shortly.');
  this.pending={party:p.id,leader:u.id,expires:Date.now()+35000};return true;
 }
 authorize(m){
  const ticket=this.relay.parties.tickets.get(m.publicTicket);
  if(this.pending&&ticket?.recurring&&ticket.member===this.pending.leader&&ticket.party===this.pending.party&&ticket.expires>Date.now())return true;
  const proof=m.publicHostProof,peer=this.relay.peers.get(proof?.id);
  if(!peer||peer.token!==proof.token||!peer.ws||!this.members.has(peer.id)||this.host)return false;
  const next=[...this.members.values()].filter(x=>!x.admission.friendSpectator&&this.relay.peers.get(x.peer)?.ws).sort((a,b)=>a.order-b.order)[0];
  return next?.peer===peer.id;
 }
 registered(peer,m){
  const owner=m.publicHostProof?.id||peer.id;
  this.host={address:peer.id,peer:owner,id:owner===peer.id?'host':owner,at:Date.now(),time:null,advancedAt:Date.now()};
  peer.publicHostOwner=owner;peer.rewardPublic=true;this.pending=null;
 }
 admission(peer,admission){
  if(!admission?.recurring)return null;
  const previous=this.members.get(peer.id);if(previous)return previous.admission;
  const status=this.summary(),spectator=!!admission.spectator||this.state&&!status.joinable;
  if((spectator?status.availableSpectators:status.availableSeats)<1)return null;
  const record={...admission,spectator:!!spectator,publicSpectator:!!spectator,crownRecord:crownRecord(this.relay.progression.account(peer.progressId).crowns)};
  this.relay.progression.bindPublicPlayer?.(peer,record.memberId,{participant:!spectator});
  this.members.set(peer.id,{peer:peer.id,id:peer.id===this.host?.peer?this.host.id:peer.id,order:++this.order,admission:record});
  peer.publicMember=true;this.joinSerial++;return record;
 }
 isTarget(peer){return peer.id===this.host?.address||peer.id===this.host?.peer;}
 publish(peer,r){
  if(!this.isTarget(peer)||!r?.recurring||r.hostId!==this.host.id)return false;
  const s=r.publicState;
  if(!s||!['spawn-island','starting','battle-bus','drop','active','ending','finished'].includes(s.stage)||!['playing','results'].includes(s.phase)||!Number.isFinite(s.time))return false;
  const now=Date.now();this.host.at=now;
  if(s.time!==this.host.time){this.host.time=s.time;this.host.advancedAt=now;}
  const count=(n,max)=>Math.max(0,Math.min(max,Math.floor(n)||0));
  this.state={stage:s.stage,phase:s.phase,time:s.time,queueEnds:Number(s.queueEnds)||0,elapsed:Number(s.elapsed)||0,round:count(s.round,1e7),matchId:String(s.matchId||'').slice(0,80),alive:count(s.alive,48),botPlayers:count(s.botPlayers,48),estimatedSeconds:count(s.estimatedSeconds,3600)};
  // Public spectators enter the next round; deliberate friend observers remain.
  if(Array.isArray(s.contestants))for(const member of this.members.values())if(!member.admission.friendSpectator){member.admission.spectator=!s.contestants.includes(member.id);member.admission.publicSpectator=member.admission.spectator;}
  return true;
 }
 summary(){
  const s=this.state,warmup=!s||['spawn-island','starting'].includes(s.stage),recovering=!this.host&&(!!this.members.size||!!this.pending);
  const members=[...this.members.values()].filter(x=>this.relay.peers.get(x.peer)?.ws),humanPlayers=members.filter(x=>!x.admission.spectator).length,spectators=members.length-humanPlayers;
  const countdownSeconds=warmup&&s?.queueEnds?Math.max(0,Math.ceil(s.queueEnds-s.time)):0;
  return {availability:publicWindow(Date.now()),code:PUBLIC_ROYALE.code,version:VERSION,hosting:'player',hostReady:!!this.host&&!!s,recovering,joinSerial:this.joinSerial,round:s?.round||0,matchId:s?.matchId||null,stage:s?.stage||'spawn-island',phase:s?.phase||'playing',capacity:48,difficulty:2,humanPlayers,spectators,botPlayers:s?.botPlayers??48,alive:warmup?48:s.alive,joinable:warmup&&!recovering,countdownStarted:countdownSeconds>0,countdownSeconds,estimatedSeconds:s?.estimatedSeconds||0,restartSeconds:s?.phase==='results'?s.estimatedSeconds:0,availableSeats:Math.max(0,48-humanPlayers-this.pendingCount()),availableSpectators:Math.max(0,16-spectators-this.pendingCount(true))};
 }
 left(peer){
  const member=this.members.get(peer.id);if(member&&!member.admission.spectator&&peer.progressId&&this.state?.phase==='playing'&&!['spawn-island','starting'].includes(this.state?.stage)){const account=this.relay.progression.account(peer.progressId);account.crowns={...crownRecord(account.crowns),owned:false};this.relay.progression.dirty=true;void this.relay.progression.save();}
  this.members.delete(peer.id);peer.publicMember=false;
  if(this.host&&(peer.id===this.host.peer||peer.id===this.host.address)){
   const old=this.host;this.host=null;
   const other=this.relay.peers.get(peer.id===old.peer?old.address:old.peer);
   if(other&&other!==peer)this.relay.remove(other,1001,'Public host transferred');
  }
  if(!this.members.size&&!this.host){this.state=null;this.pending=null;}
 }
 sweep(){
  if(!this.enabled)return;
  if(this.pending?.expires<Date.now()){const p=this.relay.parties.parties.get(this.pending.party);this.pending=null;if(p?.state==='queueing')this.relay.parties.cancel(p,'The public host did not finish loading. Try joining again.');}
  if(this.host&&Date.now()-this.host.advancedAt>(this.state?15000:35000)){const peer=this.relay.peers.get(this.host.peer);if(peer)this.relay.remove(peer,1001,'Public host stopped advancing');}
  this.relay.parties.publishPublicMatch(this.summary());
 }
 saveCrown(peer,value){if(!peer.publicMember||this.members.get(peer.id)?.admission.spectator)return;this.relay.progression.account(peer.progressId).crowns=crownRecord(value);this.relay.progression.dirty=true;void this.relay.progression.save();}
}
