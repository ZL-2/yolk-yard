// Zombies-only model additions keep the PvP factory and its baked portraits unchanged.
import * as THREE from 'three';
import {makeBlaster as makeBaseBlaster} from './weapons.js';
import {Z_SPECIALS} from './zombies-config.js';
import {modelMaterial} from './model-surfaces.js';
const geometries=new Map(),specialMaterials=new Map();
const cached=(key,create)=>{if(!geometries.has(key)){const g=create();g.userData.shared=true;geometries.set(key,g);}return geometries.get(key);};
function box(g,x,y,z,w,h,d,color){const m=new THREE.Mesh(cached(`box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d)),modelMaterial(color,'metal'));m.position.set(x,y,z);g.add(m);}
function tube(g,x,y,z,r,length,color){const m=new THREE.Mesh(cached(`tube:${r}:${length}`,()=>new THREE.CylinderGeometry(r,r,length,12)),modelMaterial(color,'metal'));m.rotation.x=Math.PI/2;m.position.set(x,y,z+length/2);g.add(m);}
export function setResonance(model,tier=0){
 if(!model||model.userData.resonanceTier===tier||!tier&&!model.userData.resonanceBands)return;model.userData.resonanceTier=tier;
 let bands=model.userData.resonanceBands;if(!bands){bands=new THREE.Group();model.userData.resonanceBands=bands;model.add(bands);for(let i=0;i<3;i++){let material=specialMaterials.get('resonance');if(!material){material=new THREE.MeshStandardMaterial({color:0xb6e6d5,emissive:0x70cbb8,emissiveIntensity:.9,roughness:.3,metalness:.6});material.userData.shared=true;specialMaterials.set('resonance',material);}const mesh=new THREE.Mesh(cached('resonance-band',()=>new THREE.BoxGeometry(.025,.075,.07)),material);mesh.position.set(-.15,.08,.1-i*.09);bands.add(mesh);}}
 bands.children.forEach((mesh,i)=>mesh.visible=i<tier);bands.visible=tier>0;
}
export function makeBlaster(id,wrap=''){
  const special=Z_SPECIALS.find(w=>w.id===id);if(special){const g=makeBaseBlaster(special.base,wrap);g.name=special.name;g.userData.weaponId=id;
   let glow=specialMaterials.get(id);if(!glow){glow=new THREE.MeshStandardMaterial({color:special.color,emissive:special.color,emissiveIntensity:1.3,metalness:.5,roughness:.3});glow.userData.shared=true;specialMaterials.set(id,glow);}
   if(special.special==='chain'){for(const side of [-1,1]){box(g,side*.19,.06,-.38,.07,.1,.62,0x587d7d);for(let i=0;i<4;i++){const coil=new THREE.Mesh(cached('z-coil',()=>new THREE.TorusGeometry(.08,.015,6,16)),glow);coil.position.set(side*.19,.06,-.18-i*.12);g.add(coil);}}}
   if(special.special==='rift'){for(let i=0;i<3;i++){const ring=new THREE.Mesh(cached('z-rift',()=>new THREE.TorusGeometry(.19,.025,6,20)),glow);ring.position.set(0,0,-.25-i*.15);g.add(ring);}for(const side of [-1,1])box(g,side*.24,0,-.42,.08,.14,.55,0x4f486b);}
   if(special.special==='cinder'){for(const side of [-1,1]){tube(g,side*.18,.02,-.22,.065,.45,0x996f49);for(let i=0;i<5;i++){const vent=new THREE.Mesh(cached('z-vent',()=>new THREE.BoxGeometry(.015,.09,.03)),glow);vent.position.set(side*.247,.03,-.42+i*.07);g.add(vent);}}}return g;
  }
 return makeBaseBlaster(id,wrap);
}
