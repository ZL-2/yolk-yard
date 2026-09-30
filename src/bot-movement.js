// Arena combat execution only: normal navigation and Royale use their existing movement.
export const ARENA_BOT_COMBAT=Object.freeze({lateralInput:.60,directionAcceleration:2.4,decisionMinimum:1.35,sideHoldMin:1.8,sideHoldExtra:1.2,turnRate:2.8,pitchRate:1.6});
export function smoothArenaCombatMovement(brain,move,yaw,now,active){
 if(!active){brain.arenaCombatMove=null;return {forward:-Math.sin(yaw)*move.mx-Math.cos(yaw)*move.mz,strafe:Math.cos(yaw)*move.mx-Math.sin(yaw)*move.mz};}
 const previous=brain.arenaCombatMove||{mx:0,mz:0,time:now-1/60},dt=Math.max(0,Math.min(.1,now-previous.time));
 const dx=move.mx-previous.mx,dz=move.mz-previous.mz,length=Math.hypot(dx,dz),step=ARENA_BOT_COMBAT.directionAcceleration*dt,blend=length?Math.min(1,step/length):0;
 const mx=previous.mx+dx*blend,mz=previous.mz+dz*blend;brain.arenaCombatMove={mx,mz,time:now};
 const lateral=Math.cos(yaw)*mx-Math.sin(yaw)*mz;
 return {forward:-Math.sin(yaw)*mx-Math.cos(yaw)*mz,strafe:Math.max(-ARENA_BOT_COMBAT.lateralInput,Math.min(ARENA_BOT_COMBAT.lateralInput,lateral))};
}
