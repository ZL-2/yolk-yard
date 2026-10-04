// World item records are immutable until their version changes. Falling height
// is reconstructed from motion/time, so static loot is not cloned at 30–60 Hz.
const cache=new WeakMap();
export function snapshotLoot(sim){
 let entry=cache.get(sim);if(entry&&entry.version===sim.lootVersion&&entry.sourceLoot===sim.loot&&entry.sourceChests===sim.chests&&entry.loot.length===sim.loot.length&&entry.chests.length===sim.chests.length)return entry;
 const copy=item=>{const {contents,...record}=item;if(item.motion)record.motion=Object.freeze({...item.motion});if(item.spawnFrom)record.spawnFrom=Object.freeze({...item.spawnFrom});return Object.freeze(record);};
 entry={version:sim.lootVersion,sourceLoot:sim.loot,sourceChests:sim.chests,loot:Object.freeze(sim.loot.map(copy)),chests:Object.freeze(sim.chests.map(copy))};cache.set(sim,entry);return entry;
}
