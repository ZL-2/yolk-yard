import {teammates} from './teams.js';
import {evaluateTeamingEvidence,TEAMING_RULE} from './teaming-evidence.js';
const pairKey=(a,b)=>[a,b].sort().join('|');
export class TeamingMonitor{
 constructor({onFlag,identity}){this.onFlag=onFlag;this.identity=identity;this.pairs=new Map();this.hits=[];this.transfers=[];this.last=-Infinity;}
 combat(e,sim){
  if(e.type==='supply-transfer'){this.transfer(e);return;}
  if(e.type==='hit'&&e.player&&e.target&&Number.isFinite(e.amount)&&e.amount>0)this.hits.push({time:e.time,player:e.player,target:e.target,amount:e.amount});
  if(this.hits.length>2000)this.hits.splice(0,this.hits.length-2000);
  if(sim&&this.pairs.size&&['shot','launch'].includes(e.type)&&e.origin)for(const target of sim.players.values()){
   const pair=this.pairs.get(pairKey(e.player,target.id));if(!pair)continue;
   const dx=target.x-e.origin.x,dy=target.y+1-e.origin.y,dz=target.z-e.origin.z,len=Math.hypot(dx,dy,dz);
   if(len>22||len<.1)continue;
   if((e.shots||[]).some(s=>(s.vx*dx+s.vy*dy+s.vz*dz)/(Math.hypot(s.vx,s.vy,s.vz)*len)>.97))pair.shots.push({time:e.time,player:e.player,target:target.id});
   if(pair.shots.length>80)pair.shots.shift();
  }
 }
 transfer(e){this.transfers.push({time:e.time,from:e.from,to:e.to,drop:e.drop,item:e.item,amount:e.amount});if(this.transfers.length>200)this.transfers.shift();}
 sample(sim,{budgetMs=1,now=()=>performance.now()}={}){
  if(sim.phase!=='playing'||!['active','drop'].includes(sim.stage)||sim.elapsed<20||sim.storm?.radius<60){this.work=null;this.pairs.clear();return;}
  if(!this.work){
   if(sim.time-this.last<(this.focus?.size?.5:2))return;
   const players=new Map([...sim.players].map(([id,p])=>[id,{...p}]));
   const snapshot={time:sim.time,elapsed:sim.elapsed,phase:sim.phase,stage:sim.stage,options:sim.options,storm:sim.storm&&{...sim.storm},players,accessible:sim.accessible.bind(sim)};
   this.work=this.sampleSteps(snapshot);
  }
  const end=now()+budgetMs;let steps=0;
  do{if(this.work.next().done){this.work=null;break;}}while((budgetMs===Infinity||++steps<64)&&now()<end);
 }
 *sampleSteps(sim){
  if(sim.time-this.last<(this.focus?.size ? .5 : 2))return;this.last=sim.time;
  this.hits=this.hits.filter(h=>sim.time-h.time<=180);this.transfers=this.transfers.filter(e=>sim.time-e.time<=180);
  if(sim.phase!=='playing'||!['active','drop'].includes(sim.stage)||sim.elapsed<20||sim.storm?.radius<60){this.pairs.clear();return;}
  const players=[...sim.players.values()].filter(p=>!p.bot&&p.contestant&&p.connected!==false&&!p.loading&&!p.spectating&&!p.eliminated&&!p.downed&&p.health>0&&p.flight==='ground'&&this.identity(p.id)&&[p.x,p.y,p.z].every(Number.isFinite)).sort((a,b)=>a.id.localeCompare(b.id));
  const byShooter=new Map();for(const h of this.hits){if(!byShooter.has(h.player))byShooter.set(h.player,[]);byShooter.get(h.player).push(h);}
  const active=new Set(),flags=[];
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
   yield;
   const a=players[i],b=players[j];if(teammates(sim.options,a,b))continue;
   const ids=[a.id,b.id],key=pairKey(...ids);active.add(key);
   let pair=this.pairs.get(key);const interval=(this.focus?.has(a.id)||this.focus?.has(b.id)) ? .5 : 2;if(pair&&sim.time-(pair.sampled??-Infinity)<interval)continue;
   const safe=p=>!sim.storm?.active||Math.hypot(p.x-sim.storm.x,p.z-sim.storm.z)<sim.storm.radius-20;
   const close=Math.hypot(a.x-b.x,a.z-b.z)<=20&&Math.abs(a.y-b.y)<4&&safe(a)&&safe(b)&&sim.accessible(a,b,22);
   if(!pair&&!close)continue;
   if(!pair){pair={trail:[],shots:[],lastSaved:-Infinity};this.pairs.set(key,pair);}
   pair.sampled=sim.time;pair.trail.push({time:sim.time,a:{x:a.x,z:a.z},b:{x:b.x,z:b.z},close});pair.trail=pair.trail.filter(p=>sim.time-p.time<=180).slice(-361);pair.shots=pair.shots.filter(s=>sim.time-s.time<=180);
   if(!pair.trail.some(p=>p.close)){this.pairs.delete(key);continue;}
   if(!close)continue;
   const hits=[...(byShooter.get(a.id)||[]),...(byShooter.get(b.id)||[])].sort((a,b)=>a.time-b.time).filter(h=>{if(ids.includes(h.target))return true;const target=sim.players.get(h.target);return target&&!target.bot&&this.identity(target.id)&&!teammates(sim.options,a,target)&&!teammates(sim.options,b,target);}).slice(-120);
   const exchanges=this.transfers.filter(e=>ids.includes(e.from)&&ids.includes(e.to));
   const raw={players:ids,trail:pair.trail,hits,shots:pair.shots,exchanges};const result=evaluateTeamingEvidence(raw);
   if(result.closeSeconds<30||!result.episodes.length)continue;
   if(!pair.flagged||result.enforce&&!pair.enforced||sim.time-pair.lastSaved>=10){
    pair.flagged=true;pair.enforced ||= result.enforce;pair.lastSaved=sim.time;
    flags.push({players:ids.map(this.identity),evidence:{...raw,...result,source:'server simulation',rule:TEAMING_RULE,note:result.enforce?'Independent cooperation signals met the '+result.path+' rule.':'Insufficient independent cooperation evidence; no penalty.'}});
   }
  }
  for(const key of this.pairs.keys())if(!active.has(key))this.pairs.delete(key);
  for(const flag of flags){this.onFlag(flag);yield;}
 }
}
