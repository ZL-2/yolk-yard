import {groundAt} from './terrain.js';

export const OWNER_CAMERA_ACTIONS={
 'game-freecam':['Free camera','Move your spectator camera independently of your player. Your contestant stays eliminated.'],
 'game-freecam-goto':['Camera to player','Move your spectator camera to the selected player.'],
 'game-freecam-exit':['Exit free camera','Return to normal spectating.'],
};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export class OwnerFreeCamera {
 constructor(){this.state=null;}
 stop(){this.state=null;}
 start(point,look,map,matchId){
  this.state={matchId,x:point.x,y:Math.max(point.y+2.8,groundAt(map,point.x,point.z)+2),z:point.z,
   yaw:look.yaw||0,pitch:look.pitch||0};
 }
 look(dx,dy){
  const p=this.state;if(!p)return;
  p.yaw-=dx;p.pitch=clamp(p.pitch-dy,-1.48,1.48);
 }
 move({forward=0,right=0,up=0,fast=false},map,dt){
  const p=this.state;if(!p)return;
  const speed=(fast?58:22)*dt/Math.max(1,Math.hypot(forward,right,up));
  const edge=(map?.size||256)+12;
  p.x=clamp(p.x+(Math.cos(p.yaw)*right-Math.sin(p.yaw)*forward)*speed,-edge,edge);
  p.z=clamp(p.z-(Math.sin(p.yaw)*right+Math.cos(p.yaw)*forward)*speed,-edge,edge);
  p.y=clamp(p.y+up*speed,Math.max(.7,groundAt(map,p.x,p.z)+.65),(map?.terrain?.max||0)+225);
 }
}
