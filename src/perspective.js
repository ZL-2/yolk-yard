import {direction,wallDistance,worldHit,candidates,rayBox} from './physics.js';
import {terrainHit} from './terrain.js';
import {cameraDistance} from './camera-collision.js';
import {eyeHeight} from './stance.js';
import {gun} from './data.js';

// Original tuning in world metres. Rendering, prediction and authority share
// this geometry; clients send only bounded blend/boom fractions, never origins.
export const THIRD_PERSON=Object.freeze({distance:3.15,aimDistance:1.65,shoulder:.62,aimShoulder:.48,height:.22,aimHeight:.13,transition:14});
const clamp01=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export const perspectiveMode=value=>value==='third'?'third':'first';
export function scopedPerspective(p){return !!p?.aim&&!p.reloadEnd&&!p.use&&!p.sprinting&&!p.reviving&&!p.mantle&&!p.traversal&&!p.building&&!p.editing&&(!p.inventory||p.inventory[p.slot]?.weapon)&&['scope','prism'].includes(gun(p).optic);}
export function thirdPersonActive(p){return p?.perspective==='third'&&p.health>0&&!p.spectating&&!p.downed&&!p.emote&&!p.vehicleId&&(!p.flight||p.flight==='ground')&&!scopedPerspective(p);}
export function cameraPose(map,p,{unclampedBoom=false}={}){
 const eye={x:p.x,y:p.y+eyeHeight(p),z:p.z},d=direction(p.yaw||0,p.pitch||0);
 if(!thirdPersonActive(p))return {origin:eye,eye,d,length:0,fraction:1,third:false};
 const t=clamp01(p.viewBlend??Number(!!p.aim&&!p.building&&!p.editing)),c=THIRD_PERSON;
 const distance=c.distance+(c.aimDistance-c.distance)*t,side=c.shoulder+(c.aimShoulder-c.shoulder)*t,height=c.height+(c.aimHeight-c.height)*t;
 const stance=Number.isFinite(p.cameraEye)?Math.max(.6,Math.min(1.7,p.cameraEye))-eyeHeight(p):0;
 const offset={x:-d.x*distance+Math.cos(p.yaw)*side,y:-d.y*distance+height+stance,z:-d.z*distance-Math.sin(p.yaw)*side};
 const length=Math.hypot(offset.x,offset.y,offset.z),back={x:offset.x/length,y:offset.y/length,z:offset.z/length};
 const allowed=map?cameraDistance(map,eye,back,length)/length:1;
 const fraction=Math.min(allowed,unclampedBoom||!Number.isFinite(p.viewBoom)?1:clamp01(p.viewBoom));
 return {origin:{x:eye.x+offset.x*fraction,y:eye.y+offset.y*fraction,z:eye.z+offset.z*fraction},eye,d,length,fraction,third:true};
}
export function sightRay(map,p,range=200){
 const pose=cameraPose(map,p);
 return {...pose,range:range+(pose.third?pose.length*pose.fraction:0)};
}
export function reachablePoint(map,p,point,range,ignoreBuildId=null){
 const eye={x:p.x,y:p.y+eyeHeight(p),z:p.z},delta={x:point.x-eye.x,y:point.y-eye.y,z:point.z-eye.z},length=Math.hypot(delta.x,delta.y,delta.z);
 if(length>range+.12)return false;if(length<.001)return true;
 const d={x:delta.x/length,y:delta.y/length,z:delta.z/length};
 if(!ignoreBuildId)return wallDistance(map,eye,d,length)>=length-.08;
 // Edit controls lie on the original piece plane, inside its own solids.
 // Exclude only that structure; intervening walls and terrain still block.
 for(const box of candidates(map,eye,d,length))if(box.buildId!==ignoreBuildId&&rayBox(eye,d,box,length)<length-.08)return false;
 const ground=terrainHit(map,eye,d,length);return !ground||ground.distance>=length-.08;
}
// Convert the camera reticle to a body-origin direction for thrown tools. The
// simulation still sweeps every projectile from the player, including cover.
export function toolDirection(map,p,range=100){
 if(!thirdPersonActive(p)||!map)return direction(p.yaw,p.pitch);
 const ray=sightRay(map,p,range),hit=worldHit(map,ray.origin,ray.d,ray.range),distance=hit?.distance??ray.range;
 const point=hit?.point||{x:ray.origin.x+ray.d.x*distance,y:ray.origin.y+ray.d.y*distance,z:ray.origin.z+ray.d.z*distance};
 const delta={x:point.x-p.x,y:point.y-(p.y+eyeHeight(p)-.15),z:point.z-p.z},length=Math.hypot(delta.x,delta.y,delta.z)||1;
 // A wall directly behind the shoulder must never make a tool fire backwards.
 if(delta.x*ray.d.x+delta.y*ray.d.y+delta.z*ray.d.z<=.05)return ray.d;
 return {x:delta.x/length,y:delta.y/length,z:delta.z/length};
}
