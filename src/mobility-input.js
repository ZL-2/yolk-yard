import {startJumpRig} from './season-one.js';
import {startShadowstep} from './shadowstep.js';
export function mobilityJump(p,input,fresh,dt,time){
 const window=p.mobilityJumpWindow||0;p.mobilityJumpWindow=Math.max(0,window-dt);
 if(!fresh||!p.inventory||p.downed||p.spectating||p.vehicleId||p.flight==='transport')return false;
 p.mobilityJumpWindow=.4;
 if(!window||p.grounded)return false;
 const mx=-Math.sin(p.yaw)*(input.forward||0)+Math.cos(p.yaw)*(input.strafe||0),mz=-Math.cos(p.yaw)*(input.forward||0)-Math.sin(p.yaw)*(input.strafe||0);
 p.shadowDirection=Math.hypot(mx,mz)>.1?{x:mx,z:mz}:null;
 const selected=p.inventory[p.slot],items=[selected,...p.inventory.filter(i=>i!==selected)].filter(i=>i&&['jumpRig','shadowstep'].includes(i.id));
 for(const item of items)if((item.id==='jumpRig'?startJumpRig:startShadowstep)(p,item,time)){
  p.mobilityJumpWindow=0;p.jumpBuffer=0;p.jumpLatch=p.flightLatch=true;p.mobilitySerial=(p.mobilitySerial||0)+1;p.mobilityKind=item.id;return true;
 }
 return false;
}
