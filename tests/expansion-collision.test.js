import test from 'node:test';
import assert from 'node:assert/strict';
import {ROYALE_MAP} from '../src/royale-map.js';
import {baseObjects,sourceRecord,compileLayout,emptyLayout} from '../src/map-layout.js';
import {doorFrame} from '../src/world-rules.js';
import {doorNear,setDoor} from '../src/frontier-world.js';
import {movePlayer,canStand,worldHit,invalidateCollision,RADIUS} from '../src/physics.js';
import {groundAt} from '../src/terrain.js';
import {resetStance} from '../src/stance.js';
import {applyBuildState,resetBuilding} from '../src/building.js';
import {initializeFrontier} from '../src/frontier-world.js';
import {RoyaleSimulation} from '../src/royale.js';
import {cameraDistance,cameraNearPlane,smoothCameraDistance,CAMERA_RADIUS} from '../src/camera-collision.js';
import {validateMapGeometry,validateMapGeometryAsync} from '../src/map-validation.js';
import * as THREE from 'three';
import {buildMapObjects,disposeMapGroup} from '../src/map-object-view.js';
import {worldKit} from '../src/view.js';

const flat=()=>({id:'flat',size:100,theme:'royale',boxes:[],doors:[],spawns:[[-8,0],[8,0]],chests:[],floorLoot:[]});
const person=(point={})=>{const p={x:0,y:0,z:0,health:100,yaw:0,pitch:0,grounded:true,flight:'ground',vy:0,vx:0,vz:0,inventory:[{id:'pickaxe',pickaxe:true}],slot:0,...point};resetStance(p);return p;};
const layout=objects=>({...emptyLayout('sunnybreak'),objects});

