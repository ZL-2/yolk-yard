import {canStand,candidates,wallDistance,RADIUS,HEIGHT} from './physics.js';
import {groundAt} from './terrain.js';
import {doorFrame} from './world-rules.js';

// Authored-map checks only: never imported by the simulation tick. They inspect
// local access, not a promise that every route across the island is navigable.
function supportedPoint(map,x,z,reference,maxDrop=1){
 let y=groundAt(map,x,z);
 for(const b of candidates(map,{x,y:reference,z}))if(Math.abs(x-b.x)<b.w/2+RADIUS&&Math.abs(z-b.z)<b.d/2+RADIUS&&b.y+b.h<=reference+.43)y=Math.max(y,b.y+b.h);
 const p={x,y,z};
 return y-reference<=.43&&reference-y<=maxDrop&&canStand(map,p)?p:null;
}
export function doorClearance(map,door){
 const frame=doorFrame(door),c=Math.cos(frame.yaw),s=Math.sin(frame.yaw);
 if(frame.width<RADIUS*2+.06||door.h<HEIGHT+.02)return false;
 const length=frame.depth+1.8,steps=Math.ceil(length/.18),side=Math.max(0,(frame.width/2-RADIUS-.06)*.55);
 for(const offset of [0,-side,side]){
  let clear=true,previous=door.y;
  for(let i=0;i<=steps;i++){
   const forward=-length/2+length*i/steps;
   const p=supportedPoint(map,door.x+c*offset+s*forward,door.z-s*offset+c*forward,previous,.43);
   if(!p){clear=false;break;}previous=p.y;
  }
  if(clear)return true;
 }
 return false;
}
function lootAccess(map,item,range){
 for(const radius of [0,1.25,2.4])for(let i=0;i<(radius?8:1);i++){
  const angle=i*Math.PI/4,p=supportedPoint(map,item.x+Math.cos(angle)*radius,item.z+Math.sin(angle)*radius,item.y||0,2);
  if(!p||Math.hypot(p.x-item.x,p.y-(item.y||0),p.z-item.z)>range)continue;
  const from={x:p.x,y:p.y+.9,z:p.z},dx=item.x-from.x,dy=(item.y||0)+.6-from.y,dz=item.z-from.z,len=Math.hypot(dx,dy,dz);
  if(len<.01||wallDistance(map,from,{x:dx/len,y:dy/len,z:dz/len},len)>=len-.15)return true;
 }
 return false;
}
function hasSupport(map,solids){
 if(!solids?.length)return true;
 const own=new Set(solids),minY=Math.min(...solids.map(b=>b.y));
 for(const b of solids)if(b.y<minY+.05)for(const [dx,dz]of [[0,0],[-.4,-.4],[-.4,.4],[.4,-.4],[.4,.4]]){
  const x=b.x+b.w*dx,z=b.z+b.d*dz,y=groundAt(map,x,z);
  if(Math.abs(b.y-y)<.5)return true;
  for(const other of candidates(map,{x,y:b.y,z}))if(!own.has(other)&&Math.abs(x-other.x)<other.w/2+.03&&Math.abs(z-other.z)<other.d/2+.03&&Math.abs(other.y+other.h-b.y)<.35)return true;
 }
 return false;
}
export function* mapValidationSteps(map){
 // A door that opens must be checked with its leaf open. This also permits
 // keyed vault loot without falsely marking every locked vault inaccessible.
 const openMap={...map,boxes:map.boxes.filter(b=>!b.doorId)},issues=[],counts={errors:0,warnings:0},solids=new Map();
 for(const b of map.boxes)if(b.editorObject){let group=solids.get(b.editorObject);if(!group)solids.set(b.editorObject,group=[]);group.push(b);}
 const objects=(map.editorObjects||[]).filter(r=>r.collision),total=(map.spawns?.length||0)+(map.doors?.length||0)+(map.chests?.length||0)+(map.floorLoot?.length||0)+objects.length;
 let checked=0,clearSpawns=0;
 const add=(severity,code,label,message,point,objectId=null)=>{counts[severity==='error'?'errors':'warnings']++;const issue={severity,code,label,message,point:{x:point.x,y:point.y||0,z:point.z},objectId};if(issues.length<200)issues.push(issue);else if(severity==='error'){issues.pop();issues.unshift(issue);}};
 for(const [index,[x,z]]of (map.spawns||[]).entries()){
  const point={x,y:groundAt(openMap,x,z),z};
  if(canStand(openMap,point))clearSpawns++;
  else add('warning','blocked-spawn','Spawn '+(index+1),'The standing space is blocked or outside the map.',point,'spawn-'+index);
  yield {checked:++checked,total};
 }
 if(clearSpawns<2)add('error','spawn-count','Spawn points','Keep at least two clear spawn points.',{x:0,y:0,z:0});
 for(const door of map.doors||[]){
  const solid=map.boxes.find(b=>b.doorId===door.id);
  if(!solid||['x','y','z','w','h','d'].some(k=>Math.abs((door[k]??.18)-(solid[k]??.18))>.002))add('error','door-mismatch',door.id,'Door controls and collision do not occupy the same space.',door,door.editorObject);
  else if(!doorClearance(openMap,door))add('warning','blocked-door',door.id,'No standing route through this open doorway. Check its frame, nearby cover and ceiling.',door,door.editorObject);
  yield {checked:++checked,total};
 }
 for(const [kind,list]of [['chest',map.chests||[]],['loot',map.floorLoot||[]]])for(const [index,item]of list.entries()){
  if(!lootAccess(openMap,item,kind==='chest'?3.3:3))add('warning','inaccessible-loot',kind==='chest'?'Chest '+(index+1):'Loot '+(index+1),'No clear nearby standing position can reach this item. Check walls, height and the floor.',item,item.editorObject);
  yield {checked:++checked,total};
 }
 for(const r of objects){
  if(!hasSupport(openMap,solids.get(r.id)))add('warning','unsupported-object',r.name||r.id,'No support beneath this solid object. Check its height or supporting structure.',{x:r.position[0],y:r.position[1],z:r.position[2]},r.id);
  yield {checked:++checked,total};
 }
 return {...counts,issues,checked,total,clearSpawns,truncated:counts.errors+counts.warnings>issues.length};
}
export function validateMapGeometry(map){
 const steps=mapValidationSteps(map);let next;do{next=steps.next();}while(!next.done);return next.value;
}
export async function validateMapGeometryAsync(map,{yieldFrame=()=>new Promise(requestAnimationFrame),active=()=>true,onProgress=()=>{}}={}){
 const steps=mapValidationSteps(map);let next,deadline=performance.now()+4;
 while(active()){
  next=steps.next();if(next.done)return next.value;
  if(performance.now()>=deadline){onProgress(next.value);await yieldFrame();deadline=performance.now()+4;}
 }
 return null;
}
