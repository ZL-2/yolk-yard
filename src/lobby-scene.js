import * as THREE from 'three';
// Original Sunnybreak overlook, separate from playable map geometry.
export function lobbyScene(){
 const group=new THREE.Group(),materials=new Map();
 const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));return materials.get(color);};
 const mesh=(geometry,color,x,y,z,scale)=>{const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);if(scale)m.scale.set(...scale);m.receiveShadow=true;group.add(m);return m;};
 mesh(new THREE.CylinderGeometry(34,38,.9,64),0xabc3aa,0,-.72,-5);
 mesh(new THREE.CylinderGeometry(12,12.8,.3,64),0xe1d8b9,1,-.22,0);
 for(const x of [0,4.1]){
  mesh(new THREE.CylinderGeometry(1.8,2,.24,48),0x456d69,x,-.04,x?-.7:0);
  const ring=mesh(new THREE.TorusGeometry(1.83,.035,6,48),0xffdf81,x,.09,x?-.7:0);ring.rotation.x=Math.PI/2;
 }
 for(let i=0;i<11;i++){
  const angle=Math.PI+i*Math.PI/10,x=Math.cos(angle)*27,z=Math.sin(angle)*20-17;
  mesh(new THREE.IcosahedronGeometry(1,1),i%2?0x82b5a2:0x699f96,x,1,z,[8,3+(i%3)*1.8,8]);
 }
 const tree=(x,z,height,color)=>{mesh(new THREE.CylinderGeometry(.18,.3,height,7),0xa08257,x,height/2-.1,z);mesh(new THREE.IcosahedronGeometry(1,1),color,x,height+.2,z,[1.8,2.1,1.8]);};
 for(const [x,z,h,c]of [[-9,-8,3.5,0xdcc47c],[-12,-13,4.4,0x90ad70],[10,-12,4,0xefce7d],[14,-16,5,0x7ca180],[-16,-20,5,0x79a898],[20,-24,5.5,0xd9b975]])tree(x,z,h,c);
 for(const x of [-5,8]){mesh(new THREE.CylinderGeometry(.09,.14,3.4,8),0x355c5b,x,1.5,-6);mesh(new THREE.SphereGeometry(.29,12,8),0xffd88c,x,3.4,-6);}
 for(const x of [-7,10])mesh(new THREE.BoxGeometry(2.8,.15,.65),0xd0ad77,x,.8,-9);
 const sun=new THREE.Mesh(new THREE.SphereGeometry(4,24,16),new THREE.MeshBasicMaterial({color:0xffe7aa}));sun.position.set(-11,14,-48);group.add(sun);
 return group;
}
