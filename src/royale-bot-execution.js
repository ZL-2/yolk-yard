import {ROYALE_BOT_RANGE} from './field-refinement.js';
import {gun,clamp} from './data.js';
import {skillFor,wrapAngle} from './bot-config.js';
import {eyeHeight,bodyHeight} from './stance.js';
import {botAim,steadyBotFire} from './bot-aim.js';
export {royaleAimError} from './bot-aim.js';
// Cheap execution every physics tick, expensive sensing/objectives stay scheduled.
// Uses observed positions only. Never snap to hidden/live enemy positions.
export function executeRoyaleIntent(sim,p,input){
 if(!p.inventory||p.flight!=='ground'||!p.brain||input.buildMode||p.use||p.reviving)return input;
 const brain=p.brain,now=sim.time,dt=clamp(now-(brain.executionAt??now-1/60),0,.05);brain.executionAt=now;
 const skill=skillFor(sim),target=brain.memory?.[brain.target],w=gun(p,input.slot??p.slot);
 let yaw=input.desiredYaw??input.yaw,pitch=input.desiredPitch??input.pitch,fire=input.fire;
 if(input.combatAim&&sim.players.get(brain.target)?.health>0&&!(sim.players.get(brain.target)?.aimBreakUntil>now)&&target?.visible&&now-target.seenAt<.65){
  const distance=Math.hypot(target.x-p.x,target.z-p.z);
  botAim(brain,p,skill,distance,now,dt,true,w.stableScope);
  const age=Math.min(.35,Math.max(0,now-target.seenAt)),lead=(w.hitscan?0:Math.min(.45,distance/w.boltSpeed)*(w.stableScope?.85+skill.lead*.1:.65+skill.lead*.25))+age;
  const dx=target.x+(target.vx||0)*lead-p.x,dz=target.z+(target.vz||0)*lead-p.z;
  yaw=Math.atan2(-dx,-dz)+brain.aimErrorX;pitch=Math.atan2(target.y+bodyHeight(target)*.63-p.y-eyeHeight(p),Math.hypot(dx,dz))+brain.aimErrorY;
  fire=steadyBotFire(brain,p,w,skill,now,distance<Math.min(ROYALE_BOT_RANGE.engage,(w.flightRange??w.range)*.95)&&(!w.projectile||distance>7)&&input.slot>0&&!(brain.task?.urgent&&distance>12)&&!input.holdFire);
 }else if(input.combatAim)fire=false;
 const desired=yaw,desiredP=pitch;yaw=p.yaw+clamp(wrapAngle(yaw-p.yaw),-skill.turn*dt,skill.turn*dt);pitch=p.pitch+clamp(pitch-p.pitch,-1.9*dt,1.9*dt);
 if(input.combatAim&&(Math.abs(wrapAngle(desired-yaw))>.12||Math.abs(desiredP-pitch)>.12))fire=false;
 let mx=input.worldMoveX??0,mz=input.worldMoveZ??0;
 if(input.moveTarget){const dx=input.moveTarget.x-p.x,dz=input.moveTarget.z-p.z,len=Math.hypot(dx,dz),speed=len<.55?0:Math.min(1,len/1.3);mx=len?dx/len*speed:0;mz=len?dz/len*speed:0;}
 return {...input,yaw,pitch,fire,forward:-Math.sin(yaw)*mx-Math.cos(yaw)*mz,strafe:Math.cos(yaw)*mx-Math.sin(yaw)*mz,sprint:!!input.sprint&&!fire};
}
