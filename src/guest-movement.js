import {launchPlayer} from './airborne.js';
import {movePlayer} from './physics.js';
// Use the same exit rule as the host, without waiting a round trip to begin a dive.
export function predictMovement(player,input,map,dt,royale){
 if(royale&&player.flight==='transport'){
  if(royale.elapsed>=3&&(input.jump||royale.elapsed>=royale.route.duration)){
   player.lastJumpPress=Math.max(player.lastJumpPress||0,input.jumpPress||0);
   launchPlayer(player,{source:'bus'});player.yaw=input.yaw;player.pitch=0;
  }
  return;
 }
 movePlayer(player,input,map,dt);
}
