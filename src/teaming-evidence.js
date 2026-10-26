// Shared decision rule: the server re-evaluates public evidence, never a client verdict.
export const TEAMING_RULE='teaming-v2';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function evaluateTeamingEvidence({players,trail=[],hits=[],shots=[],exchanges=[]}){
 const [a,b]=players||[],end=trail.at(-1)?.time||0,start=end-180;
 const samples=trail.filter(p=>p.time>=start),damage=hits.filter(h=>h.time>=start&&h.time<=end);
 let seconds=0,metres=0;const motion=[];
 for(let i=1;i<samples.length;i++){
  const p=samples[i-1],q=samples[i],dt=q.time-p.time;let travel=0;
  if(p.close&&q.close&&dt>0&&dt<=3){
   seconds+=dt;const da=distance(q.a,p.a),db=distance(q.b,p.b),dot=(q.a.x-p.a.x)*(q.b.x-p.b.x)+(q.a.z-p.a.z)*(q.b.z-p.b.z);
   if(da>.2&&db>.2&&da<15*dt&&db<15*dt&&dot/(da*db)>.8)travel=Math.min(da,db);
   metres+=travel;motion.push({time:q.time,seconds:dt,travel});
  }
 }
 const hostile=damage.filter(h=>h.player===a&&h.target===b||h.player===b&&h.target===a),hostileDamage=hostile.reduce((n,h)=>n+h.amount,0);
 const aimed=shots.filter(s=>s.time>=start&&s.time<=end),hostileTimes=[...new Set(hostile.map(h=>Math.floor(h.time)))];
 const sustained=hostileDamage>=35&&hostileTimes.length>=2&&hostileTimes.at(-1)-hostileTimes[0]>=3||hostileTimes.length>=3&&hostileTimes.at(-1)-hostileTimes[0]>=4||aimed.length>=3&&aimed.at(-1).time-aimed[0].time>=4;
 const minor=hostileDamage>0||aimed.length>0;
 const shared=[],byTarget=new Map();for(const h of damage){if(!byTarget.has(h.target))byTarget.set(h.target,[]);byTarget.get(h.target).push(h);}
 for(const h of damage){
  if(h.player!==a||h.target===b)continue;
  const near=byTarget.get(h.target).filter(o=>Math.abs(o.time-h.time)<=8);
  if([a,b].every(id=>near.filter(o=>o.player===id).reduce((n,o)=>n+o.amount,0)>=15))shared.push({time:Math.max(...near.filter(o=>[a,b].includes(o.player)).map(o=>o.time)),target:h.target});
 }
 shared.sort((a,b)=>a.time-b.time);
 const encounters=[];
 for(const h of shared){const last=encounters.at(-1);if(last&&h.time-last.end<18){last.end=Math.max(last.end,h.time);if(!last.targets.includes(h.target))last.targets.push(h.target);}else encounters.push({start:h.time,end:h.time,targets:[h.target]});}
 const episodes=encounters.map((fight,i)=>{
  const until=Math.min(fight.end+36,encounters[i+1]?.start??Infinity),after=motion.filter(m=>m.time>fight.end+3&&m.time<=until);
  return {...fight,regroupSeconds:after.reduce((n,m)=>n+m.seconds,0),regroupMetres:after.reduce((n,m)=>n+m.travel,0)};
 }).filter(e=>e.regroupSeconds>=12&&e.regroupMetres>=12);
 const transfers=exchanges.filter(e=>e.time>=start&&e.time<=end&&(e.from===a&&e.to===b||e.from===b&&e.to===a));
 const sent=id=>new Set(transfers.filter(e=>e.from===id).map(e=>e.drop)).size;
 const reciprocal=sent(a)>=2&&sent(b)>=2&&new Set(transfers.map(e=>e.item)).size>=2;
 // Small counter-signals require another independent episode; they never erase history.
 const strong=!sustained&&!minor&&seconds>=45&&metres>=20&&episodes.length>=1&&reciprocal;
 const repeated=!sustained&&seconds>=60&&metres>=35&&episodes.length>=(minor?3:2);
 return {enforce:strong||repeated,path:strong?'strong-cooperation':repeated?'repeated-cooperation':null,closeSeconds:Math.round(seconds),coTravelMetres:Math.round(metres),episodes,mutualDamage:hostileDamage,aimedShots:aimed.length,sustainedHostility:sustained,reciprocalSupplies:reciprocal,sharedTargets:new Set(episodes.flatMap(e=>e.targets)).size};
}
