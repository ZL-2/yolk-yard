import {supplyTarget} from './supply-drops.js';

// Authority owns attachment and damage. Rendering follows the same local offset
// against interpolated actors; a late explosion never damages a respawned life.
export const STORMSPIKE=Object.freeze({fuse:1.15,burstDamage:150,playerBurstDamage:40,neighborScale:.55,maxConnected:4,maxVisible:256});
const yaw=target=>target.yaw??target.doorAngle??0;
const id=box=>box.buildId?'build:'+box.buildId:box.objectId?'world:'+box.objectId:null;
export function stormspikePose(spike,target){
 if(!target||spike.ox===undefined)return spike;
 const c=Math.cos(yaw(target)),s=Math.sin(yaw(target));
 return {x:target.x+spike.ox*c+spike.oz*s,y:target.y+spike.oy,z:target.z-spike.ox*s+spike.oz*c,nx:spike.onx*c+spike.onz*s,ny:spike.ony,nz:-spike.onx*s+spike.onz*c};
}
export function lodgeStormspike(sim,projectile,box,normal={x:0,y:1,z:0},contact={}){
 const player=contact.player,vehicle=contact.vehicle,supply=contact.supply;
 const target=player||vehicle||(supply?supplyTarget(supply,sim.time):box);
 const spike={id:++sim.projectileId,owner:projectile.owner,shotId:projectile.shotId,
  playerId:player?.id,playerDeaths:player?.deaths||0,vehicleId:vehicle?.id,supplyId:supply?.id,
  buildId:box?.buildId,objectId:box?.objectId,doorId:box?.doorId,x:projectile.x,y:projectile.y,z:projectile.z,
  nx:normal.x,ny:normal.y,nz:normal.z,born:sim.time,until:sim.time+STORMSPIKE.fuse,
  damage:STORMSPIKE.burstDamage*(projectile.damage/58),playerDamage:STORMSPIKE.playerBurstDamage*(projectile.damage/58),vehicleMultiplier:contact.multiplier||1};
 if(target){const dx=spike.x-target.x,dz=spike.z-target.z,c=Math.cos(yaw(target)),s=Math.sin(yaw(target));Object.assign(spike,{ox:dx*c-dz*s,oy:spike.y-target.y,oz:dx*s+dz*c,onx:normal.x*c-normal.z*s,ony:normal.y,onz:normal.x*s+normal.z*c});}
 if(box)spike.bounds={x:box.x,y:box.y,z:box.z,w:box.w,h:box.h,d:box.d};
 // The fire-rate and participant limits bound active fuses. Never discard an
 // armed shot because the visual budget is full.
 (sim.stormSpikes??=[]).push(spike);sim.emit('royale-cue',{cue:'spike-stick',x:spike.x,y:spike.y,z:spike.z});
 return spike;
}
const gap=(a,b,key,size)=>Math.max(0,Math.abs(a[key]-b[key])-(a[size]+b[size])/2);
function touching(a,b){return gap(a,b,'x','w')<.35&&gap(a,b,'z','d')<.35&&Math.max(a.y,b.y)<=Math.min(a.y+a.h,b.y+b.h)+.35;}
export function tickStormspikes(sim){
 const active=sim.stormSpikes;if(!active?.length)return;
 for(let i=active.length-1;i>=0;i--){
  const spike=active[i],player=spike.playerId&&sim.players?.get(spike.playerId),vehicle=spike.vehicleId&&sim.vehicles?.find(v=>v.id===spike.vehicleId),supply=spike.supplyId&&sim.chests?.find(c=>c.id===spike.supplyId);
  const alive=player&&player.health>0&&!player.spectating&&(player.deaths||0)===spike.playerDeaths;
  const root=sim.time>=spike.until&&(spike.buildId||spike.objectId)?sim.map.boxes.filter(b=>spike.buildId?b.buildId===spike.buildId:b.objectId===spike.objectId):[];
  const target=alive?player:vehicle&&!vehicle.wrecked?vehicle:supply?supplyTarget(supply,sim.time):spike.doorId?sim.map.movingDoors?.find(b=>b.doorId===spike.doorId):null;
  if(target)Object.assign(spike,stormspikePose(spike,target));
  if(sim.time<spike.until)continue;
  active.splice(i,1);const attacker=sim.players?.get(spike.owner);
  if(alive)sim.damage(player,attacker,spike.playerDamage,'Stormspike Rifle',false,spike.shotId);
  else if(vehicle&&!vehicle.wrecked)sim.damageVehicle(vehicle,spike.damage*spike.vehicleMultiplier,attacker);
  else if(supply)sim.damageSupply(supply,spike.damage,attacker);
  else if(spike.buildId||spike.objectId){
   const roots=root.length?root:[spike.bounds].filter(Boolean),targets=new Map();
   for(const b of root)targets.set(id(b),b);
   // Bounded propagation across touching, destructible architecture and builds.
   // Empty space and terrain do not carry the burst.
   for(const b of sim.map.boxes){if(targets.size>=STORMSPIKE.maxConnected+1)break;if(!id(b)||targets.has(id(b))||b.indestructible)continue;if(roots.some(a=>touching(a,b)))targets.set(id(b),b);}
   const direct=spike.buildId?'build:'+spike.buildId:'world:'+spike.objectId;
   for(const [key,b]of targets)sim.damageWorld(b,spike.damage*(key===direct?1:STORMSPIKE.neighborScale));
  }
  sim.emit('royale-fx',{kind:'stormspike-burst',x:spike.x,y:spike.y,z:spike.z});sim.emit('royale-cue',{cue:'spike-burst',x:spike.x,y:spike.y,z:spike.z});
 }
}
