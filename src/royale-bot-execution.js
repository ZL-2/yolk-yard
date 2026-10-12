import {ROYALE_BOT_RANGE} from './field-refinement.js';
import {gun,clamp} from './data.js';
import {skillFor,wrapAngle} from './bot-config.js';
import {botAim,botTargetAim,steadyBotFire} from './bot-aim.js';
import {activeBotUtility} from './bot-utility.js';
export {royaleAimError} from './bot-aim.js';
// Cheap execution every physics tick, expensive sensing/objectives stay scheduled.
// Uses observed positions only. Never snap to hidden/live enemy positions.
export function executeRoyaleIntent(sim,p,input){
 if(!p.inventory||p.flight!=='ground'||!p.brain||input.buildMode||p.reviving)return input;
 const utility=activeBotUtility(p,sim.time);
 if(utility||input.utilityItem)input={...input,slot:utility?.slot??input.slot,desiredYaw:utility?.yaw??input.desiredYaw,desiredPitch:utility?.pitch??input.desiredPitch,combatAim:false,fire:!!utility&&p.slot===utility.slot&&sim.time>=(p.equipUntil||0)&&!p.useLatch,sprint:false,interact:false};
 if(p.use)return input;
 const brain=p.brain,now=sim.time,dt=clamp(now-(brain.executionAt??now-1/60),0,.05);brain.executionAt=now;
 const skill=skillFor(sim),target=brain.memory?.[brain.target],live=sim.players.get(brain.target),w=gun(p,input.slot??p.slot);
 let yaw=input.desiredYaw??input.yaw,pitch=input.desiredPitch??input.pitch,fire=input.fire,botBurstReady=false;
 if(input.combatAim&&live?.health>0&&!(live.aimBreakUntil>now)&&target?.visible&&now-target.seenAt<.65){
  const distance=Math.hypot(target.x-p.x,target.z-p.z);
  botAim(brain,p,skill,distance,now,dt,true,w.stableScope);
  const aim=botTargetAim(brain,p,target,w,skill,distance,now,dt);
  yaw=aim.yaw+brain.aimErrorX;pitch=aim.pitch+brain.aimErrorY;
  botBurstReady=distance<Math.min(ROYALE_BOT_RANGE.engage,(w.flightRange??w.range)*.95)&&(!w.projectile||distance>7)&&input.slot>0&&!(brain.task?.urgent&&distance>12)&&!input.holdFire;
  fire=steadyBotFire(brain,p,w,skill,now,botBurstReady);
  botBurstReady=botBurstReady&&now>=(brain.aimAt||0)&&now>=(brain.flinchUntil||0);
 }else if(input.combatAim)fire=false;
 const desired=yaw,desiredP=pitch;yaw=p.yaw+clamp(wrapAngle(yaw-p.yaw),-skill.turn*dt,skill.turn*dt);pitch=p.pitch+clamp(pitch-p.pitch,-1.9*dt,1.9*dt);
 if(input.combatAim&&(Math.abs(wrapAngle(desired-yaw))>.12||Math.abs(desiredP-pitch)>.12))fire=false;
 let mx=input.worldMoveX??0,mz=input.worldMoveZ??0;
 if(input.moveTarget){const dx=input.moveTarget.x-p.x,dz=input.moveTarget.z-p.z,len=Math.hypot(dx,dz),speed=len<.55?0:Math.min(1,len/1.3);mx=len?dx/len*speed:0;mz=len?dz/len*speed:0;}
 botBurstReady=botBurstReady&&Math.abs(wrapAngle(desired-yaw))<=.12&&Math.abs(desiredP-pitch)<=.12;
 return {...input,yaw,pitch,fire,botBurstReady,forward:-Math.sin(yaw)*mx-Math.cos(yaw)*mz,strafe:Math.cos(yaw)*mx-Math.sin(yaw)*mz,sprint:!!input.sprint&&!fire};
}
