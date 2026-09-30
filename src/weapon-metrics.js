import {weapon} from './data.js';
import {rarityVariant,UTILITY_WEAPONS} from './weapon-balance.js';
import {falloffAt,updateCombatAccuracy,firedAccuracy,pelletOffsets} from './combat.js';
import {humanHit,direction} from './physics.js';
export const REPRESENTATIVE_RANGES=w=>[{name:'Point blank',distance:2},{name:'Close',distance:12},{name:'Medium',distance:40},{name:'Long',distance:100},{name:'Maximum',distance:w.range-1}];
const rounded=n=>n===null?null:Math.round(n*10000)/10000;
export function eliminationTime(w,damage,health,distance){
 if(damage<=0||distance>w.range||w.projectile&&distance<w.minRange)return null;
 const count=Math.ceil((health-1e-8)/damage);if(count>Math.min(1000,w.magazine+w.reserveCap))return null;
 let time=0,ammo=w.magazine,index=0,trigger=0;
 for(let shot=1;shot<count;shot++){
  if(--ammo===0){time+=Math.ceil((w.reloadEmpty+1/60)*60-1e-9)/60;ammo=w.magazine;index=0;trigger=time;}
  else if(w.burst){if(++index<w.burst)time+=w.burstInterval;else {time=trigger+w.interval;trigger=time;index=0;}}
  else time+=w.interval;
 }
 return rounded(time+(!w.hitscan?distance/w.boltSpeed:0));
}
const cache=new Map();
// Standard anatomical target, deterministic shot dispersion and full recoil compensation.
// This estimates spread-limited continuous fire; controlled FSA shots can do better at range.
export function expectedShot(w,distance,head=false,stance='standing'){
 if(distance>w.range||w.projectile&&distance<w.minRange)return {damage:0,hitRate:0,criticalRate:0};
 if(w.projectile)return {damage:w.damage,hitRate:1,criticalRate:0};
 const key=[w.id,distance,head,stance].join(':');let value=cache.get(key);
 if(!value){
  const p={aim:true,grounded:stance!=='airborne',crouching:stance==='crouching',sliding:stance==='sliding',sprinting:stance==='sprinting',slot:0,joinedOrder:1},a={adsBlend:1},base=weapon(w.id);
  const speed=stance==='walking'||stance==='airborne'?5:stance==='sliding'?8:stance==='sprinting'?7.4:0,target={x:0,y:0,z:-distance,yaw:0,grounded:true},origin={x:0,y:1.7,z:0};
  const pitch=Math.atan2((head?1.68:1.19)-origin.y,distance);let hits=0,criticals=0,weighted=0,time=0;
  for(let i=0;i<90;i++){updateCombatAccuracy(p,base,a,1/60,time,speed);time+=1/60;}
  const samples=192;
  for(let shot=0;shot<samples;shot++){
   for(const offset of pelletOffsets(base.pellets,a.spread,shot*7919+31,base.patternFixed)){
    const contact=humanHit(origin,direction(offset.yaw,pitch+offset.pitch),target,base.hitRadius);
    if(contact.distance<=base.range){hits++;const headHit=contact.region==='head';criticals+=Number(headHit);weighted+=headHit?base.critical:1;}
   }
   firedAccuracy(p,base,a,time);
   const pause=base.burst?(shot%base.burst<base.burst-1?base.burstInterval:base.interval-(base.burst-1)*base.burstInterval):base.interval;
   for(let i=0;i<Math.round(pause*60);i++){time+=1/60;updateCombatAccuracy(p,base,a,1/60,time,speed);}
  }
  value={weighted:weighted/samples,hitRate:hits/(samples*base.pellets),criticalRate:criticals/(samples*base.pellets)};cache.set(key,value);
 }
 return {damage:w.damage*falloffAt(w,distance)*value.weighted,hitRate:value.hitRate,criticalRate:value.criticalRate};
}
export function weaponMetrics(id,rarity,distance,stance='standing'){
 const w=rarityVariant(weapon(id),rarity),active=distance<=w.range&&(!w.projectile||distance>=w.minRange),body=active?w.damage*w.pellets*falloffAt(w,distance):0,head=body*w.critical;
 const estimatedBody=expectedShot(w,distance,false,stance),estimatedHead=expectedShot(w,distance,true,stance);
 return {weapon:w.name,id,category:w.category,rarity,distance,stance,damage:rounded(w.damage*w.pellets),criticalDamage:rounded(w.damage*w.pellets*w.critical),fireRate:rounded(w.roundsPerSecond),dps:rounded(body*w.roundsPerSecond),magazine:w.magazine,reload:w.reload,reloadEmpty:w.reloadEmpty,fullDamageRange:w.falloffStart,range:w.range,falloff:w.falloff,projectileSpeed:w.hitscan?null:w.boltSpeed,hitRadius:w.hitRadius,hipSpread:w.spread,adsSpread:w.adsSpread,recoilVertical:w.recoilUp,recoilHorizontal:w.recoilSide,bodyDamage:rounded(body),headDamage:rounded(head),bodyHitRate:rounded(estimatedBody.hitRate),criticalHitRate:rounded(estimatedHead.criticalRate),bodyTtk100:eliminationTime(w,body,100,distance),headTtk100:eliminationTime(w,head,100,distance),bodyTtk200:eliminationTime(w,body,200,distance),headTtk200:eliminationTime(w,head,200,distance),estimatedBodyTtk100:eliminationTime(w,estimatedBody.damage,100,distance),estimatedHeadTtk100:eliminationTime(w,estimatedHead.damage,100,distance),estimatedBodyTtk200:eliminationTime(w,estimatedBody.damage,200,distance),estimatedHeadTtk200:eliminationTime(w,estimatedHead.damage,200,distance),purpose:w.purpose,weakness:w.weakness};
}
