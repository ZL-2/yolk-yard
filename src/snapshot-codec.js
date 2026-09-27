// Lossless deltas on an ordered connection. Each new connection starts with a
// complete baseline. Encoding happens at flush, after stale snapshots merge.
const recordKeys=['players','projectiles'];
function records(value,key='id'){return Object.fromEntries(value.map(row=>[row[key],row]));}
// Broadcast recipients share immutable state objects. Normalize each once;
// per-connection baselines and recovery checkpoints remain independent.
const normalizedStates=new WeakMap(),normalizedCheckpoints=new WeakMap();
function normalize(message){
 const {state,checkpoint,...body}=message,value=JSON.parse(JSON.stringify(body));
 for(const [key,source,cache]of [['state',state,normalizedStates],['checkpoint',checkpoint,normalizedCheckpoints]])if(source){
  let cached=cache.get(source);
  if(!cached){cached=JSON.parse(JSON.stringify(source));
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
function patch(previous,next){
 if(Object.is(previous,next))return undefined;
 if(!previous||!next||typeof previous!=='object'||typeof next!=='object'||Array.isArray(previous)||Array.isArray(next))
  return JSON.stringify(previous)===JSON.stringify(next)?undefined:[next];
 const changes=Object.create(null);
 for(const key of Object.keys(previous))if(!Object.hasOwn(next,key))changes[key]=[];
 for(const key of Object.keys(next)){const change=patch(previous[key],next[key]);if(change!==undefined)changes[key]=change;}
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
 encode(message){
  // Keep the recovery checkpoint in the baseline so its unchanged fields also
  // disappear from the wire. The receiver retains it for host migration.
  const next=normalize(message);
  if(!next.checkpoint&&this.previous?.checkpoint)next.checkpoint=this.previous.checkpoint;
  // Retain sparse world baselines across movement-only frames. Otherwise the
  // next pickup would retransmit every remaining item after an omitted frame.
  const omitWorld=[];
  if(next.state?.royale)next.state={...next.state,royale:{...next.state.royale}};
  for(const key of ['loot','chests','builds'])if(next.state?.royale&&!Object.hasOwn(next.state.royale,key)&&this.previous?.state?.royale?.[key]){next.state.royale[key]=this.previous.state.royale[key];omitWorld.push(key);}
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
  const message=structuredClone(rest);
  if(checkpoint&&(frame.full||Object.hasOwn(frame.patch||{},'checkpoint')))message.checkpoint=structuredClone(checkpoint);
  for(const key of recordKeys)if(message.state?.[key])message.state[key]=Object.values(message.state[key]);
  if(message.checkpoint?.simulation?.players)message.checkpoint.simulation.players=Object.values(message.checkpoint.simulation.players);
  for(const key of ['loot','chests','builds']){if(message.state?.royale?.[key])message.state.royale[key]=Object.values(message.state.royale[key]);if(message.checkpoint?.simulation?.[key])message.checkpoint.simulation[key]=Object.values(message.checkpoint.simulation[key]);}
  for(const key of frame.omitWorld||[])if(['loot','chests','builds'].includes(key)&&message.state?.royale)delete message.state.royale[key];
  return message;
 }
}
