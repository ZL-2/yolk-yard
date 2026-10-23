import {vehicleFits} from './vehicle-collision.js';
import {impactStructures,ramPlayers} from './vehicle-impact.js';
import {HELICOPTER,isHelicopter,spawnHelicopter,helicopterSeatPose,stepHelicopter,helicopterHit} from './helicopter.js';
import {canOccupy,candidates,rayBox,dist,direction,boxTop,wallDistance} from './physics.js';
import {groundAt} from './terrain.js';
import {clamp} from './data.js';
import {teammates} from './teams.js';
export const ATV=Object.freeze({count:6,health:400,speed:8.5,reverse:3.5,boostSpeed:15.5,acceleration:16,steer:1.65,boostDrain:34,boostCharge:12,enterRange:3.2});
export const ATV_SITES=Object.freeze([
 {id:'borough',x:-61,z:8,yaw:Math.PI,name:'Relay Borough garage'},
 {id:'farm',x:-119,z:-118,yaw:-Math.PI/2,name:'Northfield farm road'},
 {id:'observatory',x:83,z:-135,yaw:Math.PI,name:'Observatory approach'},
 {id:'docks',x:148,z:123,yaw:0,name:'Breakwater loading road'},
 {id:'woods',x:-90,z:132,yaw:Math.PI/2,name:'Sable Woods trailhead'},
 {id:'works',x:-125,z:60,yaw:0,name:'Ironwake service road'},
]);
const fits=vehicleFits;
function floorAt(map,v){let y=groundAt(map,v.x,v.z);for(const b of candidates(map,v)){const top=boxTop(b,v.x,v.z,.5);if(top<=v.y+.52)y=Math.max(y,top);}return y;}
export const ATV_WHEELS=Object.freeze([[-.85,-.76],[.85,-.76],[-.85,.76],[.85,.76]]);
export function vehicleLocal(v,x,y,z){const cr=Math.cos(v.roll||0),sr=Math.sin(v.roll||0),cp=Math.cos(v.pitch||0),sp=Math.sin(v.pitch||0),cy=Math.cos(v.yaw),sy=Math.sin(v.yaw),xx=x*cr-y*sr,yy=(x*sr+y*cr)*cp-z*sp,zz=(x*sr+y*cr)*sp+z*cp;return {x:xx*cy+zz*sy,y:yy,z:-xx*sy+zz*cy};}
export function vehicleSupportHeight(map,v){
 let height=floorAt(map,v);
 for(const [x,z]of ATV_WHEELS){const q=vehicleLocal(v,x,.53,z);height=Math.max(height,floorAt(map,{x:v.x+q.x,y:v.y,z:v.z+q.z})-q.y+.55);}
 return height;
}
export function initializeVehicles(sim){
 sim.vehicles=[];for(const p of sim.players.values()){p.vehicleId=null;p.vehicleSeat=null;p.vehicleType=null;p.vehicleLock=0;}
 if(sim.map.id!=='sunnybreak')return;
 for(const [index,site]of ATV_SITES.entries()){
  let spot;for(const radius of [0,3,6,9,12,16]){for(let i=0;i<(radius?12:1);i++){const angle=i*Math.PI/6,x=site.x+Math.cos(angle)*radius,z=site.z+Math.sin(angle)*radius,y=groundAt(sim.map,x,z),probe={x,y,z,yaw:site.yaw};if(y>1.3&&fits(sim.map,probe)&&canOccupy(sim.map,{x,y:y+.1,z},2.1,1.8)){spot=probe;break;}}if(spot)break;}
  if(!spot)throw Error('ATV parking blocked: '+site.id);
  sim.vehicles.push({id:'atv-'+index,site:site.id,name:site.name,...spot,vx:0,vz:0,vy:0,speed:0,steering:0,boost:100,boosting:false,health:ATV.health,seats:[null,null],grounded:true,pitch:0,roll:0,revision:0});
 }
 sim.vehicles.push(spawnHelicopter(sim.map));
}
export function seatPose(v,seat=0){if(isHelicopter(v))return helicopterSeatPose(v,seat);const q=vehicleLocal(v,0,.08,seat===0?-.32:.44);return {x:v.x+q.x,y:v.y+q.y,z:v.z+q.z};}
export function seatPlayer(p,v){p.vehicleType=v.type||'atv';Object.assign(p,seatPose(v,p.vehicleSeat));p.vehicleYaw=v.yaw;p.vx=v.vx;p.vz=v.vz;p.vy=v.vy;p.grounded=v.grounded;p.flight='ground';p.redeploy=p.forceGlider=false;p.sliding=p.sprinting=p.crouching=false;p.fall={apex:p.y,immune:true,source:'vehicle'};p.landing=null;}
export function exitVehicle(sim,p,{force=false}={}){
 const v=sim.vehicles?.find(v=>v.id===p.vehicleId);if(!v){p.vehicleId=null;p.vehicleSeat=null;p.vehicleType=null;return true;}
 let spot;for(const side of [1,-1])for(const away of (isHelicopter(v)?[3.2,4,5]:[1.75,2.4,3.2])){const x=v.x+Math.cos(v.yaw)*side*away,z=v.z-Math.sin(v.yaw)*side*away,y=Math.max(v.y+.15,groundAt(sim.map,x,z));if(canOccupy(sim.map,{x,y,z},1.85,.32)){spot={x,y,z};break;}if(spot)break;}
 if(!spot&&!force)return false;
 if(p.health<=0)spot={x:p.x,y:p.y,z:p.z};
 const seat=p.vehicleSeat;if(v.seats[seat]===p.id)v.seats[seat]=null;v.revision++;p.vehicleId=null;p.vehicleSeat=null;p.vehicleType=null;p.vehicleLock=sim.time+.6;p.vehicleInteractHeld=true;p.interactLatch=true;
 Object.assign(p,spot||{x:v.x,y:v.y+1.65,z:v.z});p.vy=Math.max(0,v.vy);p.grounded=false;p.fall={apex:p.y,immune:!isHelicopter(v),source:isHelicopter(v)?'helicopter-exit':'vehicle-exit'};p.launchVelocity={x:v.vx*.5,z:v.vz*.5};
 sim.emit?.('royale-cue',{cue:'vehicle-exit',player:p.id,x:v.x,y:v.y,z:v.z});return true;
}
export function vehiclePrompt(vehicles,p){
 if(p.vehicleId)return null;
 const v=vehicles?.filter(v=>v.health>0&&!v.falling&&v.seats.some(s=>!s)&&dist(p,v)<(isHelicopter(v)?HELICOPTER.enterRange:ATV.enterRange)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
 return v?{kind:'vehicle',text:isHelicopter(v)?(v.seats[0]?'BOARD KESTREL · PASSENGER':'PILOT KESTREL H-05'):(v.seats[0]?'RIDE ATV · PASSENGER':'DRIVE ATV'),id:v.id}:null;
}
export function vehicleInteract(sim,p,input){
 const fresh=!!input.interact&&!p.vehicleInteractHeld;p.vehicleInteractHeld=!!input.interact;
 if(p.vehicleId){const v=sim.vehicles.find(v=>v.id===p.vehicleId);if(!v||v.wrecked||!isHelicopter(v)&&v.health<=0||p.downed||p.health<=0||p.connected===false){exitVehicle(sim,p,{force:true});return false;}
  if(p.vehicleEntryHeld&&!input.interact&&!input.heliExit)p.vehicleEntryHeld=false;
  if(isHelicopter(v)){
   if(!p.vehicleEntryHeld&&(input.interact||input.heliExit)){p.vehicleExitSince??=sim.time;if(sim.time-p.vehicleExitSince>=HELICOPTER.exitHold&&sim.time>=(p.vehicleLock||0)){if(exitVehicle(sim,p)){p.vehicleExitSince=null;return true;}}}else p.vehicleExitSince=null;
   const hornPress=input.heliHornPress?input.heliHornPress>(p.lastVehicleHornPress||0):input.heliHorn&&!p.vehicleHornHeld;
   p.lastVehicleHornPress=Math.max(p.lastVehicleHornPress||0,input.heliHornPress||0);
   if(hornPress&&p.vehicleSeat===0&&!v.falling){v.loudspeaker=!v.loudspeaker;v.revision++;sim.emit?.('royale-cue',{cue:v.loudspeaker?'helicopter-speaker-on':'helicopter-speaker-off',x:v.x,y:v.y,z:v.z});}p.vehicleHornHeld=!!input.heliHorn;
  }else if(fresh&&sim.time>=(p.vehicleLock||0)){exitVehicle(sim,p);return true;}
  const swapping=input.heliSeat;
  const swap=input.heliSeatPress?input.heliSeatPress>(p.lastVehicleSeatPress||0):!!swapping&&!p.vehicleSeatHeld;p.vehicleSeatHeld=!!swapping;p.lastVehicleSeatPress=Math.max(p.lastVehicleSeatPress||0,input.heliSeatPress||0);
  if(swap&&sim.time>=(p.vehicleLock||0)){const other=Array.from({length:v.seats.length-1},(_,i)=>(p.vehicleSeat+i+1)%v.seats.length).find(i=>!v.seats[i]);if(other!==undefined){v.seats[other]=p.id;v.seats[p.vehicleSeat]=null;p.vehicleSeat=other;p.vehicleLock=sim.time+.6;v.revision++;seatPlayer(p,v);}}
  return true;
 }
 if(!fresh||p.bot||p.health<=0||p.downed||p.spectating||p.flight!=='ground'||p.traversal||p.grapple||sim.time<(p.vehicleLock||0))return false;
 const prompt=vehiclePrompt(sim.vehicles,p);if(!prompt)return false;const v=sim.vehicles.find(v=>v.id===prompt.id),seat=v.seats.findIndex(s=>!s);
 v.seats[seat]=p.id;v.revision++;p.vehicleId=v.id;p.vehicleSeat=seat;p.vehicleLock=sim.time+.6;p.vehicleSeatHeld=!!input.heliSeat;p.vehicleEntryHeld=true;p.vehicleExitSince=null;p.vehicleHornHeld=!!input.heliHorn;p.interactLatch=true;p.emote=null;p.use=null;p.reloadEnd=0;p.burstLeft=0;p.mantle=null;p.shadowstep=null;p.building=p.editing=false;seatPlayer(p,v);
 p.lastVehicleHornPress=input.heliHornPress||0;p.lastVehicleSeatPress=input.heliSeatPress||0;
 sim.emit?.('royale-cue',{cue:'vehicle-enter',player:p.id,x:v.x,y:v.y,z:v.z});return true;
}
// Shared by authority and guest prediction. Six ATVs and one helicopter exist, with no
// simulation work for an empty, settled vehicle. Thin cover uses swept steps.
export function stepVehicle(v,input,map,dt,onImpact=null){
 if(isHelicopter(v)){stepHelicopter(v,input,map,dt,onImpact);return;}
 v.impactSpeed=0;v.impactBoost=false;
 const count=Math.max(1,Math.ceil(Math.min(.1,dt)/(1/60))),step=Math.min(.1,dt)/count;
 for(let tick=0;tick<count;tick++){
  const throttle=clamp(input.forward||0,-1,1),steer=clamp(input.strafe||0,-1,1),brake=!!input.jump;
  if(v.boost<=0)v.boostEmpty=true;if(v.boost>=25)v.boostEmpty=false;
  v.boosting=!!input.sprint&&!v.boostEmpty&&v.boost>0&&throttle>=0&&!brake;
  v.boost=clamp(v.boost+(v.boosting?-ATV.boostDrain:Math.abs(v.speed)>1?ATV.boostCharge:ATV.boostCharge*.35)*step,0,100);
  const target=(v.boosting?ATV.boostSpeed:throttle<0?ATV.reverse:ATV.speed)*(v.boosting?1:throttle),accel=brake?35:v.boosting?30:throttle?ATV.acceleration:5;
  v.speed+=clamp(target-v.speed,-accel*step,accel*step);
  if(brake)v.speed*=Math.exp(-step*6);
  v.steering=steer;v.yaw-=steer*ATV.steer*clamp(Math.abs(v.speed)/8,0,1)*Math.sign(v.speed||1)*step*(v.grounded?1:.25);
  const d=direction(v.yaw),travel=Math.abs(v.speed*step),sweeps=Math.max(1,Math.ceil(travel/.24));let wall=false;
  for(let i=0;i<sweeps;i++){const q={...v,x:v.x+d.x*v.speed*step/sweeps,z:v.z+d.z*v.speed*step/sweeps};const floor=floorAt(map,q);if(v.grounded&&floor-v.y<=.52&&floor-v.y>-.52)q.y=floor;
   const inBounds=Math.abs(q.x)<=map.size-2&&Math.abs(q.z)<=map.size-2;let clear=inBounds&&fits(map,q);
   if(inBounds&&!clear&&onImpact){onImpact(q,Math.abs(v.speed));clear=fits(map,q);}
   if(!clear){wall=true;break;}v.x=q.x;v.y=q.y;v.z=q.z;
  }
  v.impactBoost||=wall&&v.boosting;v.impactSpeed=Math.max(v.impactSpeed,wall?Math.abs(v.speed):0);if(wall){v.speed*=.12;v.boosting=false;}
  const floor=vehicleSupportHeight(map,v);if(v.grounded&&v.y-floor<.52){v.y=floor;v.vy=0;}else{v.vy-=22*step;if(v.boosting)v.vy+=Math.sin(clamp(input.pitch||0,-.55,.9))*22*step;const q={...v,y:v.y+v.vy*step};if(fits(map,q))v.y=q.y;else v.vy=0;}
  v.grounded=v.y<=floor+.02;if(v.grounded){v.y=floor;v.vy=0;}
  const ahead={...v,x:v.x+d.x*.8,z:v.z+d.z*.8},behind={...v,x:v.x-d.x*.8,z:v.z-d.z*.8},right={...v,x:v.x+Math.cos(v.yaw)*.65,z:v.z-Math.sin(v.yaw)*.65},left={...v,x:v.x-Math.cos(v.yaw)*.65,z:v.z+Math.sin(v.yaw)*.65};
  const pitch=v.grounded?Math.atan2(floorAt(map,ahead)-floorAt(map,behind),1.6):clamp((input.pitch||0)*.4,-.35,.5),roll=v.grounded?Math.atan2(floorAt(map,left)-floorAt(map,right),1.3):steer*.12;
  v.pitch+=(clamp(pitch,-.65,.65)-v.pitch)*Math.min(1,step*12);v.roll+=(clamp(roll,-.45,.45)-v.roll)*Math.min(1,step*12);
  if(v.grounded)v.y=vehicleSupportHeight(map,v);
  v.vx=d.x*v.speed;v.vz=d.z*v.speed;
 }
}
export function tickVehicles(sim,dt){
 for(const v of sim.vehicles||[]){if(v.wrecked||v.health<=0&&!isHelicopter(v))continue;
  for(let seat=0;seat<v.seats.length;seat++){const p=sim.players.get(v.seats[seat]);if(v.seats[seat]&&(!p||p.vehicleId!==v.id))v.seats[seat]=null;else if(p&&(p.health<=0||p.downed||p.spectating||p.connected===false))exitVehicle(sim,p,{force:true});}
  const driver=sim.players.get(v.seats[0]),raw=driver&&sim.inputs.get(driver.id),input=raw&&sim.time-driver.lastInput<.4?raw:{};
  const before={x:v.x,y:v.y,z:v.z,yaw:v.yaw,type:v.type,vx:v.vx,vy:v.vy,vz:v.vz};
  const impact=(probe,speed)=>impactStructures(sim,v,probe,speed);
  if(isHelicopter(v)){
   if(driver||v.rotor>0||!v.grounded)stepHelicopter(v,input,sim.map,dt,impact);
   if(v.impactSpeed>8&&sim.time>=(v.crashAt||0)){v.crashAt=sim.time+.5;damageVehicle(sim,v,Math.min(160,v.impactSpeed*3),null);sim.emit?.('royale-cue',{cue:'helicopter-impact',x:v.x,y:v.y,z:v.z});}
   if(v.falling&&(v.grounded||v.crashTime>9))wreckHelicopter(sim,v);
  }else if(driver||Math.abs(v.speed)>.05||!v.grounded)stepVehicle(v,input,sim.map,dt,impact);
  else{v.speed=v.vx=v.vz=0;v.boosting=false;}
  ramPlayers(sim,v,before,driver,Math.min(.1,dt));
  for(const id of v.seats){const p=sim.players.get(id);if(p)seatPlayer(p,v);}
 }
}
export function vehicleHit(sim,origin,direction,range,attacker){
 let best;for(const v of sim.vehicles||[]){if(v.health<=0||attacker?.vehicleId===v.id)continue;if(isHelicopter(v)){const contact=helicopterHit(v,origin,direction,range);if(contact&&(!best||contact.distance<best.distance))best={vehicle:v,...contact,normal:{x:-direction.x,y:-direction.y,z:-direction.z}};continue;}const c=Math.abs(Math.cos(v.yaw)),s=Math.abs(Math.sin(v.yaw)),box={x:v.x,y:v.y+.35,z:v.z,w:1.4*c+2.5*s,d:1.4*s+2.5*c,h:.85},distance=rayBox(origin,direction,box,range);
  if(Number.isFinite(distance)&&distance<=range&&(!best||distance<best.distance))best={vehicle:v,distance,normal:{x:-direction.x,y:-direction.y,z:-direction.z}};
 }return best;
}
export function damageVehicle(sim,v,amount,attacker){
 if(v.health<=0||!Number.isFinite(amount)||amount<=0)return false;
 if(attacker&&v.seats.some(id=>teammates(sim.options,attacker,sim.players.get(id))))return false;
 const applied=Math.min(v.health,amount);v.health=Math.max(0,v.health-amount);v.revision++;if(attacker)sim.emit?.('vehicle-hit',{player:attacker.id,target:v.id,amount:applied,x:v.x,y:v.y+1.3,z:v.z,destroyed:v.health<=0});if(v.health<=0&&isHelicopter(v)){v.falling=true;v.lastAttacker=attacker?.id;v.boostTime=0;v.loudspeaker=false;v.crashTime=0;sim.emit?.('royale-cue',{cue:'helicopter-failing',x:v.x,y:v.y,z:v.z});return true;}if(v.health<=0){v.speed=v.vx=v.vz=0;v.boosting=false;for(const id of [...v.seats]){const p=sim.players.get(id);if(p)exitVehicle(sim,p,{force:true});}sim.emit?.('royale-fx',{kind:'explosion',x:v.x,y:v.y+.7,z:v.z});sim.emit?.('royale-cue',{cue:'vehicle-destroyed',x:v.x,y:v.y,z:v.z});}return true;
}

function wreckHelicopter(sim,v){
 if(v.wrecked)return;v.wrecked=true;v.health=0;v.rotor=0;v.boosting=false;v.loudspeaker=false;
 for(const id of [...v.seats]){const p=sim.players.get(id);if(p)exitVehicle(sim,p,{force:true});}
 const attacker=sim.players.get(v.lastAttacker),origin={x:v.x,y:v.y+1.2,z:v.z};
 for(const p of sim.players.values()){if(p.health<=0||p.spectating)continue;const dx=p.x-origin.x,dy=p.y+1-origin.y,dz=p.z-origin.z,d=Math.hypot(dx,dy,dz);if(d<6&&wallDistance(sim.map,origin,{x:dx/(d||1),y:dy/(d||1),z:dz/(d||1)},d)>=d-.2)sim.damage(p,attacker,70*(1-d/6),'Kestrel explosion');}
 const seen=new Set();for(const b of candidates(sim.map,v,null,0,6)){const id=b.buildId||b.objectId;if(!id||seen.has(id))continue;const d=Math.hypot(Math.max(0,Math.abs(v.x-b.x)-b.w/2),Math.max(0,b.y-v.y,v.y-b.y-b.h),Math.max(0,Math.abs(v.z-b.z)-b.d/2));if(d<6){seen.add(id);sim.damageWorld?.(b,450*(1-d/6));}}
 sim.emit?.('royale-fx',{kind:'explosion',...origin});sim.emit?.('royale-cue',{cue:'vehicle-destroyed',...origin});
}
