import * as THREE from 'three';
import {OPERATIONS} from './field-operations.js';
import {getMap} from './maps.js';
import {groundAt} from './terrain.js';

export function updateOperationView(view,state) {
  const u=state.royale?.operations?.uplink;
  if(!u||state.royale.practice){if(view.operationMesh)view.operationMesh.visible=false;return;}
  let root=view.operationMesh;
  if(!root){
    root=new THREE.Group();root.name='frontline-uplink';view.operationMesh=root;
    const material=new THREE.MeshBasicMaterial({color:0x74f5db,side:THREE.DoubleSide,transparent:true,opacity:.75,depthWrite:false});
    const ring=new THREE.Mesh(new THREE.RingGeometry(OPERATIONS.radius-.12,OPERATIONS.radius,64),material);ring.rotation.x=-Math.PI/2;root.add(ring);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.1,.18,3,6),new THREE.MeshLambertMaterial({color:0x213e46}));mast.position.y=1.5;root.add(mast);
    const signal=new THREE.Mesh(new THREE.OctahedronGeometry(.5),new THREE.MeshBasicMaterial({color:0x74f5db}));signal.position.y=3.4;root.add(signal);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,15,6,1,true),new THREE.MeshBasicMaterial({color:0x74f5db,transparent:true,opacity:.12,depthWrite:false}));beam.position.y=7.5;root.add(beam);
    root.traverse(m=>{if(m.isMesh){m.userData.ownedMaterial=true;m.castShadow=false;m.receiveShadow=false;}});
  }
  if(root.parent!==view.root)view.root.add(root);
  root.visible=u.status==='active';root.position.set(u.x,u.y+.06,u.z);
  if(root.userData.id!==state.royale.matchId+':'+u.id){
    root.userData.id=state.royale.matchId+':'+u.id;
    const positions=root.children[0].geometry.attributes.position,map=getMap(state.options.map);
    for(let i=0;i<positions.count;i++)positions.setZ(i,groundAt(map,u.x+positions.getX(i),u.z-positions.getY(i))-u.y);
    positions.needsUpdate=true;root.children[0].geometry.computeBoundingSphere();
  }
  const color=u.contested?0xff876b:0x74f5db;root.children[0].material.color.setHex(color);root.children[2].material.color.setHex(color);
  root.children[2].rotation.y=state.time*.6;
}
