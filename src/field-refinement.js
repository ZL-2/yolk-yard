// Shared host rules for authored recovery supplies and deliberate pickups.
export const SHIELD_BARREL=Object.freeze({restore:10,radius:3.6,health:150});
export const SWAP_HOLD_SECONDS=.45;
export const RELAY_LOOT_CLEARANCE=3.4;
export const ROYALE_BOT_RANGE=Object.freeze({vision:70,engage:62});
import {ITEMS} from './royale-data.js';
export function pickupNeedsSwap(p,item){
 if(!item||item.resource||item.ammoType)return false;
 if(p.inventory.slice(1).some(i=>!i))return false;
 if(!item.weapon&&p.inventory.some(i=>i?.id===item.id&&i.count<(ITEMS[item.id]?.stack||1)))return false;
 return true;
}
export function clearOfRelays(point,relays=[]){return !relays.some(r=>Math.abs((r.y||0)-(point.y||0))<2.5&&Math.hypot(r.x-point.x,r.z-point.z)<RELAY_LOOT_CLEARANCE);}
// A building/editing press must be released before it can become a weapon press.
export function gateBuildFire(p,input){
 const building=!!(input.buildMode||input.editing);
 if(building&&input.fire)p.buildFireHeld=true;
 if(!input.fire){p.buildFireHeld=false;p.awaitFireRelease=false;}
 else if(!building&&(p.buildFireHeld)){p.awaitFireRelease=true;p.buildFireHeld=false;}
 if(building||p.awaitFireRelease){p.pendingFireUntil=0;p.burstLeft=0;p.lastFirePress=Math.max(p.lastFirePress||0,input.firePress||0);}
 return !building&&p.awaitFireRelease?{...input,fire:false,fireHeld:false,firePress:0}:input;
}
