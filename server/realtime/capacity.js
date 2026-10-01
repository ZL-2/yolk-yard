// Admission estimates are conservative workload reservations, not player caps or
// a claim of certified hardware capacity. Actual CPU/throttle pressure is a
// second gate. Warmup reserves battle cost before the bus departs.
export function matchWorkload(options,humans=1,botLimit=Infinity){
 const capacity=options.capacity||(options.mode==='royale'?32:8);
 const bots=Math.max(0,Math.min(capacity-humans,options.fill?capacity:options.bots||0,botLimit));
 return {humans,bots,cost:options.mode==='royale'?52+humans*9+bots*7:30+humans*8+bots*11};
}
export const busyMessage='The game server is at its safe match capacity. Join an open match, try fewer bots, try again shortly, or play a Custom Private Match — it runs on the player host instead of the game server.';
export class MatchCapacity {
 constructor(authority){this.authority=authority;this.reservations=new Map();this.sampleAt=performance.now();this.cpuAt=process.cpuUsage();this.pressure=0;this.recovery=0;this.overloaded=false;}
 get budget(){
  const quota=this.authority.relay.cpuQuota?.snapshot()?.quotaCores;
  const cores=Number.isFinite(quota)&&quota>0?Math.min(1,quota):.5;
  const configured=Number(process.env.RAVEL_CPU_BUDGET_MS);
  return configured>0?Math.min(configured,cores*900):cores*650;
 }
 prune(){for(const [id,r]of this.reservations)if(r.expires<=Date.now())this.reservations.delete(id);}
 pending(key,spectator=false){
  const room=this.authority.rooms.get(key);let humans=0;
  for(const r of this.reservations.values())if(r.key===key&&!!r.spectator===spectator){let joined=0;if(room)for(const p of room.sim.players.values())if(!p.bot&&p.partyId===r.partyId)joined++;humans+=Math.max(0,r.humans-joined);}
  return humans;
 }
 humans(room){let n=0;for(const p of room.sim.players.values())if(!p.bot&&!p.lateSpectator)n++;return n;}
 spectators(room){let n=0;for(const p of room.sim.players.values())if(!p.bot&&p.lateSpectator)n++;return n;}
 roomCost(room){
  const cost=matchWorkload(room.sim.options,this.humans(room)+this.pending(room.key),room.sim.botLimit).cost+(this.spectators(room)+this.pending(room.key,true))*4;
  return room.sim.phase==='results'?Math.max(22,cost*.4):cost;
 }
 used(exclude){
  this.prune();let total=0;
  for(const room of this.authority.rooms.values())if(room.key!==exclude)total+=this.roomCost(room);
  const pending=new Map();for(const r of this.reservations.values())if(r.key!==exclude&&!this.authority.rooms.has(r.key)){const prior=pending.get(r.key);if(prior)prior.humans+=r.humans;else pending.set(r.key,{...r});}
  for(const r of pending.values())total+=matchWorkload(r.options,r.humans,r.botLimit).cost;
  return total;
 }
 plan(options,{key,humans=1,spectators,botLimit=Infinity,reduceBots=false}={}){
  const used=this.used(key),room=this.authority.rooms.get(key);
  humans=Math.max(humans,(room?this.humans(room):0)+this.pending(key));
  const original=matchWorkload(options,humans,botLimit),current=room?this.roomCost(room):0,extra=(spectators??(room?this.spectators(room)+this.pending(key,true):0))*4;
  const minimum=Math.max(0,(options.mode==='royale'?(options.teamSize||1)*2:2)-humans);
  for(let bots=original.bots;bots>=0;bots--){
   const candidate=matchWorkload(options,humans,bots);candidate.cost+=extra;
   if(candidate.cost+used<=this.budget&&(!this.overloaded||candidate.cost<=current))return {ok:true,botLimit:bots,adjusted:bots<original.bots,cost:candidate.cost};
   if(!reduceBots||bots<=minimum)break;
  }
  return {ok:false,reason:busyMessage};
 }
 reserve(partyId,key,options,humans,botLimit,spectator=false,friendSpectator=false){this.reservations.set(partyId,{partyId,key,options,humans,botLimit,spectator,friendSpectator,expires:Date.now()+90000});}
 release(partyId){this.reservations.delete(partyId);}
 releaseRoom(key){for(const [id,r]of this.reservations)if(r.key===key)this.reservations.delete(id);}
 roundPlan(room,options=room.sim.options){
  let spectators=[...room.sim.players.values()].filter(p=>!p.bot&&p.friendSpectator).length;
  for(const r of this.reservations.values())if(r.key===room.key&&r.friendSpectator){const joined=[...room.sim.players.values()].filter(p=>!p.bot&&p.partyId===r.partyId).length;spectators+=Math.max(0,r.humans-joined);}
  const humans=this.humans(room)+this.spectators(room)+this.pending(room.key)+this.pending(room.key,true)-spectators;
  return this.plan(options,{key:room.key,humans,spectators,botLimit:options===room.sim.options?room.sim.botLimit:Infinity});
 }
 rematch(key){for(const r of this.reservations.values())if(r.key===key&&!r.friendSpectator)r.spectator=false;}
 sample(now=performance.now()){
  const elapsed=now-this.sampleAt;if(elapsed<1000)return;
  const cpu=process.cpuUsage(this.cpuAt);this.cpuAt=process.cpuUsage();this.sampleAt=now;
  const quota=this.authority.relay.cpuQuota?.snapshot(),cores=quota?.quotaCores>0?Math.min(1,quota.quotaCores):.5;
  this.cpuMsPerSecond=(cpu.user+cpu.system)/elapsed;
  let throttled=0;if(this.quotaAt&&quota&&quota.periods>this.quotaAt.periods)throttled=Math.max(0,(quota.throttledPeriods-this.quotaAt.throttledPeriods)/(quota.periods-this.quotaAt.periods));this.quotaAt=quota;
  this.throttledFraction=throttled;
  const high=this.cpuMsPerSecond>cores*850||throttled>.2;
  this.pressure=high?this.pressure+elapsed:0;this.recovery=high?0:this.recovery+elapsed;
  if(this.pressure>=3000)this.overloaded=true;
  if(this.recovery>=5000)this.overloaded=false;
 }
 snapshot(){return {budgetMsPerSecond:Math.round(this.budget),reservedMsPerSecond:Math.round(this.used()),rooms:this.authority.rooms.size,pendingParties:this.reservations.size,overloaded:this.overloaded,cpuMsPerSecond:Math.round(this.cpuMsPerSecond||0),throttledFraction:Math.round((this.throttledFraction||0)*1000)/1000};}
}
