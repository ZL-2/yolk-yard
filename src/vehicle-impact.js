import {rayBox,wallDistance} from './physics.js';
import {bodyHeight} from './stance.js';
import {teammates} from './teams.js';
import {launchPlayer} from './airborne.js';
import {isBreakable} from './building-rules.js';
import {vehicleContacts,vehicleProbes} from './vehicle-collision.js';

// Original speed curves in world metres/second. Epic documents boost smashing
// and player launch behavior, but does not publish the underlying damage curve.
export const RAM_RULES=Object.freeze({
 helicopter:{minimum:3.5,maximum:35,damage:50,structure:300,boostStructure:900},
 atv:{minimum:3,maximum:15.5,damage:40,structure:250,boostStructure:800},
 cooldown:.75,
});
const impacts=new WeakMap();
function ledger(v,time){
 let entries=impacts.get(v);if(!entries){entries=new Map();impacts.set(v,entries);}
 for(const [key,until]of entries)if(until<=time)entries.delete(key);
 return entries;
}
export function ramDamage(v,speed,structure=false){
 const rule=RAM_RULES[v.type==='helicopter'?'helicopter':'atv'];
 if(!Number.isFinite(speed)||speed<=rule.minimum)return 0;
 const ratio=Math.min(1,(speed-rule.minimum)/(rule.maximum-rule.minimum));
 return Math.round(structure?(v.boosting?rule.boostStructure:rule.structure)*ratio*ratio:5+(rule.damage-5)*ratio**1.25);
}
export function impactStructures(sim,v,probe,speed){
 const damage=ramDamage(v,speed,true);if(!damage||v.falling)return;
 const entries=ledger(v,sim.time);
 for(const b of vehicleContacts(sim.map,probe)){
  const key='world:'+(b.buildId||b.objectId);
  if(!isBreakable(b)||entries.has(key))continue;
  entries.set(key,sim.time+RAM_RULES.cooldown);sim.damageWorld?.(b,damage);
 }
}
export function ramPlayers(sim,v,before,driver,dt){
 if(v.falling||v.wrecked)return;
 const velocity={x:(v.x-before.x)/dt,y:(v.y-before.y)/dt,z:(v.z-before.z)/dt};
 const movedSpeed=Math.hypot(velocity.x,velocity.y,velocity.z);if(movedSpeed<.01)return;
 const speed=Math.max(movedSpeed,Math.hypot(before.vx||0,before.vy||0,before.vz||0)),damage=ramDamage(v,speed);
 if(!damage)return;
 const from=vehicleProbes(before),to=vehicleProbes(v),entries=ledger(v,sim.time);
 for(const p of sim.players.values()){
  if(p.health<=0||p.spectating||p.vehicleId||p.flight==='transport'||teammates(sim.options,p,driver)||entries.has('player:'+p.id))continue;
  let contact=null;
  for(let i=0;i<from.length;i++){
   const a=from[i],b=to[i],delta={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
   const box={x:p.x,y:p.y-a.h,z:p.z,w:.64+a.r*2,d:.64+a.r*2,h:bodyHeight(p)+a.h};
   const t=rayBox(a,delta,box,1);if(!Number.isFinite(t))continue;
   // Do not hit someone behind a departing craft just because a hull was touching.
   if((p.x-before.x)*velocity.x+(p.y+bodyHeight(p)*.5-before.y-1)*velocity.y+(p.z-before.z)*velocity.z<=0)continue;
   contact={x:a.x+delta.x*t,y:Math.max(p.y+.1,Math.min(p.y+bodyHeight(p)-.1,a.y+a.h*.5)),z:a.z+delta.z*t};break;
  }
  if(!contact)continue;
  const delta={x:p.x-contact.x,y:p.y+bodyHeight(p)*.5-contact.y,z:p.z-contact.z},distance=Math.hypot(delta.x,delta.y,delta.z);
  if(distance>.01&&wallDistance(sim.map,contact,{x:delta.x/distance,y:delta.y/distance,z:delta.z/distance},distance)<distance-.05)continue;
  entries.set('player:'+p.id,sim.time+RAM_RULES.cooldown);
  const health=p.health+p.shield;sim.damage(p,driver,damage,v.type==='helicopter'?'Kestrel impact':'ATV ram');
  if(p.health>0&&p.health+p.shield<health){
   const scale=Math.min(1,speed/(v.type==='helicopter'?35:15.5));
   launchPlayer(p,{source:'vehicle-ram',immune:true,vy:4+scale*5,vx:velocity.x/movedSpeed*speed*.7,vz:velocity.z/movedSpeed*speed*.7});
  }
 }
}
