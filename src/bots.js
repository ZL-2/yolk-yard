import {isWarmup} from './royale-phases.js';
import {gun,weapon,mode,clamp} from './data.js';
import {dist} from './physics.js';
import {BOT_SKILL,skillFor,wrapAngle} from './bot-config.js';
import {newBrain,observe,selectThreat,seesPoint} from './bot-perception.js';
import {selectWeapon,chooseObjective,coverPoint} from './bot-objectives.js';
import {navigate} from './bot-navigation.js';
export {BOT_SKILL};
function combatGoal(sim,p,brain,target,w,skill){
 const d=dist(p,target),desired=w.pellets>1?6:w.projectile?22:w.optic==='scope'?40:18;
 const dx=p.x-target.x,dz=p.z-target.z,l=Math.hypot(dx,dz)||1;
 if(p.health<skill.retreat||p.reloadEnd>sim.time){const cover=coverPoint(sim,p,target);if(cover)return cover;}
 if(d>desired*1.45)return {x:target.x+dx/l*desired*.85,y:target.y,z:target.z+dz/l*desired*.85};
 if(d<desired*.6)return {x:p.x+dx/l*5,y:p.y,z:p.z+dz/l*5};
 // Commit to an angle, then stop/peek, rather than perpetually orbiting.
 const shift=sim.random()<.32?0:2+sim.random()*3;
 return {x:p.x-dz/l*brain.side*shift,y:p.y,z:p.z+dx/l*brain.side*shift};
}
// Atoll behavior has its own schedule and never enters match combat objectives.
export function warmupInput(sim,p){
 const bots=[...sim.players.values()].filter(o=>o.bot),index=bots.indexOf(p),cycle=Math.floor(sim.time/7);
 const practicing=(index+cycle*3)%Math.max(1,bots.length)<Math.min(3,Math.ceil(bots.length/10));
 const brain=p.warmupBrain??={...newBrain(sim,p),until:0};
 if(sim.time>=brain.until){
  brain.until=sim.time+3+sim.random()*5;brain.idle=sim.random()<.3;
  const points=sim.map.spawns,point=points[Math.floor(sim.random()*points.length)];brain.goal={x:point[0],y:p.y,z:point[1]};
  brain.jump=sim.random()<.3;brain.jumpAt=sim.time+.5+sim.random()*2;
 }
 const practice=practicing&&sim.time%7>1&&sim.time%7<3.2;
 const goal=practice?{x:31,y:4,z:6}:brain.goal,dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),yaw=Math.atan2(-dx,-dz);
 const move=!practice&&!brain.idle&&d>1.5?navigate(sim,p,brain,goal,skillFor(sim)):{mx:0,mz:0,jump:false};
 const burst=practice&&sim.time%1.1<.32&&d>5&&d<42&&seesPoint(sim,p,{x:goal.x-dx/(d||1)*1.3,y:goal.y,z:goal.z-dz/(d||1)*1.3});
 return {yaw:practice?yaw:Math.hypot(move.mx,move.mz)>.1?Math.atan2(-move.mx,-move.mz):p.yaw,pitch:0,slot:practice?1:0,
  forward:Math.hypot(move.mx,move.mz)>.1?1:0,strafe:0,fire:burst,reload:practice&&p.ammo[1]===0,
  jump:move.jump||brain.jump&&Math.abs(sim.time-brain.jumpAt)<.15,swapSlot:-1};
}
export function botInput(sim,p){
 if(isWarmup(sim.stage))return warmupInput(sim,p);
 const skill=skillFor(sim),now=sim.time,r=sim.random,brain=p.brain?.memory?p.brain:(p.brain={...newBrain(sim,p),...p.brain});
 observe(sim,p,brain,skill);const target=selectThreat(sim,p,brain,skill);
 const visible=!!target?.visible&&now-target.seenAt<skill.perception+.08&&seesPoint(sim,p,target);
 let slot=selectWeapon(p,target),w=gun({...p,slot});
 if(p.use){brain.utility=null;if(visible||now-(brain.attackedAt??-100)<.6)sim.cancelUse?.(p);else return {yaw:p.yaw,pitch:p.pitch,slot:p.use.slot,forward:0,strafe:0,swapSlot:-1};}
 if(now>=brain.decision||!brain.task){
  brain.decision=now+skill.decision*(.85+r()*.3);brain.task=chooseObjective(sim,p,brain,skill,target);brain.objective=brain.task.kind;
  if(brain.task.kind==='fight'&&target){brain.side=r()<.5?-1:1;brain.task.goal=combatGoal(sim,p,brain,target,w,skill);}
 }
 if(visible){if(now-(brain.lastVisibleAt??-100)>skill.perception*2)brain.aimAt=Math.max(brain.aimAt,now+skill.reaction*.6);brain.lastVisibleAt=now;}
 const task=brain.task,goal=task.goal;
 if(task.kind==='rotate'&&p.grounded&&!visible&&dist(p,goal)>45&&now>(brain.mobilityAt||0)){const mobility=p.inventory?.findIndex(i=>i?.id==='impulse'||i?.id==='launchpad');if(mobility>0){brain.mobilityAt=now+8;brain.utility={slot:mobility,yaw:Math.atan2(p.x-goal.x,p.z-goal.z),pitch:0,until:now+1};}}
 if(task.kind==='heal'){
  if(visible||now-(brain.attackedAt??-100)<2)brain.decision=0;
  else return {yaw:p.yaw,pitch:p.pitch,slot:task.slot,forward:0,strafe:0,fire:!p.useLatch,swapSlot:-1};
 }
 const move=navigate(sim,p,brain,goal,skill),distance=target?dist(p,target):Infinity;
 let yaw=Math.atan2(-move.mx,-move.mz),pitch=0,fire=false,popper=false,interact=move.interact&&!p.interactLatch;
 if(!move.mx&&!move.mz)yaw=p.yaw+(target?0:Math.sin(now*.35+(p.botSeed||0))*.03);
 if(task.kind==='loot'&&!visible&&now-(brain.attackedAt??-100)>2){
  const item=sim.loot.find(i=>i.uid===task.uid);
  if(!item)brain.decision=0;else if(sim.accessible(p,item)){
   if(item.weapon&&p.inventory.every(Boolean)){const similar=p.inventory.findIndex(i=>i?.weapon&&weapon(i.id).role===weapon(item.id).role);if(similar>0)slot=similar;}
   interact=!p.interactLatch;
  }
 }
 if(task.kind==='chest'&&!visible&&now-(brain.attackedAt??-100)>2){const chest=sim.chests.find(c=>c.id===task.id);if(!chest||chest.opened)brain.decision=0;else if(sim.accessible(p,chest,3.3))interact=true;}
 if(task.kind==='harvest'&&!visible){const d=dist(p,goal);slot=0;yaw=Math.atan2(p.x-goal.x,p.z-goal.z);pitch=0;fire=d<3.3;if(d<3.3){move.mx=move.mz=0;}}
 if(visible){
  if(now>=brain.nextBurst){
   brain.nextBurst=now+skill.burst+skill.pause+r()*.4;brain.burstUntil=now+skill.burst;
   const accurate=r()<skill.hit;brain.errorX=(r()-.5)*skill.error+(accurate?0:brain.side*(.65+r()*.8)/Math.max(5,distance));brain.errorY=(r()-.5)*skill.error*.65;brain.height=accurate?.78+(r()-.5)*.3:.25+r()*1.5;
  }
  const lead=Math.min(1,distance/w.boltSpeed)*skill.lead,tx=target.x+(target.vx||0)*lead-p.x,tz=target.z+(target.vz||0)*lead-p.z;
  yaw=Math.atan2(-tx,-tz)+(brain.errorX||0)+Math.sin(now*1.7+(p.botSeed||0))*skill.error*.15;
  pitch=Math.atan2(target.y+(brain.height??.9)*(target.bodyScale||1)-p.y-1.43,Math.hypot(tx,tz))+(brain.errorY||0);
  fire=!(p.inventory&&slot===0)&&now>=brain.aimAt&&now<brain.burstUntil&&distance<(w.flightRange??w.range)*.95&&(!w.projectile||distance>7);
  if(task.kind==='rotate'&&task.urgent&&distance>12)fire=false;
  if(p.inventory&&now-(brain.attackedAt??-100)<1.5&&now>(brain.buildAt||0)&&r()<skill.build*.12){
   const material=['wood','brick','metal'].find(m=>p.materials[m]>=10);brain.buildAt=now+3+(4-sim.options.difficulty)*1.8;
   if(material&&p.grounded)return {yaw:Math.atan2(p.x-target.x,p.z-target.z),pitch:0,slot,buildMode:true,buildType:p.health<skill.retreat||distance<16?'wall':'stairs',buildMaterial:material,fire:true,forward:0,strafe:0};
  }
  if(now>(brain.nextGrenade||0)&&distance>8&&distance<19){brain.nextGrenade=now+6+r()*7;
   const friendly=[...sim.players.values()].some(t=>t!==p&&mode(sim.options.mode).teams&&t.team===p.team&&dist(t,target)<5);
   if(!friendly&&r()<skill.grenade){if(!p.inventory&&p.poppers>0){popper=true;pitch=.35;}else if(p.inventory){const index=p.inventory.findIndex(i=>i?.id==='popper');if(index>0)brain.utility={slot:index,yaw,pitch:.35,until:now+1};}}
  }
 }else if(target&&task.kind==='investigate'){yaw=Math.atan2(p.x-target.x,p.z-target.z);if(dist(p,target)<2){delete brain.memory[target.id];brain.decision=0;}}
 if(brain.utility&&brain.utility.until>now&&['popper','impulse','launchpad'].includes(p.inventory?.[brain.utility.slot]?.id)&&!p.use){slot=brain.utility.slot;yaw=brain.utility.yaw;pitch=brain.utility.pitch;fire=!p.useLatch;}
 const turnDt=clamp(now-brain.turnAt,0,.1);brain.turnAt=now;
 const desiredYaw=yaw;yaw=p.yaw+clamp(wrapAngle(yaw-p.yaw),-skill.turn*turnDt,skill.turn*turnDt);
 if(visible&&Math.abs(wrapAngle(desiredYaw-yaw))>.2)fire=false;
 const moving=Math.hypot(move.mx,move.mz)>.1;
 return {yaw,pitch,forward:-Math.sin(yaw)*move.mx-Math.cos(yaw)*move.mz,strafe:Math.cos(yaw)*move.mx-Math.sin(yaw)*move.mz,fire,aim:visible&&!popper&&sim.options.difficulty>=2,reload:p.ammo[slot]===0&&p.reserve[slot]>0,jump:move.jump,popper,slot,swapSlot:-1,interact,sprint:!!p.inventory&&!fire&&!visible&&moving&&['rotate','rotate-poi','search-room'].includes(task.kind)};
}
