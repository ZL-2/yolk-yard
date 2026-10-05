// Lossless deltas on an ordered connection. Each new connection starts with a
// complete baseline. Encoding happens at flush, after stale snapshots merge.
const recordKeys=['players','projectiles'];
function records(value,key='id'){return Object.fromEntries(value.map(row=>[row[key],row]));}
// Broadcast recipients share immutable state objects. Normalize each once;
// per-connection baselines and recovery checkpoints remain independent.
const normalizedStates=new WeakMap(),normalizedCheckpoints=new WeakMap();
// A pinned layout is immutable for the lifetime of a round. Reuse its normalized
// value so unchanged authoring data is never walked/copied per frame or entrant.
const normalizedLayouts=new WeakMap(),decodedLayouts=new WeakMap();
// Only frozen, detached loot records qualify for cross-frame reuse.
const frozenValues=new WeakMap();
const immutableValues=new WeakSet();
function deeplyFrozen(value,visiting=new WeakSet()){
 if(!value||typeof value!=='object')return true;
 if(immutableValues.has(value))return true;
 if(!Object.isFrozen(value)||visiting.has(value))return false;
 visiting.add(value);const immutable=Object.values(value).every(child=>deeplyFrozen(child,visiting));visiting.delete(value);
 if(immutable)immutableValues.add(value);return immutable;
}
function immutableLayout(layout){if(!decodedLayouts.has(layout)){const value=structuredClone(layout),freeze=v=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;};decodedLayouts.set(layout,freeze(value));}return decodedLayouts.get(layout);}
function cloneSnapshot(message){const copy={...message};for(const key of ['state','checkpoint'])if(copy[key]?.mapLayouts)copy[key]={...copy[key],mapLayouts:undefined};const result=structuredClone(copy);for(const key of ['state','checkpoint'])if(message[key]?.mapLayouts)result[key].mapLayouts=immutableLayout(message[key].mapLayouts);return result;}
function snapshotLayout(layout){if(!normalizedLayouts.has(layout))normalizedLayouts.set(layout,JSON.parse(JSON.stringify(layout)));return normalizedLayouts.get(layout);}
// A broadcast batch owns its memo, so mutable simulation objects are never
// cached across ticks. Recipient groups share player/world clones and diffs.
export class SnapshotBatch {
 constructor(){this.values=new WeakMap();this.indexed=new WeakMap();this.normalized=new WeakMap();this.retained=new WeakMap();this.payloads=new WeakMap();}
 clone(source){
  if(source===null)return null;
  if(typeof source==='number')return Number.isFinite(source)?source:null;
  if(typeof source==='string'||typeof source==='boolean')return source;
  if(typeof source!=='object')return undefined;
  if(this.values.has(source))return this.values.get(source);
  if(Object.isFrozen(source)&&deeplyFrozen(source)){
   if(frozenValues.has(source))return frozenValues.get(source);
   const value=Array.isArray(source)?source.map(row=>this.clone(row)):JSON.parse(JSON.stringify(source));frozenValues.set(source,value);return value;
  }
  const value=JSON.parse(JSON.stringify(source));this.values.set(source,value);
  return value;
 }
 index(rows,key='id'){
  if(!this.indexed.has(rows))this.indexed.set(rows,records(rows,key));
  return this.indexed.get(rows);
 }
 players(rows){
  if(!this.values.has(rows))this.values.set(rows,rows.map(row=>{
   if(this.values.has(row))return this.values.get(row);const next={};for(const key of Object.keys(row)){const value=row[key];if(value===undefined||typeof value==='function'||typeof value==='symbol')continue;const cloned=value&&typeof value==='object'?this.clone(value):typeof value==='number'&&!Number.isFinite(value)?null:value;if(key==='__proto__')Object.defineProperty(next,key,{value:cloned,enumerable:true});else next[key]=cloned;}this.values.set(row,next);return next;
  }));
  return this.index(this.values.get(rows));
 }
 normalize(message){
  const {state,checkpoint,...body}=message,value=this.clone(body);
  for(const [key,source]of [['state',state],['checkpoint',checkpoint]])if(source){
   if(this.normalized.has(source)){value[key]=this.normalized.get(source);continue;}
   const cached={};value[key]=cached;this.normalized.set(source,cached);
   const name=key==='state'?'royale':'simulation';
   for(const field of Object.keys(source)){
    if(field===name&&source[name]){const world={};cached[name]=world;
     for(const collection of Object.keys(source[name])){if(collection==='players'&&Array.isArray(source[name][collection])){world[collection]=this.players(source[name][collection]);continue;}const cloned=this.clone(source[name][collection]);if(cloned!==undefined)world[collection]=Array.isArray(cloned)&&['loot','chests','builds'].includes(collection)?this.index(cloned,collection==='loot'?'uid':'id'):cloned;}
    }else if(field==='mapLayouts'&&source[field])cached[field]=snapshotLayout(source[field]);else if(field==='players'&&Array.isArray(source[field]))cached[field]=this.players(source[field]);else{const cloned=this.clone(source[field]);if(cloned!==undefined)cached[field]=recordKeys.includes(field)&&Array.isArray(cloned)?this.index(cloned):cloned;}
   }
  }
  return value;
 }
 retain(state,previous){
  let pairs=this.retained.get(state);if(!pairs){pairs=new WeakMap();this.retained.set(state,pairs);}
  if(pairs.has(previous.royale))return pairs.get(previous.royale);
  const next={...state,royale:{...state.royale}};
  for(const key of ['loot','chests','builds','worldDamage'])if(!Object.hasOwn(next.royale,key)&&previous.royale[key])next.royale[key]=previous.royale[key];
  pairs.set(previous.royale,next);return next;
 }
 json(value){
  if(!value||typeof value!=='object')return JSON.stringify(value);
  if(!this.payloads.has(value))this.payloads.set(value,JSON.stringify(value));
  return this.payloads.get(value);
 }
 serialize(frame){
  const kind=frame.full?'full':'patch',payload=frame[kind];
  const raw='{'+Object.keys(payload).map(key=>JSON.stringify(key)+':'+this.json(payload[key])).join(',')+'}';
  return '{"type":"authority-frame","frame":{"base":'+frame.base+',"seq":'+frame.seq+',"'+kind+'":'+raw+(frame.omitWorld?',"omitWorld":'+JSON.stringify(frame.omitWorld):'')+'}}';
 }
}
function normalize(message){
 const {state,checkpoint,...body}=message,value=JSON.parse(JSON.stringify(body));
 for(const [key,source,cache]of [['state',state,normalizedStates],['checkpoint',checkpoint,normalizedCheckpoints]])if(source){
  let cached=cache.get(source);
  if(!cached){cached=JSON.parse(JSON.stringify({...source,mapLayouts:undefined}));if(source.mapLayouts)cached.mapLayouts=snapshotLayout(source.mapLayouts);
   const world=key==='state'?cached.royale:cached.simulation;
   for(const [name,id]of [['loot','uid'],['chests','id'],['builds','id']])if(Array.isArray(world?.[name]))world[name]=records(world[name],id);
   for(const name of recordKeys)if(Array.isArray(cached[name]))cached[name]=records(cached[name]);
   if(Array.isArray(cached.simulation?.players))cached.simulation.players=records(cached.simulation.players);
   cache.set(source,cached);
  }
  value[key]=cached;
 }
 return value;
}
// Values have already passed JSON normalization. Compare arrays structurally
// instead of serializing inventory/ammo/events again for every recipient.
function equalJson(a,b){
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 if(Array.isArray(a)){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!equalJson(a[i],b[i]))return false;return true;}
 const keys=Object.keys(a);if(keys.length!==Object.keys(b).length)return false;
 for(const key of keys)if(!Object.hasOwn(b,key)||!equalJson(a[key],b[key]))return false;
 return true;
}
// Shared recipient states also share their object-pair diff. Weak keys keep old
// frames collectable; each connection still owns its sequence and baseline.
const patches=new WeakMap();
function sharedPatch(previous,next){
 if(previous&&next&&typeof previous==='object'&&typeof next==='object'){
  let cache=patches.get(next);if(cache?.has(previous))return cache.get(previous);
  const result=patch(previous,next);if(!cache){cache=new WeakMap();patches.set(next,cache);}cache.set(previous,result);return result;
 }
 return patch(previous,next);
}
function patch(previous,next){
 if(Object.is(previous,next))return undefined;
 if(!previous||!next||typeof previous!=='object'||typeof next!=='object')return [next];
 if(Array.isArray(previous)||Array.isArray(next))return equalJson(previous,next)?undefined:[next];
 const changes=Object.create(null);
 for(const key of Object.keys(previous))if(!Object.hasOwn(next,key))changes[key]=[];
 for(const key of Object.keys(next)){const change=(['state','royale','simulation','players','projectiles','loot','chests','builds','worldDamage'].includes(key)?sharedPatch:patch)(previous[key],next[key]);if(change!==undefined)changes[key]=change;}
 return Object.keys(changes).length?changes:undefined;
}
function apply(previous,changes){
 if(Array.isArray(changes))return changes[0];
 const next={...previous};
 for(const [key,change] of Object.entries(changes)){
  if(['__proto__','constructor','prototype'].includes(key))throw Error('Invalid snapshot key');
  if(Array.isArray(change)&&!change.length)delete next[key];else next[key]=apply(previous?.[key],change);
 }
 return next;
}
export class SnapshotEncoder {
 constructor(){this.reset();}
 reset(){this.previous=null;this.seq=0;}
 encode(message,batch){
  // Keep the recovery checkpoint in the baseline so its unchanged fields also
  // disappear from the wire. The receiver retains it for host migration.
  const next=batch?batch.normalize(message):normalize(message);
  if(!next.checkpoint&&this.previous?.checkpoint)next.checkpoint=this.previous.checkpoint;
  // Retain sparse world baselines across movement-only frames. Otherwise the
  // next pickup would retransmit every remaining item after an omitted frame.
  const omitWorld=[];
  for(const key of ['loot','chests','builds','worldDamage'])if(next.state?.royale&&!Object.hasOwn(next.state.royale,key)&&this.previous?.state?.royale?.[key])omitWorld.push(key);
  if(omitWorld.length){if(batch)next.state=batch.retain(next.state,this.previous.state);else{next.state={...next.state,royale:{...next.state.royale}};for(const key of omitWorld)next.state.royale[key]=this.previous.state.royale[key];}}
  const frame=this.previous?{base:this.seq,seq:this.seq+1,patch:patch(this.previous,next)||{}}:{base:0,seq:1,full:next};
  if(omitWorld.length)frame.omitWorld=omitWorld;
  this.previous=next;this.seq=frame.seq;return {type:'snapshot-v1',frame};
 }
}
export class SnapshotDecoder {
 constructor(){this.previous=null;this.seq=0;}
 decode(frame){
  if(!frame||!Number.isSafeInteger(frame.seq))return null;
  if(frame.base===0&&frame.full){this.previous=frame.full;this.seq=frame.seq;}
  else {
   if(!this.previous||frame.base!==this.seq||frame.seq!==this.seq+1)return null;
   try{this.previous=apply(this.previous,frame.patch);this.seq=frame.seq;}catch{return null;}
  }
  // Game/UI sanitization must never mutate the next delta's baseline.
  const {checkpoint,...rest}=this.previous;
  // Omit sleeping world collections BEFORE cloning; retain the immutable baseline.
  const payload={...rest};
  if(frame.omitWorld?.length&&rest.state?.royale){payload.state={...rest.state,royale:{...rest.state.royale}};for(const key of frame.omitWorld)if(['loot','chests','builds','worldDamage'].includes(key))delete payload.state.royale[key];}
  const message=cloneSnapshot(payload);
  if(checkpoint&&(frame.full||Object.hasOwn(frame.patch||{},'checkpoint')))message.checkpoint=cloneSnapshot({checkpoint}).checkpoint;
  for(const key of recordKeys)if(message.state?.[key])message.state[key]=Object.values(message.state[key]);
  if(message.checkpoint?.simulation?.players)message.checkpoint.simulation.players=Object.values(message.checkpoint.simulation.players);
  for(const key of ['loot','chests','builds']){if(message.state?.royale?.[key])message.state.royale[key]=Object.values(message.state.royale[key]);if(message.checkpoint?.simulation?.[key])message.checkpoint.simulation[key]=Object.values(message.checkpoint.simulation[key]);}
  return message;
 }
}
