import {rayBox,wallDistance} from './physics.js';
import {lootHeight} from './loot-motion.js';
import {supportBelow} from './royale-loot.js';
import {itemsChanged} from './nearby-items.js';
export const SUPPLY_CANOPY_HEALTH=100;
const checkedAt=new WeakMap();
export function supplyHeight(c,time){
 if(!c.supply||c.landed||!c.landAt)return lootHeight(c,time);
 if(Number.isFinite(c.cutAt)){const age=Math.max(0,time-c.cutAt);return Math.max(c.y,c.cutHeight-4*age-12*age*age);}
 return c.y+Math.max(0,(c.landAt-time)*4);
}
export function supplyTarget(c,time){return {x:c.x,y:supplyHeight(c,time)+4.45,z:c.z,w:4.5,h:1.05,d:2.8};}
export function supplyHit(sim,o,d,max,radius=0){
 let nearest=null,best=max;
 for(const c of sim.chests||[]){if(!c.supply||c.opened||c.landed||c.landAt<=sim.time||Number.isFinite(c.cutAt))continue;
  const target=supplyTarget(c,sim.time),distance=rayBox(o,d,target,best,radius);if(!Number.isFinite(distance)||distance>=best)continue;
  best=distance;nearest={chest:c,distance,normal:{x:-d.x,y:-d.y,z:-d.z}};
 }return nearest;
}
export function damageSupply(sim,c,amount,attacker){
 if(!c?.supply||c.opened||c.landed||c.landAt<=sim.time||Number.isFinite(c.cutAt)||!(amount>0))return false;
 c.canopyHealth=Math.max(0,(c.canopyHealth??SUPPLY_CANOPY_HEALTH)-amount);sim.lootVersion++;
 if(c.canopyHealth===0){c.cutHeight=supplyHeight(c,sim.time);c.cutAt=sim.time;const height=Math.max(0,c.cutHeight-c.y);c.landAt=sim.time+(-4+Math.sqrt(16+48*height))/24;
  sim.emit('royale-cue',{cue:'supply-cut',player:attacker?.id,x:c.x,y:c.cutHeight,z:c.z});
 }return true;
}
export function tickSupplyDrops(sim){
 for(const c of sim.chests||[]){if(!c.supply||c.opened||c.landed||!c.landAt)continue;
  const prior=checkedAt.get(c)??Math.max(c.cutAt??sim.time-.1,sim.time-.1),from=supplyHeight(c,prior),height=supplyHeight(c,sim.time),floor=supportBelow(sim.map,c.x,c.z,from+.01);checkedAt.set(c,sim.time);
  if(height>floor+.01&&sim.time<c.landAt)continue;
  c.y=floor;c.landAt=sim.time;c.landed=true;delete c.motion;sim.lootVersion++;sim.lootSupportDirty=true;itemsChanged(sim,'chests',c);
  sim.emit('royale-cue',{cue:'supply-land',x:c.x,y:c.y,z:c.z});
 }
}
export function blastSupply(sim,b,attacker,config){
 const normal=b.impactNormal||{x:0,y:0,z:0},origin={x:b.x+normal.x*.04,y:b.y+normal.y*.04,z:b.z+normal.z*.04};
 for(const c of sim.chests||[]){if(!c.supply||c.landed||c.opened||Number.isFinite(c.cutAt))continue;const q=supplyTarget(c,sim.time),dx=q.x-origin.x,dy=q.y+q.h/2-origin.y,dz=q.z-origin.z,length=Math.hypot(dx,dy,dz);if(length>=(config.splashRadius??config.radius)||!length)continue;
  if(wallDistance(sim.map,origin,{x:dx/length,y:dy/length,z:dz/length},length)<length-.1)continue;
  damageSupply(sim,c,(b.buildDamage??config.buildDamage??config.damage??100)*(1-length/(config.splashRadius??config.radius)),attacker);
 }
}
export function supplyMapIcon(c,x,y,full=false,airborne=true){
 const size=full?1.15:.9;c.save();c.translate(x,y);c.scale(size,size);c.lineJoin='round';c.lineCap='round';c.lineWidth=2.6;c.strokeStyle='#102d43';
 if(airborne){c.fillStyle='#6ed8ff';c.beginPath();c.moveTo(-8,-3);c.bezierCurveTo(-8,-13,8,-13,8,-3);c.quadraticCurveTo(4,-6,0,-3);c.quadraticCurveTo(-4,-6,-8,-3);c.closePath();c.fill();c.stroke();c.strokeStyle='#e3f7ff';c.lineWidth=1.4;for(const side of [-1,1]){c.beginPath();c.moveTo(side*7,-3);c.lineTo(side*3,5);c.stroke();}}
 c.fillStyle='#f6c35e';c.strokeStyle='#102d43';c.lineWidth=2.3;c.fillRect(-5,4,10,8);c.strokeRect(-5,4,10,8);c.strokeStyle='#75512a';c.lineWidth=1.2;c.beginPath();c.moveTo(0,5);c.lineTo(0,11);c.stroke();c.restore();
}
