import {mode,gun,weapon} from './data.js';
import {teammates,teamMode} from './teams.js';
import {smokeBlocks} from './season-world.js';
import {wallDistance,dist} from './physics.js';
import {eyeHeight,bodyHeight} from './stance.js';
import {wrapAngle,BOT_WORLD_SENSES} from './bot-config.js';
export const hostile=(sim,p,t)=>t!==p&&t.health>0&&!t.spectating&&t.flight!=='transport'&&!teammates(sim.options,p,t);
export function seesPoint(sim,p,t){const o={x:p.x,y:p.y+eyeHeight(p),z:p.z},d={x:t.x-o.x,y:t.y+bodyHeight(t)*.66-o.y,z:t.z-o.z},len=Math.hypot(d.x,d.y,d.z)||1;return !smokeBlocks(sim,o,{x:t.x,y:t.y+1,z:t.z})&&wallDistance(sim.map,o,{x:d.x/len,y:d.y/len,z:d.z/len},len)>=len-.08;}
export function newBrain(sim,p){return {memory:{},eventId:Math.max(0,sim.eventId-32),perceiveAt:0,decision:0,aimAt:0,nextBurst:0,burstUntil:0,turnAt:sim.time,checkAt:sim.time+1,lastX:p.x,lastZ:p.z,side:sim.random()<.5?-1:1,visited:{},lootMemory:{},objective:'survey',target:null,targetUntil:0};}
function hear(sim,p,brain,id,point,kind,damage=0){
 if(damage){brain.attackedAt=sim.time;brain.decision=0;brain.perceiveAt=0;}
 const previous=brain.memory[id];if(previous?.visible&&sim.time-previous.seenAt<.35){previous.damage=(previous.damage||0)+damage;if(damage)previous.damageAt=sim.time;previous.heardAt=sim.time;return;}
 const error=kind==='footstep'?3:kind==='damage'?5:8;
 const approximate={x:Math.round(point.x/4)*4+(sim.random()-.5)*error,y:point.y||0,z:Math.round(point.z/4)*4+(sim.random()-.5)*error};
 brain.memory[id]={...previous,...approximate,id,visible:false,heardAt:sim.time,updated:sim.time,confidence:kind==='damage'?.8:.5,damageAt:damage?sim.time:previous?.damageAt,damage:(previous?.damage||0)+damage,kind};
}
export function observe(sim,p,brain,skill){
 // Events interrupt a strategic action immediately; visual scans are staggered.
 let first=sim.events.length;while(first>0&&sim.events[first-1].id>brain.eventId)first--;
 for(let index=first;index<sim.events.length;index++){const e=sim.events[index];brain.eventId=e.id;if(sim.time-e.time>2)continue;
  if(e.type==='elimination'){delete brain.memory[e.target];continue;}
  if(e.type==='hit'&&e.target===p.id&&e.player!==p.id&&Number.isFinite(e.sourceX)){
   hear(sim,p,brain,e.player||'unknown', {x:e.sourceX,y:e.sourceY,z:e.sourceZ},'damage',e.amount||0);continue;
  }
  if(e.type==='hit'&&Number.isFinite(e.sourceX)){
   const mate=sim.players.get(e.target),enemy=sim.players.get(e.player);
   if(teammates(sim.options,p,mate)&&enemy&&hostile(sim,p,enemy)&&dist(p,mate)<skill.teamRange&&(dist(p,mate)<12||seesPoint(sim,p,mate))){
    hear(sim,p,brain,enemy.id,{x:e.sourceX,y:e.sourceY,z:e.sourceZ},'callout');brain.memory[enemy.id].allyThreatAt=sim.time;brain.assistMate=mate.id;brain.assistUntil=sim.time+3;brain.decision=0;brain.perceiveAt=0;
   }
  }
  const noisy=['shot','launch','explosion','harvest','royale-fx'].includes(e.type)||e.type==='royale-cue'&&['build-place','chest-open','land'].includes(e.cue);
  if(!noisy||e.player===p.id)continue;
  const source=e.origin||e;if(!Number.isFinite(source.x)||!Number.isFinite(source.z))continue;
  const actor=sim.players.get(e.player);if(actor&&!hostile(sim,p,actor))continue;
  if(dist(p,source)<skill.hearing){
   const id=e.player||'sound-'+e.id;hear(sim,p,brain,id,source,'sound');
   // A heard shot aimed into our vicinity is an active threat, even before it hits.
   const dx=p.x-source.x,dy=p.y+bodyHeight(p)*.66-source.y,dz=p.z-source.z,len=Math.hypot(dx,dy,dz)||1;
   if(e.type==='shot'&&e.shots?.some(s=>(s.vx*dx+s.vy*dy+s.vz*dz)/(Math.hypot(s.vx,s.vy,s.vz)*len)>.965)){
    brain.memory[id].engagedAt=sim.time;brain.decision=0;brain.perceiveAt=0;
   }
  }
 }
 if(sim.time<brain.perceiveAt)return;
 brain.perceiveAt=sim.time+skill.perception+sim.random()*.025;
 for(const m of Object.values(brain.memory))m.visible=false;
 for(const enemy of sim.players.values()){
  if(!hostile(sim,p,enemy))continue;const d=dist(p,enemy),angle=wrapAngle(Math.atan2(p.x-enemy.x,p.z-enemy.z)-p.yaw);
  if(d<skill.vision&&(Math.abs(angle)<skill.fov||d<20&&sim.time-(brain.memory[enemy.id]?.engagedAt??brain.memory[enemy.id]?.damageAt??-100)<2)&&seesPoint(sim,p,enemy)){
   const previous=brain.memory[enemy.id];brain.memory[enemy.id]={id:enemy.id,x:enemy.x,y:enemy.y,z:enemy.z,vx:enemy.vx||0,vz:enemy.vz||0,vy:enemy.vy||0,bodyScale:enemy.bodyScale||1,visible:true,seenAt:sim.time,updated:sim.time,confidence:1,health:enemy.health,weapon:gun(enemy).id,engagedAt:previous?.engagedAt,damageAt:previous?.damageAt,damage:(previous?.damage||0)*.8,kind:'visual'};
   Object.assign(brain.memory[enemy.id],{crouching:enemy.crouching,sliding:enemy.sliding,lowCrouch:enemy.lowCrouch,downed:enemy.downed});
  }else if(BOT_WORLD_SENSES.footsteps&&d<skill.steps*(enemy.crouching?.45:1)&&enemy.moving&&sim.time>(brain.footstepAt?.[enemy.id]||0)){
   brain.footstepAt??={};brain.footstepAt[enemy.id]=sim.time+.7;hear(sim,p,brain,enemy.id,enemy,'footstep');
  }
 }
 // A short-range callout carries the teammate's observation, never live enemy state.
 if(teamMode(sim.options)&&sim.time>(brain.shareAt||0)){
  brain.shareAt=sim.time+1.2;
  for(const mate of sim.players.values())if(mate!==p&&mate.team===p.team&&mate.health>0&&dist(p,mate)<skill.teamRange){
   const observation=mate.brain?.memory?.[mate.brain.target];if(observation?.visible&&sim.time-observation.seenAt<.5&&!brain.memory[observation.id])hear(sim,p,brain,observation.id,observation,'callout');
  }
 }
 for(const [id,m]of Object.entries(brain.memory)){
  const age=sim.time-m.updated;if(age>skill.memory){delete brain.memory[id];continue;}
  m.confidence=Math.max(.05,(m.kind==='visual'?1:.65)*(1-age/skill.memory));m.damage=(m.damage||0)*.93;
 }
}
export function threatScore(sim,p,brain,m){
 const d=dist(p,m),age=Math.max(0,sim.time-(m.updated??m.seenAt??0));
 const active=sim.time-Math.max(m.damageAt??-100,m.engagedAt??-100)<2.4;
 const close=Math.max(0,1-d/22),incoming=active?(26+close*48):0;
 const enemyWeapon=m.weapon?weapon(m.weapon):null,own=gun(p);
 const matchup=enemyWeapon?.pellets>1&&d<12?12:enemyWeapon?.projectile&&d<9?-10:0;
 const vulnerable=p.health<40&&active?10:0;
 const exposed=m.visible?45:6,weaponFit=own.pellets>1?(d<12?9:-6):own.optic==='scope'?(d>22?5:-3):0;
 let help=0;if(teamMode(sim.options))for(const t of sim.players.values())if(teammates(sim.options,t,p)&&t.health>0&&t.brain?.target===m.id&&dist(t,p)<25){help=6;break;}
 const storm=sim.storm?.active&&d>20&&Math.hypot(m.x-sim.storm.nextX,m.z-sim.storm.nextZ)>sim.storm.nextRadius?16:0;
 const allyDanger=sim.time-(m.allyThreatAt??-100)<3?14:0;
 return exposed+(m.confidence||0)*22+Math.min(40,m.damage||0)+incoming+matchup+vulnerable+weaponFit+help+allyDanger+(m.health<40?6:0)-Math.log1p(d)*8-age*3-storm-(m.downed?35:0);
}
export function selectThreat(sim,p,brain,skill){
 const memories=Object.values(brain.memory).filter(m=>!sim.players.has(m.id)||hostile(sim,p,sim.players.get(m.id)));
 let next=null,best=-Infinity;
 for(const m of memories){const value=threatScore(sim,p,brain,m);if(value>best){best=value;next=m;}}
 const current=memories.find(m=>m.id===brain.target);
 if(current&&next&&next!==current){
  const immediate=dist(p,next)<16&&sim.time-Math.max(next.damageAt??-100,next.engagedAt??-100)<2.4;
  const margin=immediate?14:sim.time<brain.targetUntil?32:18;
  if(best<threatScore(sim,p,brain,current)+margin)next=current;
 }
 if(next?.id!==brain.target){brain.target=next?.id||null;brain.aimAt=sim.time+skill.reaction;brain.targetUntil=sim.time+1.2;brain.decision=0;}
 return next||null;
}
