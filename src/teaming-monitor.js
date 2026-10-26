import {teammates,teamKey} from './teams.js';

// Conservative live rules, not a statistically calibrated classifier. Reports and
// player reports never enter this detector. Keep evidence for reversals.
export class TeamingMonitor{
 constructor({onFlag,identity}){this.onFlag=onFlag;this.identity=identity;this.pairs=new Map();this.hits=[];this.transfers=[];this.last=-Infinity;}
 combat(e,sim){
  if(e.type==='hit'&&e.player&&e.target&&e.amount>0){this.hits.push({time:e.time,player:e.player,target:e.target,amount:e.amount});const pair=this.pairs.get([e.player,e.target].sort().join('|'));if(pair)pair.hostile+=e.amount;}
  if(this.hits.length>2000)this.hits.splice(0,this.hits.length-2000);
  // Attempting to shoot an opponent is counter-evidence even when the shot misses.
  if(sim&&['shot','launch'].includes(e.type)&&e.origin)for(const target of sim.players.values()){
   const pair=this.pairs.get([e.player,target.id].sort().join('|'));if(!pair)continue;
   const dx=target.x-e.origin.x,dy=target.y+1-e.origin.y,dz=target.z-e.origin.z,len=Math.hypot(dx,dy,dz);
   if(len>18||len<.1)continue;
   if((e.shots||[]).some(s=>(s.vx*dx+s.vy*dy+s.vz*dz)/(Math.hypot(s.vx,s.vy,s.vz)*len)>.97))pair.hostile=Math.max(1,pair.hostile);
  }
 }
 transfer(e){this.transfers.push(e);if(this.transfers.length>200)this.transfers.shift();}
 sample(sim){
  if(sim.time-this.last<1)return;
  const dt=Math.min(1.25,Math.max(0,sim.time-this.last));this.last=sim.time;
  this.hits=this.hits.filter(h=>sim.time-h.time<=240);
  this.transfers=this.transfers.filter(e=>sim.time-e.time<=240);
  if(sim.phase!=='playing'||!['active','drop'].includes(sim.stage)||sim.elapsed<30||sim.storm?.radius<80){this.pairs.clear();return;}
  const players=[...sim.players.values()].filter(p=>!p.bot&&p.contestant&&p.connected!==false&&!p.loading&&!p.spectating&&!p.eliminated&&!p.downed&&p.health>0&&p.flight==='ground'&&this.identity(p.id)&&[p.x,p.y,p.z].every(Number.isFinite));
  const active=new Set(),flags=[];
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
   const a=players[i],b=players[j];if(teammates(sim.options,a,b))continue;
   const ids=[a.id,b.id].sort(),key=ids.join('|');active.add(key);
   const previous=this.pairs.get(key);
   const safe=p=>!sim.storm?.active||Math.hypot(p.x-sim.storm.x,p.z-sim.storm.z)<sim.storm.radius-25;
   const close=Math.hypot(a.x-b.x,a.z-b.z)<=16&&Math.abs(a.y-b.y)<4&&safe(a)&&safe(b)&&sim.accessible(a,b,18);
   if(!close){if(previous&&sim.time-previous.lastClose>10)this.pairs.delete(key);continue;}
   const pair=previous||{since:sim.time,seconds:0,distance:0,lastClose:sim.time,trail:[],lastSaved:0,hostile:0};
   // Gaps and catch-up never count as sustained observation.
   if(previous&&sim.time-previous.lastClose<=2){pair.seconds+=dt;const da=Math.hypot(a.x-pair.a.x,a.z-pair.a.z),db=Math.hypot(b.x-pair.b.x,b.z-pair.b.z),dot=(a.x-pair.a.x)*(b.x-pair.b.x)+(a.z-pair.a.z)*(b.z-pair.b.z);if(da>.2&&db>.2&&da<15&&db<15&&dot/(da*db)>.8)pair.distance+=Math.min(da,db);}
   pair.a={x:a.x,z:a.z};pair.b={x:b.x,z:b.z};pair.lastClose=sim.time;this.pairs.set(key,pair);
   if(!pair.trail.length||sim.time-pair.trail.at(-1).time>=10)pair.trail.push({time:Math.round(sim.time),a:pair.a,b:pair.b});if(pair.trail.length>18)pair.trail.shift();
   if(pair.seconds<90||pair.distance<40||pair.hostile>0)continue;
   const hits=this.hits.filter(h=>h.time>=Math.max(pair.since,sim.time-240));
   const hostile=hits.filter(h=>h.player===a.id&&h.target===b.id||h.player===b.id&&h.target===a.id).reduce((n,h)=>n+h.amount,0);pair.hostile=Math.max(pair.hostile,hostile);
   const targets=new Map();for(const h of hits){if(h.player!==a.id||h.target===b.id)continue;const victim=sim.players.get(h.target);if(!victim||victim.bot||teammates(sim.options,a,victim)||teammates(sim.options,b,victim))continue;const allied=hits.filter(o=>o.player===b.id&&o.target===h.target&&Math.abs(o.time-h.time)<=6);if(!allied.length)continue;const ah=hits.filter(o=>o.player===a.id&&o.target===h.target&&Math.abs(o.time-h.time)<=6);if(ah.reduce((n,h)=>n+h.amount,0)>=30&&allied.reduce((n,h)=>n+h.amount,0)>=30)targets.set(teamKey(sim.options,victim),h.time);}
   const encounters=[...targets.values()].sort((a,b)=>a-b).filter((t,i,list)=>!i||t-list[i-1]>=20).length;
   const exchanges=this.transfers.filter(e=>e.time>=pair.since&&(e.from===a.id&&e.to===b.id||e.from===b.id&&e.to===a.id));
   const sent=id=>new Set(exchanges.filter(e=>e.from===id).map(e=>e.drop)).size;
   const reciprocal=sent(a.id)>=2&&sent(b.id)>=2&&new Set(exchanges.map(e=>e.item)).size>=2;
   const candidate=pair.seconds>=90&&pair.distance>=40&&targets.size>=2&&pair.hostile===0;
   // Each individual pair must qualify; graph neighbours are never punished by association.
   const enforce=candidate&&encounters>=2&&(reciprocal||pair.seconds>=180&&pair.distance>=100&&targets.size>=3&&encounters>=3);
   if(candidate&&(!pair.flagged||enforce&&!pair.enforced||sim.time-pair.lastSaved>=30)){
    pair.flagged=true;pair.enforced ||= enforce;pair.lastSaved=sim.time;
    flags.push({players:[this.identity(a.id),this.identity(b.id)],evidence:{source:'server simulation',rule:'teaming-v1',enforce,closeSeconds:Math.round(pair.seconds),coTravelMetres:Math.round(pair.distance),sharedTargets:targets.size,encounters,mutualDamage:pair.hostile,reciprocalSupplies:reciprocal,exchanges,trail:pair.trail,hits:hits.filter(h=>ids.includes(h.player)).slice(-40),note:enforce?'Sustained cross-team cooperation met the automatic enforcement rule.':'Below the automatic enforcement threshold; no penalty.'}});
   }
  }
  for(const key of this.pairs.keys())if(!active.has(key))this.pairs.delete(key);
  // Decide all pairs before removal mutates the room roster (three-player rings).
  for(const flag of flags)this.onFlag(flag);
 }
}
