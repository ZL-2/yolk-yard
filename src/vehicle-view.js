import {makeATV,atvEnvironment} from './atv-model.js';
const templates=new WeakMap();
function modelFor(renderer,detail){
 let levels=templates.get(renderer);if(!levels){levels=new Map();templates.set(renderer,levels);}
 if(!levels.has(detail))levels.set(detail,makeATV({detail,environment:atvEnvironment(renderer)}));return levels.get(detail);
}
export function vehicleDetail(distance,quality,current){
 const near=quality==='low'?1:2;
 if(current===near&&distance<48)return near;
 if(current===0&&distance>88)return 0;
 return distance<42?near:distance<96?1:0;
}
function instantiate(rv,detail){
 const m=modelFor(rv.view.renderer,detail).clone(),boost=m.getObjectByName('atv-boost');boost.material=boost.material.clone();
 Object.assign(m.userData,{wheels:[0,1,2,3].map(i=>m.getObjectByName('atv-wheel-'+i)),springs:[0,1,2,3].map(i=>m.getObjectByName('atv-spring-'+i)),body:m.getObjectByName('atv-body'),steering:m.getObjectByName('atv-steering'),shadow:m.getObjectByName('atv-contact-shadow'),boost});return m;
}
export function updateVehicles(rv,state,local,dt){
 rv.vehicleMeshes??=new Map();const key=state.royale.matchId+':'+state.round;
 if(rv.vehicleKey!==key){for(const m of rv.vehicleMeshes.values()){m.removeFromParent();rv.view.disposeGroup(m);}rv.vehicleMeshes.clear();rv.vehicleKey=key;}
 for(const source of state.royale.vehicles||[]){
  const v=rv.view.predictedVehicle?.id===source.id?rv.view.predictedVehicle:source;
  let m=rv.vehicleMeshes.get(v.id);const distance=local?Math.hypot(local.x-v.x,local.z-v.z):Infinity,near=distance<170;
  if(!near||v.health<=0){if(m)m.visible=false;continue;}
  const detail=vehicleDetail(distance,rv.view.settings.quality,m?.userData.detail);
  if(!m||m.userData.detail!==detail){const old=m;m=instantiate(rv,detail);if(old){m.userData.spin=old.userData.spin;old.removeFromParent();rv.view.disposeGroup(old);}rv.root.add(m);rv.vehicleMeshes.set(v.id,m);}
  m.visible=true;m.position.set(v.x,v.y,v.z);m.rotation.set(v.pitch||0,v.yaw,v.roll||0,'YXZ');
  animateATV(m,v,state.time,dt);
 }
}

export function animateATV(m,v,time,dt){
 if(!m.userData.wheels)Object.assign(m.userData,{wheels:[0,1,2,3].map(i=>m.getObjectByName('atv-wheel-'+i)),springs:[0,1,2,3].map(i=>m.getObjectByName('atv-spring-'+i)),body:m.getObjectByName('atv-body'),steering:m.getObjectByName('atv-steering'),shadow:m.getObjectByName('atv-contact-shadow'),boost:m.getObjectByName('atv-boost')});
  const visuals=m.userData,speed=v.speed||0,blend=1-Math.exp(-Math.min(.1,dt)*12),acceleration=Math.max(-20,Math.min(20,(speed-(visuals.lastSpeed??speed))/Math.max(.016,dt)));
  visuals.lastSpeed=speed;visuals.body.rotation.x+=(-acceleration*.0015-visuals.body.rotation.x)*blend;
  visuals.body.rotation.z+=((v.steering||0)*Math.min(.025,Math.abs(speed)*.0015)-visuals.body.rotation.z)*blend;
  visuals.steering.rotation.y=-(v.steering||0)*.28;visuals.spin=((visuals.spin||0)-speed*dt/.52)%(Math.PI*2);
  for(const [i,w]of visuals.wheels.entries()){
   const compression=v.grounded?Math.sin(time*(4+Math.abs(speed)*.6)+i*1.9)*Math.min(.018,Math.abs(speed)*.001):-.035;
   w.position.y=.53-compression;w.rotation.y=i<2?-(v.steering||0)*.28:0;w.getObjectByName('atv-spin').rotation.x=visuals.spin;
   if(visuals.springs[i])visuals.springs[i].scale.y=1-compression*2;
  }
  visuals.shadow.rotation.set(-Math.PI/2-(v.pitch||0),0,-(v.roll||0));visuals.shadow.visible=v.grounded;
  visuals.boost.visible=!!v.boosting;visuals.boost.scale.y=.85+Math.sin(time*55)*.16;
}
