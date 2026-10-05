// World item records are immutable until their version changes. Falling height
// is reconstructed from motion/time, so static loot is not cloned at 30–60 Hz.
const cache=new WeakMap();
const records=new WeakMap();
function copyItem(item){
 const previous=records.get(item),keys=Object.keys(item).filter(k=>k!=='contents');
 if(previous&&keys.length===Object.keys(previous).length&&keys.every(k=>{
  const value=item[k],old=previous[k];
  return k==='motion'||k==='spawnFrom'?value&&old&&Object.keys(value).length===Object.keys(old).length&&Object.keys(value).every(n=>value[n]===old[n]):value===old;
 }))return previous;
 const {contents,...record}=item;if(item.motion)record.motion=Object.freeze({...item.motion});if(item.spawnFrom)record.spawnFrom=Object.freeze({...item.spawnFrom});Object.freeze(record);records.set(item,record);return record;
}
export function snapshotLoot(sim){
 let entry=cache.get(sim);if(entry&&entry.version===sim.lootVersion&&entry.sourceLoot===sim.loot&&entry.sourceChests===sim.chests&&entry.loot.length===sim.loot.length&&entry.chests.length===sim.chests.length)return entry;
 entry={version:sim.lootVersion,sourceLoot:sim.loot,sourceChests:sim.chests,loot:Object.freeze(sim.loot.map(copyItem)),chests:Object.freeze(sim.chests.map(copyItem))};cache.set(sim,entry);return entry;
}
