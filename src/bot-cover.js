import {candidates,canStand,dist} from './physics.js';
import {seesPoint} from './bot-perception.js';
import {takeBotWork} from './bot-work.js';
const covers=new WeakMap();
export function coverPoint(sim,p,enemy){
 const old=covers.get(p),revision=sim.navigationRevision??sim.buildVersion??0;
 if(old&&old.map===sim.map&&old.boxes===sim.map.boxes&&old.revision===revision&&sim.time-old.at<1.2&&dist(p,old.from)<5&&dist(enemy,old.enemy)<4)return old.point;
 if(!takeBotWork(sim,'cover'))return null;
 let point=null,best=Infinity,probes=0;
 const boxes=candidates(sim.map,p,null,0,14).filter(b=>b.h>=1.15&&b.y<=p.y+1&&b.kind!=='boundary'&&Math.hypot(b.x-p.x,b.z-p.z)<14).sort((a,b)=>dist(p,a)-dist(p,b)).slice(0,12);
 for(const b of boxes){
  const dx=b.x-enemy.x,dz=b.z-enemy.z,l=Math.hypot(dx,dz)||1;
  for(const shift of [0,-1.5,1.5]){
   const q={x:b.x+dx/l*(b.w/2+1.2)-dz/l*shift,y:p.y,z:b.z+dz/l*(b.d/2+1.2)+dx/l*shift},d=dist(p,q);
   if(d>=best||!canStand(sim.map,q,.5))continue;
   if(++probes>12)break;
   if(!seesPoint(sim,q,enemy)){point=q;best=d;}
  }
  if(probes>12)break;
 }
 covers.set(p,{map:sim.map,boxes:sim.map.boxes,revision,at:sim.time,from:{x:p.x,y:p.y,z:p.z},enemy:{x:enemy.x,y:enemy.y,z:enemy.z},point});return point;
}
export function peekPoint(sim,p,cover,enemy,side=1){
 if(!takeBotWork(sim,'cover'))return null;
 const dx=cover.x-enemy.x,dz=cover.z-enemy.z,len=Math.hypot(dx,dz)||1;
 for(const shift of [2.5,-2.5,4,-4]){const q={x:cover.x-dz/len*shift*side,y:cover.y,z:cover.z+dx/len*shift*side};if(canStand(sim.map,q,.5)&&seesPoint(sim,q,enemy))return q;}
 return null;
}
