import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import {MATERIALS,pieceBoxes,solvePlacement,aimedObject} from './building.js';
import {selectMaterial} from './building-rules.js';
import {editPlanePoint} from './building-shapes.js';
export function buildMesh(piece,kit,preview=false){
 const g=new THREE.Group(),color=preview?0x57caff:MATERIALS[piece.material].color;
 const previewMaterial=preview?new THREE.MeshBasicMaterial({color,transparent:true,opacity:.24,depthWrite:false}):null;
 for(const b of pieceBoxes({...piece,x:0,y:0,z:0})){
  const mesh=kit.block(g,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,b.door&&!preview?(piece.material==='wood'?0x89643f:piece.material==='brick'?0x915445:0x456570):color);
  if(preview){mesh.material=previewMaterial;mesh.userData.ownedMaterial=true;}
 }
 if(!preview){
  // Visible framing distinguishes timber, masonry and sheet metal at a glance.
  const m=piece.material,dark=m==='wood'?0x694b31:m==='brick'?0xe8cbb5:0x3e5e6d;
  if(piece.type==='wall'&&!piece.mask){for(let i=0;i<9;i++){let mesh;if(m==='wood')mesh=kit.block(g,-1.9+i*.475,2,0,.065,4,.22,dark);else mesh=kit.block(g,0,i*.48,0,4,.025,.19,dark);if(piece.rotation%2){mesh.position.z=mesh.position.x;mesh.position.x=0;mesh.rotation.y=Math.PI/2;}}
  }
 }
 const batches=new Map();g.updateMatrixWorld(true);for(const mesh of [...g.children]){const key=mesh.material.uuid;if(!batches.has(key))batches.set(key,{material:mesh.material,parts:[],owned:preview});const geo=mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);batches.get(key).parts.push(geo);g.remove(mesh);}
 for(const batch of batches.values()){const geo=mergeGeometries(batch.parts);batch.parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geo,batch.material.clone());mesh.userData.ownedMaterial=true;g.add(mesh);}
 previewMaterial?.dispose();g.position.set(piece.x,piece.y,piece.z);return g;
}
export function updateBuildingView(rv,state,p){
 rv.buildMeshes??=new Map();const r=state.royale,seen=new Set();
 for(const b of r.builds||[]){seen.add(b.id);let cached=rv.buildMeshes.get(b.id);const key=[b.material,b.mask,b.rotation,b.path,b.doorOpen].join(':');
  if(cached&&cached.key!==key){rv.root.remove(cached.mesh);rv.view.disposeGroup(cached.mesh);rv.buildMeshes.delete(b.id);cached=null;}
  if(!cached){const mesh=buildMesh(b,rv.kit);rv.root.add(mesh);cached={mesh,key};rv.buildMeshes.set(b.id,cached);}
  cached.mesh.visible=(!p||Math.hypot(b.x-p.x,b.z-p.z)<180)&&rv.view.buildControls?.editDraft?.id!==b.id;
  cached.mesh.traverse(m=>{if(!m.isMesh)return;m.material.emissive?.setHex(state.time-b.lastDamage<.16?MATERIALS[b.material].damageColor:0x000000);if(m.material.emissive)m.material.emissiveIntensity=.28;});
 }
 for(const [id,c] of rv.buildMeshes)if(!seen.has(id)){rv.root.remove(c.mesh);rv.view.disposeGroup(c.mesh);rv.buildMeshes.delete(id);}
 if(!rv.weakpoint){rv.weakpoint=new THREE.Mesh(new THREE.RingGeometry(.18,.25,32),new THREE.MeshBasicMaterial({color:0x50cfff,depthTest:false,transparent:true,opacity:.95,side:THREE.DoubleSide}));rv.weakpoint.userData.ownedMaterial=true;rv.root.add(rv.weakpoint);}
 const aimed=p?.slot===0?aimedObject(rv.view.buildMap,p,5):null,weak=r.worldDamage?.[aimed?.box.objectId]?.weakpoint;rv.weakpoint.visible=!!weak;if(weak){rv.weakpoint.position.set(weak.x,weak.y,weak.z);rv.weakpoint.quaternion.copy(rv.view.camera.quaternion);}
 const controls=rv.view.buildControls;updateEditView(rv,controls);
 const active=p?.health>0&&p.flight==='ground'&&controls?.buildMode&&!controls.editing;
 if(active)controls.buildMaterial=selectMaterial(p.materials,controls.buildMaterial)||controls.buildMaterial;
 const solved=active?solvePlacement({...p,yaw:controls.yaw??p.yaw,pitch:controls.pitch??p.pitch,buildFacing:controls.buildFacing},controls.buildType,controls.buildRotation,controls.buildMaterial,rv.view.buildMap,r.builds||[],state.players,controls.buildAnchor):null;
 const proposal=solved?.piece;
 if(proposal)controls.buildAnchor=[proposal.x,proposal.y,proposal.z,proposal.rotation].join(',');
 const previewKey=proposal?JSON.stringify(proposal):'';
 if(rv.previewKey!==previewKey){
  rv.previewKey=previewKey;
  if(rv.previewBuild){rv.root.remove(rv.previewBuild);rv.view.disposeGroup(rv.previewBuild);rv.previewBuild=null;}
  if(proposal){rv.previewBuild=buildMesh(proposal,rv.kit,true);rv.root.add(rv.previewBuild);}
 }
 if(proposal){
  const validationKey=JSON.stringify([previewKey,solved.reason,rv.view.buildMap.buildKey,p.materials,state.players.filter(o=>Math.hypot(o.x-proposal.x,o.z-proposal.z)<7).map(o=>[o.x,o.y,o.z,o.health])]);
  if(validationKey!==rv.previewValidationKey){
   rv.previewValidationKey=validationKey;
   const reason=solved.reason,valid=!reason&&(p.materials?.[proposal.material]||0)>=10;
   rv.previewBuild.traverse(m=>{if(m.isMesh)m.material.color.setHex(valid?0x61cfff:0xff556d);});controls.reason=reason||(!valid?'Not enough materials':'');
  }
 }
 if(rv.view.world&&rv.worldVersion!==r.matchId+':'+r.round+':'+r.buildVersion){rv.worldVersion=r.matchId+':'+r.round+':'+r.buildVersion;rv.view.world.traverse(m=>{if(!m.userData.objectRanges)return;const attribute=m.geometry.attributes.position;let changed=false;for(const range of m.userData.objectRanges){const destroyed=!!r.worldDamage?.[range.id]?.destroyed;if(!!range.destroyed===destroyed)continue;m.userData.originalPositions??=attribute.array.slice();const start=range.start*3,end=(range.start+range.count)*3;if(destroyed)attribute.array.fill(0,start,end);else attribute.array.set(m.userData.originalPositions.subarray(start,end),start);range.destroyed=destroyed;changed=true;}if(changed)attribute.needsUpdate=true;});}
}
function updateEditView(rv,c){
 const edit=c?.editDraft,key=edit?JSON.stringify([edit.id,edit.mask,edit.path,c.editHover,c.editValid]):'';
 if(key===rv.editKey)return;rv.editKey=key;
 if(rv.editOverlay){rv.root.remove(rv.editOverlay);rv.view.disposeGroup(rv.editOverlay);rv.editOverlay=null;}
 if(!edit)return;
 const group=new THREE.Group();rv.editOverlay=group;rv.root.add(group);
 if(c.editValid){const preview=buildMesh({...edit,doorOpen:false},rv.kit,true);preview.traverse(m=>{if(m.isMesh){m.material.opacity=.3;m.material.color.setHex(0xe5f2ff);}});group.add(preview);}
 const n=['wall','stairs'].includes(edit.type)?3:2;
 for(let row=0;row<n;row++)for(let col=0;col<n;col++){
  const index=row*n+col,selected=edit.type==='stairs'?edit.path?.includes(index):!!(edit.mask&1<<index),hover=c.editHover===index;
  const color=!c.editValid?0xe24b59:selected?0x9fa9b7:hover?0x68caff:0x187bc4;
  const pad=.008,u=col/n,v=row/n;
  const points=[[u+pad,v+pad],[u+1/n-pad,v+pad],[u+1/n-pad,v+1/n-pad],[u+pad,v+1/n-pad]].map(([a,b])=>editPlanePoint(edit,a,b));
  const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y,p.z)));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:selected?.32:.62,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));mesh.renderOrder=90;mesh.userData.ownedMaterial=true;group.add(mesh);
  const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y,p.z))),new THREE.LineBasicMaterial({color:hover?0xffffff:0x96d7ff,transparent:true,opacity:.95,depthTest:false}));outline.renderOrder=91;outline.userData.ownedMaterial=true;group.add(outline);
  if(selected){const coords=[points[0],points[2],points[1],points[3]];const cross=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(coords.map(p=>new THREE.Vector3(p.x,p.y,p.z))),new THREE.LineBasicMaterial({color:0xe7effa,transparent:true,opacity:.7,depthTest:false}));cross.renderOrder=92;cross.userData.ownedMaterial=true;group.add(cross);}
 }
}
