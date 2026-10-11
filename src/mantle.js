import {groundAt} from './terrain.js';
// Short, fully swept traversal. The authority and guest prediction use this
// exact solver. It does not grant a shield, fall immunity, or a position claim.
export const MANTLE=Object.freeze({reach:1.15,maxRise:1.65,vaultRise:.95,vaultWidth:1.1,cooldown:.25});
const pointAt=(m,t)=>{
 const a=t<.3?m.from:t<.75?m.lift:m.across,b=t<.3?m.lift:t<.75?m.across:m.to;
 const raw=t<.3?t/.3:t<.75?(t-.3)/.45:(t-.75)/.25,u=Math.max(0,Math.min(1,raw)),v=u*u*(3-2*u);
 return {x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v,z:a.z+(b.z-a.z)*v};
};
function clearSegment(map,a,b,canStand){
 const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/.12));
 for(let i=1;i<=count;i++){const t=i/count;if(!canStand(map,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}))return false;}return true;
}
export function beginMantle(p,input,map,{candidates,rayBox,canStand,radius}){
 if(!p.inventory||p.mantle||p.mantleCooldown>0||!(p.jumpBuffer>0)||(input.forward||0)<.2||p.downed||p.reviving||p.use||p.building||p.editing||p.grapple||p.shadowstep||p.traversal||p.flight!=='ground'||p.vy< -6)return false;
 const direction={x:-Math.sin(p.yaw),y:0,z:-Math.cos(p.yaw)},origin={x:p.x,y:p.y+.5,z:p.z};let box=null,distance=MANTLE.reach;
 for(const b of candidates(map,origin,direction,MANTLE.reach,radius)){
  const rise=b.y+b.h-p.y;if(rise<=.45||rise>MANTLE.maxRise)continue;
  const t=rayBox(origin,direction,b,distance);if(Number.isFinite(t)&&t<distance){box=b;distance=t;}
 }
 if(!box)return false;
 const top=box.y+box.h+.025,width=Math.abs(direction.x)*box.w+Math.abs(direction.z)*box.d;
 const vault=top-p.y<=MANTLE.vaultRise&&width<=MANTLE.vaultWidth;
 const run=distance+radius+.18+(vault?width:0),to={x:p.x+direction.x*run,y:top,z:p.z+direction.z*run};
 if(run>2.7)return false;
 if(vault){let floor=groundAt(map,to.x,to.z);for(const b of candidates(map,to))if(b.y+b.h<=top&&Math.abs(to.x-b.x)<b.w/2+radius&&Math.abs(to.z-b.z)<b.d/2+radius)floor=Math.max(floor,b.y+b.h);if(top-floor>1.2)return false;to.y=floor;}
 const from={x:p.x,y:p.y,z:p.z},lift={x:p.x,y:top,z:p.z},across={x:to.x,y:top,z:to.z};
 if(!canStand(map,to)||!clearSegment(map,from,lift,canStand)||!clearSegment(map,lift,across,canStand)||!clearSegment(map,across,to,canStand))return false;
 p.mantle={kind:vault?'vault':'mantle',from,lift,across,to,elapsed:0,duration:vault?.32:.44};p.jumpBuffer=0;p.jumpLatch=true;p.vy=0;p.grounded=false;p.crouching=p.sliding=p.sprinting=p.tacticalSprint=false;
 return true;
}
export function stepMantle(p,map,dt,canStand){
 const m=p.mantle;if(!m)return false;
 if(p.downed||p.health<=0){p.mantle=null;return false;}
 const elapsed=Math.min(m.duration,m.elapsed+dt),next=pointAt(m,elapsed/m.duration);
 if(!clearSegment(map,p,next,canStand)){p.mantle=null;p.mantleCooldown=MANTLE.cooldown;p.grounded=false;p.vy=0;return true;}
 p.x=next.x;p.y=next.y;p.z=next.z;p.vy=0;p.grounded=false;m.elapsed=elapsed;
 if(elapsed>=m.duration){p.mantle=null;p.mantleCooldown=MANTLE.cooldown;p.grounded=true;}
 return true;
}
