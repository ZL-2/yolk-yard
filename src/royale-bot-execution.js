import {ROYALE_BOT_RANGE} from './field-refinement.js';
import {gun,clamp} from './data.js';
import {skillFor,wrapAngle} from './bot-config.js';
import {eyeHeight,bodyHeight} from './stance.js';
export function royaleAimError(skill,distance){return skill.error*(.22+.7*clamp(distance/60,0,1));}
// Cheap execution every physics tick, expensive sensing/objectives stay scheduled.
// Uses observed positions only. Never snap to hidden/live enemy positions.
export function executeRoyaleIntent(sim,p,input){
 if(!p.inventory||p.flight!=='ground'||!p.brain||input.buildMode||p.use||p.reviving)return input;
 const brain=p.brain,now=sim.time,dt=clamp(now-(brain.executionAt??now-1/60),0,.05);brain.executionAt=now;
 const skill=skillFor(sim),target=brain.memory?.[brain.target],w=gun(p,input.slot??p.slot);
 let yaw=input.desiredYaw??input.yaw,pitch=input.desiredPitch??input.pitch,fire=input.fire;
 if(input.combatAim&&sim.players.get(brain.target)?.health>0&&!(sim.players.get(brain.target)?.aimBreakUntil>now)&&target?.visible&&now-target.seenAt<.65){
  const distance=Math.hypot(target.x-p.x,target.z-p.z);
  if(brain.executionWeapon!==w.id){brain.executionWeapon=w.id;brain.aimAt=Math.max(brain.aimAt||0,now+Math.max(.65,skill.reaction));brain.burstUntil=0;brain.nextBurst=brain.aimAt;brain.errorAt=0;}
  if(now>=(brain.errorAt||0)){
   // Gradual correlated error instead of a whole burst being perfect or a miss.
   const error=royaleAimError(skill,distance);brain.errorAt=now+.24+(1-skill.hit)*.16;brain.biasX=(sim.random()+sim.random()-1)*error;brain.biasY=(sim.random()+sim.random()-1)*error*.7;
   if(brain.aimErrorX===undefined){brain.aimErrorX=brain.biasX;brain.aimErrorY=brain.biasY;}
  }
  const blend=1-Math.exp(-dt*5);brain.aimErrorX=(brain.aimErrorX||0)+((brain.biasX||0)-(brain.aimErrorX||0))*blend;brain.aimErrorY=(brain.aimErrorY||0)+((brain.biasY||0)-(brain.aimErrorY||0))*blend;
  const age=Math.min(.22,Math.max(0,now-target.seenAt)),lead=(w.hitscan?0:Math.min(.45,distance/w.boltSpeed)*skill.lead)+age;
  const dx=target.x+(target.vx||0)*lead-p.x,dz=target.z+(target.vz||0)*lead-p.z;
  yaw=Math.atan2(-dx,-dz)+brain.aimErrorX;pitch=Math.atan2(target.y+bodyHeight(target)*.63-p.y-eyeHeight(p),Math.hypot(dx,dz))+brain.aimErrorY;
  if(now>=brain.nextBurst){brain.burstUntil=now+.18+skill.burst*.4;brain.nextBurst=brain.burstUntil+.55+skill.pause*.7+sim.random()*.35;}
  fire=now>=brain.aimAt&&now<brain.burstUntil&&distance<Math.min(ROYALE_BOT_RANGE.engage,(w.flightRange??w.range)*.95)&&(!w.projectile||distance>7)&&input.slot>0;
  if(brain.task?.urgent&&distance>12)fire=false;
 }else if(input.combatAim)fire=false;
 const desired=yaw,desiredP=pitch;yaw=p.yaw+clamp(wrapAngle(yaw-p.yaw),-skill.turn*dt,skill.turn*dt);pitch=p.pitch+clamp(pitch-p.pitch,-1.9*dt,1.9*dt);
 if(input.combatAim&&(Math.abs(wrapAngle(desired-yaw))>.12||Math.abs(desiredP-pitch)>.12))fire=false;
 const mx=input.worldMoveX??0,mz=input.worldMoveZ??0;
 return {...input,yaw,pitch,fire,forward:-Math.sin(yaw)*mx-Math.cos(yaw)*mz,strafe:Math.cos(yaw)*mx-Math.sin(yaw)*mz,sprint:!!input.sprint&&!fire};
}
