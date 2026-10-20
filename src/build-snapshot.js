// Share immutable building/destruction snapshots until the simulation changes them.
// New rounds, restores and replacement arrays invalidate even if versions repeat.
const cache=new WeakMap();
const damageCache=new WeakMap();
// Build fields are scalar except the edit path. Copying their known wire shape
// avoids a deep serializer pass over every completed structure after each shot.
function buildRow(b){return Object.freeze({...b,...(b.path?{path:Object.freeze([...b.path])}:{})});}
function damageRows(source){const result={};for(const [id,value]of Object.entries(source||{})){let row=damageCache.get(value);const keys=Object.keys(value);if(!row||keys.length!==row.keys.length||keys.some(k=>row.values[k]!==value[k])){const copy={...value,...(value.weakpoint?{weakpoint:Object.freeze({...value.weakpoint})}:{})};row={keys,values:{...value},copy:Object.freeze(copy)};damageCache.set(value,row);}result[id]=row.copy;}return Object.freeze(result);}
export function snapshotBuilds(sim){
 const previous=cache.get(sim);
 if(previous&&previous.version===sim.buildVersion&&previous.round===sim.round&&previous.match===sim.matchId&&previous.source===sim.builds&&previous.damageSource===sim.worldDamage)return previous.data;
 const data={builds:Object.freeze(sim.builds.map(buildRow)),worldDamage:damageRows(sim.worldDamage)};
 cache.set(sim,{version:sim.buildVersion,round:sim.round,match:sim.matchId,source:sim.builds,damageSource:sim.worldDamage,data});return data;
}
