import {glidePose} from './glide-pose.js';
import {lootHeight} from './loot-motion.js';
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

export function bake(group,chunked=false,colored=chunked){
 group.updateMatrixWorld(true);const batches=new Map();
 for(const o of [...group.children])if(o.isMesh&&!o.userData.ownedMaterial&&!o.userData.keepDynamic){
  const key=(colored?'color':o.material.uuid)+(chunked?':'+Math.floor(o.position.x/64)+':'+Math.floor(o.position.z/64):'');if(!batches.has(key))batches.set(key,{mat:colored?bakedMaterial:o.material,parts:[],ranges:[],vertices:0});
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);
  if(colored){g.deleteAttribute('uv');if(!g.attributes.color){const colors=new Float32Array(g.attributes.position.count*3),c=o.material.color;for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));}}
  const batch=batches.get(key);if(o.userData.objectId)batch.ranges.push({id:o.userData.objectId,start:batch.vertices,count:g.attributes.position.count});batch.vertices+=g.attributes.position.count;batch.parts.push(g);group.remove(o);
  if(o.geometry.type==='CylinderGeometry'&&!o.geometry.userData.shared)o.geometry.dispose();
 }
 for(const b of batches.values()){const geometry=mergeGeometries(b.parts);geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,b.mat);b.parts.forEach(g=>g.dispose());mesh.receiveShadow=true;mesh.castShadow=true;if(b.ranges.length)mesh.userData.objectRanges=b.ranges;group.add(mesh);}
}
// Roads are the terrain's own triangles, not floating intersecting ribbons.
// One surface also makes intersections a union instead of duplicate road meshes.
function roadColor(map,x,z){
 if(map.buildings.some(b=>Math.abs(x-b.x)<b.w/2+.4&&Math.abs(z-b.z)<b.d/2+.4))return null;
 for(const road of map.roads)for(let i=1;i<road.points.length;i++){
  const [ax,az]=road.points[i-1],[bx,bz]=road.points[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
  if(Math.hypot(x-ax-t*dx,z-az-t*dz)<=road.width/2)return road.kind==='path'?0xb8aa81:0x7d8987;
 }
 return null;
}
function buildTerrain(world,map){
 const t=map.terrain,material=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true});
 for(let cz=0;cz<t.n-1;cz+=32)for(let cx=0;cx<t.n-1;cx+=32){
  const positions=[],colors=[];
  for(let z=cz;z<Math.min(cz+32,t.n-1);z++)for(let x=cx;x<Math.min(cx+32,t.n-1);x++){
   const points=[[x,z],[x,z+1],[x+1,z],[x+1,z+1]].map(([ix,iz])=>[ix*t.cell-t.size,t.heights[iz*t.n+ix],iz*t.cell-t.size]);
   for(const triangle of [[0,1,2],[2,1,3]]){
    const wx=triangle.reduce((n,i)=>n+points[i][0],0)/3,wz=triangle.reduce((n,i)=>n+points[i][2],0)/3;
    const road=roadColor(map,wx,wz),c=new THREE.Color(road??terrainColor(map,wx,wz));
    if(road==null)c.multiplyScalar(1+Math.sin(wx*.07)*Math.sin(wz*.09)*.045);
    for(const i of triangle){positions.push(...points[i]);colors.push(c.r,c.g,c.b);}
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const m=new THREE.Mesh(geometry,material);m.receiveShadow=true;m.userData.ownedMaterial=true;world.add(m);
 }
}
export function islandLabel(text,size=1){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
 const c=canvas.getContext('2d');c.font='800 34px system-ui';c.textAlign='center';c.lineWidth=8;c.strokeStyle='#23443ae6';c.fillStyle='#fff8de';c.strokeText(text.toUpperCase(),256,60);c.fillText(text.toUpperCase(),256,60);
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthWrite:false}));sprite.scale.set(24*size,4.5*size,1);return sprite;
}
export function buildIsland(world,map,kit){
 const {block,palette}=kit;
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshLambertMaterial({color:0x4195ad,transparent:true,opacity:.87}));ocean.rotation.x=-Math.PI/2;ocean.position.y=.5;ocean.userData.ownedMaterial=true;world.add(ocean);
 buildTerrain(world,map);
 const byBuilding=map.buildings.map(()=>[]),treeBoxes=new Map(),propBoxes=new Map();
 for(const b of map.boxes){
  if(b.building!==undefined)byBuilding[b.building].push(b);
  if(b.tree!==undefined)treeBoxes.set(b.tree,b);
  if(b.prop!==undefined)propBoxes.set(b.prop,b);
  if(['tree','prop','roof-collider'].includes(b.kind))continue;
  const s=b.building===undefined?null:buildingStyle(map.buildings[b.building]);
  const color=s?(b.color==='floor'||b.color==='stair'?s.wood:b.color==='rail'||b.color==='lintel'?s.trim:b.color==='foundation'?0x8e988a:s.wall):palette[b.color]||0x9cb7aa;
  const m=block(world,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color);m.userData.objectId=b.objectId;
 }
 for(const [i,b] of map.buildings.entries()){
  const start=world.children.length;dressBuilding(world,b,kit);
  for(const mesh of world.children.slice(start)){let closest=null,distance=Infinity;for(const o of byBuilding[i]){const d=(o.x-mesh.position.x)**2+(o.y+o.h/2-mesh.position.y)**2+(o.z-mesh.position.z)**2;if(d<distance){distance=d;closest=o;}}if(closest)mesh.userData.objectId=closest.objectId;}
 }
 for(const [i,t]of map.trees.entries()){const start=world.children.length;treeModel(world,t,kit);for(const mesh of world.children.slice(start))mesh.userData.objectId=treeBoxes.get(i)?.objectId;}
 for(const [i,p]of map.props.entries()){const start=world.children.length;propModel(world,p,kit);for(const mesh of world.children.slice(start))mesh.userData.objectId=propBoxes.get(i)?.objectId;}
 bake(world,true);
 // World names are separate from the small diegetic signs and only visible during the drop.
 for(const p of map.districts){const label=islandLabel(p.name);label.position.set(p.x,groundAt(map,p.x,p.z)+19,p.z);label.userData.poiLabel=true;world.add(label);}
 for(const sign of map.signs){const label=islandLabel(sign.text,.16);label.position.set(sign.x,sign.y,sign.z);label.userData.detailLabel=true;label.visible=false;world.add(label);}
}
function canopy(kit,color=0xffcf64){const g=gliderModel(kit,color);bake(g,false,true);return g;}
export class RoyaleView{
 constructor(view,kit){this.view=view;this.kit=kit;this.root=new THREE.Group();view.scene.add(this.root);this.chests=new Map();this.loot=new Map();this.gliders=new Map();this.pads=new Map();this.createTransport();this.createStorm();this.marker=null;this.fx=[];this.flightPoses=new Map();}
 createTransport(){
  const {block,ball,cylinder,rounded,beam}=artKit(this.kit),g=this.transport=new THREE.Group();g.name='Kestrel tiltrotor';this.root.add(g);
  // An original cargo tiltrotor: low graphite fuselage, swept wings and four
  // independent rotor nacelles. No balloon or borrowed Battle Bus silhouette.
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
  const title=islandLabel('KESTREL / R-04',.33);title.position.set(0,4.2,0);g.add(title);
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
 itemModel(item,ground=true){const g=lootModel(item,this.kit,{ground});bake(g,false,true);return g;}
 chestModel(supply=false){const g=chestModel(this.kit,supply);bake(g.userData.lid,false,true);bake(g,false,true);return g;}
 update(state,local,dt,playing){
  this.root.visible=playing&&!!state?.royale;if(!this.root.visible)return;
  const r=state.royale,t=this.view.clock,kit=this.kit;
  this.view.lastStateTime=state.time;updateBuildingView(this,state,local);
  const roundKey=r.matchId+':'+state.round+':'+state.options.map;
  if(this.round!==roundKey){for(const group of [this.chests,this.loot,this.gliders,this.pads]){for(const mesh of group.values()){this.root.remove(mesh);this.view.disposeGroup(mesh);}group.clear();}this.round=roundKey;this.flightPoses.clear();}
  this.transport.visible=!r.practice&&r.elapsed<=r.route.duration+5;
  const pos=transportAt(r.route,r.elapsed);this.transport.position.set(pos.x,pos.y+Math.sin(t)*.18,pos.z);this.transport.rotation.y=pos.yaw;this.transport.rotation.z=Math.sin(t*.4)*.015;this.rotors.forEach(m=>m.rotation.y+=dt*18);
  this.wall.visible=this.ring.visible=r.storm.active;this.wall.position.set(r.storm.x,110,r.storm.z);this.wall.scale.set(Math.max(.01,r.storm.radius),1,Math.max(.01,r.storm.radius));this.wall.material.uniforms.time.value=t;this.wall.material.uniforms.outside.value=local&&Math.hypot(local.x-r.storm.x,local.z-r.storm.z)>r.storm.radius?1:0;if(r.storm.active&&(!this.nextRingUpdate||t>this.nextRingUpdate)){const a=this.ring.geometry.attributes.position;for(let i=0;i<a.count;i++){const angle=i/a.count*Math.PI*2,x=r.storm.x+Math.cos(angle)*r.storm.radius,z=r.storm.z+Math.sin(angle)*r.storm.radius;a.setXYZ(i,x,groundAt(ROYALE_MAP,x,z)+.14,z);}a.needsUpdate=true;this.nextRingUpdate=t+.15;}
  const observer=local?.spectating?state.players.find(p=>p.id===this.view.spectateTarget)||local:local;
  for(const mesh of this.view.world?.children||[])if(mesh.userData.poiLabel||mesh.userData.detailLabel)mesh.visible=!!observer&&(mesh.userData.poiLabel?observer.flight!=='ground'&&observer.health>0:Math.hypot(mesh.position.x-observer.x,mesh.position.z-observer.z)<35);
  const seen=new Set();
  for(const item of r.loot){
   seen.add(item.uid);let mesh=this.loot.get(item.uid);
   const close=observer&&Math.hypot(item.x-observer.x,item.z-observer.z)<(this.view.settings.quality==='low'?45:70);
   if(!mesh&&close){mesh=this.itemModel(item);this.loot.set(item.uid,mesh);this.root.add(mesh);}
   if(mesh){mesh.visible=!!close;mesh.position.set(item.x,lootHeight(item,state.time)+.24+Math.sin(t*1.65+item.uid)*.055,item.z);mesh.rotation.y=Math.sin(t*.55+item.uid)*.16;if(!item.motion&&item.spawnFrom&&state.time-item.spawnAt<.6){const age=Math.max(0,(state.time-item.spawnAt)/.6),ease=1-(1-age)**3;mesh.position.x=THREE.MathUtils.lerp(item.spawnFrom.x,item.x,ease);mesh.position.z=THREE.MathUtils.lerp(item.spawnFrom.z,item.z,ease);mesh.position.y=THREE.MathUtils.lerp(item.spawnFrom.y,item.y+.24,ease)+Math.sin(age*Math.PI)*.6;}}
  }
  for(const [id,m]of this.loot)if(!seen.has(id)){this.root.remove(m);this.view.disposeGroup(m);this.loot.delete(id);}
  for(const chest of r.chests){
   const close=!!observer&&(Math.hypot(chest.x-observer.x,chest.z-observer.z)<(this.view.settings.quality==='low'?70:100)||chest.supply);
   let mesh=this.chests.get(chest.id);if(!mesh&&!close)continue;if(!mesh){mesh=this.chestModel(chest.supply);this.chests.set(chest.id,mesh);this.root.add(mesh);if(chest.supply){const rig=new THREE.Group(),c=canopy(kit,0x99dad9);c.position.y=1.5;rig.add(c);for(const x of [-.6,.6])for(const z of [-.4,.4])artKit(kit).beam(rig,[x,1.2,z],[Math.sign(x)*.72,3.7,.1],.018,0xf5ead2);bake(rig,false,true);mesh.add(rig);mesh.userData.canopy=rig;}}
   const fall=chest.landAt?Math.max(0,(chest.landAt-state.time)*4):0;mesh.position.set(chest.x,lootHeight(chest,state.time)+fall,chest.z);
   if(mesh.userData.canopy)mesh.userData.canopy.visible=fall>0;
   mesh.userData.lid.rotation.x+=((chest.opened?-1.7:0)-mesh.userData.lid.rotation.x)*Math.min(1,dt*8);

   mesh.visible=close;
  }
  for(const p of state.players){
   let mesh=this.gliders.get(p.id);const style=(p.glider||'')+':'+(p.trail||'');
   if(mesh&&mesh.userData.style!==style){this.root.remove(mesh);this.view.disposeGroup(mesh);this.gliders.delete(p.id);mesh=null;}
   if(!mesh&&['dive','glide'].includes(p.flight)){mesh=new THREE.Group();const sail=shopItem(p.glider)?makeShopGlider(p.glider):canopy(kit),trail=makeShopTrail(p.trail);mesh.add(sail,trail);Object.assign(mesh.userData,{sail,trail,style});this.gliders.set(p.id,mesh);this.root.add(mesh);}
   if(mesh){const pose=this.flightPose(p,t,dt);mesh.visible=p.health>0&&pose.air>.025;mesh.userData.sail.visible=pose.glide>.025;mesh.userData.sail.scale.setScalar(Math.max(.01,pose.glide));mesh.userData.trail.scale.y=(1+Math.sin(t*5)*.04)*pose.air;mesh.position.set(p.x,p.y+pose.bob,p.z);mesh.rotation.set(pose.pitch*.23,pose.yaw,pose.roll*.5);}
  }
  const padIds=new Set();for(const p of r.pads){padIds.add(p.id);let mesh=this.pads.get(p.id);if(!mesh){mesh=launchpadModel(kit);bake(mesh);this.root.add(mesh);this.pads.set(p.id,mesh);}mesh.position.set(p.x,p.y,p.z);mesh.scale.setScalar(1+Math.sin(t*3)*.035);}
  for(const [id,m]of this.pads)if(!padIds.has(id)){this.root.remove(m);this.view.disposeGroup(m);this.pads.delete(id);}
  for(let i=this.fx.length-1;i>=0;i--){const fx=this.fx[i];fx.age+=dt;fx.mesh.scale.setScalar(1+fx.age*9);fx.mesh.material.opacity=Math.max(0,.8-fx.age);if(fx.age>.8){this.root.remove(fx.mesh);fx.mesh.geometry.dispose();fx.mesh.material.dispose();this.fx.splice(i,1);}}
  if(this.view.waypoint){if(!this.marker){this.marker=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,90,8),new THREE.MeshBasicMaterial({color:0xffe59c,transparent:true,opacity:.5,depthWrite:false}));this.marker.userData.ownedMaterial=true;this.root.add(this.marker);}this.marker.visible=true;this.marker.position.set(this.view.waypoint.x,groundAt(ROYALE_MAP,this.view.waypoint.x,this.view.waypoint.z)+45,this.view.waypoint.z);}else if(this.marker)this.marker.visible=false;
 }
 event(e){
  if(!this.root.visible)return;
  if(e.type==='royale-fx'||e.type==='royale-cue'&&['shield-break','complete-splash','launch','chest-open'].includes(e.cue)){
   const color=e.kind==='splash'||e.cue==='complete-splash'?0x73e8d4:e.cue==='chest-open'?0xffd574:0xb6a5ff;
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.5,.045,6,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.set(e.x||0,(e.y||0)+.3,e.z||0);ring.userData.ownedMaterial=true;this.root.add(ring);this.fx.push({mesh:ring,age:0});
  }
 }
 flightPose(p,t,dt=this.poseDt||1/60){
  const cached=this.flightPoses.get(p.id);if(cached?.time===t)return cached.pose;
  const pose=glidePose(cached?.pose,p,dt,t);this.flightPoses.set(p.id,{time:t,pose});return pose;
 }
 animateActor(model,p,t,dt=1/60){
  this.poseDt=dt;const pose=this.flightPose(p,t,dt);
  const flying=p.flight==='dive'||p.flight==='glide'||p.flight==='launch';
  if(model.userData.held)model.userData.held.visible=!p.building&&!flying&&!!p.inventory?.[p.slot]&&(!!p.inventory[p.slot].weapon||!!p.inventory[p.slot].pickaxe);
  if(model.userData.blaster)model.userData.blaster.visible=!p.building&&!flying&&!!p.inventory?.[p.slot]?.weapon;
  const item=p.building?{id:'blueprint'}:p.inventory?.[p.slot];
  const itemKey=!flying&&item&&!item.weapon&&!item.pickaxe?item.id:null;
  if(model.userData.utilityKey!==itemKey){if(model.userData.utility){model.userData.utility.removeFromParent();this.view.disposeGroup(model.userData.utility);}model.userData.utility=null;model.userData.utilityKey=itemKey;if(itemKey){const prop=this.itemModel(item,false);prop.scale.setScalar(.6);prop.position.set(.36,.7,-.35);model.add(prop);model.userData.utility=prop;}}
  if(model.userData.utility){model.userData.utility.position.y=p.use?1.15+Math.sin(t*7)*.02:.7;if(item?.pickaxe){const swing=Math.max(0,1-(this.view.lastStateTime-(p.swingAt??-100))/.45);model.userData.utility.rotation.x=-Math.sin(swing*Math.PI)*1.5;}}

  if(pose.air>.01){model.rotation.x=model.rotation.x*(1-pose.air)+pose.pitch;model.rotation.z=model.rotation.z*(1-pose.air)+pose.roll;model.position.y+=pose.bob;}

  if(p.place===1&&p.health>0)model.userData.victory=true;
 }
}
