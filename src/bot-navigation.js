import {wallDistance,dist,candidates,canStand} from './physics.js';
import {groundAt} from './terrain.js';
const clear=(sim,p,q)=>{const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz)||1;return Math.abs(q.y-p.y)<.45&&wallDistance(sim.map,{x:p.x,y:p.y+.7,z:p.z},{x:dx/d,y:0,z:dz/d},d)>=d-.1;};
// Bounded live collision search for edits, ramps and destroyed walls. The large
// authored graph remains cached; obstruction does not rebuild the entire map.
function walkEdge(map,from,x,z){
 let y=from.y;const distance=Math.hypot(x-from.x,z-from.z),steps=Math.ceil(distance/.28);
 for(let i=1;i<=steps;i++){const xx=from.x+(x-from.x)*i/steps,zz=from.z+(z-from.z)*i/steps;let floor=groundAt(map,xx,zz);
  for(const b of candidates(map,{x:xx,y,z:zz}))if(Math.abs(xx-b.x)<b.w/2+.44&&Math.abs(zz-b.z)<b.d/2+.44&&b.y+b.h<=y+.43)floor=Math.max(floor,b.y+b.h);
  if(floor-y>.43||y-floor>3.7||!canStand(map,{x:xx,y:floor,z:zz},.45))return null;y=floor;
 }return {x,y,z};
}
export function localRoute(sim,p,goal){
 const queue=[{x:p.x,y:p.y,z:p.z,parent:-1}],seen=new Set(['0,0']),step=1.5;let best=0,bestDistance=dist(p,goal);
 for(let i=0;i<queue.length&&i<160;i++){
  const at=queue[i];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=at.x+dx*step,z=at.z+dz*step,key=Math.round((x-p.x)/step)+','+Math.round((z-p.z)/step);if(seen.has(key)||Math.hypot(x-p.x,z-p.z)>12)continue;seen.add(key);
   const q=walkEdge(sim.map,at,x,z);if(!q)continue;q.parent=i;queue.push(q);const d=dist(q,goal);if(d<bestDistance){best=queue.length-1;bestDistance=d;}if(d<1.5)break;
  }
 }
 const route=[];for(let i=best;i>0;i=queue[i].parent){const{x,y,z}=queue[i];route.push({x,y,z});}return route.reverse();
}
function pathBudget(sim){
 if(sim.botPathTick!==sim.time){sim.botPathTick=sim.time;sim.botPathBudget=1;}
 if(sim.botPathBudget<=0)return false;sim.botPathBudget--;return true;
}
export function navigate(sim,p,brain,goal,skill){
 if(!goal)return {mx:0,mz:0,jump:false};
 const now=sim.time,arrived=dist(p,goal)<1.3;
 if(arrived){if(brain.task?.id)brain.visited[brain.task.id]=now;if(p.inventory||brain.task?.kind!=='fight')brain.decision=Math.min(brain.decision,now+.2);}
 const revision=sim.navigationRevision||0,movedGoal=!brain.pathGoal||dist(goal,brain.pathGoal)>4;
 if((movedGoal||now>(brain.pathAt||0)||revision!==brain.navRevision)&&!arrived){
  if(pathBudget(sim)){brain.navRevision=revision;brain.pathGoal={...goal};brain.pathAt=now+1.8+sim.random()*.7;p.botPath=clear(sim,p,goal)?[]:sim.nav.path(p,goal);}
 }
 while(p.botPath?.length&&dist(p,p.botPath[0])<.65)p.botPath.shift();
 const direct=clear(sim,p,goal),step=direct?goal:p.botPath?.[0]||goal;
 let dx=step.x-p.x,dz=step.z-p.z,len=Math.hypot(dx,dz),mx=len>.4?dx/len:0,mz=len>.4?dz/len:0,jump=false,interact=false;
 if(mx||mz){
  const o={x:p.x,y:p.y+.55,z:p.z},d={x:mx,y:0,z:mz};
  if(wallDistance(sim.map,o,d,1.3)<1.1){
   interact=true;const left={x:-mz,y:0,z:mx},right={x:mz,y:0,z:-mx};
   const side=wallDistance(sim.map,o,left,2.5)>wallDistance(sim.map,o,right,2.5)?left:right;
   jump=wallDistance(sim.map,{...o,y:p.y+1.7},d,1.3)>1.2&&now>(brain.nextJump||0);
   if(!jump){mx=side.x;mz=side.z;}
  }
  if(!walkEdge(sim.map,p,p.x+mx*.7,p.z+mz*.7)&&!jump){mx=0;mz=0;brain.pathAt=0;}
 }
 if(now>=brain.checkAt){
  const stuck=Math.hypot(p.x-brain.lastX,p.z-brain.lastZ)<.4&&!arrived;
  if(stuck&&pathBudget(sim)){brain.failures=(brain.failures||0)+1;p.botPath=localRoute(sim,p,goal);brain.pathAt=now+2;brain.side*=-1;if(brain.failures>=3){if(brain.task?.id)brain.visited[brain.task.id]=now;brain.decision=0;brain.task=null;brain.failures=0;}}
  else brain.failures=0;
  brain.lastX=p.x;brain.lastZ=p.z;brain.checkAt=now+Math.max(.7,skill.decision*.6);
 }
 for(const other of sim.players.values())if(other!==p&&other.health>0&&!other.spectating){const d=Math.hypot(p.x-other.x,p.z-other.z);if(d>.01&&d<1.5){mx+=(p.x-other.x)/d*(1.5-d);mz+=(p.z-other.z)/d*(1.5-d);}}
 if(jump)brain.nextJump=now+1.1;
 const lenMove=Math.max(1,Math.hypot(mx,mz));return {mx:mx/lenMove,mz:mz/lenMove,jump,interact};
}
