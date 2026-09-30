import * as THREE from 'three';
import {FrontierArt} from './frontier-art.js';
import {PATROL_SPEED} from './lobby-motion.js';
// Modular coast-road scenery moves with the existing patrol distance. All detail
// is baked once; four reusable sections keep the loop seamless and draw calls low.
export function lobbyScene(){
 const group=new THREE.Group(),moving=[],base=new FrontierArt();
 base.box(1,-.3,-30,150,.4,190,0x4c6868);base.box(45,-.48,-45,46,.15,160,0x4a7b88);
 for(let i=0;i<13;i++){base.rock((i-6)*14,2+i%3,-99,9,6+i%3*2,7);if(i%3===0)base.pine((i-6)*14,-84,8+i%3);}
 base.building(-31,-80,18,14,10,'slate');base.radar(-31,-80,10);base.crane(36,-68);
 base.bake(group);
 for(let n=0;n<4;n++){
  const tile=new THREE.Group();tile.position.z=18-n*30;group.add(tile);moving.push({model:tile,base:tile.position.z});const a=new FrontierArt();
  a.box(1,.08,0,14,.1,30,0x53696c);for(const x of [-5.6,7.6]){a.box(x,.16,0,.22,.18,30,'dark');for(const z of [-12,-6,0,6,12])a.box(x,.137,z,.14,.015,2.6,'amber');}
  for(const z of [-12,-6,0,6,12])a.box(1,.137,z,.1,.015,2.7,0x9fb5ac);
  // Paths, curb drains and crash rails frame the patrol without obscuring it.
  for(const x of [-8.5,10.5]){a.box(x,.06,0,3,.08,30,0x83928b);for(const z of [-11,-1,9]){a.lamp(x,z);a.box(x,.15,z+2,.8,.04,.45,'dark');for(let j=0;j<4;j++)a.box(x-.27+j*.18,.18,z+2,.04,.03,.4,'steel');}}
  if(n%2===0){a.building(-17,-5,11,15,6.6,'slate');a.building(21,-7,13,13,5.5,'canvas');a.container(15,10,7,3.3,2.5,'teal');a.truck(-13,10);}
  else{a.building(-19,-6,14,13,5.3,'rust');a.container(17,-6,5,12,3.2,'teal');a.container(23,-6,5,12,3.2,'olive');a.container(17,-6,5,8,2.5,'canvas',3.2);a.truck(13,10);}
  // Utility pipes, exterior stair landings, shutters and supply-yard barriers.
  for(const x of [-12,14]){a.box(x,.65,-8,1.2,1.3,6,'concrete');a.box(x,1.36,-8,1.3,.1,6,'steel');for(let i=0;i<5;i++)a.box(x,.16+i*.18,-2+i*.5,1.4,.3+i*.36,.52,'concrete');}
  for(const side of [-1,1]){const x=side<0?-28:32;for(const z of [-8,4,12]){a.rock(x,.5,z,2,1.6,2);a.pine(x+side*2,z,6+(n%2));}a.beam([x,2,-14],[x,2,14],.12);for(const z of [-12,-4,4,12])a.cylinder(x,1,z,.1,2);}
  if(n===1){for(const x of [-8.5,10.5])a.box(x,4.6,-10,.45,9.2,.65,'steel');a.box(1,9.2,-10,20,.5,1.2,'steel');for(let x=-7;x<=9;x+=2){a.box(x,9.55,-10,.18,.2,1.3,'amber');a.beam([x,9.45,-10],[x+1.8,10.3,-10],.12,'canvas');}a.box(1,10.3,-10,20,.15,.55,'steel');}
  tile.userData.details=a.features;a.bake(tile);
 }
 const sun=new THREE.Mesh(new THREE.SphereGeometry(4,16,10),new THREE.MeshBasicMaterial({color:0xe8d4ae}));sun.position.set(-24,16,-112);sun.userData.ownedMaterial=true;group.add(sun);
 group.userData.distance=0;group.userData.moving=moving;group.userData.style='ravel-coast-operations';
 group.userData.update=dt=>{const step=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;group.userData.distance=(group.userData.distance+PATROL_SPEED*2.3*step)%120;for(const item of moving)item.model.position.z=((item.base-group.userData.distance+90)%120+120)%120-90;};
 return group;
}
