import * as THREE from 'three';
import {grappleHookPoint} from './grappler.js';
import {artKit} from './royale-art.js';
const up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
export function updateGrapplers(rv,state,local){
 rv.grappleMeshes??=new Map();const active=new Set();
 for(const p of state.players){
  const g=p.grapple;if(!g||p.health<=0||local&&Math.hypot(local.x-p.x,local.z-p.z)>110)continue;
  active.add(p.id);let mesh=rv.grappleMeshes.get(p.id);
  if(!mesh){
   mesh=new THREE.Group();const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(27),3)),line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xd9cda2}));line.userData.ownedMaterial=true;line.frustumCulled=false;
   const hook=new THREE.Group(),k=artKit(rv.kit);k.cone(hook,0,0,0,.16,.2,0xbc3041,.055);k.torus(hook,0,-.1,0,.15,.025,0xe54d59).rotation.x=Math.PI/2;k.cylinder(hook,0,.15,0,.027,.23,0x788082,8);
   mesh.add(line,hook);rv.root.add(mesh);rv.grappleMeshes.set(p.id,mesh);
  }
  mesh.visible=true;const hook=grappleHookPoint(g),origin={x:p.x,y:p.y+1.35,z:p.z},a=mesh.children[0].geometry.attributes.position;
  for(let i=0;i<9;i++){const t=i/8;a.setXYZ(i,origin.x+(hook.x-origin.x)*t,origin.y+(hook.y-origin.y)*t-Math.sin(t*Math.PI)*(g.phase==='pull'?.06:.22),origin.z+(hook.z-origin.z)*t);}a.needsUpdate=true;
  mesh.children[1].position.set(hook.x,hook.y,hook.z);direction.set(origin.x-hook.x,origin.y-hook.y,origin.z-hook.z).normalize();mesh.children[1].quaternion.setFromUnitVectors(up,direction);
 }
 for(const [id,mesh]of rv.grappleMeshes)if(!active.has(id)){mesh.visible=false;if(!state.players.some(p=>p.id===id)||rv.grappleMeshes.size>8){mesh.removeFromParent();rv.view.disposeGroup(mesh);rv.grappleMeshes.delete(id);}}
}
