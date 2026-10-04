import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {dressBuilding,buildingStyle,treeModel,propModel,chestModel} from './royale-art.js';
import {FrontierArt,FRONTIER_COLORS} from './frontier-art.js';
import {prefab,prefabBoxes} from './map-layout.js';
import {mapAssetUrl} from './map-service.js';

const modelCache=new Map();
export function normalizeModel(scene){
 scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3());
 if(bounds.isEmpty()||!Number.isFinite(size.length())||Math.max(size.x,size.y,size.z)<.001)throw Error('The model has no usable geometry.');
 const factor=6/Math.max(size.x,size.y,size.z),center=bounds.getCenter(new THREE.Vector3()),root=new THREE.Group();scene.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));root.add(scene);root.scale.setScalar(factor);root.updateMatrixWorld(true);
 return {root,dimensions:[size.x,size.y,size.z].map(n=>Math.max(.02,n*factor))};
}
export async function parseModel(bytes){const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const gltf=await new GLTFLoader().parseAsync(bytes,'');return normalizeModel(gltf.scene);}
export function cachedModel(id){
 if(!modelCache.has(id)){const task=(async()=>{const res=await fetch(mapAssetUrl(id));if(!res.ok)throw Error('Imported model unavailable.');const model=await parseModel(await res.arrayBuffer());model.root.traverse(m=>{if(m.isMesh){m.geometry.userData.shared=true;m.castShadow=m.receiveShadow=true;}});return model;})();modelCache.set(id,task);task.catch(()=>modelCache.delete(id));}
 return modelCache.get(id);
}
export function registerModel(id,model){model.root.traverse(m=>{if(m.isMesh)m.geometry.userData.shared=true;});modelCache.set(id,Promise.resolve(model));}
export function disposeMapGroup(group){group.userData.details?.close();group.userData.disposed=true;const geos=new Set(),mats=new Set();group.traverse(m=>{m.userData.disposed=true;if(m.geometry&&!m.geometry.userData.shared)geos.add(m.geometry);if(m.material&&(m.isLine||m.isSprite||m.userData.ownedMaterial))for(const mat of Array.isArray(m.material)?m.material:[m.material])mats.add(mat);});for(const g of geos)g.dispose();for(const m of mats){if(m.isSpriteMaterial)m.map?.dispose();m.dispose();}group.clear();}
export function bakeObject(group){
 group.updateMatrixWorld(true);const batches=new Map();
 for(const mesh of [...group.children])if(mesh.isMesh&&!mesh.material.map&&!mesh.userData.keepDynamic){
  const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrix);g.deleteAttribute('uv');const c=mesh.material.color||new THREE.Color(0xffffff);if(!g.attributes.color){const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));}else if(mesh.material.vertexColors){const colors=g.attributes.color;for(let i=0;i<colors.count;i++)colors.setXYZ(i,colors.getX(i)*c.r,colors.getY(i)*c.g,colors.getZ(i)*c.b);}
  const key=mesh.material.transparent?'transparent':'opaque';if(!batches.has(key))batches.set(key,{parts:[],ranges:[],vertices:0});const b=batches.get(key);b.parts.push(g);if(mesh.userData.objectId)b.ranges.push({id:mesh.userData.objectId,start:b.vertices,count:g.attributes.position.count});b.vertices+=g.attributes.position.count;group.remove(mesh);if(!mesh.geometry.userData.shared)mesh.geometry.dispose();
 }
 for(const b of batches.values()){const geometry=mergeGeometries(b.parts);for(const p of b.parts)p.dispose();geometry.computeBoundingSphere();const material=new THREE.MeshLambertMaterial({vertexColors:true}),mesh=new THREE.Mesh(geometry,material);mesh.userData.ownedMaterial=true;mesh.userData.objectRanges=b.ranges;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
}
export function makeMapObject(record,kit,{base,markers=false,loadModels=true}={}){
 const root=new THREE.Group(),content=new THREE.Group();root.add(content);root.name=record.name||record.kind||record.source;root.userData.editorId=record.id;
 const src=record.sourceObject,origin=record.origin||src?.position||[0,0,0],color=record.color?Number.parseInt(record.color.slice(1),16):null;
 if(src?.type==='building'){
  const s=buildingStyle(src.spec);for(const b of src.boxes){if(['tree','prop','roof-collider','door'].includes(b.kind))continue;const c=typeof b.color==='number'?b.color:b.color==='floor'||b.color==='stair'?s.wood:b.color==='rail'||b.color==='lintel'?s.trim:s.wall;const m=kit.block(content,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color??c);m.userData.objectId=b.objectId;}
  dressBuilding(content,src.spec,kit);
  for(const [index,p]of (base?.props||[]).entries())if(p.building===Number(src.id.split('-')[1])&&!record.omitProps?.includes('prop-'+index)){const start=content.children.length;propModel(content,p,kit);const box=src.boxes.find(b=>b.prop===index);for(const m of content.children.slice(start))m.userData.objectId=box?.objectId;}
 }else if(src?.type==='tree')treeModel(content,src.spec,kit);
 else if(src?.type==='prop')propModel(content,src.spec,kit);
 else if(src?.type==='box'){
  if(base?.theme==='frontier'){const a=new FrontierArt();a.wallDetail(src.spec);a.bake(content);}else {const b=src.spec;kit.block(content,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color??(typeof b.color==='number'?b.color:kit.palette[b.color]||0x82928f));}
 }else if(record.kind==='model'){
  root.userData.damageObjectId='editor-'+record.id+'-0';
  const [w,h,d]=record.dimensions;const fallback=kit.block(content,0,h/2,0,w,h,d,color??0x648083);fallback.userData.keepDynamic=true;fallback.userData.modelFallback=true;
  if(loadModels)void cachedModel(record.asset).then(({root:model})=>{if(root.userData.disposed||!root.parent&&root.userData.abandoned)return;fallback.removeFromParent();const clone=model.clone(true);if(color!=null)clone.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.color.setHex(color);m.userData.ownedMaterial=true;}});content.add(clone);root.userData.modelReady=true;}).catch(e=>{root.userData.modelError=e.message;});
 }else if(['pine','oak','palm'].includes(record.kind))treeModel(content,{x:0,y:0,z:0,h:prefab(record.kind).size[1],kind:record.kind,seed:17},kit);
 else if(['block','wall','platform','stairs','bunker','tower'].includes(record.kind)){
  for(const [i,b]of prefabBoxes(record.kind).entries()){const m=kit.block(content,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color??b.color);m.userData.objectId='editor-'+record.id+'-'+i;}
 }else if(record.kind==='chest'||src?.type==='chest'){const chest=chestModel(kit);content.add(chest);}
 else if(record.kind==='spawn'||src?.type==='spawn'){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,.08,16),new THREE.MeshBasicMaterial({color:0x77e0bd}));m.position.y=.08;m.userData.ownedMaterial=true;content.add(m);kit.cylinder(content,0,.8,0,.045,1.6,0x77e0bd);
 }else {const p=prefab(record.kind);propModel(content,{kind:record.kind,x:0,y:0,z:0,w:p.size[0],h:p.size[1],d:p.size[2],seed:17},kit);}
 if(!['chest','spawn'].includes(src?.type))content.position.set(-origin[0],-origin[1],-origin[2]);
 content.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=true;if(!m.userData.objectId)m.userData.objectId=src?.boxes?.[0]?.objectId||'editor-'+record.id+'-0';if(color!=null&&m.material?.color){m.material=m.material.clone();m.material.color.setHex(color);m.userData.ownedMaterial=true;}}});
 if(src&&record.id!==record.source)content.traverse(m=>{if(!m.isMesh)return;const index=src.boxes.findIndex(b=>b.objectId===m.userData.objectId);m.userData.objectId='editor-'+record.id+'-'+Math.max(0,index);});
 if(record.kind!=='model')bakeObject(content);
 root.position.fromArray(record.position);root.rotation.y=record.rotation*Math.PI/180;root.scale.fromArray(record.scale);return root;
}
export function buildMapObjects(world,map,kit){for(const record of map.editorObjects||[]){const group=makeMapObject(record,kit,{base:map.editorBase});world.add(group);}}
