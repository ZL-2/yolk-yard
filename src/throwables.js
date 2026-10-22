import {toolDirection} from './perspective.js';
import {UTILITY_WEAPONS} from './weapon-balance.js';
import {direction,worldHit} from './physics.js';
import {eyePosition} from './stance.js';
export const SMOKE_RULES=Object.freeze({fuse:1.5,duration:20,radius:4.5});
export function thrownProjectile(p,kind='popper',map=null){
 const c=UTILITY_WEAPONS.popper,d=toolDirection(map,p);
 return {owner:p.id,weapon:kind,throwable:kind,kind:'shell',popper:true,...eyePosition(p),y:eyePosition(p).y-.15,vx:d.x*c.speed,vy:d.y*c.speed+c.lift,vz:d.z*c.speed,gravity:c.gravity,hitRadius:c.hitRadius,damage:kind==='smoke'?0:c.damage,buildDamage:kind==='smoke'?0:c.buildDamage,fuse:kind==='smoke'?SMOKE_RULES.fuse:c.fuse,bounces:0,travelled:0,resting:false};
}
// The preview and authoritative projectile use exactly the same swept bounce.
export function stepThrowable(b,map,dt,vehicleHit){
 if(b.resting)return null;
 const delta={x:b.vx*dt,y:b.vy*dt-.5*b.gravity*dt*dt,z:b.vz*dt},length=Math.hypot(delta.x,delta.y,delta.z);b.vy-=b.gravity*dt;
 if(length<1e-8)return null;
 const d={x:delta.x/length,y:delta.y/length,z:delta.z/length};
 const wall=worldHit(map,b,d,length,b.hitRadius),vehicle=vehicleHit?.(b,d,wall?.distance??length),hit=vehicle||wall,travel=hit?.distance??length;
 b.x+=d.x*travel;b.y+=d.y*travel;b.z+=d.z*travel;b.travelled+=travel;
 if(!hit)return null;
 const n=hit.normal,c=UTILITY_WEAPONS.popper,dot=b.vx*n.x+b.vy*n.y+b.vz*n.z;
 for(const axis of ['x','y','z']){const v='v'+axis;b[v]=(b[v]-(1+c.restitution)*dot*n[axis])*c.friction;b[axis]+=n[axis]*.025;}
 b.bounces++;
 if(n.y>.5&&Math.hypot(b.vx,b.vy,b.vz)<1.8){b.resting=true;b.vx=b.vy=b.vz=0;}
 return hit;
}
export function throwPath(p,map,kind='popper',vehicleHit){
 const b=thrownProjectile(p,kind,map),points=[{x:b.x,y:b.y,z:b.z}];
 for(let i=0;i<Math.ceil(b.fuse*60);i++){const hit=stepThrowable(b,map,1/60,vehicleHit);if(i%3===0||hit||b.resting)points.push({x:b.x,y:b.y,z:b.z});if(b.resting)break;}
 points.push({x:b.x,y:b.y,z:b.z});return points;
}
