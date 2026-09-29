// Shared spatial lookup for loot and chests. Rebuild only when their layout changes.
const cache=new WeakMap(),CELL=16;
export function nearbyItems(sim,kind,p,radius){
 let entry=cache.get(sim);
 if(!entry||entry.version!==sim.lootVersion||entry.loot!==sim.loot||entry.chests!==sim.chests){
  entry={version:sim.lootVersion,loot:sim.loot,chests:sim.chests};
  for(const name of ['loot','chests']){const grid=new Map();for(const item of sim[name]||[]){const key=Math.floor(item.x/CELL)+','+Math.floor(item.z/CELL);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(item);}entry[name+'Grid']=grid;}
  cache.set(sim,entry);
 }
 const found=[],grid=entry[kind+'Grid'];
 for(let x=Math.floor((p.x-radius)/CELL);x<=Math.floor((p.x+radius)/CELL);x++)for(let z=Math.floor((p.z-radius)/CELL);z<=Math.floor((p.z+radius)/CELL);z++)for(const item of grid.get(x+','+z)||[])if((item.x-p.x)**2+(item.z-p.z)**2<=radius*radius)found.push(item);
 return found;
}
