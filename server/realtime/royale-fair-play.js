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
  if(!message.flag||now-observer.since<180000)return;
  const flag=this.validate(room,message.flag);if(!flag)return;
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
  const evidence={...host.evidence,source:'corroborated public match',rule:'public-teaming-v1',witnesses:witnesses.map(([id])=>id),host:hostIdentity,note:'Host and at least two non-accused clients independently met the sustained combat threshold with matching trails and targets.'};
  this.pending.set(room.code+':'+message.matchId+':'+candidateKey,{room,key,players:accusedIds,matchId:message.matchId,evidence});
  if(!this.timer){this.timer=setTimeout(()=>this.flush(),250);this.timer.unref?.();}
 }
 flush(){
  clearTimeout(this.timer);this.timer=null;
  const decisions=[...this.pending.values()].filter(d=>d.room.fairPlayKey===d.key&&d.room.state?.matchId===d.matchId);this.pending.clear();
  for(const d of decisions){
   const id=this.relay.fairPlay.flag({players:d.players,room:d.room.code,matchId:d.matchId,evidence:{...d.evidence,enforce:false}});
   if(id){const row=this.relay.fairPlay.db.get('SELECT * FROM teaming_cases WHERE id=?',id);if(row?.status==='pending')this.relay.fairPlay.enforce(id,{...JSON.parse(row.data),evidence:{...d.evidence,enforce:true}});}
  }
 }
 validate(room,flag){
  const e=flag?.evidence,ids=flag?.players;
  if(!Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2||!e||e.enforce!==true||e.mutualDamage!==0||!Number.isFinite(e.closeSeconds)||e.closeSeconds<180||e.closeSeconds>3600||!Number.isFinite(e.coTravelMetres)||e.coTravelMetres<100||e.coTravelMetres>100000)return null;
  const roster=new Map([...room.members.values()].map(m=>[m.id,m]));
  if(ids.some(id=>!roster.has(id)||roster.get(id).admission.spectator))return null;
  if(room.options.teamSize>1&&roster.get(ids[0]).admission.partyId===roster.get(ids[1]).admission.partyId)return null;
  if(!Array.isArray(e.hits)||e.hits.length>40||!Array.isArray(e.trail)||e.trail.length<10||e.trail.length>18)return null;
  if(e.trail.some((p,i)=>!Number.isFinite(p.time)||p.time>room.state.time+2||room.state.time-p.time>240||i&&p.time<=e.trail[i-1].time||![p.a?.x,p.a?.z,p.b?.x,p.b?.z].every(n=>Number.isFinite(n)&&Math.abs(n)<10000)||Math.hypot(p.a.x-p.b.x,p.a.z-p.b.z)>17))return null;
  if(room.state.time-e.trail.at(-1).time>40)return null;
  const hits=e.hits.filter(h=>ids.includes(h.player)&&roster.has(h.target)&&!ids.includes(h.target)&&Number.isFinite(h.amount)&&h.amount>0&&h.amount<=300&&Number.isFinite(h.time)&&h.time<=room.state.time+2&&room.state.time-h.time<=240);
  const targets=new Map();
  for(const h of hits){const same=hits.filter(o=>o.target===h.target&&Math.abs(o.time-h.time)<=6);if(ids.every(id=>same.filter(o=>o.player===id).reduce((n,o)=>n+o.amount,0)>=30))targets.set(h.target,h.time);}
  const times=[...targets.values()].sort((a,b)=>a-b);let last=-Infinity,count=0;for(const time of times)if(time-last>=20){last=time;count++;}
  if(targets.size<3||count<3)return null;
  return {players:ids,evidence:{closeSeconds:e.closeSeconds,coTravelMetres:e.coTravelMetres,sharedTargets:targets.size,encounters:count,mutualDamage:0,trail:e.trail.map(p=>({time:p.time,a:{x:p.a.x,z:p.a.z},b:{x:p.b.x,z:p.b.z}})),hits:hits.map(h=>({time:h.time,player:h.player,target:h.target,amount:h.amount})),targets:[...targets.keys()].sort()}};
 }
 agrees(a,b){
  if(a.evidence.targets.filter(id=>b.evidence.targets.includes(id)).length<3)return false;
  return a.evidence.trail.filter(p=>b.evidence.trail.some(q=>Math.abs(p.time-q.time)<=2&&Math.hypot(p.a.x-q.a.x,p.a.z-q.a.z)<=4&&Math.hypot(p.b.x-q.b.x,p.b.z-q.b.z)<=4)).length>=10;
 }
}
