import {isTeamRoyale,teammates} from './teams.js';
import {direction,worldHit,humanHit,dist} from './physics.js';
import {eyeHeight} from './stance.js';
import {surfaceAt,getMap} from './maps.js';
import {isWarmup} from './royale-phases.js';
import {itemInfo} from './royale-data.js';
export const visibleMarkers=(state,p)=>(state.royale?.markers||[]).filter(m=>m.until>state.time&&(m.global||m.player===p?.id||m.team===p?.team&&isTeamRoyale(state.options)));
// The client supplies intent, never marker ownership, expiry or a tracked enemy.
export function markerAction(sim,p,action){
 if(!action.startsWith('ping-'))return false;
 if(!p.contestant||p.spectating||p.health<=0)return true;
 sim.markers??=[];sim.markers=sim.markers.filter(m=>m.until>sim.time);
 if(action==='ping-clear'){sim.markers=sim.markers.filter(m=>m.player!==p.id);return true;}
 let payload;try{payload=JSON.parse(action.slice(5));}catch{return true;}
 if(!['normal','danger','map'].includes(payload.kind))return true;
 p.pingTimes=(p.pingTimes||[]).filter(t=>sim.time-t<6);
 if(sim.time-(p.lastPingAt??-100)<.8||p.pingTimes.length>=3)return true;
 let point,label='',kind=payload.kind==='danger'?'danger':'normal';
 if(payload.kind==='map'){
  const map=isWarmup(sim.stage)?getMap('sunnybreak',sim.mapLayouts):sim.map;
  if(!Number.isFinite(payload.x)||!Number.isFinite(payload.z)||Math.abs(payload.x)>map.size||Math.abs(payload.z)>map.size)return true;
  point={x:payload.x,z:payload.z,y:surfaceAt(map,payload.x,payload.z),planning:isWarmup(sim.stage)};
 }else{
  const origin={x:p.x,y:p.y+eyeHeight(p),z:p.z},ray=direction(p.yaw,p.pitch),hit=worldHit(sim.map,origin,ray,250);
  let range=hit?.distance??180;point=hit?.point||{x:origin.x+ray.x*range,y:origin.y+ray.y*range,z:origin.z+ray.z*range};
  for(const other of sim.players.values())if(other!==p&&other.health>0&&!other.spectating&&!teammates(sim.options,p,other)){
   const t=humanHit(origin,ray,other).distance;if(t<range){range=t;point={x:other.x,y:other.y+eyeHeight(other),z:other.z};kind='danger';}
  }
  if(kind==='normal'){const loot=sim.loot?.find(i=>dist(i,point)<2);if(loot){point={x:loot.x,y:loot.y+.3,z:loot.z};label=itemInfo(loot).name;}}
 }
 if(!point||![point.x,point.y,point.z].every(Number.isFinite))return true;
 p.lastPingAt=sim.time;p.pingTimes.push(sim.time);
 const marker={...point,player:p.id,team:p.team,name:p.name,kind,label,until:sim.time+(kind==='danger'?12:payload.kind==='map'?90:45),id:++sim.markerId||1};
 sim.markerId=marker.id;sim.markers=sim.markers.filter(m=>m.player!==p.id);sim.markers.push(marker);
 // Marker identity is not the global event sequence used for exactly-once audio.
 const {id:markerId,...event}=marker;sim.emit('duo-marker',{...event,markerId});return true;
}
