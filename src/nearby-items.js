// Independent indices: opening a chest or changing a stack never rebuilds loot.
const cache=new WeakMap(),arrays=new WeakMap(),CELL=16;
const version=(sim,kind)=>sim[kind==='loot'?'lootSpatialVersion':'chestSpatialVersion']??sim.lootVersion;
const cellKey=item=>Math.floor(item.x/CELL)+','+Math.floor(item.z/CELL);
function insert(entry,item){const key=cellKey(item);let bucket=entry.grid.get(key);if(!bucket){bucket=[];entry.grid.set(key,bucket);}bucket.push(item);const id=item.uid??item.id;entry.byId.set(id,item);entry.cells.set(id,key);}
function index(sim,kind){
 let all=cache.get(sim);if(!all){all={};cache.set(sim,all);}const items=sim[kind]||[];let entry=all[kind]||arrays.get(items);
 if(!entry||entry.items!==items||entry.length!==items.length||entry.version!==version(sim,kind)){
  entry={items,length:items.length,version:version(sim,kind),grid:new Map(),byId:new Map(),cells:new Map()};for(const item of items)insert(entry,item);arrays.set(items,entry);
 }
 all[kind]=entry;
 return entry;
}
// Update an existing index in place after membership/XY changes, so a chain of
// pickups/drops does not repeatedly scan the whole island.
export function itemsChanged(sim,kind,item,removed=false){
 const field=kind==='loot'?'lootSpatialVersion':'chestSpatialVersion';sim[field]=(sim[field]||0)+1;
 const entry=cache.get(sim)?.[kind];if(!entry||entry.items!==sim[kind])return;
 const id=item.uid??item.id,known=entry.byId.has(id),expected=entry.length+(removed?-1:known?0:1);
 if(sim[kind].length!==expected){arrays.delete(entry.items);delete cache.get(sim)[kind];return;}
 const key=entry.cells.get(id),bucket=entry.grid.get(key);
 if(bucket){const i=bucket.indexOf(item);if(i>=0){bucket[i]=bucket.at(-1);bucket.pop();}if(!bucket.length)entry.grid.delete(key);}
 entry.byId.delete(id);entry.cells.delete(id);if(!removed)insert(entry,item);
 entry.length=sim[kind].length;entry.version=version(sim,kind);
}
export function itemById(sim,kind,id){return index(sim,kind).byId.get(id);}
export function nearbyItems(sim,kind,p,radius){
 const found=[],grid=index(sim,kind).grid,r2=radius*radius;
 for(let x=Math.floor((p.x-radius)/CELL);x<=Math.floor((p.x+radius)/CELL);x++)for(let z=Math.floor((p.z-radius)/CELL);z<=Math.floor((p.z+radius)/CELL);z++){const bucket=grid.get(x+','+z);if(bucket)for(const item of bucket)if((item.x-p.x)**2+(item.z-p.z)**2<=r2)found.push(item);}
 return found;
}
