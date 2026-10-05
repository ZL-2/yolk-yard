import {mapVaults} from './vaults.js';
import {bake} from './royale-view.js';
import * as THREE from 'three';
import {getMap} from './maps.js';
import {keycardRoute} from './frontier-world.js';
import {artKit} from './royale-art.js';

export function updateFrontierView(rv,state,p){
 const map=getMap(state.options.map),r=state.royale,k=artKit(rv.kit);rv.doorMeshes??=new Map();
 const key=r.matchId+':'+state.round+':'+map.id;
 if(rv.frontierKey!==key){for(const m of rv.doorMeshes.values()){m.userData.reader?.removeFromParent();if(m.userData.reader)rv.view.disposeGroup(m.userData.reader);m.removeFromParent();rv.view.disposeGroup(m);}rv.doorMeshes.clear();if(rv.traversalMesh){rv.traversalMesh.removeFromParent();rv.view.disposeGroup(rv.traversalMesh);}rv.traversalMesh=null;rv.frontierKey=key;}
 for(const d of map.doors||[]){const destroyed=r.worldDamage?.['world-door-'+d.id]?.destroyed,close=p&&Math.hypot(d.x-p.x,d.z-p.z)<75;let m=rv.doorMeshes.get(d.id);if(!m&&close&&!destroyed){m=new THREE.Group();m.position.set(d.x-d.w/2,d.y,d.z);const color=d.vault?0x526c7c:d.material==='metal'?0x607c81:0x796547;const panel=k.block(m,d.w/2,d.h/2,0,d.w,d.h,.18,color);panel.material=panel.material.clone();panel.userData.ownedMaterial=true;m.userData.panel=panel;
   for(const y of [.18,d.h-.18])k.block(m,d.w/2,y,.12,d.w,.13,.13,d.vault?0xd3b45e:0x2d444c);
   k.block(m,d.w-.25,d.h*.48,.18,.25,.09,.12,0xdbc79d);
   if(d.vault){const vault=mapVaults(map).find(v=>v.doorId===d.id);for(const x of [.3,d.w-.3])k.block(m,x,d.h/2,.15,.18,d.h,.18,0x203844);const reader=new THREE.Group();reader.position.set(vault.reader.x,vault.reader.y+1.25,vault.reader.z-.35);k.block(reader,0,0,0,.65,.85,.25,0x19313e);k.block(reader,0,.12,.15,.43,.28,.04,0x72d8d7);bake(reader,false,true);rv.root.add(reader);m.userData.reader=reader;}
   bake(m,false,true);rv.doorMeshes.set(d.id,m);rv.root.add(m);}
  if(m){m.visible=!!close&&!destroyed;if(m.userData.reader)m.userData.reader.visible=!!close;m.rotation.y=r.doors?.[d.id]?.open?Math.PI/2:0;const damage=r.worldDamage?.['world-door-'+d.id],loss=damage?1-damage.health/damage.maxHealth:0;m.userData.panel.material.color.setHex(d.vault?0x526c7c:d.material==='metal'?0x607c81:0x796547).multiplyScalar(1-loss*.45);}
 }
 if(!rv.traversalMesh&&map.traversal?.length){const g=new THREE.Group();rv.traversalMesh=g;rv.root.add(g);for(const line of map.traversal){const a=line.from,b=line.to;
   const route=[a,...line.via||[],b];for(let i=1;i<route.length;i++){const q=route[i-1],r=route[i];k.beam(g,[q.x,q.y+2.1,q.z],[r.x,r.y+2.1,r.z],.035,0x344b53);}
   for(const q of [a,b]){k.beam(g,[q.x+.7,q.y,q.z],[q.x+.7,q.y+3,q.z],.10,0x8b9d96);k.beam(g,[q.x+.7,q.y+3,q.z],[q.x,q.y+2.1,q.z],.1,0xc4a861);k.cylinder(g,q.x,q.y+2.15,q.z,.23,.12,0xc6b57b,10);k.block(g,q.x+.7,q.y+1,q.z,.14,.9,.18,0xe0ba59);}
  }bake(g,false,true);}
 const path=keycardRoute(map,r,p);if(!rv.keycardLine){rv.keycardLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0x83e2ef,dashSize:.55,gapSize:.42,depthTest:false,transparent:true,opacity:.85}));rv.keycardLine.userData.ownedMaterial=true;rv.keycardLine.renderOrder=12;rv.root.add(rv.keycardLine);}
 rv.keycardLine.visible=!!path&&p.health>0;if(path&&(!rv.nextKeycardLine||state.time>=rv.nextKeycardLine)){rv.nextKeycardLine=state.time+.1;const points=[new THREE.Vector3(p.x,p.y+.25,p.z),...path.map(q=>new THREE.Vector3(q.x,q.y+.35,q.z))];rv.keycardLine.geometry.dispose();rv.keycardLine.geometry=new THREE.BufferGeometry().setFromPoints(points);rv.keycardLine.computeLineDistances();}
}
