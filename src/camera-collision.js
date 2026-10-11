import {candidates,rayBox} from './physics.js';
import {terrainHit} from './terrain.js';

// One short, spatially indexed sweep for the local camera only. Expanding the
// boxes protects the near-plane corners, including diagonal walls and ceilings.
export const CAMERA_RADIUS=.18;
export function cameraDistance(map,origin,direction,length,radius=CAMERA_RADIUS){
 let distance=length;
 for(const box of candidates(map,origin,direction,length,radius))distance=Math.min(distance,rayBox(origin,direction,box,distance,radius));
 const terrain=terrainHit(map,origin,direction,distance,radius);
 return Math.max(0,Math.min(distance,terrain?.distance??distance)-.025);
}
export function cameraNearPlane(fov,aspect,radius=CAMERA_RADIUS){
 // Keep every near-plane corner inside the swept volume, even on wide screens.
 const tangent=Math.tan(fov*Math.PI/360);
 return Math.min(.15,radius/Math.sqrt(1+tangent*tangent*(1+aspect*aspect)));
}
export function smoothCameraDistance(previous,distance,dt,key){
 // Collision pulls inward immediately. Release outward smoothly; never smooth
 // through a new wall, across a teleport, or between spectator targets.
 const same=previous?.key===key;
 const value=same&&distance>previous.distance?previous.distance+(distance-previous.distance)*(1-Math.exp(-8*Math.max(0,dt))):distance;
 if(previous){previous.key=key;previous.distance=value;return previous;}
 return {key,distance:value};
}
