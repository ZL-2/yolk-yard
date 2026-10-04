import {canStand} from './physics.js';
import {placeLoot,supportBelow} from './royale-loot.js';
import {groundAt} from './terrain.js';
import {clearOfRelays} from './field-refinement.js';
import {itemsChanged} from './nearby-items.js';
const motionCache=new WeakMap();
function fallingItems(sim){
 let entry=motionCache.get(sim);if(!entry||entry.loot!==sim.loot||entry.chests!==sim.chests){entry={loot:sim.loot,chests:sim.chests,active:new Set()};for(const items of [sim.loot,sim.chests])for(const item of items||[])if(item.motion)entry.active.add(item);motionCache.set(sim,entry);}return entry.active;
}
export function stopLootFall(sim,item){motionCache.get(sim)?.active.delete(item);}
// Sleeping items cost nothing per frame. Geometry edits wake support checks once.
export function wakeLoot(sim){sim.lootSupportDirty=true;}
function settleLoot(sim,item,floor){
 item.y=Math.max(floor,groundAt(sim.map,item.x,item.z));delete item.motion;stopLootFall(sim,item);
 const relays=sim.relays?.length?sim.relays:sim.map.relays||[];
 if(!clearOfRelays(item,relays)){const spot=placeLoot(sim.map,item,sim.loot,relays);if(spot){Object.assign(item,spot);itemsChanged(sim,item.uid!==undefined?'loot':'chests',item);sim.lootVersion++;}}
}
export function startLootFall(sim,item){
 const floor=supportBelow(sim.map,item.x,item.z,item.y);
 if(item.y<=floor+.025){settleLoot(sim,item,floor);return false;}
 item.motion={from:item.y,at:sim.time,vy:0,floor};fallingItems(sim).add(item);sim.lootVersion++;return true;
}
export function lootHeight(item,time){const m=item.motion;if(!m)return item.y;const age=Math.max(0,time-m.at);return Math.max(m.floor,m.from+m.vy*age-12*age*age);}
export function tickLootMotion(sim){
 if(sim.lootSupportDirty){sim.lootSupportDirty=false;for(const kind of ['loot','chests'])for(const item of sim[kind]){if(item.landAt>sim.time)continue;item.y=lootHeight(item,sim.time);if(!canStand(sim.map,item,.35)){const spot=placeLoot(sim.map,item);if(spot){item.x=spot.x;item.z=spot.z;item.y=Math.max(item.y,spot.y);itemsChanged(sim,kind,item);sim.lootVersion++;}}startLootFall(sim,item);}}
 // A roof can be destroyed after a drop. Keep the eventual landing clear too.
 for(const item of fallingItems(sim)){if(!item.motion){stopLootFall(sim,item);continue;}item.y=lootHeight(item,sim.time);if(item.y<=item.motion.floor+.001){settleLoot(sim,item,item.motion.floor);sim.lootVersion++;}}
}
