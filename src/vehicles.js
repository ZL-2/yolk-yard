import {canOccupy,candidates,rayBox,dist,direction,boxTop} from './physics.js';
import {groundAt} from './terrain.js';
import {clamp} from './data.js';
import {teammates} from './teams.js';
export const ATV=Object.freeze({count:6,health:400,speed:17,reverse:7,boostSpeed:31,acceleration:16,steer:1.65,boostDrain:34,boostCharge:12,enterRange:3.2});
export const ATV_SITES=Object.freeze([
 {id:'borough',x:-61,z:8,yaw:Math.PI,name:'Relay Borough garage'},
 {id:'farm',x:-119,z:-118,yaw:-Math.PI/2,name:'Northfield farm road'},
 {id:'observatory',x:83,z:-135,yaw:Math.PI,name:'Observatory approach'},
 {id:'docks',x:148,z:123,yaw:0,name:'Breakwater loading road'},
 {id:'woods',x:-90,z:132,yaw:Math.PI/2,name:'Sable Woods trailhead'},
 {id:'works',x:-125,z:60,yaw:0,name:'Ironwake service road'},
]);
function fits(map,v){const d=direction(v.yaw);for(const offset of [-.72,0,.72])if(!canOccupy(map,{x:v.x+d.x*offset,y:v.y+.38,z:v.z+d.z*offset},1.05,.66))return false;return true;}
function floorAt(map,v){let y=groundAt(map,v.x,v.z);for(const b of candidates(map,v)){const top=boxTop(b,v.x,v.z,.5);if(top<=v.y+.52)y=Math.max(y,top);}return y;}
export function initializeVehicles(sim){
 sim.vehicles=[];for(const p of sim.players.values()){p.vehicleId=null;p.vehicleSeat=null;p.vehicleLock=0;}
 if(sim.map.id!=='sunnybreak')return;
 for(const [index,site]of ATV_SITES.entries()){
  let spot;for(const radius of [0,3,6,9,12,16]){for(let i=0;i<(radius?12:1);i++){const angle=i*Math.PI/6,x=site.x+Math.cos(angle)*radius,z=site.z+Math.sin(angle)*radius,y=groundAt(sim.map,x,z),probe={x,y,z,yaw:site.yaw};if(y>1.3&&fits(sim.map,probe)&&canOccupy(sim.map,{x,y:y+.1,z},2.1,1.8)){spot=probe;break;}}if(spot)break;}
  if(!spot)throw Error('ATV parking blocked: '+site.id);
  sim.vehicles.push({id:'atv-'+index,site:site.id,name:site.name,...spot,vx:0,vz:0,vy:0,speed:0,steering:0,boost:100,boosting:false,health:ATV.health,seats:[null,null],grounded:true,pitch:0,roll:0,revision:0});
 }
}
export function seatPose(v,seat=0){const d=direction(v.yaw),offset=seat===0?.32:-.44;return {x:v.x+d.x*offset,y:v.y+.08,z:v.z+d.z*offset};}
export function seatPlayer(p,v){Object.assign(p,seatPose(v,p.vehicleSeat));p.vehicleYaw=v.yaw;p.vx=v.vx;p.vz=v.vz;p.vy=v.vy;p.grounded=v.grounded;p.flight='ground';p.sliding=p.sprinting=p.crouching=false;p.fall={apex:p.y,immune:true,source:'vehicle'};p.landing=null;}
export function exitVehicle(sim,p,{force=false}={}){
 const v=sim.vehicles?.find(v=>v.id===p.vehicleId);if(!v){p.vehicleId=null;p.vehicleSeat=null;return true;}
 let spot;for(const side of [1,-1])for(const away of [1.75,2.4,3.2]){const x=v.x+Math.cos(v.yaw)*side*away,z=v.z-Math.sin(v.yaw)*side*away,y=Math.max(v.y+.15,groundAt(sim.map,x,z));if(canOccupy(sim.map,{x,y,z},1.85,.32)){spot={x,y,z};break;}if(spot)break;}
 if(!spot&&!force)return false;
 if(p.health<=0)spot={x:p.x,y:p.y,z:p.z};
 const seat=p.vehicleSeat;if(v.seats[seat]===p.id)v.seats[seat]=null;v.revision++;p.vehicleId=null;p.vehicleSeat=null;p.vehicleLock=sim.time+.6;p.vehicleInteractHeld=true;p.interactLatch=true;
 Object.assign(p,spot||{x:v.x,y:v.y+1.65,z:v.z});p.vy=Math.max(0,v.vy);p.grounded=false;p.fall={apex:p.y,immune:true,source:'vehicle-exit'};p.launchVelocity={x:v.vx*.5,z:v.vz*.5};
 sim.emit?.('royale-cue',{cue:'vehicle-exit',player:p.id,x:v.x,y:v.y,z:v.z});return true;
}
export function vehiclePrompt(vehicles,p){
 if(p.vehicleId)return null;
 const v=vehicles?.filter(v=>v.health>0&&v.seats.some(s=>!s)&&dist(p,v)<ATV.enterRange).sort((a,b)=>dist(p,a)-dist(p,b))[0];
 return v?{kind:'vehicle',text:v.seats[0]?'RIDE ATV · PASSENGER':'DRIVE ATV',id:v.id}:null;
}
export function vehicleInteract(sim,p,input){
 const fresh=!!input.interact&&!p.vehicleInteractHeld;p.vehicleInteractHeld=!!input.interact;
 if(p.vehicleId){const v=sim.vehicles.find(v=>v.id===p.vehicleId);if(!v||v.health<=0||p.downed||p.health<=0||p.connected===false){exitVehicle(sim,p,{force:true});return false;}
  if(fresh&&sim.time>=(p.vehicleLock||0)){exitVehicle(sim,p);return true;}
  const swap=!!input.reload&&!p.vehicleSeatHeld;p.vehicleSeatHeld=!!input.reload;
  if(swap&&sim.time>=(p.vehicleLock||0)){const other=1-p.vehicleSeat;if(!v.seats[other]){v.seats[other]=p.id;v.seats[p.vehicleSeat]=null;p.vehicleSeat=other;p.vehicleLock=sim.time+.6;v.revision++;seatPlayer(p,v);}}
  return true;
 }
 if(!fresh||p.bot||p.health<=0||p.downed||p.spectating||p.flight!=='ground'||p.traversal||p.grapple||sim.time<(p.vehicleLock||0))return false;
 const prompt=vehiclePrompt(sim.vehicles,p);if(!prompt)return false;const v=sim.vehicles.find(v=>v.id===prompt.id),seat=v.seats[0]?1:0;
 v.seats[seat]=p.id;v.revision++;p.vehicleId=v.id;p.vehicleSeat=seat;p.vehicleLock=sim.time+.6;p.vehicleSeatHeld=!!input.reload;p.interactLatch=true;p.emote=null;p.use=null;p.reloadEnd=0;p.burstLeft=0;p.mantle=null;p.shadowstep=null;p.building=p.editing=false;seatPlayer(p,v);
 sim.emit?.('royale-cue',{cue:'vehicle-enter',player:p.id,x:v.x,y:v.y,z:v.z});return true;
}
// Shared by authority and guest prediction. Only six vehicles exist, with no
// simulation work for an empty, settled vehicle. Thin cover uses swept steps.
export function stepVehicle(v,input,map,dt){
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
   if(Math.abs(q.x)>map.size-2||Math.abs(q.z)>map.size-2||!fits(map,q)){wall=true;break;}v.x=q.x;v.y=q.y;v.z=q.z;
  }
  v.impactBoost=wall&&v.boosting;v.impactSpeed=wall?Math.abs(v.speed):0;if(wall){v.speed*=.12;v.boosting=false;}
  const floor=floorAt(map,v);if(v.grounded&&v.y-floor<.52){v.y=floor;v.vy=0;}else{v.vy-=22*step;if(v.boosting)v.vy+=Math.sin(clamp(input.pitch||0,-.55,.9))*22*step;const q={...v,y:v.y+v.vy*step};if(fits(map,q))v.y=q.y;else v.vy=0;}
  v.grounded=v.y<=floor+.02;if(v.grounded){v.y=floor;v.vy=0;}
  const ahead={...v,x:v.x+d.x*.8,z:v.z+d.z*.8},behind={...v,x:v.x-d.x*.8,z:v.z-d.z*.8},right={...v,x:v.x+Math.cos(v.yaw)*.65,z:v.z-Math.sin(v.yaw)*.65},left={...v,x:v.x-Math.cos(v.yaw)*.65,z:v.z+Math.sin(v.yaw)*.65};
  const pitch=v.grounded?Math.atan2(floorAt(map,ahead)-floorAt(map,behind),1.6):clamp((input.pitch||0)*.4,-.35,.5),roll=v.grounded?Math.atan2(floorAt(map,left)-floorAt(map,right),1.3):steer*.12;
  v.pitch+=(clamp(pitch,-.65,.65)-v.pitch)*Math.min(1,step*12);v.roll+=(clamp(roll,-.45,.45)-v.roll)*Math.min(1,step*12);
  v.vx=d.x*v.speed;v.vz=d.z*v.speed;
 }
}
export function tickVehicles(sim,dt){
 for(const v of sim.vehicles||[]){if(v.health<=0)continue;
  for(let seat=0;seat<2;seat++){const p=sim.players.get(v.seats[seat]);if(v.seats[seat]&&(!p||p.vehicleId!==v.id))v.seats[seat]=null;else if(p&&(p.health<=0||p.downed||p.spectating||p.connected===false))exitVehicle(sim,p,{force:true});}
  const driver=sim.players.get(v.seats[0]),raw=driver&&sim.inputs.get(driver.id),input=raw&&sim.time-driver.lastInput<.4?raw:{};
  if(driver||Math.abs(v.speed)>.05||!v.grounded){stepVehicle(v,input,sim.map,dt);
   if(v.boosting&&Math.abs(v.speed)>12&&sim.time>=(v.ramAt||0)){v.ramAt=sim.time+.1;for(const p of sim.players.values())if(p.health>0&&!p.spectating&&!p.vehicleId&&!teammates(sim.options,p,driver)&&dist(v,p)<1.75){sim.damage(p,driver,Math.min(40,Math.abs(v.speed)*1.1),'ATV ram');p.grounded=false;p.vy=7;p.launchVelocity={x:v.vx*.6,z:v.vz*.6};p.fall={apex:p.y,immune:true,source:'vehicle-ram'};}}
   if(v.impactBoost&&v.impactSpeed>12&&sim.time>=(v.crashAt||0)){v.crashAt=sim.time+.25;const d=direction(v.yaw);for(const b of candidates(sim.map,{x:v.x+d.x*1.5,y:v.y,z:v.z+d.z*1.5}))if((b.buildId||b.objectId)&&!b.doorId&&Math.abs(v.x+d.x*1.5-b.x)<b.w/2+1&&Math.abs(v.z+d.z*1.5-b.z)<b.d/2+1)sim.damageWorld?.(b,150);}
  }else{v.speed=v.vx=v.vz=0;v.boosting=false;}
  for(const id of v.seats){const p=sim.players.get(id);if(p)seatPlayer(p,v);}
 }
}
export function vehicleHit(sim,origin,direction,range,attacker){
 let best;for(const v of sim.vehicles||[]){if(v.health<=0||attacker?.vehicleId===v.id)continue;const c=Math.abs(Math.cos(v.yaw)),s=Math.abs(Math.sin(v.yaw)),box={x:v.x,y:v.y+.35,z:v.z,w:1.4*c+2.5*s,d:1.4*s+2.5*c,h:.85},distance=rayBox(origin,direction,box,range);
  if(Number.isFinite(distance)&&distance<=range&&(!best||distance<best.distance))best={vehicle:v,distance,normal:{x:-direction.x,y:-direction.y,z:-direction.z}};
 }return best;
}
export function damageVehicle(sim,v,amount,attacker){
 if(v.health<=0||!Number.isFinite(amount)||amount<=0)return false;
 if(attacker&&v.seats.some(id=>teammates(sim.options,attacker,sim.players.get(id))))return false;
 const applied=Math.min(v.health,amount);v.health=Math.max(0,v.health-amount);v.revision++;if(attacker)sim.emit?.('vehicle-hit',{player:attacker.id,target:v.id,amount:applied,x:v.x,y:v.y+1.3,z:v.z,destroyed:v.health<=0});if(v.health<=0){v.speed=v.vx=v.vz=0;v.boosting=false;for(const id of [...v.seats]){const p=sim.players.get(id);if(p)exitVehicle(sim,p,{force:true});}sim.emit?.('royale-fx',{kind:'explosion',x:v.x,y:v.y+.7,z:v.z});sim.emit?.('royale-cue',{cue:'vehicle-destroyed',x:v.x,y:v.y,z:v.z});}return true;
}
