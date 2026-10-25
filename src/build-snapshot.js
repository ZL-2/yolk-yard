// Share immutable building/destruction snapshots until the simulation changes them.
// New rounds, restores and replacement arrays invalidate even if versions repeat.
const cache=new WeakMap();
const damageCache=new WeakMap();
// Build fields are scalar except the edit path. Copying their known wire shape
// avoids a deep serializer pass over every completed structure after each shot.
const buildRows=new WeakMap();
function buildRow(b){
 const previous=buildRows.get(b),keys=Object.keys(b);
 if(previous&&keys.length===Object.keys(previous).length&&keys.every(k=>k==='path'&&Array.isArray(b.path)?b.path.length===previous.path?.length&&b.path.every((v,i)=>v===previous.path[i]):b[k]===previous[k]))return previous;
 const row=Object.freeze({...b,...(b.path?{path:Object.freeze([...b.path])}:{})});buildRows.set(b,row);return row;
}
function damageRows(source){const result={};for(const [id,value]of Object.entries(source||{})){let row=damageCache.get(value);const keys=Object.keys(value);if(!row||keys.length!==row.keys.length||keys.some(k=>row.values[k]!==value[k])){const copy={...value,...(value.weakpoint?{weakpoint:Object.freeze({...value.weakpoint})}:{})};row={keys,values:{...value},copy:Object.freeze(copy)};damageCache.set(value,row);}result[id]=row.copy;}return Object.freeze(result);}
export function snapshotBuilds(sim){
 const previous=cache.get(sim);
 if(previous&&previous.version===sim.buildVersion&&previous.round===sim.round&&previous.match===sim.matchId&&previous.source===sim.builds&&previous.damageSource===sim.worldDamage)return previous.data;
 const rows=sim.builds.map(buildRow),builds=previous?.data.builds;
 const data={builds:builds&&rows.length===builds.length&&rows.every((row,i)=>row===builds[i])?builds:Object.freeze(rows),worldDamage:damageRows(sim.worldDamage)};
 cache.set(sim,{version:sim.buildVersion,round:sim.round,match:sim.matchId,source:sim.builds,damageSource:sim.worldDamage,data});return data;
}

// Doors are copied once per actual state change, not 129 records per snapshot.
// Each returned row is detached and frozen so cross-frame encoding is safe.
const doorRows=new WeakMap(),doorSets=new WeakMap();
export function snapshotDoors(source){
 if(!source)return Object.freeze({});
 const previous=doorSets.get(source),rows={};let changed=!previous;
 for(const [id,door]of Object.entries(source)){
  let row=doorRows.get(door);const keys=Object.keys(door);
  if(!row||keys.length!==Object.keys(row).length||keys.some(k=>door[k]!==row[k])){row=Object.freeze({...door});doorRows.set(door,row);}
  rows[id]=row;if(previous?.[id]!==row)changed=true;
 }
 if(previous&&Object.keys(previous).length!==Object.keys(rows).length)changed=true;
 if(!changed)return previous;
 const value=Object.freeze(rows);doorSets.set(source,value);return value;
}
