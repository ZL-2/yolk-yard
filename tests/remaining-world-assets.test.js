import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {detailEnvironmentProp} from '../src/environment-props.js';
import {FrontierArt} from '../src/frontier-art.js';
import {lobbyScene} from '../src/lobby-scene.js';
import {architectureMaterial} from '../src/architecture-surfaces.js';
import {buildMesh} from '../src/building-view.js';
import {pieceBoxes,MATERIALS} from '../src/building.js';

const triangles=g=>{let total=0;g.traverse(m=>{if(m.isMesh)total+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;});return total;};
const kit={block(g,x,y,z,w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);m.scale.set(w,h,d);g.add(m);return m;}};
function release(g){g.traverse(m=>{if(!m.isMesh)return;if(!m.geometry.userData.shared)m.geometry.dispose();if(m.userData.ownedMaterial)m.material.dispose();});g.clear();}

test('rocks are closed outward rounded shells with seamless normals inside authored envelopes',()=>{
 for(const detail of [false,true])for(let seed=0;seed<16;seed++){
  const descriptor=Object.freeze({kind:'rock',x:3,y:2,z:7,w:3,h:2,d:5,seed}),group=new THREE.Group();detailEnvironmentProp(group,descriptor,{},detail);const rock=group.children[0],p=rock.geometry.attributes.position,n=rock.geometry.attributes.normal,edges=new Map(),normals=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
  assert.equal(rock.material.side,THREE.FrontSide);assert.equal(rock.geometry.userData.roundedBoulder,true);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),face=new THREE.Vector3(),center=new THREE.Vector3();
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);center.copy(a).add(b).add(c).multiplyScalar(1/3).sub(new THREE.Vector3(0,.5,0));face.crossVectors(b.clone().sub(a),c.clone().sub(a));assert.ok(face.dot(center)>0,'front faces must point out, not into the boulder');for(let j=0;j<3;j++){const edge=[key(i+j),key(i+(j+1)%3)].sort().join('/');edges.set(edge,(edges.get(edge)||0)+1);}}
  assert.ok([...edges.values()].every(v=>v===2),'every welded edge belongs to two faces');
  for(let i=0;i<p.count;i++){const vector=new THREE.Vector3().fromBufferAttribute(n,i);assert.ok(Math.abs(vector.length()-1)<1e-5);const k=key(i);if(normals.has(k))assert.ok(vector.distanceTo(normals.get(k))<1e-5,'normals agree across UV seams');else normals.set(k,vector);}
  group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group);assert.ok(bounds.min.x>=descriptor.x-descriptor.w/2&&bounds.max.x<=descriptor.x+descriptor.w/2);assert.ok(bounds.min.z>=descriptor.z-descriptor.d/2&&bounds.max.z<=descriptor.z+descriptor.d/2);assert.ok(bounds.min.y>=descriptor.y-1e-6&&bounds.max.y<=descriptor.y+descriptor.h+1e-6);
  const base=[];for(let i=0;i<p.count;i++)if(p.getY(i)<.01)base.push(Math.hypot(p.getX(i),p.getZ(i)));assert.ok(Math.max(...base)<.20,'rounded underside cannot be a broad flat cut');assert.ok(triangles(group)<=260);release(group);
 }
});

test('Frontier buildings and landmarks share one PBR architecture batch with metre-scale UVs',()=>{
 const a=new FrontierArt(),group=new THREE.Group();a.building(0,0,12,15,7,'slate');a.radar(20,5);a.crane(-20,-5);a.pine(12,12);a.rock(-12,1,12,3,2,3);a.bake(group);
 const architectural=group.children.filter(m=>m.userData.frontierArchitecture);assert.equal(architectural.length,1);assert.equal(group.children.length,3);assert.equal(architectural[0].material.userData.architectureSurface,'atlas');assert.ok(architectural[0].material.isMeshStandardMaterial);assert.ok(architectural[0].geometry.attributes.architectureKind.array.some(v=>v===6),'opaque fixture glazing has its own finish');assert.ok(architectural[0].geometry.attributes.uv.array.some(v=>Math.abs(v)>2),'brick and panel scale does not stretch across entire facades');assert.ok(architectural[0].geometry.attributes.normal.array instanceof Int16Array);assert.ok(architectural[0].geometry.attributes.color.array instanceof Uint8Array);
 for(const m of group.children){assert.equal(m.material.userData.shared,true);assert.ok(m.material.map&&m.material.normalMap&&m.material.roughnessMap);for(const attribute of Object.values(m.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));}release(group);
 const lobby=lobbyScene();let meshes=0;lobby.traverse(m=>{if(m.isMesh)meshes++;});assert.ok(meshes<=17);assert.ok(triangles(lobby)<100000);assert.ok(lobby.userData.moving.every(s=>s.model.children.length<=3));release(lobby);
});

test('wood brick and metal builds keep exact edit openings with distinct shared PBR finishes',()=>{
 for(const [material,kind]of [['wood','timber'],['brick','brick'],['metal','metal']])for(const type of ['floor','stairs','roof','wall']){
  const piece={type,material,x:12,y:4,z:-7,rotation:1,mask:type==='stairs'?0:1};if(type==='wall')piece.mask=8;
  const before=JSON.stringify(piece),group=buildMesh(piece,kit),boxes=pieceBoxes({...piece,x:0,y:0,z:0});assert.equal(JSON.stringify(piece),before);assert.equal(triangles(group),boxes.length*12);assert.ok(group.children.every(m=>m.material.isMeshStandardMaterial&&m.material.userData.architectureSurface===kind));
  for(const mesh of group.children){assert.ok(mesh.material.normalMap&&mesh.material.roughnessMap);assert.notEqual(mesh.material,architectureMaterial(MATERIALS[material].color,kind),'damage tint has an owned material');assert.equal(mesh.material.userData.shared,false);assert.equal(mesh.material.map.userData.shared,true);const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(boxes.some(b=>Math.abs(p.getX(i)-b.x)<=b.w/2+1e-5&&p.getY(i)>=b.y-1e-5&&p.getY(i)<=b.y+b.h+1e-5&&Math.abs(p.getZ(i)-b.z)<=b.d/2+1e-5),'no visual part crosses an edited opening');}
  if(type==='floor'){group.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(11,8,-6),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObject(group,true).length,0,'rotated removed corner stays visibly open');}release(group);
 }
 const preview=buildMesh({type:'wall',material:'wood',x:0,y:0,z:0,rotation:0,mask:0},kit,true);assert.ok(preview.children.every(m=>m.material.isMeshBasicMaterial&&m.material.transparent&&!m.material.depthWrite));release(preview);
});
