import {clamp} from './data.js';
import {botIdentity} from './bot-personality.js';
import {eyeHeight,bodyHeight} from './stance.js';
export function royaleAimError(skill,distance){return skill.error*(.22+.7*clamp(distance/60,0,1));}
// Smooth, bounded aim cycles avoid entire lucky-perfect / hopeless-miss bursts.
// The physical offset keeps close-range bots fallible too. No hidden target data.
export function botAim(brain,p,skill,distance,now,dt,royale=true,precision=false){
 brain.aimPhase??=botIdentity(p)*Math.PI*2;
 const phase=brain.aimPhase+now*3.8+(p.shotSerial||0)*2.39996323;
 const physicalError=(skill.aimOffset??.18)*(1+2*clamp(1-distance/30,0,1));
 const error=(royale?royaleAimError(skill,distance)*.6:skill.error*.42)*(precision?.8:1)+physicalError/Math.max(6,distance);
 const x=(Math.sin(phase)*.8+Math.sin(phase*1.71+1)*.2)*error;
 const y=Math.sin(phase*1.27+.7)*error*.55,blend=1-Math.exp(-Math.max(0,dt)*(skill.trackingRate??5.5));
 brain.aimBlend=blend;brain.aimStep=dt;
 brain.aimErrorX=(brain.aimErrorX??x)+(x-(brain.aimErrorX??x))*blend;
 brain.aimErrorY=(brain.aimErrorY??y)+(y-(brain.aimErrorY??y))*blend;
 const aim=brain.aimOffsets??={};aim.x=brain.aimErrorX;aim.y=brain.aimErrorY;return aim;
}
// Hold and correct a small cached observation, without live position reads or
// the old perfect age compensation. A reversal takes time to notice and follow.
export function botTargetAim(brain,p,target,w,skill,distance,now,dt){
 if(brain.trackTarget!==target.id){
  brain.trackTarget=target.id;brain.trackedX=target.x;brain.trackedY=target.y;brain.trackedZ=target.z;brain.trackAt=0;
 }
 if(now>=brain.trackAt){
  brain.trackX=target.x;brain.trackY=target.y;brain.trackZ=target.z;brain.trackVX=target.vx||0;brain.trackVZ=target.vz||0;brain.trackHeight=bodyHeight(target);
  brain.trackSeenAt=target.seenAt??now;brain.trackAt=now+(skill.trackingDelay??.24);
 }
 const blend=brain.aimStep===dt?brain.aimBlend:1-Math.exp(-Math.max(0,dt)*(skill.trackingRate??5.5));
 brain.trackedX+=(brain.trackX-brain.trackedX)*blend;brain.trackedY+=(brain.trackY-brain.trackedY)*blend;brain.trackedZ+=(brain.trackZ-brain.trackedZ)*blend;
 // Partially anticipate established motion. Sampled velocity stays stale through
 // reversals, so this never has the old exact per-tick motion compensation.
 const lead=(w.hitscan?0:Math.min(.3,distance/w.boltSpeed)*skill.lead)+(clamp(now-brain.trackSeenAt,0,.35)+1/(skill.trackingRate??5.5))*(skill.trackingLead??.7);
 const dx=brain.trackedX+brain.trackVX*lead-p.x,dz=brain.trackedZ+brain.trackVZ*lead-p.z;
 const aim=brain.trackedAim??={};aim.yaw=Math.atan2(-dx,-dz);aim.pitch=Math.atan2(brain.trackedY+brain.trackHeight*.63-p.y-eyeHeight(p),Math.hypot(dx,dz));return aim;
}
export function botCombatReady(brain,p,skill,now){
 // Each distinct damage time can cause a short flinch. Sustained incoming fire
 // does not stack an unlimited stun; a bot can recover and return fire.
 if(Number.isFinite(p.lastDamage)&&p.lastDamage!==brain.flinchDamage){
  brain.flinchDamage=p.lastDamage;
  if(now-p.lastDamage<.25&&now>=(brain.flinchAgainAt||0)){
   brain.flinchUntil=now+(skill.flinch??.36);brain.flinchAgainAt=now+.9;brain.triggerUntil=0;
  }
 }
 return now>=(brain.aimAt||0)&&now>=(brain.flinchUntil||0);
}
export const botBurstGap=(w,skill)=>Math.max(w.burstInterval||0,skill.burstGap??.28);
export function botShotGap(w,skill){
 // Pace actual trigger pulls by weapon strength; never alter weapon damage or
 // grant target-specific protection. A native three-round burst counts as three.
 const pressure=22+skill.hit*34;
 return Math.max(w.interval+.06,w.damage*w.pellets*(w.burst||1)/pressure,w.stableScope&&w.damage>=75?2.8+skill.reaction:0);
}
export function steadyBotFire(brain,p,w,skill,now,ready){
 const serial=p.shotSerial||0;
 if(brain.fireWeapon!==w.id){
  brain.fireWeapon=w.id;brain.fireSerial=serial;brain.fireAfter=Math.max(brain.fireAfter||0,now+Math.max(.8,skill.reaction,w.damage*w.pellets>=90?1.35:0)+botIdentity(p)*.18);
 }
 if(serial!==brain.fireSerial){
  brain.fireSerial=serial;brain.fireAfter=now+botShotGap(w,skill)+.02+(1+Math.sin(serial*2.4+botIdentity(p)*6))*.02;brain.triggerUntil=0;
 }
 if(!botCombatReady(brain,p,skill,now)||!ready||now<(brain.fireAfter||0)||p.reloadEnd>now)return false;
 // Brief request window; a failed/blocked equip does not accumulate catch-up fire.
 if(!brain.triggerUntil||now>=brain.triggerUntil){brain.triggerUntil=now+.09;brain.fireAfter=now+.18;}
 return now<brain.triggerUntil;
}
