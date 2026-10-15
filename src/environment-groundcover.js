import * as T from 'three';
import {groundAt} from './terrain.js';
import {createTerrainSurfaceSampler} from './terrain-detail.js';
import {environmentMaterial} from './environment-surfaces.js';

// Decorative only: nothing here participates in collision, targeting, loot or
// replication. Short opaque blades cannot conceal a standing/crouching player.
export const GROUND_COVER_BUDGET=Object.freeze({cell:32,lowCells:9,highCells:16,grassPerCell:128,stonesPerCell:24,maxHeight:.34});
let blades,pebble;
const seedFor=(x,z)=>Math.imul(x+9123,73856093)^Math.imul(z+1327,19349663);
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function geometry(){
 if(blades)return;const p=[],uv=[],indices=[];
 for(let j=0;j<4;j++){
  const a=j*2.399,dx=Math.cos(a),dz=Math.sin(a),h=.23+j*.025,w=.026,base=p.length/3;
  for(const [side,y,bend]of [[-1,0,0],[1,0,0],[-.6,h*.55,.04],[.6,h*.55,.04],[0,h,.09]]){p.push(dx*side*w-dz*bend,y,dz*side*w+dx*bend);uv.push((side+1)/2,y/h);}
  indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
 }
 blades=new T.BufferGeometry();blades.setAttribute('position',new T.Float32BufferAttribute(p,3));blades.setAttribute('uv',new T.Float32BufferAttribute(uv,2));blades.setIndex(indices);blades.computeVertexNormals();blades.computeBoundingSphere();blades.userData.shared=true;
 pebble=new T.IcosahedronGeometry(1,0);pebble.userData.shared=true;
}
export class EnvironmentGroundCover {
 constructor(world,map){this.world=world;this.map=map;this.sample=createTerrainSurfaceSampler(map);this.cells=new Map();this.queue=[];this.scanAt=-1;this.root=new T.Group();this.root.name='Near-ground grass and mineral scatter';world.add(this.root);world.userData.groundCover=this;geometry();}
 attach(world){this.world=world;world.userData.groundCover=this;}
 blocked(x,z){
  for(const b of this.buildings||[])if(!b.editorHidden&&Math.abs(x-b.x)<b.w/2+1&&Math.abs(z-b.z)<b.d/2+1)return true;
  // The edited collision snapshot includes user-added platforms and machinery.
  for(const b of this.blockers||[])if(Math.abs(x-b.x)<b.w/2+.25&&Math.abs(z-b.z)<b.d/2+.25)return true;
  return false;
 }
 build(ix,iz){
  const rng=random(seedFor(ix,iz)),group=new T.Group(),grass=[],stones=[],size=GROUND_COVER_BUDGET.cell;
  group.name='Ground detail '+ix+':'+iz;group.position.set(ix*size,0,iz*size);
  this.buildings=(this.map.buildings||[]).filter(b=>Math.abs(b.x-(ix+.5)*size)<size/2+b.w/2+1&&Math.abs(b.z-(iz+.5)*size)<size/2+b.d/2+1);
  this.blockers=(this.map.boxes||[]).filter(b=>!['tree','roof-collider','door'].includes(b.kind)&&Math.abs(b.x-(ix+.5)*size)<size/2+b.w/2&&Math.abs(b.z-(iz+.5)*size)<size/2+b.d/2&&b.h>.15);
  for(let attempt=0;attempt<384&&(grass.length<128||stones.length<24);attempt++){
   const x=(ix+rng())*size,z=(iz+rng())*size;if(Math.abs(x)>this.map.terrain.size-2||Math.abs(z)>this.map.terrain.size-2||this.blocked(x,z))continue;
   const s=this.sample(x,z);if(s.height<.85||s.road>.08||s.path>.12||s.slope>.62)continue;
   if(grass.length<128&&s.grass>.42&&rng()<s.grass){grass.push({x:x-ix*size,y:s.height-.025,z:z-iz*size,rotation:rng()*Math.PI*2,scale:.55+rng()*.5,tint:rng()});}
   else if(stones.length<24&&rng()<.25+(s.rock||0)*.55){stones.push({x:x-ix*size,y:s.height+.015,z:z-iz*size,rotation:rng()*Math.PI*2,scale:.035+rng()*.07,tint:rng()});}
  }
  this.blockers=this.buildings=null;
  const matrix=new T.Matrix4(),q=new T.Quaternion(),scale=new T.Vector3(),position=new T.Vector3(),axis=new T.Vector3(0,1,0),color=new T.Color();
  for(const [name,list,g,kind,tint]of [['grass',grass,blades,'leaf',0x6e7d49],['stones',stones,pebble,'stone',0x969588]]){
   if(!list.length)continue;const mesh=new T.InstancedMesh(g,environmentMaterial(tint,kind),list.length);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.keepDynamic=true;mesh.userData.decorative=true;mesh.userData.fullCount=list.length;
   for(let i=0;i<list.length;i++){const a=list[i];position.set(a.x,a.y,a.z);q.setFromAxisAngle(axis,a.rotation);scale.set(a.scale,name==='grass'?a.scale:a.scale*.55,a.scale);matrix.compose(position,q,scale);mesh.setMatrixAt(i,matrix);color.setRGB(.76+a.tint*.24,.8+a.tint*.2,.71+a.tint*.24);mesh.setColorAt(i,color);}
   mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();group.add(mesh);
  }
  this.root.add(group);return {ix,iz,group};
 }
 update(observer,{quality='low',time=0}={}){
  if(!observer||!this.map.terrain)return;this.root.visible=(observer.y??0)-groundAt(this.map,observer.x,observer.z)<30;
  if(!this.root.visible)return;
  if(time>=this.scanAt||quality!==this.quality){
   this.scanAt=time+.35;this.quality=quality;const size=GROUND_COVER_BUDGET.cell,cx=Math.floor(observer.x/size),cz=Math.floor(observer.z/size),low=quality==='low',radius=low?43:65,limit=low?9:16,candidates=[];
   for(let z=cz-2;z<=cz+2;z++)for(let x=cx-2;x<=cx+2;x++){const distance=Math.hypot((x+.5)*size-observer.x,(z+.5)*size-observer.z);if(distance<radius)candidates.push({x,z,distance,key:x+':'+z});}
   candidates.sort((a,b)=>a.distance-b.distance);const selected=candidates.slice(0,limit),wanted=new Set(selected.map(c=>c.key));
   for(const [key,cell]of this.cells)if(!wanted.has(key)){this.release(cell);this.cells.delete(key);}
   this.queue=selected.filter(c=>!this.cells.has(c.key));
   for(const cell of this.cells.values())this.density(cell,low);
  }
  // At most one small instance buffer is constructed per update; no full-island
  // grass allocation or CPU animation, and repeated stationary frames do no work.
  const next=this.queue.shift();if(next){const cell=this.build(next.x,next.z);this.density(cell,quality==='low');this.cells.set(next.key,cell);}
 }
 density(cell,low){for(const m of cell.group.children)m.count=Math.ceil(m.userData.fullCount*(low?.5:1));}
 release(cell){cell.group.removeFromParent();for(const m of cell.group.children)m.dispose();cell.group.clear();}
 close(){for(const c of this.cells.values())this.release(c);this.cells.clear();this.queue=[];this.root.removeFromParent();}
 diagnostics(){let instances=0,draws=0;for(const c of this.cells.values())for(const m of c.group.children){instances+=m.count;draws++;}return {cells:this.cells.size,instances,draws,visible:this.root.visible,quality:this.quality||'low',maxCells:16,maxDraws:32};}
}
