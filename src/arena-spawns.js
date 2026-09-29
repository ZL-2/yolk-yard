import {MAPS,surfaceAt} from './maps.js';
import {canStand,wallDistance,direction,EYE} from './physics.js';
// Arena geometry is immutable. Score clearance once, then evaluate only live
// player separation at each respawn. Custom/dynamic maps are never cached.
const prepared=new WeakMap();
export function arenaSpawnPoints(map){
 if(MAPS.includes(map)&&prepared.has(map))return prepared.get(map);
 const points=map.spawns.map(([x,z])=>({x,z,y:surfaceAt(map,x,z)}));
 const spacing=Math.max(5,map.size/12);
 for(let x=-map.size+4;x<map.size-3;x+=spacing)for(let z=-map.size+4;z<map.size-3;z+=spacing)points.push({x,z,y:surfaceAt(map,x,z)});
 const safe=[];
 for(const q of points){
  if(!canStand(map,q,.8))continue;
  let clear=0,yaw=0;
  for(let i=0;i<12;i++){const a=i*Math.PI/6,d=wallDistance(map,{...q,y:q.y+EYE},direction(a),10);if(d>clear){clear=d;yaw=a;}}
  if(clear>=4)safe.push({...q,yaw,clear});
 }
 if(MAPS.includes(map))prepared.set(map,safe);
 return safe;
}
