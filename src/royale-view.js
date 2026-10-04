import {buildMapObjects} from './map-object-view.js';
import {updateWorldDamage} from './damage-visuals.js';
import {WorldDetails,WORLD_STREAMING} from './world-streaming.js';
import {updateFrontierView} from './frontier-world-view.js';
import {getMap} from './maps.js';
import {glidePose} from './glide-pose.js';
import {lootHeight} from './loot-motion.js';
import {nearbyItems,itemById} from './nearby-items.js';
import {ROYALE_MAP} from './royale-map.js';
import {groundAt,terrainColor} from './terrain.js';
import {updateBuildingView} from './building-view.js';
import {shopItem} from './shop-catalog.js';
import {makeShopGlider,makeShopTrail} from './shop-models.js';
import {makeArms,actionArms} from './arms.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {transportAt} from './royale-data.js';
import {artKit,buildingStyle,dressBuilding,treeModel,propModel,gliderModel,chestModel,lootModel,launchpadModel} from './royale-art.js';
const bakedMaterial=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true});
const lootTemplates=new Map();
const propTemplates=new Map(),repeatProps=new Set(['counter','sofa','bed','shelf','crate','barrels','console','bollard','crop','solar','fence','car','bench','lamp','bush']);
function repeatedProp(group,p,kit){
 if(!repeatProps.has(p.kind)){propModel(group,p,kit);return;}
 const key=Object.keys(p).filter(k=>!['x','y','z','seed'].includes(k)).sort().map(k=>k+':'+p[k]).join('|');let template=propTemplates.get(key);
 if(!template){template=new THREE.Group();propModel(template,{...p,x:0,y:0,z:0},kit);bake(template,false,true);if(!template.children.every(m=>m.isMesh&&!m.userData.ownedMaterial)){propModel(group,p,kit);return;}for(const m of template.children)m.geometry.userData.shared=true;if(propTemplates.size<96)propTemplates.set(key,template);else{propModel(group,p,kit);return;}}
 for(const source of template.children){const mesh=new THREE.Mesh(source.geometry,source.material);mesh.position.set(p.x,p.y||0,p.z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
}

export function bake(group,chunked=false,colored=chunked){for(const _ of bakeSteps(group,chunked,colored)){} }
function* bakeSteps(group,chunked=false,colored=chunked){
 group.updateMatrixWorld(true);const batches=new Map();
 for(const o of [...group.children])if(o.isMesh&&!o.userData.ownedMaterial&&!o.userData.keepDynamic){
  const key=(colored?'color':o.material.uuid)+(chunked?':'+Math.floor(o.position.x/64)+':'+Math.floor(o.position.z/64):'');if(!batches.has(key))batches.set(key,{mat:colored?bakedMaterial:o.material,parts:[],ranges:[],vertices:0});
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);
  if(colored){g.deleteAttribute('uv');if(!g.attributes.color){const colors=new Float32Array(g.attributes.position.count*3),c=o.material.color;for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));}}
  const batch=batches.get(key);if(o.userData.objectId)batch.ranges.push({id:o.userData.objectId,start:batch.vertices,count:g.attributes.position.count});batch.vertices+=g.attributes.position.count;batch.parts.push(g);group.remove(o);
  if(o.geometry.type==='CylinderGeometry'&&!o.geometry.userData.shared)o.geometry.dispose();
  yield;
 }
 for(const b of batches.values()){const geometry=mergeGeometries(b.parts);geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,b.mat);b.parts.forEach(g=>g.dispose());mesh.receiveShadow=true;mesh.castShadow=true;mesh.updateMatrix();mesh.matrixAutoUpdate=false;if(b.ranges.length)mesh.userData.objectRanges=b.ranges;group.add(mesh);yield;}
}
// Roads are the terrain's own triangles, not floating intersecting ribbons.
// One surface also makes intersections a union instead of duplicate road meshes.
function roadColor(map,x,z){
 if(map.buildings.some(b=>Math.abs(x-b.x)<b.w/2+.4&&Math.abs(z-b.z)<b.d/2+.4))return null;
 for(const road of map.roads)for(let i=1;i<road.points.length;i++){
  const [ax,az]=road.points[i-1],[bx,bz]=road.points[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
  if(Math.hypot(x-ax-t*dx,z-az-t*dz)<=road.width/2)return road.kind==='runway'?0x34424a:road.kind==='taxiway'?0x56646b:road.kind==='path'?0x9d9275:0x687473;
 }
 return null;
}
function* buildTerrain(world,map){
 const t=map.terrain,material=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true});
 for(let cz=0;cz<t.n-1;cz+=32)for(let cx=0;cx<t.n-1;cx+=32){
  const positions=[],colors=[];
  for(let z=cz;z<Math.min(cz+32,t.n-1);z++){for(let x=cx;x<Math.min(cx+32,t.n-1);x++){
   const points=[[x,z],[x,z+1],[x+1,z],[x+1,z+1]].map(([ix,iz])=>[ix*t.cell-t.size,t.heights[iz*t.n+ix],iz*t.cell-t.size]);
   for(const triangle of [[0,1,2],[2,1,3]]){
    const wx=triangle.reduce((n,i)=>n+points[i][0],0)/3,wz=triangle.reduce((n,i)=>n+points[i][2],0)/3;
    const road=roadColor(map,wx,wz),c=new THREE.Color(road??terrainColor(map,wx,wz));
    if(road==null)c.multiplyScalar(1+Math.sin(wx*.07)*Math.sin(wz*.09)*.045);
    for(const i of triangle){positions.push(...points[i]);colors.push(c.r,c.g,c.b);}
   }
  }yield;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const m=new THREE.Mesh(geometry,material);m.receiveShadow=true;m.userData.ownedMaterial=true;world.add(m);yield;
 }
}
export function islandLabel(text,size=1){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
 const c=canvas.getContext('2d');c.font='800 34px system-ui';c.textAlign='center';c.lineWidth=8;c.strokeStyle='#23443ae6';c.fillStyle='#fff8de';c.strokeText(text.toUpperCase(),256,60);c.fillText(text.toUpperCase(),256,60);
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthWrite:false}));sprite.scale.set(24*size,4.5*size,1);return sprite;
}
export function buildIsland(world,map,kit){for(const _ of buildIslandSteps(world,map,kit)){} }
// Resumable construction lets warmup frames keep servicing input and sockets.
export function* buildIslandSteps(world,map,kit){
 if(map.id==='sunnybreak'){yield* streamedIslandSteps(world,map,kit);buildMapObjects(world,map,kit);return;}
 const {block,palette}=kit;
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshLambertMaterial({color:0x4195ad,transparent:true,opacity:.87}));ocean.rotation.x=-Math.PI/2;ocean.position.y=.5;ocean.userData.ownedMaterial=true;world.add(ocean);
 yield* buildTerrain(world,map);
 const byBuilding=map.buildings.map(()=>[]),treeBoxes=new Map(),propBoxes=new Map();
 for(const b of map.boxes){
  if(b.editorObject)continue;
  if(b.building!==undefined)byBuilding[b.building].push(b);
  if(b.tree!==undefined)treeBoxes.set(b.tree,b);
  if(b.prop!==undefined)propBoxes.set(b.prop,b);
  if(['tree','prop','roof-collider','door','parked-aircraft'].includes(b.kind))continue;
  const s=b.building===undefined?null:buildingStyle(map.buildings[b.building]);
  const color=s?(b.color==='floor'||b.color==='stair'?s.wood:b.color==='rail'||b.color==='lintel'?s.trim:b.color==='foundation'?0x8e988a:s.wall):typeof b.color==='number'?b.color:palette[b.color]||0x9cb7aa;
  const m=block(world,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color);m.userData.objectId=b.objectId;yield;
 }
 for(const [i,b] of map.buildings.entries()){if(b.editorHidden)continue;
  const start=world.children.length;dressBuilding(world,b,kit);
  for(const mesh of world.children.slice(start)){let closest=null,distance=Infinity;for(const o of byBuilding[i]){const d=(o.x-mesh.position.x)**2+(o.y+o.h/2-mesh.position.y)**2+(o.z-mesh.position.z)**2;if(d<distance){distance=d;closest=o;}}if(closest)mesh.userData.objectId=closest.objectId;}yield;
 }
 for(const [i,t]of map.trees.entries()){if(t.editorHidden)continue;const start=world.children.length;treeModel(world,t,kit);for(const mesh of world.children.slice(start))mesh.userData.objectId=treeBoxes.get(i)?.objectId;yield;}
 for(const [i,p]of map.props.entries()){if(p.editorHidden)continue;const start=world.children.length;propModel(world,p,kit);for(const mesh of world.children.slice(start))mesh.userData.objectId=propBoxes.get(i)?.objectId;yield;}
 yield* bakeSteps(world,true);buildMapObjects(world,map,kit);
 // Landmark names remain on the map; the world has no floating signs.
}
function* streamedIslandSteps(world,map,kit){
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshLambertMaterial({color:0x4195ad}));ocean.rotation.x=-Math.PI/2;ocean.position.y=.5;ocean.userData.ownedMaterial=true;world.add(ocean);
 yield* buildTerrain(world,map);
 const cells=new Map(),cellFor=(x,z)=>{const ix=Math.floor(x/64),iz=Math.floor(z/64),key=ix+':'+iz;if(!cells.has(key))cells.set(key,{key,x:(ix+.5)*64,z:(iz+.5)*64,radius:48,boxes:[],buildings:[],trees:[],props:[],coarse:new THREE.Group()});return cells.get(key);};
 for(const b of map.boxes){if(b.editorObject)continue;const parent=b.building===undefined?b:map.buildings[b.building];cellFor(parent.x,parent.z).boxes.push(b);}
 for(const b of map.buildings)if(!b.editorHidden)cellFor(b.x,b.z).buildings.push(b);
 for(const t of map.trees)if(!t.editorHidden)cellFor(t.x,t.z).trees.push(t);
 for(const p of map.props)if(!p.editorHidden)cellFor(p.x,p.z).props.push(p);
 const color=b=>{const s=b.building===undefined?null:buildingStyle(map.buildings[b.building]);return s?(b.color==='floor'||b.color==='stair'?s.wood:b.color==='rail'||b.color==='lintel'?s.trim:b.color==='foundation'?0x8e988a:s.wall):typeof b.color==='number'?b.color:kit.palette[b.color]||0x9cb7aa;};
 function* draw(cell,group,detail){
  for(const b of cell.boxes){if(['tree','prop','roof-collider','door','parked-aircraft'].includes(b.kind))continue;const m=kit.block(group,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color(b));m.userData.objectId=b.objectId;yield;}
  for(const b of cell.buildings){
   if(detail){const start=group.children.length;dressBuilding(group,b,kit);const boxes=cell.boxes.filter(o=>o.building!==undefined&&map.buildings[o.building]===b);for(const mesh of group.children.slice(start)){let best=null,d=Infinity;for(const o of boxes){const distance=(o.x-mesh.position.x)**2+(o.y+o.h/2-mesh.position.y)**2+(o.z-mesh.position.z)**2;if(distance<d){d=distance;best=o;}}if(best)mesh.userData.objectId=best.objectId;}}
   else if(b.roof==='gable'){const m=artKit(kit).cone(group,b.x,(b.baseY||0)+b.h+.8,b.z,Math.min(b.w,b.d)*.55,1.6,buildingStyle(b).roof);m.scale.z=b.d/Math.max(1,b.w);m.userData.objectId=cell.boxes.find(o=>o.building!==undefined&&map.buildings[o.building]===b&&o.color==='roof')?.objectId;}
   yield;
  }
  for(const t of cell.trees){const start=group.children.length;if(detail)treeModel(group,t,kit);else {kit.cylinder(group,t.x,t.y+t.h*.3,t.z,.22,t.h*.6,0x6b5946);artKit(kit).cone(group,t.x,t.y+t.h*.68,t.z,2.4,t.h*.6,t.kind==='autumn'?0xae8856:0x52775c);}
   const id=cell.boxes.find(b=>b.tree!==undefined&&map.trees[b.tree]===t)?.objectId;for(const m of group.children.slice(start))m.userData.objectId=id;yield;
  }
  for(const p of cell.props){const start=group.children.length;if(detail)repeatedProp(group,p,kit);else if(['dome','bio-dome','beacon','crane','drill','waterwheel','telescope','radar','dish','antenna'].includes(p.kind))propModel(group,p,kit);else{const b=cell.boxes.find(b=>b.prop!==undefined&&map.props[b.prop]===p);if(b&&Math.max(b.w,b.d,b.h)>2)kit.block(group,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color(b));}
   const id=cell.boxes.find(b=>b.prop!==undefined&&map.props[b.prop]===p)?.objectId;for(const m of group.children.slice(start))m.userData.objectId=id;yield;
  }
  yield* bakeSteps(group,false,true);
 }
 for(const cell of cells.values()){yield* draw(cell,cell.coarse,false);world.add(cell.coarse);yield;}
 const dispose=group=>{group.traverse(m=>{if(m.geometry&&!m.geometry.userData.shared)m.geometry.dispose();if(m.userData.ownedMaterial)m.material?.dispose();});group.clear();};
 const details=new WorldDetails(world,[...cells.values()],cell=>{const group=new THREE.Group();return {group,steps:draw(cell,group,true)};},dispose);world.userData.details=details;
}
function canopy(kit,color=0xffcf64){const g=gliderModel(kit,color);bake(g,false,true);return g;}
export class RoyaleView{
 constructor(view,kit){this.view=view;this.kit=kit;this.root=new THREE.Group();view.scene.add(this.root);this.chests=new Map();this.loot=new Map();this.gliders=new Map();this.pads=new Map();this.createTransport();this.createStorm();this.marker=null;this.fx=[];this.flightPoses=new Map();}
 createTransport(){
  const {block,ball,cylinder,rounded,beam}=artKit(this.kit),g=this.transport=new THREE.Group();g.name='Kestrel tiltrotor';this.root.add(g);
  // An original cargo tiltrotor: low graphite fuselage, swept wings and four
  // independent rotor nacelles. No balloon or borrowed Battle Bus silhouette.
  rounded(g,0,.1,-8.05,4.5,1.4,3.2,0x213946,.4);
  const windscreen=rounded(g,0,2.9,-8.03,4.1,1.2,2.1,0x244b58,.2);windscreen.rotation.x=-.32;
  for(const side of [-1,1]){beam(g,[side*1.7,1.6,-8.8],[side*1.2,3.4,-7.8],.1,0x172a35);rounded(g,side*2.8,.3,4.4,.2,1.9,2.2,0x4d686c,.06);block(g,side*2.92,.5,4.4,.04,.18,1.7,0xc4a66a);rounded(g,side*6.5,2.45,-3.6,1.8,1.4,2.65,0x25424d,.3);rounded(g,side*7.6,2.7,-1.2,.25,.16,.4,side<0?0xeb6558:0x69cfa8,.04);}
  rounded(g,0,-.6,7.05,4.2,.3,2.5,0x243b43,.12);for(let j=0;j<6;j++)block(g,0,-.42,6.1+j*.27,3.7,.04,.045,0x7c9190);
  rounded(g,0,1,0,5.8,3.8,13.6,0x334d58,.7);rounded(g,0,-.7,.4,4.7,.65,11.8,0x182d38,.22);
  rounded(g,0,1.3,-6.9,4.5,3.1,3.5,0x3c606b,.7);rounded(g,0,2,-8.5,3.7,1.4,.18,0x79b8c4,.18);
  block(g,0,2,-8.62,.12,1.4,.06,0x142e38);
  for(const side of [-1,1]){
   const wing=block(g,side*5.1,2.5,-.7,5.8,.3,4.1,0x425b63);wing.rotation.z=side*.04;wing.rotation.y=side*.14;
   block(g,side*2.93,1.6,1,.08,1.7,7.2,0x21343f);block(g,side*2.99,2.55,1,.1,.18,7.4,0xe2aa50);
   for(const z of [-2,0,2,4])rounded(g,side*2.97,2.04,z,.12,.6,1.3,0x81b1b6,.09);
   beam(g,[side*2,-.4,-4],[side*2,-1.3,-4],.18,0x1d303b);beam(g,[side*2,-.4,4],[side*2,-1.3,4],.18,0x1d303b);
   rounded(g,side*2,-1.35,0,.3,.24,11,0x182d38,.1);
   const tail=block(g,side*2.6,3.5,6.2,.22,4,3,0x456a70);tail.rotation.z=-side*.24;
   block(g,side*2.6,4.25,6.18,.28,.65,2.4,0xedae45);
  }
  block(g,0,2.5,6.3,7,.24,3.5,0x37545f);
  for(const x of [-1.7,1.7])ball(g,x,.4,-8.52,.24,.15,.1,0xf5e4bd);
  this.rotors=[];for(const x of [-6.5,6.5])for(const z of [-3.5,3.5]){
   rounded(g,x,2.55,z,1.6,1.25,2.2,0x1c3543,.25);cylinder(g,x,3.35,z,.28,.55,0xc69448,12);
   const rotor=new THREE.Group();rotor.position.set(x,3.7,z);
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3,m=rounded(rotor,Math.cos(a)*1.8,0,Math.sin(a)*1.8,3.7,.09,.32,0x192e3a,.035);m.rotation.y=-a;}
   bake(rotor,false,true);g.add(rotor);this.rotors.push(rotor);
  }
  bake(g,false,true);
 }
 createStorm(){
  const material=new THREE.ShaderMaterial({
   uniforms:{time:{value:0},outside:{value:0}},transparent:true,side:THREE.DoubleSide,depthWrite:false,forceSinglePass:true,
   vertexShader:`varying vec2 stormUv;void main(){stormUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
   fragmentShader:`uniform float time;uniform float outside;varying vec2 stormUv;
    void main(){float bands=pow(.5+.5*sin(stormUv.y*110.0-time*1.8+sin(stormUv.x*70.0+time*.3)),5.0);
    float veins=pow(.5+.5*sin(stormUv.x*360.0+sin(stormUv.y*22.0+time)*2.0),18.0);
    vec3 color=mix(vec3(.31,.31,.94),vec3(.57,.20,.84),outside);
    color=mix(color,vec3(.54,.84,1.0),bands*.65+veins*.22);
    gl_FragColor=vec4(color,.27+outside*.06+bands*.12+veins*.09);}`
  });
  this.wall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,240,256,1,true),material);this.wall.position.y=90;this.wall.userData.ownedMaterial=true;this.root.add(this.wall);
  this.ring=new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(160*3),3)),new THREE.LineBasicMaterial({color:0xc9a5ff}));this.ring.frustumCulled=false;this.ring.userData.ownedMaterial=true;this.root.add(this.ring);
 }
 itemModel(item,ground=true){
  const key=[item.id,item.rarity||0,item.weapon||false,item.resource||'',item.ammoType||'',ground].join(':');let template=lootTemplates.get(key);
  if(!template){const g=lootModel(item,this.kit,{ground});bake(g,false,true);if(lootTemplates.size>=192)return g;g.traverse(m=>{if(m.geometry)m.geometry.userData.shared=true;});lootTemplates.set(key,g);template=g;}
  const g=template.clone(true);g.traverse(m=>{m.userData.ownedMaterial=false;});return g;
 }
 updateCollectibles(r,observer,dt,t,time){
  const low=this.view.settings.quality==='low',lootRadius=low?45:70,chestRadius=low?70:100;
  if(!observer)return;
  if(!this.itemQuery||t>=this.itemQuery.at||this.itemQuery.version!==r.lootVersion||Math.hypot(observer.x-this.itemQuery.x,observer.z-this.itemQuery.z)>3||this.itemQuery.low!==low){
   const nearest=(a,b)=>(a.x-observer.x)**2+(a.z-observer.z)**2-(b.x-observer.x)**2-(b.z-observer.z)**2;
   this.itemQuery={at:t+.1,version:r.lootVersion,x:observer.x,z:observer.z,low,loot:nearbyItems(r,'loot',observer,lootRadius).sort(nearest).map(i=>i.uid),chests:[...new Set([...nearbyItems(r,'chests',observer,chestRadius).sort(nearest).map(c=>c.id),...r.chests.filter(c=>c.supply).map(c=>c.id)])]};
  }
  // Close objects arrive first, with bounded geometry work each frame.
  let created=0;const deadline=performance.now()+3;
  for(const id of this.itemQuery.loot){if(this.loot.has(id))continue;const item=itemById(r,'loot',id);if(!item)continue;if(created>=3||performance.now()>deadline)break;const mesh=this.itemModel(item);this.loot.set(id,mesh);this.root.add(mesh);created++;}
  for(const [id,mesh]of this.loot){
   const item=itemById(r,'loot',id),distance=item?Math.hypot(item.x-observer.x,item.z-observer.z):Infinity;
   if(distance>150){mesh.removeFromParent();this.view.disposeGroup(mesh);this.loot.delete(id);continue;}
   mesh.visible=distance<lootRadius;if(!mesh.visible)continue;
   mesh.position.set(item.x,lootHeight(item,time)+.24+Math.sin(t*1.65+item.uid)*.055,item.z);mesh.rotation.y=Math.sin(t*.55+item.uid)*.16;
   if(!item.motion&&item.spawnFrom&&time-item.spawnAt<.6){const age=Math.max(0,(time-item.spawnAt)/.6),ease=1-(1-age)**3;mesh.position.x=THREE.MathUtils.lerp(item.spawnFrom.x,item.x,ease);mesh.position.z=THREE.MathUtils.lerp(item.spawnFrom.z,item.z,ease);mesh.position.y=THREE.MathUtils.lerp(item.spawnFrom.y,item.y+.24,ease)+Math.sin(age*Math.PI)*.6;}
  }
  for(const id of this.itemQuery.chests){if(this.chests.has(id))continue;const chest=itemById(r,'chests',id);if(!chest)continue;if(created>=3||performance.now()>deadline)break;const mesh=this.chestModel(chest.supply,chest.epic);this.chests.set(id,mesh);this.root.add(mesh);created++;
   if(chest.supply){const rig=new THREE.Group(),c=canopy(this.kit,0x99dad9);c.position.y=1.5;rig.add(c);for(const x of [-.6,.6])for(const z of [-.4,.4])artKit(this.kit).beam(rig,[x,1.2,z],[Math.sign(x)*.72,3.7,.1],.018,0xf5ead2);bake(rig,false,true);mesh.add(rig);mesh.userData.canopy=rig;}
  }
  for(const [id,mesh]of this.chests){
   const chest=itemById(r,'chests',id),distance=chest?Math.hypot(chest.x-observer.x,chest.z-observer.z):Infinity;
   if(!chest||!chest.supply&&distance>180){mesh.removeFromParent();this.view.disposeGroup(mesh);this.chests.delete(id);continue;}
   mesh.visible=distance<chestRadius||!!chest.supply;if(!mesh.visible)continue;
   const fall=chest.landAt?Math.max(0,(chest.landAt-time)*4):0;mesh.position.set(chest.x,lootHeight(chest,time)+fall,chest.z);if(mesh.userData.canopy)mesh.userData.canopy.visible=fall>0;
   mesh.userData.lid.rotation.x+=((chest.opened?-1.7:0)-mesh.userData.lid.rotation.x)*Math.min(1,dt*8);
  }
 }
 chestModel(supply=false,epic=false){const g=chestModel(this.kit,supply,epic);bake(g.userData.lid,false,true);bake(g,false,true);return g;}
 update(state,local,dt,playing){
  this.root.visible=playing&&!!state?.royale;if(!this.root.visible)return;
  const r=state.royale,t=this.view.clock,kit=this.kit;
  this.seasonMeshes??=new Map();const activeSeason=new Set();
  for(const s of [...state.players.filter(p=>p.bossWindup).map(p=>({id:p.id,x:p.x,y:p.y+.06,z:p.z,kind:'telegraph'})),...state.players.filter(p=>p.bossVeil).map(p=>({id:p.id,x:p.x,y:p.y+1.55,z:p.z,goal:p.bossVeil.goal,kind:'laser'})),...(r.smokes||[]).map(x=>({...x,kind:'smoke'})),...(r.relays||[]).map(x=>({...x,kind:'relay'}))]){const key=s.kind+s.id;activeSeason.add(key);let mesh=this.seasonMeshes.get(key);if(!mesh){if(s.kind==='laser'){mesh=new THREE.Group();const line=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3)),new THREE.LineBasicMaterial({color:0xff554c,transparent:true,opacity:.9}));line.frustumCulled=false;line.userData.ownedMaterial=true;const marker=new THREE.Mesh(new THREE.RingGeometry(.18,.3,16),new THREE.MeshBasicMaterial({color:0xff554c,side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.userData.ownedMaterial=true;mesh.add(line,marker);}else if(s.kind==='telegraph'){mesh=new THREE.Mesh(new THREE.RingGeometry(1.1,1.35,24),new THREE.MeshBasicMaterial({color:0xffc563,transparent:true,opacity:.8,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;}else if(s.kind==='smoke'){mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshBasicMaterial({color:0xc1c6bb,transparent:true,opacity:.94,depthWrite:false}));mesh.userData.ownedMaterial=true;mesh.scale.setScalar(s.radius);}else{const g=new THREE.Group(),k=artKit(this.kit);k.rounded(g,0,.6,0,.75,1.2,.6,0x304b54,.06);k.rounded(g,0,1.05,-.32,.5,.3,.06,0x65d6c8,.02);k.beam(g,[0,1.2,0],[0,4,0],.045,0xa7c2bd);k.torus(g,0,3.5,0,.4,.04,0xdfb567);bake(g,false,true);mesh=g;}this.root.add(mesh);this.seasonMeshes.set(key,mesh);}mesh.position.set(s.x,s.y,s.z);if(s.kind==='laser'){const a=mesh.children[0].geometry.attributes.position;a.setXYZ(0,0,0,0);a.setXYZ(1,s.goal.x-s.x,s.goal.y+.08-s.y,s.goal.z-s.z);a.needsUpdate=true;mesh.children[1].position.set(s.goal.x-s.x,s.goal.y+.08-s.y,s.goal.z-s.z);}if(s.kind==='smoke'){mesh.rotation.y=t*.04;mesh.material.opacity=Math.min(.94,(s.until-state.time)*.8);}}
  for(const [key,m]of this.seasonMeshes)if(!activeSeason.has(key)){m.removeFromParent();this.view.disposeGroup(m);this.seasonMeshes.delete(key);}
  this.cacheMeshes??=new Map();
  for(const cache of r.bossCaches||[]){let mesh=this.cacheMeshes.get(cache.id);if(!mesh){mesh=this.chestModel(false,true);this.root.add(mesh);this.cacheMeshes.set(cache.id,mesh);}mesh.position.set(cache.x,cache.y,cache.z);mesh.visible=!cache.opened;}
  this.view.lastStateTime=state.time;updateBuildingView(this,state,local);updateFrontierView(this,state,local);
  const roundKey=r.matchId+':'+state.round+':'+state.options.map;
  if(this.round!==roundKey){for(const group of [this.chests,this.loot,this.gliders,this.pads]){for(const mesh of group.values()){this.root.remove(mesh);this.view.disposeGroup(mesh);}group.clear();}this.round=roundKey;this.itemQuery=null;this.flightPoses.clear();for(const mesh of this.cacheMeshes.values()){mesh.removeFromParent();this.view.disposeGroup(mesh);}this.cacheMeshes.clear();}
  this.transport.visible=r.practice||r.elapsed<=r.route.duration+5;
  const pos=r.practice?getMap(state.options.map).parkedTransport:transportAt(r.route,r.elapsed);if(pos){this.transport.position.set(pos.x,pos.y+(r.practice?0:Math.sin(t)*.18),pos.z);this.transport.rotation.y=pos.yaw;this.transport.rotation.z=r.practice?0:Math.sin(t*.4)*.015;}this.rotors.forEach(m=>m.rotation.y+=dt*(r.practice?.15:18));
  this.wall.visible=this.ring.visible=r.storm.active;this.wall.position.set(r.storm.x,110,r.storm.z);this.wall.scale.set(Math.max(.01,r.storm.radius),1,Math.max(.01,r.storm.radius));this.wall.material.uniforms.time.value=t;this.wall.material.uniforms.outside.value=local&&Math.hypot(local.x-r.storm.x,local.z-r.storm.z)>r.storm.radius?1:0;if(r.storm.active&&(!this.nextRingUpdate||t>this.nextRingUpdate)){const a=this.ring.geometry.attributes.position;for(let i=0;i<a.count;i++){const angle=i/a.count*Math.PI*2,x=r.storm.x+Math.cos(angle)*r.storm.radius,z=r.storm.z+Math.sin(angle)*r.storm.radius;a.setXYZ(i,x,groundAt(ROYALE_MAP,x,z)+.14,z);}a.needsUpdate=true;this.nextRingUpdate=t+.15;}
  const observer=local?.spectating?state.players.find(p=>p.id===this.view.spectateTarget)||local:local;
  const revision=this.view.world.userData.geometryRevision;this.view.world.userData.details?.update(observer,{quality:this.view.settings.quality,scoped:!!observer?.aim&&this.view.scopeActive,time:t});if(revision!==this.view.world.userData.geometryRevision)updateWorldDamage(this.view.world,r.worldDamage,r.matchId+':'+state.round+':'+r.buildVersion);
  this.updateCollectibles(r,observer,dt,t,state.time);
  for(const p of state.players){
   let mesh=this.gliders.get(p.id);const style=(p.glider||'')+':'+(p.trail||'');
   if(mesh&&mesh.userData.style!==style){this.root.remove(mesh);this.view.disposeGroup(mesh);this.gliders.delete(p.id);mesh=null;}
   const close=!!observer&&Math.hypot(p.x-observer.x,p.z-observer.z)<(this.view.settings.quality==='low'?220:360);
   if(!mesh&&close&&['dive','glide'].includes(p.flight)){mesh=new THREE.Group();const sail=shopItem(p.glider)?makeShopGlider(p.glider):canopy(kit),trail=makeShopTrail(p.trail);mesh.add(sail,trail);Object.assign(mesh.userData,{sail,trail,style});this.gliders.set(p.id,mesh);this.root.add(mesh);}
   if(mesh){mesh.visible=close&&p.health>0;if(!mesh.visible)continue;const interval=observer&&Math.hypot(p.x-observer.x,p.z-observer.z)>100?.1:0;if(t<(mesh.userData.poseAt||0)){mesh.position.set(p.x,p.y,p.z);continue;}const poseDt=Math.min(.15,t-(mesh.userData.poseClock??t-dt));mesh.userData.poseClock=t;mesh.userData.poseAt=t+interval;const pose=this.flightPose(p,t,poseDt);mesh.visible=p.health>0&&pose.air>.025;mesh.userData.sail.visible=pose.glide>.025;mesh.userData.sail.scale.setScalar(Math.max(.01,pose.glide));mesh.userData.trail.scale.y=(1+Math.sin(t*5)*.04)*pose.air;mesh.position.set(p.x,p.y+pose.bob,p.z);mesh.rotation.set(pose.pitch,pose.yaw,pose.roll);}
  }
  const padIds=new Set();for(const p of r.pads){padIds.add(p.id);let mesh=this.pads.get(p.id);if(!mesh){mesh=launchpadModel(kit);bake(mesh);this.root.add(mesh);this.pads.set(p.id,mesh);}mesh.position.set(p.x,p.y,p.z);mesh.scale.setScalar(1+Math.sin(t*3)*.035);}
  for(const [id,m]of this.pads)if(!padIds.has(id)){this.root.remove(m);this.view.disposeGroup(m);this.pads.delete(id);}
  for(let i=this.fx.length-1;i>=0;i--){const fx=this.fx[i];fx.age+=dt;fx.mesh.scale.setScalar(1+fx.age*9);fx.mesh.material.opacity=Math.max(0,.8-fx.age);if(fx.age>.8){this.view.renderPool.release(fx.mesh);this.fx.splice(i,1);}}
  if(this.view.waypoint){if(!this.marker){this.marker=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,90,8),new THREE.MeshBasicMaterial({color:0xffe59c,transparent:true,opacity:.5,depthWrite:false}));this.marker.userData.ownedMaterial=true;this.root.add(this.marker);}this.marker.visible=true;this.marker.position.set(this.view.waypoint.x,groundAt(ROYALE_MAP,this.view.waypoint.x,this.view.waypoint.z)+45,this.view.waypoint.z);}else if(this.marker)this.marker.visible=false;
 }
 event(e){
  if(!this.root.visible)return;
  if(e.type==='royale-fx'||e.type==='royale-cue'&&['shield-break','complete-splash','launch','chest-open'].includes(e.cue)){
   const color=e.kind==='splash'||e.cue==='complete-splash'?0x73e8d4:e.cue==='chest-open'?0xffd574:0xb6a5ff;
   const ring=this.view.renderPool.acquire('royale-ring',()=>new THREE.Mesh(new THREE.TorusGeometry(.5,.045,6,40),new THREE.MeshBasicMaterial({transparent:true,opacity:.8,depthWrite:false})));ring.material.color.setHex(color);ring.material.opacity=.8;ring.rotation.x=Math.PI/2;ring.position.set(e.x||0,(e.y||0)+.3,e.z||0);ring.userData.ownedMaterial=true;this.root.add(ring);this.fx.push({mesh:ring,age:0});
  }
 }
 flightPose(p,t,dt=this.poseDt||1/60){
  const cached=this.flightPoses.get(p.id);if(cached?.time===t)return cached.pose;
  const pose=glidePose(cached?.pose,p,dt,t);this.flightPoses.set(p.id,{time:t,pose});return pose;
 }
 animateActor(model,p,t,dt=1/60){
  this.poseDt=dt;const pose=this.flightPose(p,t,dt);
  const flying=p.flight==='dive'||p.flight==='glide'||p.flight==='launch';
  if(model.userData.held)model.userData.held.visible=p.health>0&&!p.downed&&!p.reviving&&model.userData.draw?.visible!==false&&!p.emote&&!p.building&&!p.traversal&&!flying&&!!p.inventory?.[p.slot]&&(!!p.inventory[p.slot].weapon||!!p.inventory[p.slot].pickaxe);
  if(model.userData.blaster)model.userData.blaster.visible=!p.building&&!flying&&!!p.inventory?.[p.slot]?.weapon;
  const item=p.building?{id:'blueprint'}:p.inventory?.[p.slot];
  const itemKey=p.health>0&&!p.downed&&!p.reviving&&!p.emote&&!flying&&item&&!item.weapon&&!item.pickaxe?item.id:null;
  if(model.userData.utilityKey!==itemKey){if(model.userData.utility){model.userData.utility.removeFromParent();this.view.disposeGroup(model.userData.utility);}model.userData.utility=null;model.userData.utilityKey=itemKey;if(itemKey){const prop=this.itemModel(item,false);prop.scale.setScalar(.6);prop.position.set(.36,.7,-.35);model.add(prop);model.userData.utility=prop;}}
  if(model.userData.utility){model.userData.utility.position.y=p.use?1.15+Math.sin(t*7)*.02:.7;if(item?.pickaxe){const swing=Math.max(0,1-(this.view.lastStateTime-(p.swingAt??-100))/.45);model.userData.utility.rotation.x=-Math.sin(swing*Math.PI)*1.5;}}

  if(pose.air>.01){model.rotation.y=pose.yaw;model.rotation.x=model.rotation.x*(1-pose.air)+pose.pitch;model.rotation.z=model.rotation.z*(1-pose.air)+pose.roll;model.position.y+=pose.bob;}

  if(p.place===1&&p.health>0)model.userData.victory=true;
 }
}
