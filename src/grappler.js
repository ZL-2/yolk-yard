// Skye-style Mythic: unlimited plunger shots; no glider or fall immunity.
// Range/projectile/cadence references are kept separate from pull-motion tuning.
export const GRAPPLER=Object.freeze({range:75,minRange:2,projectileSpeed:75,cooldown:1/.65,returnTime:1.26,pullSpeed:26});
export function grappleAim(map,p,ray){
 const cp=Math.cos(p.pitch||0),d={x:-Math.sin(p.yaw||0)*cp,y:Math.sin(p.pitch||0),z:-Math.cos(p.yaw||0)*cp};
 const origin={x:p.x,y:p.y+(p.crouching?1.05:1.7),z:p.z},length=ray(map,origin,d,GRAPPLER.range);
 return {origin,anchor:{x:origin.x+d.x*length,y:origin.y+d.y*length,z:origin.z+d.z*length},length,valid:length>=GRAPPLER.minRange&&length<GRAPPLER.range-.001};
}
export function startGrapple(p,aim,time){
 p.grapple={origin:{...aim.origin},anchor:{...aim.anchor},length:aim.length,valid:aim.valid,elapsed:0,start:time,phase:'hook',hookTime:aim.length/GRAPPLER.projectileSpeed};
 p.traversal=null;p.use=null;p.reloadEnd=0;p.burstLeft=0;
 return p.grapple;
}
function release(p,g,momentum=true){
 g.phase='return';g.returnAt=g.elapsed;
 if(momentum){p.launchVelocity={x:g.vx||0,z:g.vz||0};p.vy=Math.min(12,g.vy||0);p.grounded=false;}
}
export function stepGrapple(p,input,map,dt,occupy,ground){
 const g=p.grapple;if(!g)return false;
 if(p.health<=0||p.downed||p.spectating){p.grapple=null;return false;}
 g.elapsed+=dt;
 if(g.phase==='return'){if(g.elapsed-(g.returnAt||0)>=GRAPPLER.returnTime)p.grapple=null;return false;}
 if(g.phase==='hook'){
  if(g.elapsed<g.hookTime)return false;
  if(!g.valid){release(p,g,false);return false;}
  g.phase='pull';p.fall={apex:p.y,immune:false,source:'grapple'};p.landing=null;p.launchVelocity=null;p.redeploy=false;p.forceGlider=false;p.flight='ground';
 }
 if(input.jump&&!p.jumpLatch){p.jumpLatch=true;release(p,g);return false;}
 p.jumpLatch=!!input.jump;
 const dx=g.anchor.x-p.x,dy=g.anchor.y-1.3-p.y,dz=g.anchor.z-p.z,length=Math.hypot(dx,dy,dz)||1;
 if(length<1.1||g.elapsed>g.hookTime+GRAPPLER.range/GRAPPLER.pullSpeed+1){release(p,g);return false;}
 const travel=Math.min(length-1,GRAPPLER.pullSpeed*dt),steps=Math.max(1,Math.ceil(travel/.22));
 g.vx=dx/length*GRAPPLER.pullSpeed;g.vy=dy/length*GRAPPLER.pullSpeed;g.vz=dz/length*GRAPPLER.pullSpeed;
 for(let i=0;i<steps;i++){
  const q={x:p.x+dx/length*travel/steps,y:p.y+dy/length*travel/steps,z:p.z+dz/length*travel/steps};q.y=Math.max(q.y,ground(map,q.x,q.z));
  if(!occupy(map,q)){release(p,g);p.vy=0;p.launchVelocity=null;return false;}
  Object.assign(p,q);
 }
 p.vy=g.vy;p.grounded=false;p.sprinting=p.tacticalSprint=false;p.crouching=p.sliding=false;p.sprintBlend=0;
 return true;
}
export function grappleHookPoint(g,returnOrigin=g.origin){
 const t=g.phase==='hook'?Math.min(1,g.elapsed/g.hookTime):g.phase==='return'?Math.max(0,1-(g.elapsed-g.returnAt)/GRAPPLER.returnTime):1;
 const origin=g.phase==='return'?returnOrigin:g.origin;
 return {x:origin.x+(g.anchor.x-origin.x)*t,y:origin.y+(g.anchor.y-origin.y)*t,z:origin.z+(g.anchor.z-origin.z)*t};
}
