import {gun,clamp} from './data.js';
import {weaponReadyAt} from './combat.js';
import {COMBAT_LIMITS} from './weapon-balance.js';

// Presentation and host readiness share one clock, so a hidden blaster cannot
// fire early. Each silhouette has its own lift, wrist roll and settling time.
export const DRAW_POSES={
 sprinter:{offset:[.10,-.86,.16],rotation:[-.48,.12,-.26]},
 zipper:{offset:[.17,-.78,.12],rotation:[-.38,.22,-.38]},
 anchor:{offset:[.06,-.98,.20],rotation:[-.60,.08,-.19]},
 duet:{offset:[.15,-.87,.18],rotation:[-.44,-.17,-.32]},
 pip:{offset:[.29,-.70,.12],rotation:[-.30,-.25,-.58]},
 needle:{offset:[.07,-.95,.25],rotation:[-.55,.14,-.22]},
 scatter:{offset:[.18,-.92,.20],rotation:[-.52,-.12,-.38]},
 thumper:{offset:[.12,-1.02,.22],rotation:[-.62,.24,-.31]},
};
DRAW_POSES.peeper = DRAW_POSES.needle;
DRAW_POSES.doubleyolk = DRAW_POSES.scatter;
DRAW_POSES.comet = DRAW_POSES.sprinter;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export function beginEquip(player,time,holster=false){
 player.equipStarted=time;
 player.equipHolster=holster?COMBAT_LIMITS.holsterTime:0;
 player.equipUntil=time+player.equipHolster+gun(player).equipTime;
 player.nextShot=Math.max(weaponReadyAt(player,gun(player)),player.equipUntil);
 player.pendingFireUntil=0;player.burstLeft=0;player.burstWeapon=null;player.fireLatch=false;
}
export function equipPose(player,time){
 const w=gun(player),c=DRAW_POSES[w.id]||DRAW_POSES.sprinter;
 const active=player.health>0&&player.equipUntil>time;
 const elapsed=time-(player.equipStarted||0),holster=player.equipHolster||0;
 const progress=active?clamp((elapsed-holster)/w.equipTime,0,1):1;
 const amount=1-smooth(progress);
 // A small wrist settle gives the raised blaster weight without a camera jolt.
 const settle=progress>.7?Math.sin((progress-.7)/.3*Math.PI)*.025:0;
 return {active,progress,visible:!active||elapsed>=holster,
  holster:holster?smooth(elapsed/holster):1,
  position:c.offset.map(v=>v*amount),
  rotation:c.rotation.map((v,i)=>v*amount+(i===0?settle:0))};
}