for(const hz of [20,60])test(`all 122 ordinary doorways are traversable from both sides at ${hz} Hz`,()=>{
 const map={...ROYALE_MAP,boxes:ROYALE_MAP.boxes.filter(b=>!b.doorId)},doors=map.doors.filter(d=>!d.vault);assert.equal(doors.length,122);
 for(const door of doors)for(const side of [-1,1])for(const offset of [-.75,0,.75]){
  const p=person({x:door.x+offset,y:door.y,z:door.z+side*1.8,yaw:side>0?0:Math.PI});
  assert.ok(canStand(map,p),`${door.id} ${side} ${offset} entry`);
  for(let i=0;i<Math.ceil(.85*hz);i++)movePlayer(p,{forward:1,yaw:p.yaw},map,1/hz);
  assert.ok((p.z-door.z)*side<-.7,`${door.id} ${side} ${offset} stalled at ${p.z-door.z}`);
 }
});
test('diagonal approach slides along a narrow frame into its clear opening',()=>{
 const map=flat();map.boxes=[{x:-2.5,y:0,z:0,w:4,h:3,d:.25},{x:2.5,y:0,z:0,w:4,h:3,d:.25}];
 for(const hz of [20,60]){
  const p=person({x:.55,z:1.2});for(let i=0;i<hz*.7;i++)movePlayer(p,{forward:1,strafe:-.25,yaw:0},map,1/hz);
  assert.ok(p.z<-.5,JSON.stringify(p));assert.ok(canStand(map,p));
 }
});
for(const rotation of [0,90,180,270])test(`edited and copied buildings keep matching doors at ${rotation} degrees`,()=>{
 const base=ROYALE_MAP,src=baseObjects(base).find(o=>o.id==='building-0'),original=sourceRecord(src);
 for(const copy of [false,true]){
  const r={...original,id:copy?'copy-house':original.id,position:[src.position[0]+40,src.position[1]+2,src.position[2]+40],rotation,scale:[1.5,1.2,.8]};
  const map=compileLayout(base,layout([r])),doors=map.doors.filter(d=>d.editorObject===r.id);assert.equal(doors.length,2);
  for(const d of doors){
   const b=map.boxes.find(b=>b.doorId===d.id);assert.ok(b);assert.equal(map.boxes.filter(b=>b.doorId===d.id).length,1);
   for(const key of ['x','y','z','w','h','d'])assert.ok(Math.abs(d[key]-b[key])<1e-9,key);
   assert.equal(b.objectId,'world-door-'+d.id);
   const frame=doorFrame(d),cx=frame.x+Math.cos(frame.yaw)*frame.width/2,cz=frame.z-Math.sin(frame.yaw)*frame.width/2;
   assert.ok(Math.abs(cx-d.x)<1e-9&&Math.abs(cz-d.z)<1e-9,'render hinge agrees with collision center');
   if(!copy)assert.ok(!map.boxes.some(b=>b.doorId===d.id&&b.x===base.doors.find(o=>o.id===d.id).x&&b.z===base.doors.find(o=>o.id===d.id).z));
  }
  const guest={...base,boxes:map.boxes,authored:map.boxes};applyBuildState(guest,{matchId:'doors',round:1,builds:[],worldDamage:{},doors:Object.fromEntries(doors.map(d=>[d.id,{open:true}]))});
  assert.ok(doors.every(d=>!guest.boxes.some(b=>b.doorId===d.id)));
 }
 assert.ok(base.doors.every(d=>!d.editorObject),'source map stays immutable');
});
test('deleting a building removes its door leaves; explicit door edits win and copied leaves have independent controls',()=>{
 const base=ROYALE_MAP,src=baseObjects(base).find(o=>o.id==='building-0'),r=sourceRecord(src),door=base.doors.find(d=>d.building===0),leaf=baseObjects(base).find(o=>o.spec.doorId===door.id),edit={...sourceRecord(leaf),position:[-8,10,-8],rotation:90};
 const removed=compileLayout(base,layout([{...r,removed:true}]));assert.ok(!removed.doors.some(d=>d.building===0));assert.ok(!removed.boxes.some(b=>b.doorId===door.id));
 const edited=compileLayout(base,layout([{...r,rotation:90},edit]));const d=edited.doors.find(d=>d.id===door.id);assert.deepEqual([d.x,d.y,d.z],edit.position);
 const copy=compileLayout(base,layout([{...edit,id:'copy-leaf'}]));assert.ok(copy.doors.some(d=>d.id==='editor-copy-leaf-'+door.id));assert.ok(copy.boxes.some(b=>b.objectId==='world-door-editor-copy-leaf-'+door.id));
 const together=compileLayout(base,layout([{...r,rotation:90},{...edit,id:'copy-leaf'}]));assert.equal(together.doors.find(d=>d.id===door.id).yaw,Math.PI/2,'copying a leaf does not override its original building transform');
});
test('edited door leaves have one dynamic match render and a correctly transformed editor preview',()=>{
 const base=ROYALE_MAP,leaf=baseObjects(base).find(o=>o.spec.doorId),r={...sourceRecord(leaf),rotation:90,position:[10,12,14],scale:[1.5,1.2,.8]},map=compileLayout(base,layout([r]));
 const kit={palette:{},block(g,x,y,z,w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);m.userData.ownedMaterial=true;g.add(m);return m;}};
 const match=new THREE.Group();buildMapObjects(match,map,kit);assert.equal(match.children.length,0,'FrontierView owns the moving leaf');
 const preview=new THREE.Group();buildMapObjects(preview,{...map,editorPreview:true},kit);const group=preview.children.find(g=>g.userData.editorId===r.id);assert.ok(group);preview.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),door=map.doors.find(d=>d.id===leaf.spec.doorId);
 assert.ok(Math.abs(center.x-door.x)<1e-5&&Math.abs(center.z-door.z)<1e-5);assert.ok(Math.abs(size.x-door.w)<1e-5&&Math.abs(size.z-door.d)<1e-5&&Math.abs(size.y-door.h)<1e-5);disposeMapGroup(preview);
});
test('building previews respect separately moved or deleted door leaves',()=>{
 const base=ROYALE_MAP,sources=baseObjects(base),building=sources.find(o=>o.id==='building-0'),door=base.doors.find(d=>d.building===0),leaf=sources.find(o=>o.spec.doorId===door.id);
 for(const removed of [false,true]){
  const map=compileLayout(base,layout([{...sourceRecord(building),rotation:90},{...sourceRecord(leaf),position:[10,12,14],removed}])),preview=new THREE.Group();
  buildMapObjects(preview,{...map,editorPreview:true},worldKit);
  const group=preview.children.find(g=>g.userData.editorId===building.id),doorIds=[];group.traverse(m=>{for(const r of m.userData.objectRanges||[])if(r.id.startsWith('world-door-'))doorIds.push(r.id);});
  assert.equal(doorIds.length,1);assert.ok(!doorIds.includes('world-door-'+door.id));disposeMapGroup(preview);
 }
});
test('rotated doors cannot close on occupants and cannot be used through adjacent walls',()=>{
 const sim=new RoyaleSimulation({bots:0,fill:false,capacity:4}),p=sim.addPlayer('host',{name:'Host'}),d={id:'rotated',x:0,y:0,z:0,w:.18,h:3,d:3,yaw:Math.PI/2};
 sim.map=flat();sim.map.doors=[d];sim.map.boxes=[{...d,doorId:d.id,objectId:'world-door-'+d.id}];resetBuilding(sim);initializeFrontier(sim);Object.assign(p,person({id:'host',x:1,z:0,yaw:Math.PI/2}));
 assert.equal(doorNear(sim.map,p)?.id,d.id);assert.equal(setDoor(sim,d,true,p),true);sim.time+=1;
 p.x=0;p.z=1.2;assert.equal(setDoor(sim,d,false,p),false,'occupancy along the rotated leaf');
 p.x=1.2;assert.equal(setDoor(sim,d,false,p),true);sim.map.boxes.push({x:.6,y:0,z:0,w:.2,h:3,d:5});invalidateCollision(sim.map);
 assert.equal(doorNear(sim.map,p),null,'a wall blocks the interaction');
});
test('map checks flag bad spawns, inaccessible loot, blocked doors and unsupported solids without changing geometry',async()=>{
 const map=flat(),door={id:'entry',x:0,y:0,z:0,w:3,h:3,d:.18};map.doors=[door];
 map.boxes=[{...door,doorId:door.id},{x:0,y:1.3,z:0,w:4,h:1,d:2},{x:12,y:0,z:0,w:5,h:5,d:5},{x:20,y:8,z:0,w:2,h:2,d:2,editorObject:'float'},{x:-8,y:0,z:0,w:2,h:3,d:2},{x:8,y:0,z:0,w:2,h:3,d:2}];
 map.chests=[{id:'sealed',x:12,y:0,z:0}];map.editorObjects=[{id:'float',name:'Floating block',position:[20,8,0],collision:true}];
 const before=JSON.stringify(map),report=validateMapGeometry(map),codes=new Set(report.issues.map(i=>i.code));
 for(const code of ['blocked-spawn','spawn-count','blocked-door','inaccessible-loot','unsupported-object'])assert.ok(codes.has(code),code);
 assert.equal(JSON.stringify(map),before);assert.deepEqual(await validateMapGeometryAsync(map,{yieldFrame:async()=>{}}),report);
 assert.equal(await validateMapGeometryAsync(map,{active:()=>false}),null);
 map.boxes=map.boxes.filter(b=>!b.doorId);assert.ok(validateMapGeometry(map).issues.some(i=>i.code==='door-mismatch'));
});
test('authored coast passes all local placement checks including the dock entrance and five spawns',()=>{
 const report=validateMapGeometry(ROYALE_MAP);assert.equal(report.errors,0);assert.equal(report.warnings,0,JSON.stringify(report.issues));assert.equal(report.clearSpawns,5);assert.ok(report.checked>900);
 for(const [x,z]of ROYALE_MAP.spawns)assert.ok(canStand(ROYALE_MAP,{x,y:groundAt(ROYALE_MAP,x,z),z}));
});
test('camera sweep protects edge contacts, ceilings, floors and runtime build changes',()=>{
 const map=flat(),o={x:0,y:1.6,z:0},back={x:0,y:0,z:1};
 assert.equal(cameraDistance(map,o,back,4),3.975);
 map.boxes=[{x:.3,y:0,z:2,w:.3,h:3,d:.3}];
 const d=cameraDistance(map,o,back,4);assert.ok(d<1.7,'near-plane edge catches a corner missed by the center ray');
 map.boxes=[{x:0,y:2.2,z:0,w:5,h:.2,d:5}];assert.ok(cameraDistance(map,o,{x:0,y:1,z:0},3)<.5);
 assert.ok(cameraDistance(flat(),o,{x:0,y:-1,z:0},3)<1.6-CAMERA_RADIUS);
 map.boxes=[{x:0,y:0,z:1,w:3,h:3,d:.15}];const close=cameraDistance(map,o,back,4);assert.ok(close<.8);
 const clear={...map,boxes:[]};assert.ok(cameraDistance(clear,o,back,4)>close);
 // A center with its near plane inside a newly placed wall pulls to the pivot.
 map.boxes=[{x:0,y:0,z:.1,w:3,h:3,d:.2}];assert.equal(cameraDistance(map,o,back,4),0);
});
test('camera contraction is immediate, extension is smooth, target changes reset, and wide near planes fit',()=>{
 let state=smoothCameraDistance(null,4,.016,'a');state=smoothCameraDistance(state,.5,.016,'a');assert.equal(state.distance,.5);
 const same=state;state=smoothCameraDistance(state,4,.016,'a');assert.equal(state,same);assert.ok(state.distance>.5&&state.distance<1);
 assert.equal(smoothCameraDistance(state,3,.016,'b').distance,3);
 for(const fov of [55,80,110])for(const aspect of [.5,1.78,3.55]){const near=cameraNearPlane(fov,aspect),t=Math.tan(fov*Math.PI/360);assert.ok(near*Math.sqrt(1+t*t*(1+aspect*aspect))<=CAMERA_RADIUS+1e-10);}
});
