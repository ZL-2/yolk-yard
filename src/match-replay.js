// A privacy-limited tactical recording: no chat, credentials, or client storage.
const actorFields=['id','name','team','bot','x','y','z','yaw','pitch','health','shield','spectating','contestant','flight','downed','connected','killerId','kills','weapon','slot','ammo','reloading'];
const eventFields=['id','type','time','player','target','from','to','drop','item','amount','weapon','head','x','y','z','origin','shots'];
const eventTypes=new Set(['shot','launch','hit','elimination','kill','royale-eliminated','box-eliminated','supply-transfer','build','build-destroyed','revive']);
const select=(value,keys)=>Object.fromEntries(keys.flatMap(k=>{const v=value[k];if(typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return [[k,v]];if(typeof v==='string')return [[k,v.slice(0,100)]];if(k==='origin'&&v&&[v.x,v.y,v.z].every(Number.isFinite))return [[k,{x:v.x,y:v.y,z:v.z}]];if(k==='shots'&&Array.isArray(v))return [[k,v.slice(0,40).map(s=>select(s,['vx','vy','vz','x','y','z']))]];return [];}));
export function replayFrame(state){
 if(!state||!Number.isFinite(state.time)||!Array.isArray(state.players)||state.players.length>80)return null;
 const players=state.players.filter(p=>p&&typeof p.id==='string'&&p.id.length<=100&&[p.x,p.y,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<20000)).map(p=>select(p,actorFields));
 const events=(state.events||[]).filter(e=>e&&eventTypes.has(e.type)&&Number.isFinite(e.time)).slice(-400).map(e=>select(e,eventFields));
 const r=state.royale;
 return {time:state.time,matchId:String(r?.matchId||state.matchId||'').slice(0,100),phase:state.phase,map:state.options?.map,mode:state.options?.mode,teamSize:state.options?.teamSize||1,players,events,...(r?{stage:r.stage,storm:r.storm?select(r.storm,['active','x','z','radius','phase']):null,builds:r.builds?.slice(0,4096).map(b=>select(b,['id','x','y','z','type','rotation','material','health','team','owner'])),vehicles:r.vehicles?.slice(0,100).map(v=>select(v,['id','x','y','z','yaw','type','health']))}:{})};
}
