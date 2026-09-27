// Original Yolk Yard game balance. Angles are radians; distances are map units.
// This module is shared by host simulation, prediction, HUD and bot planning.
const base={critical:1.75,hitscan:true,gravity:0,projectile:false,pellets:1,falloff:[[0,1],[35,1],[90,.65],[180,.45]],spread:.032,adsSpread:.007,movementPenalty:.022,airPenalty:.04,sprintPenalty:.055,bloomStep:.008,bloomMax:.05,bloomRecovery:.11,recoveryDelay:.14,firstShot:.3,recoilUp:.006,recoilSide:.0018,recoilRecovery:9,recoilADS:.65,buildDamage:24,range:250,flightRange:250,boltSpeed:180,engage:[12,45],magazine:24,reserve:240,reload:2.2,reloadEmpty:2.5,interval:.15,automatic:true};
export const COMBAT_PROFILES={
 sprinter:{damage:22,magazine:30,interval:.14,falloff:[[0,1],[35,1],[90,.7],[180,.45]],engage:[14,48],recoilUp:.0065,buildDamage:26},
 scatter:{damage:8.5,pellets:10,critical:1.5,magazine:5,reserve:40,interval:.9,automatic:false,reload:3,reloadEmpty:3.3,spread:.15,adsSpread:.11,movementPenalty:.018,airPenalty:.028,bloomStep:.01,bloomMax:.02,firstShot:0,recoilUp:.017,recoilSide:.002,falloff:[[0,1],[7,1],[18,.45],[35,.08],[55,0]],range:55,flightRange:55,engage:[3,9],buildDamage:6},
 needle:{damage:82,critical:2,hitscan:false,magazine:1,reserve:30,interval:1.65,automatic:false,reload:2.6,reloadEmpty:2.6,spread:.13,adsSpread:0,movementPenalty:.05,airPenalty:.07,stableScope:true,bloomStep:0,bloomMax:0,firstShot:0,recoilUp:.025,recoilSide:.001,recoilRecovery:7,falloff:[[0,1],[600,1]],range:600,flightRange:600,boltSpeed:190,gravity:.8,engage:[40,130],buildDamage:85},
 zipper:{damage:14,critical:1.5,magazine:36,interval:.075,reload:2.1,reloadEmpty:2.35,spread:.042,adsSpread:.022,movementPenalty:.017,airPenalty:.038,bloomStep:.005,bloomMax:.052,firstShot:0,recoilUp:.0034,recoilSide:.0027,falloff:[[0,1],[15,1],[40,.45],[90,.18]],engage:[5,22],buildDamage:17},
 thumper:{damage:90,automatic:false,critical:1,projectile:true,hitscan:false,magazine:1,reserve:12,interval:1.4,reload:3.2,reloadEmpty:3.2,spread:.012,adsSpread:.006,movementPenalty:.009,airPenalty:.015,bloomStep:0,bloomMax:0,firstShot:0,recoilUp:.019,falloff:[[0,1],[180,1]],range:180,flightRange:180,boltSpeed:32,gravity:3,splashRadius:5,minRange:3,engage:[15,45],buildDamage:160},
 anchor:{damage:46,critical:1.8,magazine:6,reserve:54,interval:.58,automatic:false,reload:2.35,reloadEmpty:2.6,spread:.075,adsSpread:0,stableScope:true,bloomStep:0,bloomMax:0,firstShot:0,recoilUp:.016,recoilRecovery:8,falloff:[[0,1],[65,1],[170,.8],[300,.65]],range:350,flightRange:350,engage:[30,95],buildDamage:49},
 duet:{damage:20,magazine:24,interval:.47,burst:3,burstInterval:.09,automatic:false,spread:.025,adsSpread:.004,bloomStep:.003,bloomMax:.025,firstShot:.33,recoilUp:.0045,recoilSide:.001,falloff:[[0,1],[42,1],[120,.7],[220,.5]],engage:[20,65],buildDamage:22},
 pip:{damage:24,critical:2,magazine:12,reserve:120,interval:.25,automatic:false,reload:1.6,reloadEmpty:1.9,spread:.035,adsSpread:.008,bloomStep:.01,bloomMax:.045,firstShot:.26,recoilUp:.009,falloff:[[0,1],[20,1],[55,.55],[100,.25]],engage:[5,25],buildDamage:22},
 peeper:{damage:36,critical:1.75,magazine:10,reserve:60,interval:.37,automatic:false,reload:2.2,reloadEmpty:2.5,spread:.065,adsSpread:0,stableScope:true,bloomStep:0,bloomMax:0,firstShot:0,recoilUp:.012,falloff:[[0,1],[70,1],[150,.8],[300,.55]],range:350,flightRange:350,engage:[30,100],buildDamage:38},
 doubleyolk:{damage:6.4,pellets:10,critical:1.5,magazine:8,reserve:56,interval:.48,automatic:false,reload:2.5,reloadEmpty:2.8,spread:.17,adsSpread:.135,movementPenalty:.013,airPenalty:.024,bloomStep:.008,bloomMax:.028,firstShot:0,recoilUp:.012,falloff:[[0,1],[6,1],[16,.5],[30,.12],[50,0]],range:50,flightRange:50,engage:[3,10],buildDamage:5},
 comet:{damage:25,critical:1.6,magazine:24,interval:.19,reload:2.1,reloadEmpty:2.4,spread:.022,adsSpread:.004,movementPenalty:.015,airPenalty:.034,bloomStep:.006,bloomMax:.03,firstShot:.26,recoilUp:.005,recoilSide:.0008,falloff:[[0,1],[48,1],[120,.75],[250,.55]],range:300,flightRange:300,engage:[20,65],buildDamage:28},
};
export const RARITY_SCALE=[{damage:1,reload:1},{damage:1.04,reload:.975},{damage:1.08,reload:.95},{damage:1.12,reload:.925},{damage:1.16,reload:.9}];
export function combatProfile(id){const c={...base,...COMBAT_PROFILES[id]};return {...c,aimSpread:c.spread?c.adsSpread/c.spread:0,spreadMax:c.bloomMax,shotBloom:c.bloomStep,spreadRecovery:c.bloomRecovery/30,movementSpread:1};}
export function rarityVariant(w,rarity){const scale=RARITY_SCALE[Math.max(0,Math.min(4,Math.floor(rarity)||0))];return {...w,damage:w.damage*scale.damage,buildDamage:w.buildDamage*scale.damage,reload:w.reload*scale.reload,reloadEmpty:w.reloadEmpty*scale.reload};}
export function falloffAt(w,distance){const points=w.falloff;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(distance<=b[0])return a[1]+(b[1]-a[1])*Math.max(0,(distance-a[0])/(b[0]-a[0]));}return points.at(-1)[1];}
export const criticalHit=(hit,egg,w)=>w.critical>1&&(hit.y-egg.y)/(egg.bodyScale||1)>=1.32;
export function updateCombatAccuracy(p,w,a,dt,time,speed=0){
 if(a.weapon&&a.weapon!==w.id)for(const key of Object.keys(a))delete a[key];a.weapon=w.id;
 const settled=time-(a.lastShot??-100),stable=p.aim&&w.stableScope,walking=Math.min(1,speed/Math.max(1,w.speed));
 a.bloom=Math.max(0,(a.bloom||0)-(settled>w.recoveryDelay?w.bloomRecovery*dt:0));
 const movement=stable?0:walking*w.movementPenalty+(p.grounded===false?w.airPenalty:0)+(p.sprinting?w.sprintPenalty:0);
 a.movement=movement;a.shot=(p.aim?w.adsSpread:w.spread)+a.bloom*(p.aim?.65:1);
 a.still=(p.aim&&p.grounded!==false&&speed<.12&&!p.reloadEnd)?(a.still||0)+dt:0;
 a.firstShot=!!w.firstShot&&a.still>=w.firstShot&&settled>=w.firstShot&&a.bloom<.0001;
 a.spread=a.firstShot?0:stable?0:a.shot+movement;
 a.recoilPitch=(a.recoilPitch||0)*Math.exp(-w.recoilRecovery*dt);a.recoilYaw=(a.recoilYaw||0)*Math.exp(-w.recoilRecovery*dt);
 return a;
}
export function firedAccuracy(p,w,a,time){a.lastShot=time;a.bloom=Math.min(w.bloomMax,(a.bloom||0)+w.bloomStep);a.firstShot=false;a.still=0;const serial=p.shotSerial=(p.shotSerial||0)+1,pattern=[.6,-.35,.8,-.6,.25,-.4];a.recoilPitch=Math.min(.12,(a.recoilPitch||0)+w.recoilUp*(p.aim?w.recoilADS:1));a.recoilYaw=(a.recoilYaw||0)+pattern[serial%pattern.length]*w.recoilSide;return serial;}
export function pelletOffsets(count,spread,seed){let n=seed|0;const random=()=>{n=Math.imul(n^n>>>16,0x45d9f3b);n=Math.imul(n^n>>>16,0x45d9f3b);return ((n^n>>>16)>>>0)/4294967296;},rotation=random()*Math.PI*2;return Array.from({length:count},(_,i)=>{const radius=count>1?Math.sqrt(i/(count-1))*spread*.5:Math.sqrt(random())*spread*.5,angle=count>1?i*2.39996323+rotation:random()*Math.PI*2;return {yaw:Math.cos(angle)*radius,pitch:Math.sin(angle)*radius};});}
