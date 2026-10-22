import {vehicleFits} from './vehicle-collision.js';
import {candidates,boxTop,rayBox,direction} from './physics.js';
import {groundAt} from './terrain.js';
// Classic five-seat Choppa behavior; flight constants are original Ravel Coast
// tuning in metres/seconds, not claimed to be Epic's unpublished engine values.
export const HELICOPTER=Object.freeze({health:1500,seats:5,speed:25,boostSpeed:35,acceleration:8,verticalSpeed:6,ceiling:155,spoolTime:3,boostDuration:1.5,boostCooldown:5,fuel:100,enterRange:5,exitHold:.45,tailMultiplier:2.25});
export const HELIPAD=Object.freeze({id:'kestrel-forward',name:'Kestrel Forward Station',x:158,z:74,yaw:Math.PI*.8,radius:16});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const isHelicopter=v=>v?.type==='helicopter';
export const heliLocal=(v,x,y,z)=>({x:v.x+x*Math.cos(v.yaw)+z*Math.sin(v.yaw),y:v.y+y,z:v.z-x*Math.sin(v.yaw)+z*Math.cos(v.yaw)});
export function helicopterSeatPose(v,seat){
 const poses=[[0,.64,-1.05],[-1.75,.34,-.35],[1.75,.34,-.35],[-1.75,.34,1.10],[1.75,.34,1.10]];
 return heliLocal(v,...(poses[seat]||poses[0]));
}
// The passenger's shoulder camera must not pass through its own cabin. The
// seat and authoritative craft yaw recover the craft origin on every peer.
export function helicopterCameraDistance(p,origin,d,length,radius=.18){
 if(p?.vehicleType!=='helicopter'||!p.vehicleId||!(p.vehicleSeat>0))return length;
 const angle=p.vehicleYaw||0,c=Math.cos(angle),s=Math.sin(angle),seat=helicopterSeatPose({x:0,y:0,z:0,yaw:angle},p.vehicleSeat);
 const x=origin.x-p.x+seat.x,z=origin.z-p.z+seat.z,o={x:x*c-z*s,y:origin.y-p.y+seat.y,z:x*s+z*c},ray={x:d.x*c-d.z*s,y:d.y,z:d.x*s+d.z*c};
 let distance=length;
 for(const box of [{x:0,y:.4,z:-.9,w:2.56,h:2.2,d:2.6},{x:0,y:.4,z:1.1,w:2.56,h:1.9,d:1.5},{x:0,y:1.25,z:3.35,w:.72,h:.65,d:3.5}])distance=Math.min(distance,rayBox(o,ray,box,distance,radius));
 return Math.max(0,Math.min(length,distance-.025));
}
export function helicopterFloor(map,v){
 let floor=groundAt(map,v.x,v.z);
 for(const [x,z]of [[-1.35,-1.35],[1.35,-1.35],[-1.35,1.3],[1.35,1.3]]){
  const p=heliLocal(v,x,0,z);let h=groundAt(map,p.x,p.z);
  for(const b of candidates(map,p,null,0,.15)){const top=boxTop(b,p.x,p.z,.15);if(top<=v.y+.4)h=Math.max(h,top);}
  floor=Math.max(floor,h);
 }
 return floor;
}
export const helicopterFits=vehicleFits;

