import {canStand} from './physics.js';
import {placeLoot,supportBelow} from './royale-loot.js';
import {groundAt} from './terrain.js';
import {clearOfRelays} from './field-refinement.js';
// Sleeping items cost nothing per frame. Geometry edits wake support checks once.
export function wakeLoot(sim){sim.lootSupportDirty=true;}
function settleLoot(sim,item,floor){
 item.y=Math.max(floor,groundAt(sim.map,item.x,item.z));delete item.motion;
 const relays=sim.relays?.length?sim.relays:sim.map.relays||[];
 if(!clearOfRelays(item,relays)){const spot=placeLoot(sim.map,item,sim.loot,relays);if(spot){Object.assign(item,spot);sim.lootVersion++;}}
}
export function startLootFall(sim,item){
 const floor=supportBelow(sim.map,item.x,item.z,item.y);
 if(item.y<=floor+.025){settleLoot(sim,item,floor);return false;}
 item.motion={from:item.y,at:sim.time,vy:0,floor};sim.lootVersion++;return true;
}
export function lootHeight(item,time){const m=item.motion;if(!m)return item.y;const age=Math.max(0,time-m.at);return Math.max(m.floor,m.from+m.vy*age-12*age*age);}
export function tickLootMotion(sim){
 if(sim.lootSupportDirty){sim.lootSupportDirty=false;for(const item of [...sim.loot,...sim.chests]){if(item.landAt>sim.time)continue;item.y=lootHeight(item,sim.time);if(!canStand(sim.map,item,.35)){const spot=placeLoot(sim.map,item);if(spot){item.x=spot.x;item.z=spot.z;item.y=Math.max(item.y,spot.y);sim.lootVersion++;}}startLootFall(sim,item);}}
 // A roof can be destroyed after a drop. Keep the eventual landing clear too.
 for(const item of [...sim.loot,...sim.chests])if(item.motion){item.y=lootHeight(item,sim.time);if(item.y<=item.motion.floor+.001){settleLoot(sim,item,item.motion.floor);sim.lootVersion++;}}
}
