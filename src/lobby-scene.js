import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PATROL_SPEED} from './lobby-motion.js';
// An original coastal expedition service road. Recycled geometry supplies
// parallax without loading the playable island or moving gameplay actors.
export function lobbyScene(){
 const group=new THREE.Group(),materials=new Map(),moving=[];
 const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.83}));return materials.get(color);};
 const box=new THREE.BoxGeometry(1,1,1),pole=new THREE.CylinderGeometry(.075,.11,1,7),rock=new THREE.IcosahedronGeometry(1,1);
 const add=(parent,geometry,color,x,y,z,scale)=>{const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);if(scale)m.scale.set(...scale);m.receiveShadow=true;parent.add(m);return m;};
 add(group,box,0x354b53,1,-.30,-30,[130,.4,190]);
 for(let n=0;n<4;n++){
  const tile=new THREE.Group();tile.position.z=18-n*30;group.add(tile);moving.push({model:tile,base:tile.position.z});
  add(tile,box,0x536467,1,.08,0,[14,.10,30]);
  for(const x of [-5.6,7.6]){
   add(tile,box,0x293f48,x,.16,0,[.22,.18,30]);
   for(const z of [-10,0,10])add(tile,box,0xd7b879,x+.27,.137,z,[.12,.012,3]);
  }
  for(const z of [-12,-6,0,6,12])add(tile,box,0x88aaa5,1,.137,z,[.10,.012,2.7]);
  for(const [x,z]of [[-8,-6],[10,8]]){
   add(tile,pole,0x2a4651,x,2,z,[1,4,1]);
   add(tile,box,0x334e59,x,4.1,z,[1.3,.20,.7]);
   const lamp=add(tile,box,0xf0c778,x,3.98,z,[.9,.06,.5]);lamp.material=new THREE.MeshBasicMaterial({color:0xf0c778});
   add(tile,box,0x2c434a,x+(x<0?-2:2),.58,z-5,[2,1.1,1.5]);
   add(tile,box,0x74a8a2,x+(x<0?-2:2),1.18,z-5,[2.05,.08,1.6]);
  }
  for(const x of [-16,19]){
   add(tile,box,0x344d57,x,3.3,-8,[6,6.3,10]);
   add(tile,box,0x668681,x,6.6,-8,[6.4,.3,10.6]);
   for(const z of [-11,-7,-3])add(tile,box,0x85c8bc,x+(x<0?3.02:-3.02),3.2,z,[.03,.25,1.8]);
  }
 }
 for(let i=0;i<12;i++)add(group,rock,i%2?0x789b96:0x567d7c,(i-6)*16,3+(i%3),-98,[12,7+(i%3)*2,9]);
 const sun=new THREE.Mesh(new THREE.SphereGeometry(4,20,12),new THREE.MeshBasicMaterial({color:0xe8d4ae}));sun.position.set(-24,16,-112);group.add(sun);
 // Bake each reusable road segment into a handful of material batches.
 for(const {model} of moving){
  const batches=new Map();
  for(const child of [...model.children]){child.updateMatrix();const geometry=child.geometry.clone().applyMatrix4(child.matrix);if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(geometry);model.remove(child);}
  for(const [mat,parts]of batches){const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());const mesh=new THREE.Mesh(geometry,mat);mesh.receiveShadow=true;model.add(mesh);}
 }
 group.userData.distance=0;group.userData.moving=moving;
 group.userData.update=dt=>{
  const step=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;
  group.userData.distance=(group.userData.distance+PATROL_SPEED*2.3*step)%120;
  for(const item of moving)item.model.position.z=((item.base-group.userData.distance+90)%120+120)%120-90;
 };
 return group;
}
