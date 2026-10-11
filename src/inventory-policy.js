import {gun} from './data.js';
import {ITEMS,ammoType} from './royale-data.js';
export const SLOT_GROUPS=Object.freeze(['shotgun','rifle','healing','mobility']);
export function sanitizeSlotPreferences(value){
 const result={};for(const key of SLOT_GROUPS)result[key]=Number.isInteger(value?.[key])&&value[key]>=1&&value[key]<=5?value[key]:0;return result;
}
export function itemGroup(item){
 if(item?.weapon)return ['scatter','doubleyolk'].includes(item.id)?'shotgun':['sprinter','duet','comet','anchor','peeper','needle'].includes(item.id)?'rifle':null;
 const kind=ITEMS[item?.id]?.kind;return ['heal','shield','splash'].includes(kind)?'healing':['winch','shadowstep','jumpRig','impulse','launchpad'].includes(kind)?'mobility':null;
}
export function vacantSlot(p,item){
 const preferred=p.pickupPreferences?.[itemGroup(item)];
 if(Number.isInteger(preferred)&&preferred>=1&&preferred<=5&&!p.inventory[preferred])return preferred;
 for(let i=1;i<=5;i++)if(!p.inventory[i])return i;return -1;
}
export function stackCapacity(p,item){
 if(!item||item.weapon||!ITEMS[item.id])return 0;
 const max=ITEMS[item.id].stack||1;let room=0;
 for(let i=1;i<=5;i++){const entry=p.inventory?.[i];if(!entry)room+=max;else if(entry.id===item.id)room+=Math.max(0,max-entry.count);}
 return room;
}
// Exact same scoring is used by authority and UI; callers supply reachability.
// No sort/allocation of a temporary candidate list for every interaction tick.
export function targetLoot(items,p,allowed=()=>true){
 const cp=Math.cos(p.pitch||0),fx=-Math.sin(p.yaw||0)*cp,fy=Math.sin(p.pitch||0),fz=-Math.cos(p.yaw||0)*cp;
 let best=null,score=-Infinity;
 for(const item of items){
  if(!allowed(item))continue;
  const dx=item.x-p.x,dy=item.y+.6-(p.y+.9),dz=item.z-p.z,d=Math.hypot(dx,dy,dz)||.001;
  const value=(dx*fx+dy*fy+dz*fz)/d*2-d*.2;
  if(value>score+1e-9||(Math.abs(value-score)<1e-9&&String(item.uid??item.id)<String(best?.uid??best?.id))){best=item;score=value;}
 }return best;
}
export function weaponComparison(item,current){
 if(!item?.weapon)return null;
 const w=gun({inventory:[item],slot:0}),old=current?.weapon?gun({inventory:[current],slot:0}):null;
 const stats=w=>({damage:w.damage*w.pellets,rate:w.roundsPerSecond||(w.burst||1)/w.interval,reload:w.reload,magazine:w.magazine});
 return {stats:stats(w),previous:old?stats(old):null,ammo:ammoType(item.id)};
}
export function healingSuggestion(p,time){
 if(!p||p.health<=0||p.downed||p.use||p.flight!=='ground'||p.lastDamage>time-4)return null;
 for(const kind of ['heal','shield','splash'])for(let slot=1;slot<=5;slot++){
  const item=p.inventory?.[slot],def=ITEMS[item?.id];if(!item||item.count<=0||def?.kind!==kind)continue;
  if(kind==='heal'&&p.health<def.cap||kind==='shield'&&p.shield<def.cap||kind==='splash'&&(p.health<100||p.shield<100))return {slot,label:kind==='heal'||kind==='splash'&&p.health<100?'Health available':'Shield available'};
 }return null;
}
export const USE_CANCEL_REASONS=Object.freeze({damage:'Incoming damage',sprint:'Sprinting',swap:'Changed equipment',drop:'Dropped item',revive:'Reviving teammate',action:'Another action'});
export function preferencesFromSettings(settings){return sanitizeSlotPreferences(Object.fromEntries(SLOT_GROUPS.map(key=>[key,Number(settings['slot_'+key])])));}
export function inventoryPreferencesHTML(settings){return SLOT_GROUPS.map(key=>`<div class="setting-row"><label class="setting-label" for="slot_${key}">${key[0].toUpperCase()+key.slice(1)} preferred slot</label><select id="slot_${key}" data-setting="slot_${key}">${Array.from({length:6},(_,slot)=>`<option value="${slot}" ${Number(settings['slot_'+key]||0)===slot?'selected':''}>${slot?'Slot '+slot:'First empty slot'}</option>`).join('')}</select></div>`).join('');}
