import {emoteInput} from './emotes.js';
import {launchPlayer} from './airborne.js';
import {movePlayer} from './physics.js';
// Use the same exit rule as the host, without waiting a round trip to begin a dive.
export function predictMovement(player,input,map,dt,royale,time=0){
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
 movePlayer(player,input,map,dt);
}
