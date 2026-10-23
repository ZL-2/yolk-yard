import {direction,wallDistance,worldHit,candidates,rayBox} from './physics.js';
import {terrainHit} from './terrain.js';
import {cameraDistance} from './camera-collision.js';
import {eyeHeight,eyePosition} from './stance.js';
import {gun} from './data.js';
import {helicopterCameraDistance} from './helicopter.js';

// Original tuning in world metres. Rendering, prediction and authority share
// this geometry; clients send only bounded blend/boom fractions, never origins.
export const THIRD_PERSON=Object.freeze({distance:3.35,aimDistance:2.05,shoulder:.62,aimShoulder:.46,height:-.16,aimHeight:-.18,transition:14});
const clamp01=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export const perspectiveMode=value=>value==='third'?'third':'first';
export const helicopterPassenger=p=>!!p?.vehicleId&&p.vehicleType==='helicopter'&&p.vehicleSeat>0;
export const vehiclePassenger=p=>!!p?.vehicleId&&p.vehicleSeat>0;
export const weaponCameraAllowed=p=>(!p?.vehicleId||vehiclePassenger(p))&&!p?.zVehicle;
export function scopedPerspective(p){return !!p?.aim&&!p.reloadEnd&&!p.use&&!p.sprinting&&!p.reviving&&!p.mantle&&!p.traversal&&!p.building&&!p.editing&&(!p.inventory||p.inventory[p.slot]?.weapon)&&['scope','prism'].includes(gun(p).optic);}
export function thirdPersonActive(p){return p?.perspective==='third'&&p.health>0&&!p.spectating&&!p.downed&&!p.emote&&weaponCameraAllowed(p)&&(!p.flight||p.flight==='ground')&&!scopedPerspective(p);}
export function cameraPose(map,p,{unclampedBoom=false}={}){
 const eye=eyePosition(p),d=direction(p.yaw||0,p.pitch||0);
 if(!thirdPersonActive(p))return {origin:eye,eye,d,length:0,fraction:1,third:false};
 const t=clamp01(p.viewBlend??Number(!!p.aim&&!p.building&&!p.editing)),c=THIRD_PERSON;
 const distance=c.distance+(c.aimDistance-c.distance)*t,side=c.shoulder+(c.aimShoulder-c.shoulder)*t,height=c.height+(c.aimHeight-c.height)*t;
 const stance=Number.isFinite(p.cameraEye)?Math.max(.6,Math.min(1.7,p.cameraEye))-eyeHeight(p):0;
 // Rotate the vertical framing offset with the boom. A world-up offset moved
 // the reticle away from the shoulder as pitch changed, exaggerating look-down.
 const yaw=p.yaw||0,pitch=p.pitch||0,up={x:Math.sin(yaw)*Math.sin(pitch),y:Math.cos(pitch),z:Math.cos(yaw)*Math.sin(pitch)};
 const offset={x:-d.x*distance+Math.cos(yaw)*side+up.x*height,y:-d.y*distance+up.y*height+stance,z:-d.z*distance-Math.sin(yaw)*side+up.z*height};
 const length=Math.hypot(offset.x,offset.y,offset.z),back={x:offset.x/length,y:offset.y/length,z:offset.z/length};
 const allowed=Math.min(map?cameraDistance(map,eye,back,length):length,helicopterCameraDistance(p,eye,back,length))/length;
 const fraction=Math.min(allowed,unclampedBoom||!Number.isFinite(p.viewBoom)?1:clamp01(p.viewBoom));
 return {origin:{x:eye.x+offset.x*fraction,y:eye.y+offset.y*fraction,z:eye.z+offset.z*fraction},eye,d,length,fraction,third:true};
}
export function sightRay(map,p,range=200){
 const pose=cameraPose(map,p);
 return {...pose,range:range+(pose.third?pose.length*pose.fraction:0)};
}
export function reticleTarget(map,p,range=200,renderedPose=null){
 const ray={...sightRay(map,p,range),...renderedPose},hit=map?worldHit(map,ray.origin,ray.d,ray.range):null,distance=hit?.distance??ray.range;
 return {ray,point:hit?.point||{x:ray.origin.x+ray.d.x*distance,y:ray.origin.y+ray.d.y*distance,z:ray.origin.z+ray.d.z*distance}};
}
// Local-space weapon pitch/yaw, solved against the same world point as the
// camera reticle. The arm IK follows this weapon transform instead of a second
// approximation of the player's pitch. Reject points behind a retracted boom.
export function weaponAimAt(p,point,anchor){
 const dx=point.x-p.x,dz=point.z-p.z,yaw=p.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
 const x=c*dx-s*dz-anchor.x,y=point.y-p.y-anchor.y,z=s*dx+c*dz-anchor.z;
 const forward=direction(0,p.pitch||0);
 if(y*forward.y+z*forward.z<=.05)return {pitch:p.pitch||0,yaw:0};
 return {pitch:Math.atan2(y,Math.hypot(x,z)),yaw:Math.atan2(-x,-z)};
}
export function reachablePoint(map,p,point,range,ignoreBuildId=null){
 const eye=eyePosition(p),delta={x:point.x-eye.x,y:point.y-eye.y,z:point.z-eye.z},length=Math.hypot(delta.x,delta.y,delta.z);
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
 const eye=eyePosition(p),delta={x:point.x-eye.x,y:point.y-(eye.y-.15),z:point.z-eye.z},length=Math.hypot(delta.x,delta.y,delta.z)||1;
 // A wall directly behind the shoulder must never make a tool fire backwards.
 if(delta.x*ray.d.x+delta.y*ray.d.y+delta.z*ray.d.z<=.05)return ray.d;
 return {x:delta.x/length,y:delta.y/length,z:delta.z/length};
}
