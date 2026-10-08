import {clamp} from './data.js';
import {botIdentity} from './bot-personality.js';
export function royaleAimError(skill,distance){return skill.error*(.22+.7*clamp(distance/60,0,1));}
// Smooth, bounded aim cycles avoid entire lucky-perfect / hopeless-miss bursts.
// The physical offset keeps close-range bots fallible too. No hidden target data.
export function botAim(brain,p,skill,distance,now,dt,royale=true,precision=false){
 brain.aimPhase??=botIdentity(p)*Math.PI*2;
 const phase=brain.aimPhase+now*3.8+(p.shotSerial||0)*2.39996323,error=((royale?royaleAimError(skill,distance)*.36:skill.error*.32)+.10/Math.max(6,distance))*(precision?.48:1);
 const x=(Math.sin(phase)*.8+Math.sin(phase*1.71+1)*.2)*error;
 const y=Math.sin(phase*1.27+.7)*error*.35,blend=1-Math.exp(-Math.max(0,dt)*12);
 brain.aimErrorX=(brain.aimErrorX??x)+(x-(brain.aimErrorX??x))*blend;
 brain.aimErrorY=(brain.aimErrorY??y)+(y-(brain.aimErrorY??y))*blend;
 return {x:brain.aimErrorX,y:brain.aimErrorY};
}
export function botShotGap(w,skill){
 // Pace actual trigger pulls by weapon strength; never alter weapon damage or
 // grant target-specific protection. A native three-round burst counts as three.
 const pressure=30+skill.hit*40;
 return Math.max(w.interval+.06,w.damage*w.pellets*(w.burst||1)/pressure,w.stableScope&&w.damage>=75?2.8+skill.reaction:0);
}
export function steadyBotFire(brain,p,w,skill,now,ready){
 const serial=p.shotSerial||0;
 if(brain.fireWeapon!==w.id){
  brain.fireWeapon=w.id;brain.fireSerial=serial;brain.fireAfter=Math.max(brain.fireAfter||0,now+Math.max(.65,skill.reaction,w.damage*w.pellets>=90?1.1:0)+botIdentity(p)*.12);
 }
 if(serial!==brain.fireSerial){
  brain.fireSerial=serial;brain.fireAfter=now+botShotGap(w,skill)+.02+(1+Math.sin(serial*2.4+botIdentity(p)*6))*.02;brain.triggerUntil=0;
 }
 if(!ready||now<(brain.aimAt||0)||now<(brain.fireAfter||0)||p.reloadEnd>now)return false;
 // Brief request window; a failed/blocked equip does not accumulate catch-up fire.
 if(!brain.triggerUntil||now>=brain.triggerUntil){brain.triggerUntil=now+.09;brain.fireAfter=now+.18;}
 return now<brain.triggerUntil;
}
