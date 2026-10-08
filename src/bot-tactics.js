import {clamp} from './data.js';
import {dist,canStand} from './physics.js';
import {personality,botIdentity} from './bot-personality.js';
import {coverPoint,peekPoint} from './bot-cover.js';
import {combatRole} from './bot-team.js';
export function tacticalGoal(sim,p,brain,target,w,skill){
 const now=sim.time,profile=personality(p,brain),role=combatRole(sim,p,brain,target),low=p.health<skill.retreat||p.reloadEnd>now;
 let plan=brain.tactic;
 if(plan&&plan.target===target.id&&plan.role===role&&plan.low===low&&now<plan.until&&dist(target,plan.observed)<8&&!(brain.failures>0)){
  if(dist(p,plan.goal)<1.4){
   plan.arrivedAt??=now;
   if(plan.kind==='cover'&&!low&&now-plan.arrivedAt>.4){const peek=peekPoint(sim,p,plan.goal,target,brain.side);if(peek){brain.tactic={...plan,kind:'peek',goal:peek,arrivedAt:null,until:now+1.4};return peek;}}
   if(now-plan.arrivedAt<profile.peek)return plan.goal;
  }else return plan.goal;
 }
 const dx=p.x-target.x,dz=p.z-target.z,len=Math.hypot(dx,dz)||1;
 brain.tacticCount=(brain.tacticCount||0)+1;
 if(role==='solo'&&plan?.kind==='reposition'&&brain.tacticCount%3===0)brain.side=-(brain.side||1);
 const desired=clamp((w.engage[0]+w.engage[1])*.5,4,40)*profile.range*(role==='support'?1.15:1);
 const underFire=now-(brain.attackedAt??-100)<2.5;
 let goal,kind;
 if(low||underFire&&profile.cover>=.5){goal=coverPoint(sim,p,target);if(goal)kind='cover';}
 if(!goal){
  if(low||len<desired*.65){goal={x:p.x+dx/len*5,y:p.y,z:p.z+dz/len*5};kind='withdraw';}
  else if(len>desired*1.35){goal={x:target.x+dx/len*desired,y:target.y,z:target.z+dz/len*desired};kind='advance';}
  else{
   const side=role==='flank-left'?-1:role==='flank-right'?1:brain.side||1,shift=Math.min(profile.flank,desired*.55)*(role.startsWith('flank')?1.3:1);
   goal={x:p.x-dz/len*side*shift,y:p.y,z:p.z+dx/len*side*shift};kind=role.startsWith('flank')?'flank':'reposition';
   if(!canStand(sim.map,goal,.5)){goal={x:p.x+dz/len*side*shift,y:p.y,z:p.z-dx/len*side*shift};brain.side=-side;}
  }
 }
 brain.tactic={target:target.id,observed:{x:target.x,y:target.y,z:target.z},role,low,kind,goal,until:now+profile.commit,arrivedAt:null};return goal;
}
export function keepCommittedTask(sim,p,brain,target,urgent=false){
 const task=brain.task;if(!task||urgent||sim.time>=(brain.commitUntil||0)||brain.failures>0)return false;
 if(['fight','cover'].includes(task.kind))return target?.id===task.enemy?.id&&!!target?.visible&&p.health>=35&&!(p.reloadEnd>sim.time)&&sim.time-(brain.attackedAt??-100)>.15;
 if(['loot','chest','harvest','search-room','investigate','rotate-poi','patrol'].includes(task.kind))return !target?.visible&&sim.time-(brain.attackedAt??-100)>1&&dist(p,task.goal)>1.3;
 return false;
}
export function commitTask(sim,p,brain){brain.commitUntil=sim.time+personality(p,brain).commit;}
export function searchObjective(sim,p,brain,target){
 if(target.visible){brain.search=null;return null;}
 let search=brain.search;
 if(!search||search.id!==target.id){const phase=botIdentity(p)*Math.PI*2;search=brain.search={id:target.id,until:sim.time+4.5,origin:{x:target.x,y:target.y,z:target.z},phase,index:0};}
 if(sim.time>=search.until){delete brain.memory[target.id];brain.search=null;return null;}
 let goal=search.goal||search.origin;
 if(dist(p,goal)<1.4){
  search.arrivedAt??=sim.time;
  if(sim.time-search.arrivedAt>.35){search.index++;const angle=search.phase+search.index*2.4;const next={x:search.origin.x+Math.cos(angle)*3.5,y:search.origin.y,z:search.origin.z+Math.sin(angle)*3.5};if(canStand(sim.map,next,.5))goal=search.goal=next;search.arrivedAt=sim.time;}
 }
 return {kind:'investigate',goal,id:target.id};
}
