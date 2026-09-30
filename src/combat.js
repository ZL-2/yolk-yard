import {COMBAT_LIMITS} from './weapon-balance.js';
export {COMBAT_PROFILES,RARITY_SCALE,combatProfile,rarityVariant} from './weapon-balance.js';
export function falloffAt(w,distance){const points=w.falloff;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(distance<=b[0])return a[1]+(b[1]-a[1])*Math.max(0,(distance-a[0])/(b[0]-a[0]));}return points.at(-1)[1];}
export const structureDamage=(w,distance)=>w.buildDamage*(w.buildFalloff?falloffAt(w,distance):1);
// Authoritative contacts use anatomical regions, independent of cosmetics.
export const criticalHit=(hit,person,w)=>w.critical>1&&(hit.region?hit.region==='head':hit.y-person.y>=1.505);
export function updateCombatAccuracy(p,w,a,dt,time,speed=0){
 if(a.weapon&&a.weapon!==w.id)for(const key of Object.keys(a))delete a[key];a.weapon=w.id;
 const settled=time-(a.lastShot??-100),walking=Math.min(1,speed/Math.max(1,w.speed));
 a.adsBlend=(a.adsBlend||0)+(Number(!!p.aim)-(a.adsBlend||0))*(1-Math.exp(-Math.log(20)*dt/w.adsTime));
 a.bloom=Math.max(0,(a.bloom||0)-(settled>w.recoveryDelay?w.bloomRecovery*dt:0));
 const crouch=p.crouching&&!p.sliding&&p.grounded!==false?w.crouchSpread:1,base=w.spread+(w.adsSpread-w.spread)*a.adsBlend,moveFactor=1+(w.movingADS-1)*a.adsBlend;
 const movement=walking*w.movementPenalty*moveFactor+(p.grounded===false?w.airPenalty:0)+(p.sprinting?w.sprintPenalty:0)+(p.sliding?w.slidePenalty:0);
 a.speed=speed;a.movement=movement;a.shot=base+a.bloom*(1+(w.bloomADS-1)*a.adsBlend);
 a.still=p.aim&&a.adsBlend>=.95&&p.grounded!==false&&!p.sliding&&!p.sprinting&&speed<.12&&!p.reloadEnd?(a.still||0)+dt:0;
 a.firstShot=!!w.firstShot&&a.still>=w.firstShot&&settled>=w.firstShot&&a.bloom<.0001;
 a.spread=a.firstShot?0:(a.shot+movement)*crouch*(p.focus?.8:1);
 if(w.stableScope&&a.adsBlend>=.995&&p.grounded!==false&&!p.sliding&&!p.sprinting)a.spread=0;
 a.recoilPitch=(a.recoilPitch||0)*Math.exp(-w.recoilRecovery*dt);a.recoilYaw=(a.recoilYaw||0)*Math.exp(-w.recoilRecovery*dt);if(settled>Math.max(.4,w.interval*1.5))a.sustain=0;return a;
}
export function firedAccuracy(p,w,a,time){
 a.lastShot=time;a.bloom=Math.min(w.bloomMax,(a.bloom||0)+w.bloomStep);a.firstShot=false;a.still=0;
 const serial=p.shotSerial=(p.shotSerial||0)+1,index=a.sustain||0,noise=Math.sin(serial*12.9898+(p.joinedOrder||0)*78.233)*w.recoilJitter;
 a.recoilPitch=Math.min(w.recoilCap,(a.recoilPitch||0)+w.recoilUp*(1+Math.min(12,index)*w.recoilRamp)*(1+(w.recoilADS-1)*(a.adsBlend||0)));
 a.recoilYaw=(a.recoilYaw||0)+w.recoilPattern[index%w.recoilPattern.length]*w.recoilSide+noise;a.sustain=index+1;updateCombatAccuracy(p,w,a,0,time,a.speed||0);return serial;
}
export function pelletOffsets(count,spread,seed,fixed=false){let n=seed|0;const random=()=>{n=Math.imul(n^n>>>16,0x45d9f3b);n=Math.imul(n^n>>>16,0x45d9f3b);return ((n^n>>>16)>>>0)/4294967296;},rotation=fixed?0:random()*Math.PI*2;return Array.from({length:count},(_,i)=>{const r=count>1?Math.sqrt(i/(count-1))*spread*.5:Math.sqrt(random())*spread*.5,angle=count>1?i*2.39996323+rotation:random()*Math.PI*2;return {yaw:Math.cos(angle)*r,pitch:Math.sin(angle)*r};});}
export const weaponReadyAt=(p,w)=>Math.max(p.weaponCooldowns?.[w.id]||0,w.shotgunLock?p.shotgunReadyAt||0:0);
export function rememberShot(p,w,time){p.weaponCooldowns??={};p.weaponCooldowns[w.id]=time+w.interval;if(w.shotgunLock)p.shotgunReadyAt=time+w.interval;p.nextShot=p.weaponCooldowns[w.id];}
export function triggerRequested(p,w,input,time){const edge=input.firePress>(p.lastFirePress||0)||!!input.fire&&!p.fireLatch;if(edge){p.lastFirePress=Math.max(p.lastFirePress||0,input.firePress||0);p.pendingFireUntil=time+COMBAT_LIMITS.triggerBuffer;}return w.automatic||p.bot?!!input.fire:p.pendingFireUntil>0&&p.pendingFireUntil+1e-9>=time;}
export function crosshairRadius(spread,height,projectionY){return Math.tan(Math.min(Math.max(0,spread)*.5,1))*height*projectionY/2;}
