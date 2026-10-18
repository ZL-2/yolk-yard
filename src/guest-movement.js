import {constrainBoxMovement} from './box-fight-rules.js';
import {emoteInput} from './emotes.js';
import {launchPlayer} from './airborne.js';
import {movePlayer} from './physics.js';
import {stepVehicle,seatPlayer} from './vehicles.js';
// Prediction owns all mutable movement state. In particular mantle.elapsed
// must never advance inside the authoritative snapshot being reconciled.
export function predictionCopy(p){
 return {...p,phasedBuilds:p.phasedBuilds?.slice(),ammo:p.ammo?.slice()||[],reserve:p.reserve?.slice()||[],inventory:p.inventory?.map(i=>i?{...i}:null),
  mantle:p.mantle?{...p.mantle,from:{...p.mantle.from},lift:{...p.mantle.lift},across:{...p.mantle.across},to:{...p.mantle.to}}:null,
  grapple:p.grapple?structuredClone(p.grapple):null,shadowstep:p.shadowstep?{...p.shadowstep}:null,
  traversal:p.traversal?{...p.traversal}:null,fall:p.fall?{...p.fall}:null,launchVelocity:p.launchVelocity?{...p.launchVelocity}:null};
}
// Use the same exit rule as the host, without waiting a round trip to begin a dive.
export function predictMovement(player,input,map,dt,royale,time=0){
 if(player.zVehicle){player.yaw=input.yaw??player.yaw;player.pitch=input.pitch??player.pitch;return;}
 if(royale?.boxfightStage==='intermission')return;
 if(player.vehicleId){
  const source=royale?.vehicles?.find(v=>v.id===player.vehicleId);if(!source)return;
  if(!player.predictedVehicle||player.predictedVehicle.id!==source.id)player.predictedVehicle={...source,seats:[...source.seats]};
  const v=player.predictedVehicle;if(player.vehicleSeat===0)stepVehicle(v,input,map,dt);else Object.assign(v,source,{seats:[...source.seats]});seatPlayer(player,v);player.yaw=input.yaw??player.yaw;player.pitch=input.pitch??player.pitch;return;
 }
 if(royale&&player.flight==='transport'){
  if(Number.isFinite(input.yaw))player.yaw=input.yaw;
  if(Number.isFinite(input.pitch))player.pitch=Math.max(-1.48,Math.min(1.48,input.pitch));
  if(royale.elapsed>=3&&(input.jump||royale.elapsed>=royale.route.duration)){
   player.lastJumpPress=Math.max(player.lastJumpPress||0,input.jumpPress||0);
   launchPlayer(player,{source:'bus'});player.yaw=input.yaw;player.pitch=0;
  }
  return;
 }
 input=emoteInput({time},player,input);
 movePlayer(player,input,map,dt,time);
 if(map.boxArena||map.zoneWars)constrainBoxMovement(player,map,['waiting','prepare'].includes(royale?.boxfightStage));
}
