import {mode} from './data.js';
import {wallDistance,dist,EYE} from './physics.js';
import {wrapAngle,BOT_WORLD_SENSES} from './bot-config.js';
export const hostile=(sim,p,t)=>t!==p&&t.health>0&&!t.spectating&&t.flight!=='transport'&&(!mode(sim.options.mode).teams||t.team!==p.team);
export function seesPoint(sim,p,t){const o={x:p.x,y:p.y+EYE,z:p.z},d={x:t.x-o.x,y:t.y+.9-o.y,z:t.z-o.z},len=Math.hypot(d.x,d.y,d.z)||1;return wallDistance(sim.map,o,{x:d.x/len,y:d.y/len,z:d.z/len},len)>=len-.08;}
export function newBrain(sim,p){return {memory:{},eventId:Math.max(0,sim.eventId-32),perceiveAt:0,decision:0,aimAt:0,nextBurst:0,burstUntil:0,turnAt:sim.time,checkAt:sim.time+1,lastX:p.x,lastZ:p.z,side:sim.random()<.5?-1:1,visited:{},lootMemory:{},objective:'survey',target:null,targetUntil:0};}
function hear(sim,p,brain,id,point,kind,damage=0){
 if(damage){brain.attackedAt=sim.time;brain.decision=0;brain.perceiveAt=0;}
 const previous=brain.memory[id];if(previous?.visible&&sim.time-previous.seenAt<.35){previous.damage=(previous.damage||0)+damage;return;}
 const error=kind==='footstep'?3:kind==='damage'?5:8;
 const approximate={x:Math.round(point.x/4)*4+(sim.random()-.5)*error,y:point.y||0,z:Math.round(point.z/4)*4+(sim.random()-.5)*error};
 brain.memory[id]={...previous,...approximate,id,visible:false,heardAt:sim.time,updated:sim.time,confidence:kind==='damage'?.8:.5,damage:(previous?.damage||0)+damage,kind};
}
export function observe(sim,p,brain,skill){
 // Events interrupt a strategic action immediately; visual scans are staggered.
 for(const e of sim.events){if(e.id<=brain.eventId)continue;brain.eventId=e.id;if(sim.time-e.time>2)continue;
  if(e.type==='elimination'){delete brain.memory[e.target];continue;}
  if(e.type==='hit'&&e.target===p.id&&e.player!==p.id&&Number.isFinite(e.sourceX)){
   hear(sim,p,brain,e.player||'unknown', {x:e.sourceX,y:e.sourceY,z:e.sourceZ},'damage',e.amount||0);continue;
  }
  const noisy=['shot','launch','explosion','harvest','royale-fx'].includes(e.type)||e.type==='royale-cue'&&['build-place','chest-open','land'].includes(e.cue);
  if(!noisy||e.player===p.id)continue;
  const source=e.origin||e;if(!Number.isFinite(source.x)||!Number.isFinite(source.z))continue;
  const actor=sim.players.get(e.player);if(actor&&!hostile(sim,p,actor))continue;
  if(dist(p,source)<skill.hearing)hear(sim,p,brain,e.player||'sound-'+e.id,source,'sound');
 }
 if(sim.time<brain.perceiveAt)return;
 brain.perceiveAt=sim.time+skill.perception+sim.random()*.025;
 for(const m of Object.values(brain.memory))m.visible=false;
 for(const enemy of sim.players.values()){
  if(!hostile(sim,p,enemy))continue;const d=dist(p,enemy),angle=wrapAngle(Math.atan2(p.x-enemy.x,p.z-enemy.z)-p.yaw);
  if(d<skill.vision&&Math.abs(angle)<skill.fov&&seesPoint(sim,p,enemy)){
   const previous=brain.memory[enemy.id];brain.memory[enemy.id]={id:enemy.id,x:enemy.x,y:enemy.y,z:enemy.z,vx:enemy.vx||0,vz:enemy.vz||0,vy:enemy.vy||0,bodyScale:enemy.bodyScale||1,visible:true,seenAt:sim.time,updated:sim.time,confidence:1,health:enemy.health,damage:(previous?.damage||0)*.8,kind:'visual'};
  }else if(BOT_WORLD_SENSES.footsteps&&d<skill.steps&&enemy.moving&&sim.time>(brain.footstepAt?.[enemy.id]||0)){
   brain.footstepAt??={};brain.footstepAt[enemy.id]=sim.time+.7;hear(sim,p,brain,enemy.id,enemy,'footstep');
  }
 }
 // A short-range callout carries the teammate's observation, never live enemy state.
 if(mode(sim.options.mode).teams&&sim.time>(brain.shareAt||0)){
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
export function selectThreat(sim,p,brain,skill){
 const memories=Object.values(brain.memory);
 const score=m=>(m.visible?45:8)+m.confidence*25+Math.min(60,m.damage||0)+(m.health<40?7:0)-Math.min(60,dist(p,m))*.35+(m.id===brain.target?18:0);
 memories.sort((a,b)=>score(b)-score(a));let next=memories[0];const current=brain.memory[brain.target];
 if(current&&sim.time<brain.targetUntil&&next&&score(next)<score(current)+35)next=current;
 if(next?.id!==brain.target){brain.target=next?.id||null;brain.aimAt=sim.time+skill.reaction;brain.targetUntil=sim.time+1.2;brain.decision=0;}
 return next||null;
}
