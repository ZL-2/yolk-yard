import {sanitizeInput} from '../../src/physics.js';
const forbidden=new Set(['state','snapshot-v1','welcome','host-left','damage','hit','elimination','reward','set-health','teleport']);
export class MatchIntegrity{
 constructor(service){this.service=service;this.relay=service.relay;this.peers=new WeakMap();}
 context(peer){const r=this.relay,server=r.authority.roomFor(peer),pub=r.publicHost.roomFor(peer),identity=r.progression.accounts.get(peer.progressId)?.socialId||pub?.members.get(peer.id)?.admission.memberId;return {server,pub,identity,room:server?.code||pub?.code,matchId:server?.sim.matchId||pub?.state?.matchId,eventId:server?.eventId||null};}
 guard(peer,other,m){
  if(!m||typeof m!=='object'||Array.isArray(m))return false;
  const c=this.context(peer),address=peer.hostReady?.address,alias=this.relay.peers.get(address)||this.relay.hostWatchdog.owners.get(peer.id)?.peer;
  // A transferred host owns both its member connection and a proven room alias.
  // Authenticate that ownership before the first publication; a recovering guest
  // has no hostReady record and must not cause the new host to be misclassified.
  const host=!c.server&&(c.pub?peer.id===c.pub.host?.peer||peer.id===c.pub.host?.address:/^yolk-yard-v\d+-[A-Z2-9]{8}$/.test(peer.id)||alias?.hostOwner===peer.id||this.relay.hostWatchdog.rooms.get(address)?.owner===peer.id);
  if(forbidden.has(m.type)&&!host){this.violation(peer,c,m.type,true);return false;}
  if(m.type==='input'){
   const raw=m.input;if(!raw||!Number.isSafeInteger(raw.seq)||raw.seq<1||raw.seq>1e10){this.violation(peer,c,'invalid-input',false);return false;}
   let meter=this.peers.get(peer);if(!meter)this.peers.set(peer,meter={credit:120,at:this.service.now(),violations:[]});const now=this.service.now();meter.credit=Math.min(120,meter.credit+Math.max(0,now-meter.at)*.09);meter.at=now;if(meter.credit<1){this.violation(peer,c,'input-rate',false);return false;}meter.credit--;
   // Never accept client positions, health, damage, inventory, or elapsed time.
   m.input={...sanitizeInput(raw),dt:1/60};const time=c.server?.sim.time??c.pub?.state?.time;if(Number.isFinite(m.input.shotTime)&&Number.isFinite(time))m.input.shotTime=Math.max(time-2,Math.min(time,m.input.shotTime));
  }
  return true;
 }
 violation(peer,c,type,hard){
  if(!c.identity||!c.room||!c.matchId)return;let meter=this.peers.get(peer);if(!meter)this.peers.set(peer,meter={credit:120,at:this.service.now(),violations:[]});
  const now=this.service.now();meter.violations=meter.violations.filter(v=>now-v.at<30000&&v.matchId===c.matchId);meter.violations.push({at:now,type,hard,matchId:c.matchId});if(meter.violations.length>30)meter.violations.shift();
  const hardRows=meter.violations.filter(v=>v.hard),proven=hardRows.length>=3&&hardRows.at(-1).at-hardRows[0].at>=2000;
  if(!proven&&now-(meter.saved||0)<5000)return;meter.saved=now;
  const id='integrity:'+c.room+':'+c.matchId+':'+c.identity,name=this.relay.parties.store.identities.get(c.identity)?.profile.name||'Player',data={kind:'cheating',players:[{id:c.identity,name}],room:c.room,matchId:c.matchId,eventId:c.eventId,evidence:{source:'relay protocol',rule:'state-forgery-v1',note:proven?'Repeated attempts to send authoritative game state from a non-host connection.':'Invalid control traffic blocked. Network bursts alone never cause a ban.',violations:meter.violations},notes:[]};
  const previous=this.service.db.get('SELECT status FROM teaming_cases WHERE id=?',id);if(previous&&previous.status!=='pending')return;
  if(proven)this.service.enforce(id,data,{reason:'Verified cheating: repeated unauthorized game-state messages.'});
  else{this.service.db.run('INSERT INTO teaming_cases VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,data=excluded.data',id,now,now,'pending',JSON.stringify(data));try{this.service.replays.retain(c.room,c.matchId);}catch{this.service.replayError='Some replay data could not be retained.';}}
 }
}
