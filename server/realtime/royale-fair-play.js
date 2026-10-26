import {evaluateTeamingEvidence,TEAMING_RULE} from '../../src/teaming-evidence.js';
// Client-hosted matches need corroboration. Reports never enter this path.
// This cannot defeat a host that fabricates the world seen by every client.
export class PublicFairPlay {
 constructor(relay,{now=Date.now}={}){this.relay=relay;this.now=now;this.pending=new Map();}
 close(){clearTimeout(this.timer);this.timer=null;this.pending.clear();}
 receive(peer,message){
  const room=this.relay.publicHost.roomFor(peer),member=room?.members.get(peer.id),now=this.now();
  if(!member||room.options.mode!=='royale'||!room.host||message.hostId!==room.host.id||message.matchId!==room.state?.matchId||room.state.phase!=='playing'||!['active','drop'].includes(room.state.stage))return;
  const identity=member.admission.memberId;if(!identity||member.admission.friendSpectator)return;
  const key=message.matchId+':'+room.host.peer;
  if(room.fairPlayKey!==key){room.fairPlayKey=key;room.fairPlayObservers=new Map();room.fairPlayCandidates=new Map();}
  const observers=room.fairPlayObservers,previous=observers.get(identity);
  // An observer must have been receiving this match for the full evidence window.
  const observer=previous&&now-previous.seen<15000?previous:{since:now,seen:now,flags:new Map()};
  observer.seen=now;observers.set(identity,observer);
  if(!message.flag||now-observer.since<45000)return;
  const flag=this.validate(room,message.flag);if(!flag||now-observer.since<(flag.evidence.path==='strong-cooperation'?45000:60000))return;
  const candidateKey=flag.players.slice().sort().join('|'),candidates=room.fairPlayCandidates;
  if(now-(observer.flags.get(candidateKey)||0)<1000)return;observer.flags.set(candidateKey,now);if(observer.flags.size>128)observer.flags.delete(observer.flags.keys().next().value);
  for(const [k,c]of candidates)if(now-c.updated>45000)candidates.delete(k);
  if(!candidates.has(candidateKey)&&candidates.size>=128)candidates.delete(candidates.keys().next().value);
  const candidate=candidates.get(candidateKey)||{reports:new Map(),updated:now};candidate.updated=now;candidate.reports.set(identity,{...flag,at:now,peer:peer.id});candidates.set(candidateKey,candidate);
  const hostMember=room.members.get(room.host.peer),hostIdentity=hostMember?.admission.memberId,host=candidate.reports.get(hostIdentity);
  if(!host||now-host.at>45000)return;
  const accused=host.players.map(id=>[...room.members.values()].find(m=>m.id===id)),accusedIds=accused.map(m=>m?.admission.memberId);
  if(accusedIds.some(id=>!id))return;
  const witnesses=[...candidate.reports].filter(([id,r])=>id!==hostIdentity&&!accusedIds.includes(id)&&now-r.at<=45000&&this.agrees(host,r));
  if(witnesses.length<2)return;
  // Capture identities before removal mutates room membership or elects a host.
  const evidence={...host.evidence,source:'corroborated public match',rule:TEAMING_RULE,witnesses:witnesses.map(([id])=>id),host:hostIdentity,note:'Host and at least two non-accused clients independently met the cooperation rule with matching movement and encounters.'};
  this.pending.set(room.code+':'+message.matchId+':'+candidateKey,{room,key,players:accusedIds,matchId:message.matchId,evidence});
  if(!this.timer){this.timer=setTimeout(()=>this.flush(),250);this.timer.unref?.();}
 }
 flush(){
  clearTimeout(this.timer);this.timer=null;
  const decisions=[...this.pending.values()].filter(d=>d.room.fairPlayKey===d.key&&d.room.state?.matchId===d.matchId&&d.room.state.phase==='playing'&&d.key===d.matchId+':'+d.room.host?.peer);this.pending.clear();
  for(const d of decisions){try{
   const id=this.relay.fairPlay.flag({players:d.players,room:d.room.code,matchId:d.matchId,evidence:{...d.evidence,enforce:false}});
   if(id){const row=this.relay.fairPlay.db.get('SELECT * FROM teaming_cases WHERE id=?',id);if(row?.status==='pending')this.relay.fairPlay.enforce(id,{...JSON.parse(row.data),evidence:{...d.evidence,enforce:true}});}
  }catch{if(!this.lastError||this.now()-this.lastError>60000){this.lastError=this.now();console.warn('Public fair-play enforcement could not complete; no unsaved penalty is applied.');}}}
 }
 validate(room,flag){
  const e=flag?.evidence,ids=flag?.players;
  if(!Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2||ids.some(id=>typeof id!=='string')||!e||e.rule!==TEAMING_RULE)return null;
  const roster=new Map([...room.members.values()].map(m=>[m.id,m]));
  if(ids.some(id=>!roster.has(id)||roster.get(id).admission.spectator))return null;
  if(room.options.teamSize>1&&roster.get(ids[0]).admission.partyId===roster.get(ids[1]).admission.partyId)return null;
  if(!Array.isArray(e.hits)||e.hits.length>120||!Array.isArray(e.trail)||e.trail.length<15||e.trail.length>361||!Array.isArray(e.shots)||e.shots.length>80||!Array.isArray(e.exchanges)||e.exchanges.length>200)return null;
  const time=t=>Number.isFinite(t)&&t<=room.state.time+3&&room.state.time-t<=190;
  if(e.trail.some((p,i)=>!p||!time(p.time)||i&&p.time<=e.trail[i-1].time||typeof p.close!=='boolean'||![p.a?.x,p.a?.z,p.b?.x,p.b?.z].every(n=>Number.isFinite(n)&&Math.abs(n)<10000)||p.close&&Math.hypot(p.a.x-p.b.x,p.a.z-p.b.z)>20.1))return null;
  if(room.state.time-e.trail.at(-1).time>15)return null;
  if(e.hits.some(h=>!h||!ids.includes(h.player)||!roster.has(h.target)||!time(h.time)||!Number.isFinite(h.amount)||h.amount<=0||h.amount>300))return null;
  if(e.shots.some(h=>!h||!ids.includes(h.player)||!ids.includes(h.target)||!time(h.time)))return null;
  if(e.exchanges.some(h=>!h||!ids.includes(h.from)||!ids.includes(h.to)||h.from===h.to||!time(h.time)||!Number.isSafeInteger(h.drop)||typeof h.item!=='string'||h.item.length>50||!Number.isFinite(h.amount)||h.amount<=0||h.amount>1000))return null;
  const trail=e.trail.map(p=>({time:p.time,a:{x:p.a.x,z:p.a.z},b:{x:p.b.x,z:p.b.z},close:p.close}));
  const hits=e.hits.map(h=>({time:h.time,player:h.player,target:h.target,amount:h.amount}));
  const shots=e.shots.map(h=>({time:h.time,player:h.player,target:h.target}));
  const exchanges=e.exchanges.map(h=>({time:h.time,from:h.from,to:h.to,drop:h.drop,item:h.item,amount:h.amount}));
  const raw={players:ids,trail,hits,shots,exchanges},decision=evaluateTeamingEvidence(raw);
  if(!decision.enforce)return null;
  return {players:ids,evidence:{...raw,...decision,rule:TEAMING_RULE}};
 }
 agrees(a,b){
  if(!a.evidence.episodes.some(e=>b.evidence.episodes.some(f=>Math.abs(e.end-f.end)<=8&&e.targets.some(t=>f.targets.includes(t)))))return false;
  const start=Math.max(a.evidence.trail.at(-1).time,b.evidence.trail.at(-1).time)-45;
  return a.evidence.trail.filter(p=>p.time>=start&&p.close&&b.evidence.trail.some(q=>q.close&&Math.abs(p.time-q.time)<=2&&Math.hypot(p.a.x-q.a.x,p.a.z-q.a.z)<=4&&Math.hypot(p.b.x-q.b.x,p.b.z-q.b.z)<=4)).length>=10;
 }
}
