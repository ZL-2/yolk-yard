import {makeVictoryCrown} from './celebration-view.js';
import {LOCATION_IDENTITIES} from './world-locations.js';
import {dressIslandBuilding,islandProp} from './island-art.js';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GROUND_DISPLAY,AMMO_VISUALS} from './weapon-presentation.js';
import {makeBlaster,makeGroundBlaster} from './weapons.js';
import {ITEMS,RARITIES} from './royale-data.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {modelMaterial,surfaceUV,surfaceAtlasMaterial} from './model-surfaces.js';

// Shared primitives stay inexpensive even in the island's dense groves.
const geometry=new Map();
const itemAssemblies=new Map();
function geo(key,create){if(!geometry.has(key)){const g=create();g.userData.shared=true;geometry.set(key,g);}return geometry.get(key);}
function mesh(g,geometry,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
export function artKit(kit){
 const {block,ball,cylinder,mat}=kit;
 return {...kit,
  rounded:(g,x,y,z,w,h,d,c,r=.08)=>mesh(g,geo(`round:${w}:${h}:${d}:${r}`,()=>new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3))),mat(c),x,y,z),
  rock:(g,x,y,z,w,h,d,c,detail=0)=>mesh(g,geo('ico'+detail,()=>new THREE.IcosahedronGeometry(1,detail)),mat(c),x,y,z,w,h,d),
  cone:(g,x,y,z,r,h,c,top=0)=>mesh(g,geo('cone'+top,()=>new THREE.CylinderGeometry(top,1,1,8)),mat(c),x,y,z,r,h,r),
  torus:(g,x,y,z,r,t,c)=>mesh(g,geo(`torus:${r}:${t}`,()=>new THREE.TorusGeometry(r,t,6,24)),mat(c),x,y,z),
  beam:(g,a,b,r,c)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);const m=mesh(g,geo('beam',()=>new THREE.CylinderGeometry(1,1,1,6)),mat(c),...(av.add(bv).multiplyScalar(.5).toArray()),r,v.length(),r);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;},
 };
}
// Item surfaces deliberately do not change the island's inexpensive art kit.
// Opaque pieces are atlas-batched before the legacy world baker can flatten them.
function itemMesh(g,geometry,color,kind,x,y,z,sx=1,sy=1,sz=1,options={}){
 const m=mesh(g,geometry,modelMaterial(color,kind,options),x,y,z,sx,sy,sz);m.userData.surfaceKind=kind;m.userData.keepDynamic=true;return m;
}
function itemKit(){
 const k={mat:(c,kind='paint',options={})=>modelMaterial(c,kind,options)};
 k.block=(g,x,y,z,w,h,d,c,kind='paint')=>itemMesh(g,geo('item-box',()=>new THREE.BoxGeometry(1,1,1)),c,kind,x,y,z,w,h,d);
 k.rounded=(g,x,y,z,w,h,d,c,r=.04,kind='paint')=>itemMesh(g,geo(`item-round:${w}:${h}:${d}:${r}`,()=>new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3))),c,kind,x,y,z);
 k.cylinder=(g,x,y,z,r,h,c,n=20,kind='metal')=>itemMesh(g,geo('item-cylinder:'+n,()=>new THREE.CylinderGeometry(1,1,1,n)),c,kind,x,y,z,r,h,r);
 k.cone=(g,x,y,z,r,h,c,top=0,kind='metal')=>itemMesh(g,geo('item-cone:'+top,()=>new THREE.CylinderGeometry(top,1,1,20)),c,kind,x,y,z,r,h,r);
 k.rock=(g,x,y,z,w,h,d,c,detail=1,kind='paint')=>itemMesh(g,geo('item-rock:'+detail,()=>new THREE.IcosahedronGeometry(1,detail)),c,kind,x,y,z,w,h,d);
 k.torus=(g,x,y,z,r,t,c,kind='metal')=>itemMesh(g,geo(`item-torus:${r}:${t}`,()=>new THREE.TorusGeometry(r,t,6,24)),c,kind,x,y,z);
 k.beam=(g,a,b,r,c,kind='metal')=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av),m=itemMesh(g,geo('item-beam',()=>new THREE.CylinderGeometry(1,1,1,8)),c,kind,...av.add(bv).multiplyScalar(.5).toArray(),r,v.length(),r);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;};
 return k;
}
function latheItem(g,key,points,color,kind='metal',x=0,y=0,z=0,options={}){
 return itemMesh(g,geo('item-lathe:'+key,()=>new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),24)),color,kind,x,y,z,1,1,1,options);
}
function finishItem(g){
 g.userData.artRevision=155;g.updateMatrixWorld(true);const parts=[],opaque=g.children.filter(m=>m.isMesh&&!m.material.transparent&&m.userData.surfaceKind),key=opaque.map(m=>[m.geometry.uuid,m.userData.surfaceKind,m.material.color.getHex(),...m.matrix.elements].join(':')).join('|');
 if(opaque.length&&itemAssemblies.has(key)){for(const m of opaque)g.remove(m);const m=new THREE.Mesh(itemAssemblies.get(key),surfaceAtlasMaterial());m.castShadow=m.receiveShadow=true;m.userData.keepDynamic=true;m.name='PBR item shell';g.add(m);return g;}
 for(const m of opaque){
  let p=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();p.applyMatrix4(m.matrix);p=surfaceUV(p,m.userData.surfaceKind);
  const color=m.material.color,a=new Float32Array(p.attributes.position.count*3);for(let j=0;j<a.length;j+=3){a[j]=color.r;a[j+1]=color.g;a[j+2]=color.b;}p.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(p);g.remove(m);
 }
 if(parts.length){const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(itemAssemblies.size<128){geometry.userData.shared=true;itemAssemblies.set(key,geometry);}geometry.computeBoundingSphere();const m=new THREE.Mesh(geometry,surfaceAtlasMaterial());m.castShadow=m.receiveShadow=true;m.userData.keepDynamic=true;m.name='PBR item shell';g.add(m);}
 return g;
}
export const DISTRICT_STYLES={
 town:{walls:[0xdfad70,0xd5866b,0x7caaa4],trim:0xffe8b7,roof:0x467b80,wood:0x775447},
 farm:{walls:[0xb85e47,0xcba061,0xa86e45],trim:0xf7dfac,roof:0x576f70,wood:0x765743},
 dock:{walls:[0x6c98a9,0x81a6a4,0xd0a36c],trim:0xf5dab0,roof:0x466578,wood:0x7e6350},
 resort:{walls:[0xe8d5b0,0xe7ac8f,0x9bc4b5],trim:0xfff0ce,roof:0xc96d54,wood:0x7e9e99},
 camp:{walls:[0x838274,0x7e9584,0xaa8962],trim:0xe2cc93,roof:0x505e5d,wood:0x655543},
 park:{walls:[0x7e9c73,0xbea774,0x8eaf9a],trim:0xe7ddaf,roof:0x667b58,wood:0x695543},
 hatchery:{walls:[0xc6c9ac,0xcdbca1,0x95bfb4],trim:0xf9e9c3,roof:0x699ba0,wood:0x8b9b82},
 factory:{walls:[0x8199a0,0x7d8a98,0xae9e80],trim:0xe9ca72,roof:0x435d70,wood:0x4e6971},
};
export function buildingStyle(b){const s=LOCATION_IDENTITIES[b.poi]||DISTRICT_STYLES[b.kind]||DISTRICT_STYLES.camp;return {...s,wall:s.walls[b.index%s.walls.length]};}
export function dressBuilding(g,b,raw){
 if(b.floors)return dressIslandBuilding(g,b,raw);
 const k=artKit(raw),{block:box,cylinder,beam,rock}=k,s=buildingStyle(b),{x,z,w,d,h}=b;
 // Structural corner posts, foundation courses and a broad, unobstructed entrance.
 for(const dx of [-w/2,w/2]){
  box(g,x+dx,.22,z,.86,.44,d+.3,s.wood);
  for(const dz of [-d/2,d/2])box(g,x+dx,h/2,z+dz,.86,h,.86,s.trim);
 }
 box(g,x,.23,z-d/2,w,.46,.84,s.wood);
 box(g,x,h-1.16,z+d/2+.41,5.9,.2,.16,s.trim);
 for(const dx of [-2.85,2.85])box(g,x+dx,(h-1.2)/2,z+d/2+.4,.14,h-1.2,.16,s.trim);
 const window=(dx,dz,side)=>{
  const xx=x+dx,zz=z+dz,ww=side?.12:1.65,dd=side?1.65:.12,yy=Math.min(2.6,h*.52);
  box(g,xx,yy,zz,ww,1.65,dd,s.trim);box(g,xx+(side?Math.sign(dx)*.08:0),yy,zz+(side?0:.08),side?.1:1.38,1.37,side?1.38:.1,0x406c7b);
  box(g,xx+(side?Math.sign(dx)*.15:0),yy,zz+(side?0:.15),side?.08:1.4,.075,side?1.4:.08,s.trim);
  box(g,xx+(side?Math.sign(dx)*.16:0),yy,zz+(side?0:.16),.09,1.4,.09,s.trim);
  box(g,xx,yy-.95,zz,side?.42:2,.18,side?2:.42,s.wood);
  if(['town','resort','park'].includes(b.kind))for(const sign of [-1,1])box(g,xx+(side?0:sign*1.04),yy,zz+(side?sign*1.04:0),side?.18:.36,1.65,side?.36:.18,s.roof);
 };
 for(const side of [-1,1])for(const dz of [-d*.25,d*.2])window(side*(w/2+.4),dz,true);
 for(const dx of [-w/2+1.45,w/2-1.45])window(dx,d/2+.42,false);
 // Roof trim outlines the usable half-deck; opening remains clear for drops.
 if(b.roof==='terrace')box(g,x-w/4,h+.23,z,w/2+.7,.12,d+.65,s.roof);
 box(g,x-w/2-.22,h+.38,z,.15,.3,d+.7,s.trim);
 box(g,x-w/4,h+.38,z-d/2-.25,w/2+.7,.3,.15,s.trim);
 if(b.roof==='gable'){
  // A peaked tiled cap distinguishes lodges, barns and upper shop floors.
  for(const zz of [-d/2-.3,d/2+.3]){
   beam(g,[x-w/2-.25,h+.52,z+zz],[x-w/4,h+2.05,z+zz],.12,s.trim);
   beam(g,[x-w/4,h+2.05,z+zz],[x+.25,h+.52,z+zz],.12,s.trim);
  }
  box(g,x-w/4,h+2.02,z,.2,.16,d+.8,s.trim);
  for(let j=0;j<9;j++)for(const side of [-1,1])beam(g,[x-w/4,h+2.03,z-d/2+j*d/8],[x-w/4+side*(w/4+.3),h+.5,z-d/2+j*d/8],.035,s.wood);
 }
 // Interior shelves, entry mat and wall panels fit entirely within existing walls.
 box(g,x+1,.025,z+2.6,4.4,.05,2.5,b.kind==='resort'?0x629eaa:0xc4ae7f);
 box(g,x,2,z-d/2+.4,3.8,1.6,.1,s.wood);
 box(g,x,2,z-d/2+.47,3.3,1.18,.04,b.kind==='factory'?0xb6c3af:0x9aae8c);
 for(const sign of [-1,1])box(g,x+sign*1.6,2,z-d/2+.51,.09,1.2,.03,s.trim);
 if(b.kind==='farm'||b.kind==='camp'||b.kind==='park'){
  // Timber siding and diagonal braces make these read as cabins/barns, not houses.
  for(let yy=.8;yy<h-.2;yy+=.62)for(const side of [-1,1])box(g,x+side*(w/2+.37),yy,z,.1,.11,d-.4,s.wood);
  for(const side of [-1,1])beam(g,[x+side*(w/2-.65),h-1,z+d/2+.44],[x+side*3,h-2.5,z+d/2+.44],.065,s.trim);
  const canopy=box(g,x,h-.75,z+d/2+1.1,6.2,.18,2.1,s.roof);canopy.rotation.x=.12;
  for(const side of [-1,1])beam(g,[x+side*3,h-1.9,z+d/2+.5],[x+side*3,h-.7,z+d/2+2],.07,s.wood);
 }else if(b.kind==='factory'||b.kind==='dock'){
  for(let xx=-w/2+1;xx<w/2;xx+=1.25)box(g,x+xx,h-.5,z-d/2-.4,.1,.9,.12,s.roof);
  for(const dx of [-w/2+.7,w/2-.7])for(let yy=.6;yy<h;yy+=.8)box(g,x+dx,yy,z+d/2+.43,.4,.24,.09,yy%1.6<.8?s.trim:s.roof);
  box(g,x,h-.55,z+d/2+.6,4.7,.62,.18,s.roof);
  for(let j=0;j<5;j++)box(g,x-1.7+j*.8,h-.55,z+d/2+.71,.4,.09,.04,s.trim);
  // Industrial side conduit is tight to the already-solid wall.
  beam(g,[x+w/2+.48,.3,z-d/2+1],[x+w/2+.48,h-.2,z-d/2+1],.11,s.roof);
 }else if(b.kind==='hatchery'){
  // Greenhouse crown: lightweight ribs arch above the opening, rather than a solid roof.
  for(const zz of [-d/2+.6,d/2-.6])for(let j=0;j<6;j++){
   const a=j*Math.PI/6,aa=(j+1)*Math.PI/6;
   beam(g,[x+Math.cos(a)*w/2,h+Math.sin(a)*2, z+zz],[x+Math.cos(aa)*w/2,h+Math.sin(aa)*2,z+zz],.07,s.trim);
  }
  for(const dx of [-3,0,3])box(g,x+dx,h+1.7,z,.08,.1,d-.8,s.roof);
 }else{
  // Shop awnings and villa pergolas: striped fabric, shaped brackets and valances.
  for(let j=0;j<8;j++){const m=box(g,x-2.8+j*.8,h-1.15,z+d/2+1.2,.79,.14,2.25,j%2?s.trim:s.roof);m.rotation.x=.1;box(g,x-2.8+j*.8,h-1.37,z+d/2+2.3,.79,.35,.09,j%2?s.trim:s.roof);}
  for(const side of [-1,1])beam(g,[x+side*3,h-2,z+d/2+.4],[x+side*3,h-1.25,z+d/2+2],.055,s.wood);
  if(b.kind==='resort')for(let j=0;j<6;j++)box(g,x-w/4,h+.45,z-d/2+.7+j*(d-1)/5,w/2,.12,.14,s.trim);
 }
 // Door-top district insignia uses geometry and is legible without textures.
 const badge=cylinder(g,x,h-.55,z+d/2+.6,.32,.08,s.trim,12);badge.rotation.x=Math.PI/2;
 rock(g,x,h-.55,z+d/2+.68,.16,.21,.04,s.roof,1);
}
export function treeModel(g,t,raw){
 const {cone,beam,rock,torus}=artKit(raw),{x,y,z,h,kind,seed}=t;
 cone(g,x,y+h*.3,z,.44,h*.6,kind==='palm'?0xad8d60:0x80604c,.55);
 if(kind==='palm'){
  for(let j=0;j<6;j++)cone(g,x,y+.7+j*h*.075,z,.38-j*.012,.07,0xc6a877,.95);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7+seed,dx=Math.cos(a),dz=Math.sin(a);beam(g,[x,y+h*.68,z],[x+dx*3.7,y+h*.63,z+dz*3.7],.1,0x628c4a);
   const leaf=rock(g,x+dx*2,y+h*.76,z+dz*2,.64,.32,2.7,i%2?0x709d50:0x87b25b);leaf.rotation.y=Math.PI/2-a;leaf.rotation.z=dx*.15;
  }
  for(let i=0;i<3;i++)rock(g,x+Math.cos(i*2)*.4,y+h*.65,z+Math.sin(i*2)*.4,.25,.3,.25,0x876141,1);
 }else if(kind==='pine'){
  for(let j=0;j<4;j++)cone(g,x,y+h*(.42+j*.15),z,2.8-j*.48,h*.39,[0x3d7868,0x4b8d70,0x629b72,0x84ae7d][j]);
 }else{
  const colors=kind==='autumn'?[0xd89356,0xe4ae61,0xc97950]:kind==='orchard'?[0x668b49,0x7d9e52,0x95b85f]:[0x518563,0x66986b,0x8ab579];
  for(let i=0;i<5;i++){const a=i*2.4+seed,dx=Math.cos(a)*1.5,dz=Math.sin(a)*1.5;
   beam(g,[x,y+h*.38,z],[x+dx,y+h*.67,z+dz],.14,0x80604c);
   const leaf=rock(g,x+dx,y+h*(.67+(i%2)*.12),z+dz,2.4,2.1,2.3,colors[i%3],1);leaf.rotation.y=a;
   if(kind==='orchard')for(let j=0;j<3;j++)rock(g,x+dx+Math.cos(j*2)*1.9,y+h*.65,z+dz+Math.sin(j*2)*1.9,.19,.21,.19,0xe2a24d,1);
  }
 }
}
export function propModel(g,p,raw){
 if(islandProp(g,p,raw))return;
 const {block:box,cone,rock,cylinder,torus,beam}=artKit(raw),{x,y=0,z,w,d,h,kind}=p;
 if(kind==='target'){
  cylinder(g,x,y+.75,z,.08,1.5,0x6b7961,8);box(g,x,y+.12,z,1.1,.24,.65,0x9c8061);
  rock(g,x,y+1.65,z,.58,.77,.14,0xfff3d2,2);
  for(const side of [-1,1]){const ring=torus(g,x,y+1.65,z+side*.16,.27,.045,0xd17e4e);ring.scale.y=1.2;rock(g,x,y+1.65,z+side*.17,.13,.17,.035,0xf1c552,1);}
 }else if(kind==='rock'){
  const m=rock(g,x,y+h*.45,z,w*.5,h*.55,d*.5,0x929789,1);m.rotation.y=(p.seed||0)*2.4;
  rock(g,x-w*.19,y+h*.81,z,.6,.16,.55,0xb7ba9b);
 }else if(kind==='lamp'){
  cylinder(g,x,y+2.1,z,.1,4.2,0x41616a,8);cylinder(g,x,y+.15,z,.2,.3,0x41616a,8);
  box(g,x,y+4.1,z,.6,.55,.6,0xffdfa0);cone(g,x,y+4.5,z,.53,.35,0x41616a);
  for(const dx of [-.32,.32])for(const dz of [-.32,.32])box(g,x+dx,y+4.1,z+dz,.06,.6,.06,0x41616a);
 }else if(kind==='bench'){
  for(let i=0;i<3;i++)box(g,x,y+.65,z-.2+i*.2,2.6,.12,.16,0xaf875c);
  for(let i=0;i<2;i++)box(g,x,y+.92+i*.24,z-.32,2.6,.15,.1,0xaf875c);
  for(const dx of [-.95,.95]){box(g,x+dx,y+.33,z,.12,.65,.6,0x41616a);box(g,x+dx,y+.8,z-.32,.1,.8,.1,0x41616a);}
 }else if(kind==='shield-barrel'){
  cylinder(g,x,y+.62,z,.42,1.24,0x23495d,12);
  for(const yy of [.12,.42,.94,1.16]){const r=torus(g,x,y+yy,z,.43,.035,0x79eadb);r.rotation.x=Math.PI/2;}
  box(g,x,y+.68,z-.423,.37,.4,.025,0x73e8d4);box(g,x,y+.68,z-.45,.25,.085,.025,0xe7fff9);box(g,x,y+.68,z-.45,.085,.25,.025,0xe7fff9);
 }else if(kind==='barrels'){
  for(const dx of [-.4,.4]){cylinder(g,x+dx,y+.6,z,.35,1.2,0xc19762,10);for(const yy of [.2,1]){const r=torus(g,x+dx,y+yy,z,.36,.035,0x556873);r.rotation.x=Math.PI/2;}}
 }else if(kind==='planter'){
  box(g,x,y+.4,z,w,.8,d,0xc3ad83);box(g,x,y+.84,z,w-.3,.08,d-.3,0x706957);
  for(let j=0;j<4;j++)rock(g,x+(j%2-.5)*1.4,y+1.05,z+(Math.floor(j/2)-.5),.7,.38,.8,0x729257,1);
 }else{
  box(g,x,y+h/2,z,w,h,d,0xb49161);
  for(const dx of [-w/2+.12,w/2-.12])box(g,x+dx,y+h/2,z,.2,h+.05,d+.04,0xe0bf84);
  for(const dz of [-d/2-.03,d/2+.03])for(const sign of [-1,1])beam(g,[x-w/2+.2,y+.1,z+dz],[x+w/2-.2,y+h-.1,z+dz],.055,sign===1?0xe0bf84:0xc09b64);
 }
}
export function gliderModel(raw,color=0xf4c454){
 const k=itemKit(),{beam,rounded}=k,g=new THREE.Group();g.name='Stitched sunwing parafoil';
 // Separate curved fabric panels and suspension ribs form an arched parafoil.
 for(let j=0;j<9;j++){
  const geometry=geo('sail-panel-'+j,()=>{
   const vertices=[],indices=[],uv=[];
   for(let face=0;face<2;face++)for(let z=0;z<=12;z++)for(let x=0;x<=2;x++){
    const xx=-2.25+(j+x/2)*.5,zz=-1.4+z*2.8/12,yy=3.6-(xx/2.25)**2*.65+.16*Math.cos(zz*Math.PI/2.8)-face*.055;
    vertices.push(xx,yy,zz);uv.push(x/2,z/12);
   }
   for(let z=0;z<12;z++)for(let x=0;x<2;x++){const a=z*3+x,b=a+39;indices.push(a,a+3,a+1,a+1,a+3,a+4,b,b+1,b+3,b+1,b+4,b+3);}
   const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));gg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));gg.setIndex(indices);gg.computeVertexNormals();return gg;
  });
  itemMesh(g,geometry,j%3===0?0xe6dfca:color,'cloth',0,0,0);
  const x=-2.25+j*.5;for(let z=0;z<6;z++){const za=-1.4+z*2.8/6,zb=za+2.8/6;beam(g,[x,3.62-(x/2.25)**2*.65+.16*Math.cos(za*Math.PI/2.8),za],[x,3.62-(x/2.25)**2*.65+.16*Math.cos(zb*Math.PI/2.8),zb],.008,0xd0c8b1,'cloth');}
  for(const z of [-1.35,1.35])beam(g,[x,3.6-(x/2.25)**2*.65,z],[x+.48,3.6-((x+.48)/2.25)**2*.65,z],.012,0x364c56,'cloth');
 }
 for(const x of [-1.95,-1.3,-.7,.7,1.3,1.95])for(const z of [-.95,.95])beam(g,[x,3.3-(x/2.25)**2*.35,z],[Math.sign(x)*.33,1.99,-.06],.009,0xded9c8,'cloth');
 rounded(g,0,1.97,-.06,.85,.07,.07,0x7e8e92,.03,'metal');
 for(const x of [-.33,.33]){rounded(g,x,1.93,-.06,.11,.075,.14,0x1c292d,.025,'rubber');k.torus(g,x,2.02,-.06,.045,.011,0xa3b4b7,'metal').rotation.y=Math.PI/2;}
 return finishItem(g);
}
export function chestModel(raw,supply=false,epic=false){
 const {block:box,rounded,cylinder,rock,torus}=itemKit(),g=new THREE.Group();g.name=supply?'Airfreight supply crate':epic?'Rare armored chest':'Field requisition chest';
 const wood=supply?0x4e9ea8:epic?0x2577b6:0x52695a,trim=supply?0xd6e9d4:epic?0xc5dfed:0xd2b66d;
 rounded(g,0,.49,0,1.76,.96,1.22,wood,.065,supply||epic?'paint':'wood');
 rounded(g,0,.9,0,1.50,.08,.98,0x253033,.035,'rubber');
 for(const z of [-.625,.625]){
  for(let i=0;i<4;i++)box(g,0,.16+i*.2,z,1.55,.035,.025,supply?0x367584:epic?0x173a62:0x304737);
  for(const x of [-.72,.72]){rounded(g,x,.5,z,.19,.96,.08,trim,.02,'metal');for(const y of [.16,.8])rock(g,x,y,z+Math.sign(z)*.05,.033,.033,.025,0x526067,1,'metal');}
 }
 for(const x of [-.9,.9]){const handle=torus(g,x,.55,0,.14,.027,trim);handle.rotation.y=Math.PI/2;rounded(g,x,.71,0,.055,.085,.30,0x34444b,.015,'metal');}
 if(epic){for(const x of [-.42,0,.42])box(g,x,.51,.7,.12,.42,.07,0xf1d177);}
 const lid=new THREE.Group();lid.position.set(0,.96,-.61);g.add(lid);g.userData.lid=lid;
 rounded(lid,0,.14,.61,1.83,.3,1.28,wood,.08,supply||epic?'paint':'wood');
 // Curved top with visible plank seams and continuous gold hoops.
 for(let j=0;j<7;j++){const zz=.06+j*.18,yy=.23+Math.sin(j/6*Math.PI)*.24;box(lid,0,yy,zz,1.65,.15,.175,j%2?wood:supply?0x63b5b9:epic?0x408fca:0x6f8669,supply||epic?'paint':'wood');}
 for(const x of [-.65,.65])for(let j=0;j<7;j++){const zz=.06+j*.18,yy=.31+Math.sin(j/6*Math.PI)*.24;box(lid,x,yy,zz,.15,.065,.19,trim,'metal');}
 for(const x of [-.58,.58]){const h=cylinder(g,x,.95,-.61,.055,.24,0x727f80,16,'metal');h.rotation.z=Math.PI/2;box(lid,x,.05,.015,.20,.12,.035,trim,'metal');}
 rounded(g,0,.86,.68,.38,.4,.1,trim,.03,'metal');rounded(g,0,.79,.744,.13,.16,.03,0x263c42,.015,'rubber');rock(g,0,.89,.77,.10,.10,.04,supply?0x94eef1:0x64cfc3,1,'glass');box(lid,0,-.025,1.26,.18,.20,.045,trim,'metal');
 for(const x of [-.67,.67])for(const z of [-.43,.43])rounded(g,x,.035,z,.3,.12,.3,0x28373c,.025,'rubber');
 for(const x of [-.79,.79])for(const z of [-.56,.56]){box(g,x,.1,z,.2,.2,.15,trim,'metal');box(lid,x,.11,z+.61,.2,.12,.17,trim,'metal');}
 if(supply){for(const x of [-.5,.5])box(g,x,.5,0,.07,1.05,1.33,0xe0c994,'cloth');box(g,0,.43,.68,.4,.19,.025,0xf5edcc,'cloth');for(let j=0;j<5;j++)box(g,-.145+j*.071,.43,.699,.021,.14,.008,0x455a61,'paint');}
 g.scale.setScalar(supply?.85:.68);
 finishItem(lid);return finishItem(g);
}
export function launchpadModel(raw){
 const {cylinder,cone,torus,rounded,block:box}=itemKit(),g=new THREE.Group();g.name='Hydraulic field launch pad';
 cylinder(g,0,.12,0,1.2,.24,0x344753,24,'metal');cylinder(g,0,.28,0,.92,.12,0x21373f,24,'rubber');
 const r=torus(g,0,.36,0,.81,.045,0xc6a858);r.rotation.x=Math.PI/2;
 for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.cos(a),z=Math.sin(a);const m=rounded(g,x*.6,.37,z*.6,.2,.045,.44,0xe0bc5d,.015,'paint');m.rotation.y=Math.PI/2-a;cylinder(g,x*1.01,.235,z*1.01,.067,.22,0x9fadb1,12,'metal');rounded(g,x*1.12,.07,z*1.12,.23,.1,.23,0x1c2b31,.025,'rubber');for(const rr of [.43,.58])box(g,x*rr,.394,z*rr,.025,.008,.08,0x2c464d,'paint');}
 cone(g,0,.39,0,.3,.08,0x7cbcb8,.7,'paint');return finishItem(g);
}
export function lootModel(item,raw,{ground=true}={}){
 const k=itemKit(),{block:box,rounded,cylinder,cone,torus,rock,beam}=k,g=new THREE.Group();g.name=(item.id||'item')+' collectible';
 const c=Number('0x'+(item.weapon?RARITIES[item.rarity||0].color:ITEMS[item.id]?.color||'#d9b967').slice(1));
 if(['asterKeycard','rookKeycard','nyxKeycard'].includes(item.id)){const accent=item.id==='asterKeycard'?0xc5a454:item.id==='rookKeycard'?0xec864a:0x9c73c8;rounded(g,0,.24,0,.64,.43,.055,0x253746,.026,'polymer');rounded(g,-.13,.25,-.034,.19,.23,.012,0x627a82,.008,'paint');for(let j=0;j<4;j++)box(g,.06+j*.04,.29,-.035,.024,.065,.008,accent,'metal');box(g,.13,.17,-.035,.24,.024,.008,0xaac2c4,'paint');box(g,0,.37,.036,.58,.04,.007,0x1e2931,'rubber');for(let j=0;j<7;j++)box(g,-.25+j*.08,.19,.036,.025,.14,.007,0xc9b568,'metal');}
 else if(item.id==='jumpRig'){rounded(g,0,.35,0,.58,.75,.3,0x283c45,.06,'paint');for(const side of [-1,1]){latheItem(g,'jump-engine',[[0,-.34],[.085,-.34],[.13,-.23],[.13,.23],[.09,.34],[0,.34]],0x9baba7,'metal',side*.27,.35,0);cone(g,side*.27,-.08,0,.13,.19,0x556468,.7,'metal');torus(g,side*.27,-.04,0,.103,.025,0xc59f59).rotation.x=Math.PI/2;beam(g,[side*.16,.65,-.16],[side*.16,.03,-.16],.035,0x172d38,'cloth');for(const y of [.08,.57])rounded(g,side*.27,y,0,.29,.055,.28,0x28383f,.01,'paint');}rounded(g,0,.48,.18,.32,.17,.08,0xc9a058,.02,'metal');for(let j=0;j<4;j++)box(g,0,.19+j*.06,.165,.3,.018,.018,0x738782,'metal');rounded(g,0,.5,.225,.17,.085,.01,0x73c9c0,.005,'glass');}
 else if(item.id==='shadowstep'){g.name='Nyx Shadowstep phase gauntlet';latheItem(g,'phase-bracer',[[.15,-.24],[.21,-.24],[.235,-.12],[.235,.12],[.19,.24],[.15,.24]],0x293540,'paint',0,.3,0);for(const x of [-.14,0,.14]){box(g,x,.33,-.23,.065,.32,.045,0x675181,'metal');box(g,x,.33,-.258,.018,.24,.012,0xc4a5ec,'glass');}for(const y of [.065,.535])torus(g,0,y,0,.21,.028,0x968084).rotation.x=Math.PI/2;rounded(g,0,.53,-.08,.24,.09,.34,0x4c3d60,.02,'metal');for(const x of [-.19,.19])rounded(g,x,.32,.11,.045,.30,.05,0x151f29,.014,'rubber');}
 else if(item.id==='victoryCrown'){g.add(makeVictoryCrown());}
 else if(item.id==='anchorWinch'){
  g.name='Mythic plunger grappler';rounded(g,0,.27,0,.24,.29,.49,0x625075,.03,'paint');rounded(g,0,.38,.02,.27,.13,.29,0x787b80,.02,'metal');
  const barrel=cylinder(g,0,.29,-.34,.09,.5,0x474b50,12);barrel.rotation.x=Math.PI/2;
  const cup=new THREE.Group();cup.name='grappler-plunger';g.add(cup);cone(cup,0,.28,-.62,.17,.2,0xc53646,.05,'rubber').rotation.x=Math.PI/2;torus(cup,0,.28,-.72,.17,.025,0xef5360,'rubber');finishItem(cup);
  rounded(g,0,.05,.08,.13,.28,.15,0x29373c,.025,'rubber');torus(g,0,.14,-.07,.065,.013,0xc3bec3).rotation.y=Math.PI/2;
  for(const side of [-1,1]){const spool=cylinder(g,side*.16,.29,.12,.12,.08,0x929699,16);spool.rotation.z=Math.PI/2;for(const x of [.18,.20,.22])torus(g,side*x,.29,.12,.08,.010,0xd9cba2,'cloth').rotation.y=Math.PI/2;for(let j=0;j<3;j++)box(g,side*.131,.22+j*.055,-.09,.012,.018,.16,0x26323a,'rubber');}beam(g,[-.16,.37,.12],[-.16,.37,-.35],.012,0xd9cba2,'cloth');
 }
 else if(item.id==='smoke'||item.id==='veilProjector'){const phase=item.id==='veilProjector';latheItem(g,'smoke-shell',[[0,-.045],[.15,-.045],[.18,0],[.18,.46],[.15,.52],[.09,.54]],phase?0x49375b:0x748980,'paint');for(const y of [.01,.46])torus(g,0,y,0,.175,.012,0x394951).rotation.x=Math.PI/2;cylinder(g,0,.56,0,.10,.08,0x9eaba8,16,'metal');rounded(g,.10,.50,0,.055,.24,.075,0x9aabaa,.012,'metal');torus(g,-.055,.64,0,.07,.013,0xaebeb8).rotation.y=Math.PI/2;box(g,0,.26,.185,.20,.15,.018,phase?0x9a7bce:0xd2c9aa,'cloth');for(let j=0;j<3;j++)box(g,0,.23+j*.035,.197,.12,.01,.005,0x39434b,'paint');}
 else if(item.id==='scanner'){rounded(g,0,.18,0,.5,.35,.22,0x263e48,.05,'rubber');rounded(g,0,.2,-.13,.35,.22,.03,0x829e9d,.014,'metal');rounded(g,0,.2,-.151,.31,.18,.01,0x70b7ad,.006,'glass');for(const x of [-.13,0,.13])cylinder(g,x,.05,-.13,.025,.025,0xe2bd63,12,'polymer').rotation.x=Math.PI/2;beam(g,[.17,.32,0],[.17,.69,0],.016,0x26353a,'rubber');cylinder(g,.17,.73,0,.024,.10,0xa2b4b3,10,'metal');for(let j=0;j<4;j++)box(g,-.105+j*.07,.18,-.158,.008,.05+j*.018,.003,0xd5e7c9,'paint');}
 else if(item.id==='blueprint'){rounded(g,0,.3,0,1.2,.85,.035,0x247bad,.02);for(let i=0;i<7;i++)box(g,-.55+i*.18,.3,.025,.012,.8,.015,0x80d7ed);for(let i=0;i<5;i++)box(g,0,-.05+i*.18,.025,1.1,.012,.015,0x80d7ed);const pencil=cylinder(g,.7,.2,.03,.024,.7,0xf2d261,8);pencil.rotation.z=-.2;}
 else if(item.id==='pickaxe'){cylinder(g,0,0,0,.039,1.35,0x57624f,16,'polymer');for(let i=0;i<6;i++)torus(g,0,-.5+i*.065,0,.044,.009,0x17272b,'rubber').rotation.x=Math.PI/2;const shape=new THREE.Shape([[-.48,.69],[-.27,.76],[.32,.7],[.56,.40],[.30,.56],[.03,.60],[-.48,.58]].map(p=>new THREE.Vector2(...p))),blade=geo('field-pick-head',()=>{const gg=new THREE.ExtrudeGeometry(shape,{depth:.085,bevelEnabled:true,bevelThickness:.009,bevelSize:.012,bevelSegments:1,steps:1});gg.translate(0,0,-.042);return gg;});itemMesh(g,blade,0x879a9a,'metal',0,0,0);rounded(g,0,.65,0,.16,.22,.15,0x3a4b52,.014,'paint');for(const z of [-.08,.08])cylinder(g,0,.66,z,.026,.025,0xb5c2c3,12,'metal').rotation.x=Math.PI/2;}
 else if(item.resource){for(let i=0;i<3;i++){const wood=item.resource==='wood',brick=item.resource==='brick';rounded(g,(i-1)*.23,.05+i*.08,0,.55,.18,.4,wood?0xba8852:brick?0xbc705c:0x799ba8,.018,wood?'wood':brick?'polymer':'metal');if(wood)for(const z of [-.12,.12])box(g,(i-1)*.23,.149+i*.08,z,.47,.008,.022,0x61452f,'wood');if(!wood&&!brick)for(const x of [-.2,0,.2])box(g,(i-1)*.23+x,.15+i*.08,0,.022,.008,.3,0xc2d0cc,'metal');}}
 else if(item.weapon){const blaster=ground?makeGroundBlaster(item.id):makeBlaster(item.id),pose=GROUND_DISPLAY[item.id];blaster.rotation.set(pose.pitch,pose.yaw,0);blaster.scale.setScalar(pose.scale);blaster.position.y=pose.lift;blaster.userData.keepDynamic=true;g.add(blaster);g.userData.display=pose;}
 else if(item.ammoType){
  const v=AMMO_VISUALS[item.ammoType]||AMMO_VISUALS.medium;
  g.userData.ammoType=item.ammoType;
  // Open clips expose the actual cartridge shape instead of hiding it in identical boxes.
  for(let j=0;j<v.count;j++){
   const x=(j%4-1.5)*(v.radius*2.6),z=Math.floor(j/4)*v.radius*3,yy=.1;
   const h=v.height,r=v.radius;
   if(item.ammoType==='shells'){latheItem(g,'shot-shell',[[0,0],[r,0],[r,h*.89],[r*.92,h*.97],[0,h*.97]],0x9d3a30,'polymer',x,yy,z);cylinder(g,x,yy+.06,z,r*1.025,.12,0xc5a057,20,'metal');torus(g,x,yy+h*.93,z,r*.80,.01,0x78382f,'polymer').rotation.x=Math.PI/2;box(g,x,yy+h*.52,z+r,.075,.09,.005,0xc9bca4,'paint');}
   else if(item.ammoType==='rockets'){latheItem(g,'rocket-body',[[0,0],[r*.93,0],[r,.1],[r,h*.68],[r*.87,h*.80],[r*.2,h],[0,h*1.05]],0x6b7e55,'paint',x,yy,z);for(let k=0;k<4;k++){const a=k*Math.PI/2,m=box(g,x+Math.cos(a)*.14,yy+.13,z+Math.sin(a)*.14,.23,.22,.02,0x34464b,'metal');m.rotation.y=-a;}cylinder(g,x,yy+h*.62,z,r*1.02,.045,0xcaa35b,20,'metal');cylinder(g,x,yy+.05,z,r*.52,.035,0x1b3037,16,'rubber');}
   else{const neck=h*.70,tipR=r*(item.ammoType==='light'?.83:.66);latheItem(g,'brass-'+item.ammoType,[[0,0],[r*1.07,0],[r*1.07,.035],[r*.91,.048],[r,neck-.04],[tipR,neck],[tipR,h*.82]],v.color,'metal',x,yy,z);latheItem(g,'bullet-'+item.ammoType,[[0,h*.69],[tipR,h*.69],[tipR,h*.84],[tipR*.7,h*.95],[0,h*1.09]],item.ammoType==='heavy'?0x897169:0xad8860,'metal',x,yy,z);}
  }
  if(item.ammoType!=='rockets'){rounded(g,0,.14,.03,.86,.095,.31,0x425d65,.015,'paint');for(const x of [-.37,.37])box(g,x,.18,.03,.045,.095,.29,0x293942,'rubber');box(g,0,.14,-.14,.26,.07,.016,v.color,'paint');}
 }else if(item.id==='mini'||item.id==='flask'){
  const big=item.id==='flask',r=big?.28:.19;
  const bottom=big?-.14:-.065,shoulder=big?.41:.32,neck=big?.545:.445,cap=big?.61:.51;
  latheItem(g,'shield-liquid-'+item.id,[[0,bottom+.025],[r*.85,bottom+.025],[r*.91,bottom+.06],[r*.91,shoulder-.03],[r*.75,shoulder],[0,shoulder]],big?0x4299c3:0x49bdd0,'paint');
  latheItem(g,'shield-glass-'+item.id,[[0,bottom],[r*.87,bottom],[r,bottom+.05],[r,shoulder],[r*.84,shoulder+.055],[r*.5,neck],[r*.5,neck+.025]],0xb8e5df,'glass',0,0,0,{transparent:true,opacity:.27,depthWrite:false,roughness:.15});
  cylinder(g,0,cap,0,r*.60,.09,0x8eaaa8,20,'metal');for(let j=0;j<12;j++){const a=j*Math.PI/6,m=box(g,Math.sin(a)*r*.61,cap,Math.cos(a)*r*.61,.018,.065,.018,0x536f78,'metal');m.rotation.y=a;}
  cylinder(g,0,bottom+.025,0,r*1.005,.05,0x273e49,20,'rubber');rounded(g,0,.18,r+.01,r*1.35,.20,.016,0xd8e5cf,.012,'cloth');box(g,0,.18,r+.021,r*.48,.022,.008,0x2c777e,'paint');box(g,0,.18,r+.021,.022,r*.48,.008,0x2c777e,'paint');
  if(big){const handle=torus(g,r+.08,.25,0,.17,.025,0x809694);handle.rotation.y=Math.PI/2;box(g,0,.32,r+.024,.23,.018,.008,0x789c9d,'paint');}
 }else if(item.id==='bandage'){
  const roll=cylinder(g,0,.16,0,.23,.43,0xded8bd,24,'cloth');roll.rotation.z=Math.PI/2;
  for(const x of [-.218,.218]){for(const radius of [.075,.125,.18,.222])torus(g,x,.16,0,radius,.009,0xb1ab97,'cloth').rotation.y=Math.PI/2;const core=cylinder(g,x,.16,0,.051,.018,0x584f43,18,'wood');core.rotation.z=Math.PI/2;}
  rounded(g,0,.10,.22,.16,.34,.016,0xd8ccad,.008,'cloth');box(g,0,.16,.236,.16,.055,.014,0xa95149,'paint');box(g,0,.16,.236,.05,.16,.014,0xa95149,'paint');
 }else if(item.id==='medkit'){
  rounded(g,0,.13,0,.84,.53,.55,0xbdc7af,.075,'cloth');rounded(g,0,-.07,0,.85,.06,.56,0x51604f,.02,'rubber');rounded(g,0,.43,0,.35,.085,.13,0x465653,.025,'rubber');
  rounded(g,0,.15,.285,.42,.33,.05,0xd9ded0,.024,'cloth');box(g,0,.15,.317,.28,.072,.012,0xa94f43,'paint');box(g,0,.15,.317,.072,.25,.012,0xa94f43,'paint');
  for(const x of [-.30,.30]){box(g,x,.13,0,.085,.56,.59,0x606a54,'cloth');rounded(g,x,.20,.305,.12,.13,.028,0x979f91,.013,'metal');rounded(g,x,.21,.325,.065,.065,.009,0x283d3b,.01,'rubber');}
  for(let j=0;j<8;j++)box(g,-.22+j*.061,.397,.22,.025,.01,.018,0x8c9b91,'metal');rounded(g,.26,.40,.24,.08,.05,.035,0xaebbb0,.014,'metal');
 }else if(item.id==='splash'){
  for(const x of [-.17,.17]){latheItem(g,'restoration-can',[[0,-.08],[.10,-.08],[.14,-.035],[.14,.38],[.10,.43],[0,.43]],0x3caaa7,'paint',x,0,0);cylinder(g,x,.44,0,.105,.035,0xa9bfb4,20,'metal');torus(g,x,.468,0,.038,.010,0x677b78).rotation.x=Math.PI/2;rounded(g,x,.15,.145,.14,.20,.008,0xdde0c4,.008,'cloth');box(g,x,.15,.153,.07,.02,.008,0x388b82,'paint');box(g,x,.15,.153,.02,.09,.008,0x388b82,'paint');}
  rounded(g,0,.34,0,.63,.05,.32,0x344f51,.018,'polymer');rounded(g,0,.49,0,.24,.10,.06,0x8ea79d,.025,'metal');
 }else if(item.id==='impulse'){
  rock(g,0,.2,0,.30,.32,.30,0x716193,2,'paint');
  for(let j=0;j<3;j++){const r=torus(g,0,.2,0,.34,.043,0x5c658b);r.rotation.set(j*Math.PI/3,j*Math.PI/3,0);}
  for(const dx of [-.32,.32])rock(g,dx,.2,0,.08,.13,.13,0xbbeff0,1);
  cylinder(g,0,.57,0,.075,.10,0xb7aaa0,16);torus(g,-.07,.66,0,.07,.012,0xbbc7bf).rotation.y=Math.PI/2;
 }else if(item.id==='launchpad'){
  const p=launchpadModel(raw);p.scale.setScalar(.37);p.position.y=.06;g.add(p);
 }else if(item.id==='popper'){
  // Segmented grenade body, collar, safety lever, and a visible pull ring.
  latheItem(g,'frag-core',[[0,-.075],[.15,-.075],[.24,.03],[.24,.32],[.19,.48],[.09,.54]],0x354d40,'paint');
  cylinder(g,0,-.06,0,.19,.06,0x334c43,12);cylinder(g,0,.58,0,.11,.13,0x35454e,10);
  for(let row=0;row<3;row++)for(let j=0;j<8;j++){const a=j*Math.PI/4;const m=box(g,Math.cos(a)*.235,.02+row*.15,Math.sin(a)*.235,.155,.12,.05,0x617750,'paint');m.rotation.y=Math.PI/2-a;}
  const r=torus(g,-.08,.72,0,.12,.025,0xc9d4cf);r.rotation.y=Math.PI/2;
  rounded(g,.17,.57,0,.32,.055,.13,0xd6b466,.012);const lever=rounded(g,.30,.38,0,.055,.38,.13,0xd6b466,.012);lever.rotation.z=-.18;
 }else rock(g,0,.2,0,.3,.35,.3,c,1);
 finishItem(g);
 if(ground){const ring=new THREE.Mesh(geo('loot-ring',()=>new THREE.RingGeometry(.4,.51,32)),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;ring.userData.ownedMaterial=true;g.add(ring);}
 return g;
}
