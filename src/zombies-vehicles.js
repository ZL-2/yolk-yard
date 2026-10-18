import {gun} from './data.js';
import {groundAt} from './terrain.js';
import {canStand} from './physics.js';
import {zAlive} from './zombies-expedition-config.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function exitRover(sim,p){
 const v=sim.zVehicles.find(v=>v.id===p.zVehicle);p.zVehicle=null;p.zVehicleSeat=null;
 if(!v)return;if(v.driver===p.id)v.driver=null;v.passengers=(v.passengers||[]).filter(id=>id!==p.id);
 for(const side of [1,-1]){const q=sim.safePoint({x:v.x+Math.cos(v.yaw)*2.1*side,z:v.z-Math.sin(v.yaw)*2.1*side},3);if(q){Object.assign(p,q);break;}}
 p.vx=p.vz=0;p.vy=0;
}
export function roverAction(sim,p,key,id){
 if(key==='exitvehicle'){exitRover(sim,p);return true;}
 if(!['vehicle','ride','service'].includes(key))return false;
 const v=sim.zVehicles.find(v=>v.id===id);if(!v||distance(p,v)>4||!zAlive(p))return true;
 v.passengers??=[];
 if(key==='service'){if(v.health<=0)return sim.note(p,'This rover is destroyed. Find another vehicle.');if(v.health>=1200&&v.fuel>=100)return true;if(sim.time<(v.serviceAt||0))return true;if(sim.pay(p,60,true)){v.health=Math.min(1200,v.health+300);v.fuel=Math.min(100,v.fuel+40);v.serviceAt=sim.time+8;sim.cue('repair',v);}return true;}
 if(p.zVehicle||v.health<=0||v.fuel<=0)return true;
 if(key==='vehicle'&&!v.driver){v.driver=p.id;p.zVehicle=id;p.zVehicleSeat=0;}
 else if(v.passengers.length<3){v.passengers.push(p.id);p.zVehicle=id;p.zVehicleSeat=v.passengers.length;}
 return true;
}
export function tickRovers(sim,dt){
 const riding=[];
 for(const v of sim.zVehicles){v.passengers??=[];const driver=sim.players.get(v.driver);
  if(!driver||!zAlive(driver)||driver.zVehicle!==v.id){if(driver?.zVehicle===v.id)exitRover(sim,driver);v.driver=null;}
  for(const id of [...v.passengers]){const p=sim.players.get(id);if(!zAlive(p)||p.zVehicle!==v.id){if(p?.zVehicle===v.id)exitRover(sim,p);else v.passengers=v.passengers.filter(other=>other!==id);}}
  const occupants=[v.driver,...v.passengers].filter(Boolean).map(id=>sim.players.get(id));
  if(v.health<=0){v.speed=0;for(const p of occupants){exitRover(sim,p);sim.note(p,'VEHICLE DISABLED. Move away from the wreck.');}continue;}
  let throttle=0;
  for(const p of occupants){const commands=sim.movementInput(p,dt),input=commands?.input||sim.inputs.get(p.id)||{};for(const step of commands?.steps||[])p.ack=Math.max(p.ack,step.seq);if(!commands)p.ack=Math.max(p.ack,input.seq||0);p.yaw=input.yaw??p.yaw;p.pitch=input.pitch??p.pitch;
   if(p.id===v.driver){const turn=Math.atan2(Math.sin(p.yaw-v.yaw),Math.cos(p.yaw-v.yaw));v.yaw+=clamp(turn,-dt*1.7,dt*1.7);throttle=sim.time-p.lastInput<.5&&v.fuel>0?clamp(Number(input.forward)||0,-1,1):0;}
   else {if(input.reload)sim.reload(p);if(p.reloadEnd&&sim.time>=p.reloadEnd){const w=gun(p);p.reloadEnd=0;if(w){const added=Math.min(w.magazine-p.ammo[p.slot],p.reserve[p.slot]);p.ammo[p.slot]+=added;p.reserve[p.slot]-=added;}}if(input.fire)sim.fire(p);}
   p.loading=true;riding.push(p);
  }
  const target=throttle*(throttle<0?5:12),accel=throttle?8:12;v.speed+=(target-v.speed)*Math.min(1,dt*accel/5);
  const steps=Math.max(1,Math.ceil(Math.abs(v.speed)*dt/.2));let hit=false;
  for(let i=0;i<steps;i++){const q={x:v.x-Math.sin(v.yaw)*v.speed*dt/steps,z:v.z-Math.cos(v.yaw)*v.speed*dt/steps};q.y=groundAt(sim.map,q.x,q.z);const legal=Math.abs(q.x)<176&&Math.abs(q.z)<176&&Math.abs(q.y-(v.y||0))<.55&&canStand(sim.map,{...q,y:q.y+.05},1.05);if(!legal){hit=true;break;}Object.assign(v,q);}
  if(hit){if(Math.abs(v.speed)>6&&sim.time>(v.impactAt||0)){v.health=Math.max(0,v.health-Math.abs(v.speed)*8);v.impactAt=sim.time+1;sim.cue('blast',v);}v.speed=0;}
  v.fuel=Math.max(0,v.fuel-Math.abs(v.speed)*dt*.035);
  const front=groundAt(sim.map,v.x-Math.sin(v.yaw),v.z-Math.cos(v.yaw)),back=groundAt(sim.map,v.x+Math.sin(v.yaw),v.z+Math.cos(v.yaw));v.pitch=Math.atan2(front-back,2);
  const left=groundAt(sim.map,v.x-Math.cos(v.yaw),v.z+Math.sin(v.yaw)),right=groundAt(sim.map,v.x+Math.cos(v.yaw),v.z-Math.sin(v.yaw));v.roll=Math.atan2(right-left,2);
  for(const p of occupants){const i=p.id===v.driver?0:v.passengers.indexOf(p.id)+1;p.zVehicleSeat=i;const side=i%2?1:-1,back=i>1?.7:-.45;p.x=v.x+Math.cos(v.yaw)*side*.45+Math.sin(v.yaw)*back;p.z=v.z-Math.sin(v.yaw)*side*.45+Math.cos(v.yaw)*back;p.y=(v.y||0)+.45;p.vx=-Math.sin(v.yaw)*v.speed;p.vz=-Math.cos(v.yaw)*v.speed;if(Math.abs(v.speed)>.5)p.zStats.active+=dt;}
  if(occupants.length&&sim.time>(v.attackAt||0)){v.attackAt=sim.time+1;const nearby=sim.enemies.filter(e=>e.health>0&&distance(e,v)<2.5);v.health=Math.max(0,v.health-nearby.length*9);}
  if(occupants.length&&Math.abs(v.speed)>5)for(const e of sim.enemies)if(e.health>0&&distance(e,v)<1.6&&sim.time>(e.ramAt||0)){e.ramAt=sim.time+1;sim.enemyHit(e,sim.players.get(v.driver)||occupants[0],Math.abs(v.speed)*30,false,'Rover impact',false);v.health=Math.max(0,v.health-7);}
 }
 return riding;
}