export function spawnHelicopter(map){
 const site=map.helipad||HELIPAD,v={id:'kestrel-01',type:'helicopter',site:site.id,name:'Kestrel H-05',x:site.x,y:site.y??groundAt(map,site.x,site.z),z:site.z,yaw:site.yaw??HELIPAD.yaw,vx:0,vy:0,vz:0,speed:0,pitch:0,roll:0,health:HELICOPTER.health,seats:Array(5).fill(null),grounded:true,boost:100,boosting:false,boostTime:0,boostCooldown:0,rotor:0,fuel:100,revision:0,loudspeaker:false,falling:false,wrecked:false};
 v.y=helicopterFloor(map,v);return v;
}
export function stepHelicopter(v,input,map,dt,onImpact=null){
 if(v.wrecked)return;
 const count=Math.max(1,Math.ceil(Math.min(.1,dt)*60)),step=Math.min(.1,dt)/count;
 v.impactSpeed=0;
 for(let i=0;i<count;i++){
  const piloted=!!v.seats[0]&&!v.falling&&v.fuel>0;
  const powered=piloted||!v.grounded&&!v.falling&&v.fuel>0;
  v.rotor=clamp((v.rotor||0)+(powered?1/HELICOPTER.spoolTime:-.24)*step,0,1);
  v.boostCooldown=Math.max(0,(v.boostCooldown||0)-step);v.boostTime=Math.max(0,(v.boostTime||0)-step);
  if(piloted&&input.heliBoost&&v.rotor>.92&&v.boostCooldown===0&&!v.grounded){v.boostTime=HELICOPTER.boostDuration;v.boostCooldown=HELICOPTER.boostDuration+HELICOPTER.boostCooldown;}
  v.boosting=powered&&v.boostTime>0;v.boost=v.boostCooldown?100*(1-clamp((v.boostCooldown-v.boostTime)/HELICOPTER.boostCooldown,0,1)):100;
  if(powered)v.fuel=Math.max(0,v.fuel-step*(v.boosting?.8:v.speed>2?.22:.10));
  if(v.fuel<=0){v.falling=true;v.loudspeaker=false;}
  const turn=piloted?Math.atan2(Math.sin((input.yaw??v.yaw)-v.yaw),Math.cos((input.yaw??v.yaw)-v.yaw)):0;
  v.yaw+=clamp(turn,-1.6*step,1.6*step);
  const forward=piloted?clamp(input.forward||0,-1,1):0,strafe=piloted?clamp(input.strafe||0,-1,1):0,length=Math.max(1,Math.hypot(forward,strafe)),f=direction(input.yaw??v.yaw),r={x:Math.cos(input.yaw??v.yaw),z:-Math.sin(input.yaw??v.yaw)};
  const speed=(v.boosting?HELICOPTER.boostSpeed:HELICOPTER.speed)*Math.max(0,(v.rotor-.55)/.45),launch=v.boosting&&forward===0&&strafe===0;
  const tx=(f.x*(launch?1:forward)+r.x*strafe)/length*speed,tz=(f.z*(launch?1:forward)+r.z*strafe)/length*speed;
  const accel=(v.boosting?20:HELICOPTER.acceleration)*step;
  v.vx+=clamp(tx-v.vx,-accel,accel);v.vz+=clamp(tz-v.vz,-accel,accel);
  const up=piloted&&!!input.heliUp,down=piloted&&!!input.heliDown;
  const targetY=v.falling?-24:!piloted?-2:v.rotor<.92?0:(Number(up)-Number(down))*HELICOPTER.verticalSpeed;
  v.vy+=clamp(targetY-v.vy,-(v.falling?10:8)*step,(v.falling?10:8)*step);
  if(v.grounded&&v.rotor<.92)v.vx=v.vz=0;
  const swept=Math.max(1,Math.ceil(Math.hypot(v.vx,v.vy,v.vz)*step/.30));
  for(let j=0;j<swept;j++){
   const q={...v,x:v.x+v.vx*step/swept,z:v.z+v.vz*step/swept};
   const inBounds=Math.abs(q.x)<map.size-7&&Math.abs(q.z)<map.size-7;let clear=inBounds&&helicopterFits(map,q);
   if(inBounds&&!clear&&onImpact){onImpact(q,Math.hypot(v.vx,v.vz));clear=helicopterFits(map,q);}
   if(clear){v.x=q.x;v.z=q.z;}else{v.impactSpeed=Math.max(v.impactSpeed,Math.hypot(v.vx,v.vz));v.vx*=.35;v.vz*=.35;}
   const floor=helicopterFloor(map,v),ny=clamp(v.y+v.vy*step/swept,floor,HELICOPTER.ceiling);
   const vertical={...v,y:ny};let verticalClear=helicopterFits(map,vertical);
   if(!verticalClear&&ny>floor&&onImpact){onImpact(vertical,Math.abs(v.vy));verticalClear=helicopterFits(map,vertical);}
   if(verticalClear||ny<=v.y&&ny===floor)v.y=ny;else{v.impactSpeed=Math.max(v.impactSpeed,Math.abs(v.vy));v.vy=0;}
   v.grounded=v.y<=floor+.03;
   if(v.grounded){if(v.vy<-8)v.impactSpeed=Math.max(v.impactSpeed,-v.vy*1.4);v.y=floor;v.vy=Math.max(0,v.vy);}
   if(v.y>=HELICOPTER.ceiling)v.vy=Math.min(0,v.vy);
  }
  v.speed=Math.hypot(v.vx,v.vz);
  const blend=1-Math.exp(-step*4),along=-(v.vx*Math.sin(v.yaw)+v.vz*Math.cos(v.yaw)),across=v.vx*Math.cos(v.yaw)-v.vz*Math.sin(v.yaw);
  v.pitch+=((v.grounded?0:-along*.009)-v.pitch)*blend;v.roll+=((v.grounded?0:-across*.008-turn*.07)-v.roll)*blend;
  if(v.falling)v.crashTime=(v.crashTime||0)+step;
 }
}
export function helicopterHit(v,origin,d,range){
 const c=Math.cos(v.yaw),s=Math.sin(v.yaw),x=origin.x-v.x,z=origin.z-v.z,o={x:x*c-z*s,y:origin.y-v.y,z:x*s+z*c},ray={x:d.x*c-d.z*s,y:d.y,z:d.x*s+d.z*c};
 // Cockpit glass is omitted above the instrument panel so pilots can be hit.
 const parts=[{x:0,y:.6,z:0,w:2.5,h:1.05,d:3.8},{x:0,y:1.1,z:1.3,w:2.5,h:1.2,d:1.5},{x:0,y:1.35,z:3.6,w:.52,h:.65,d:3.5},{x:.22,y:1.9,z:5.1,w:.35,h:1.8,d:1.7,weak:true}];
 let hit;for(const b of parts){const distance=rayBox(o,ray,b,range);if(Number.isFinite(distance)&&distance<=range&&(!hit||distance<hit.distance))hit={distance,multiplier:b.weak?HELICOPTER.tailMultiplier:1};}return hit;
}
