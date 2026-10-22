import {canOccupy,candidates} from './physics.js';
import {shapeOverlap} from './environment-collision.js';
import {groundAt} from './terrain.js';

// One hull for movement, impact contacts and swept character collisions.
const HELI=[[0,.4,-.9,2.2,1.28],[0,.4,1.1,1.9,1.18],[0,1.25,3.35,.65,.36],[0,1.6,5,.6,.2]];
const QUAD=[[0,.38,-.72,1.05,.66],[0,.38,0,1.05,.66],[0,.38,.72,1.05,.66]];
export function vehicleProbes(v){
 const c=Math.cos(v.yaw),s=Math.sin(v.yaw);
 return (v.type==='helicopter'?HELI:QUAD).map(([x,y,z,h,r])=>({x:v.x+x*c+z*s,y:v.y+y,z:v.z-x*s+z*c,h,r}));
}
export function vehicleFits(map,v){
 for(const q of vehicleProbes(v))if(v.type==='helicopter'&&q.y<groundAt(map,q.x,q.z)-.035||!canOccupy(map,q,q.h,q.r))return false;
 return true;
}
export function vehicleContacts(map,v){
 const contacts=new Set();
 for(const q of vehicleProbes(v))for(const b of candidates(map,q,null,0,q.r)){
  const overlaps=b.collisionShape?shapeOverlap(b.collisionShape,q,q.h,q.r):q.y+.035<b.y+b.h&&q.y+q.h>b.y+.02&&Math.abs(q.x-b.x)<b.w/2+q.r&&Math.abs(q.z-b.z)<b.d/2+q.r;
  if(overlaps)contacts.add(b);
 }
 return contacts;
}
