import {canStand} from './physics.js';
import {groundAt} from './terrain.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Scheduled tactical decisions supplement the shared navigation fields. No
// per-enemy path search and no client-decided damage.
export function infectedTactic(sim,e,dt){
 if(e.health<=0||sim.time<e.emergeUntil)return false;
 const living=sim.activePlayers();if(!living.length)return false;
 const p=living.reduce((a,b)=>distance(e,a)<distance(e,b)?a:b),d=distance(e,p);e.target=p.id;
 if(e.type==='mimic'){
  if(e.disguised&&d>9&&!(e.lastHit>e.born)){e.state='idle';e.vx=e.vz=0;return true;}
  if(e.disguised){e.disguised=false;e.revealUntil=sim.time+1.1;sim.cue('mimic',e);sim.effect('warning',e,3,1.1);}
  if(sim.time<e.revealUntil){e.state='emerge';return true;}
  if(e.graspAt){e.state='attack';e.attackStyle='grasp';e.yaw=Math.atan2(e.x-p.x,e.z-p.z);if(sim.time>=e.graspAt){if(d<7&&sim.clearMelee(e,p)){sim.damage(p,e,24,'Lure grasp');p.zDisrupted=sim.time+1.5;const q=sim.safePoint({x:p.x+(e.x-p.x)/(d||1)*1.3,z:p.z+(e.z-p.z)/(d||1)*1.3},1);if(q)Object.assign(p,q);}e.graspAt=0;e.attackStyle=null;}return true;}
  if(d>2&&d<7&&sim.time>=e.nextSpecial&&sim.clearMelee(e,p)){e.nextSpecial=sim.time+9;e.graspAt=sim.time+.9;sim.effect('warning',p,2,.9);sim.cue('telegraph',e);return true;}
 }
 if(e.type!=='mercenary')return false;
 if(d>30||!sim.clearMelee(e,p)){e.zAimAt=0;return false;}
 e.yaw=Math.atan2(e.x-p.x,e.z-p.z);
 // Move to lateral cover between bursts; close-range operators can force retreat.
 if(d<8||sim.time<(e.zMoveUntil||0)){const sign=e.id%2?1:-1,dx=d<8?(e.x-p.x)/(d||1):Math.cos(e.yaw)*sign,dz=d<8?(e.z-p.z)/(d||1):-Math.sin(e.yaw)*sign;
  const q={x:e.x+dx*2.3*dt,z:e.z+dz*2.3*dt};q.y=groundAt(sim.map,q.x,q.z);if(canStand(sim.map,{...q,y:q.y+.04},.35)){Object.assign(e,q);e.vx=dx*2.3;e.vz=dz*2.3;e.state='run';return true;}}
 e.vx=e.vz=0;e.state='aim';
 if(sim.time<(e.zShotAt||0))return true;
 if(!e.zAimAt){e.zAimAt=sim.time+.7;sim.effect('warning',e,1,.7);return true;}
 if(sim.time>=e.zAimAt){e.zAimAt=0;e.zShotAt=sim.time+1.7;e.zMoveUntil=sim.time+.5;e.state='attack';sim.effect('merc-shot',e,1,.18);if(sim.clearMelee(e,p))sim.damage(p,e,12,'Black Wake rifle');}
 return true;
}
