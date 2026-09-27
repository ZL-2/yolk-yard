import * as THREE from 'three';
import {artKit,buildingStyle} from './royale-art.js';
import {groundAt,terrainColor} from './terrain.js';
export function dressIslandBuilding(g,b,raw){
 const {block:box,beam,cone,rock,cylinder,torus}=artKit(raw),s=buildingStyle(b),{x,z,w,d,h,baseY:y,floors,type}=b;
 for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2])box(g,x+dx,y+h/2,z+dz,.43,h,.43,s.trim);
 for(let f=0;f<floors;f++){
  const fy=y+f*4.2;
  for(const dz of [-d/2,d/2]){
   box(g,x,fy+3.05,z+dz,3.3,.12,.5,s.trim);
   for(const dx of [-1.66,1.66])box(g,x+dx,fy+1.5,z+dz,.13,3,.5,s.wood);
   for(const side of [-1,1]){const span=(w-3.2)/2,xx=x+side*(1.6+span/2),ww=Math.min(2.3,span-1);
    box(g,xx,fy+.91,z+dz,ww+.25,.12,.64,s.trim);box(g,xx,fy+3.06,z+dz,ww+.25,.12,.53,s.trim);
    for(const edge of [-1,1])box(g,xx+edge*ww/2,fy+2,z+dz,.09,2.12,.43,s.trim);
   }
  }
  for(const dx of [-w/2,w/2]){
   box(g,x+dx,fy+4.15,z,.44,.15,d+.25,s.trim);
   for(let q=0;q<3;q++){const zz=z-d/2+(q+.5)*d/3,opening=Math.min(2.4,d/3-1.2);box(g,x+dx,fy+.91,zz,.65,.12,opening+.2,s.trim);for(const side of [-1,1])box(g,x+dx,fy+2,zz+side*opening/2,.43,2.12,.08,s.trim);}
  }
  // A narrow central rug and floor bands give each level a readable orientation.
  box(g,x+.2,fy+.015,z,2.5,.025,d-3,b.kind==='hatchery'?0x69aeba:b.kind==='farm'?0xbda56b:0xc29578);
  if(['shop','bakery','hotel','station'].includes(type)&&f===0){
   for(let j=0;j<8;j++){const awning=box(g,x-3.1+j*.87,fy+3.3,z+d/2+1.1,.86,.14,2.2,j%2?s.trim:s.roof);awning.rotation.x=.1;box(g,x-3.1+j*.87,fy+3.1,z+d/2+2.13,.86,.35,.1,j%2?s.trim:s.roof);}
  }
 }
 if(b.roof==='gable'){
  // A half-width attic canopy shelters the upper loot deck without sealing its stairwell.
  const cx=x+w*.18,r=w*.29;
  for(const side of [-1,1]){const roof=box(g,cx+side*r/2,y+h+2.1+r/2*Math.tan(.42),z,r/Math.cos(.42),.18,d+.6,s.roof);roof.rotation.z=-side*.42;}
  for(const zz of [-d/2,d/2]){beam(g,[cx-r,y+h+2.1,z+zz],[cx,y+h+2.1+r*Math.tan(.42),z+zz],.1,s.trim);beam(g,[cx,y+h+2.1+r*Math.tan(.42),z+zz],[cx+r,y+h+2.1,z+zz],.1,s.trim);for(const side of [-1,1])beam(g,[cx+side*r,y+h,z+zz],[cx+side*r,y+h+2.1,z+zz],.1,s.wood);}
 }else if(['greenhouse','hatchery','hangar'].includes(type)){
  for(const zz of [-d*.35,0,d*.35])for(let j=0;j<8;j++){const a=j*Math.PI/8,aa=(j+1)*Math.PI/8;beam(g,[x+Math.cos(a)*w*.42,y+h+Math.sin(a)*2.8,z+zz],[x+Math.cos(aa)*w*.42,y+h+Math.sin(aa)*2.8,z+zz],.08,s.trim);}
  for(const xx of [-w*.38,0,w*.38])box(g,x+xx,y+h+1.4,z,.09,.1,d*.8,s.roof);
  // Broad segmented ribs retain open routes across the roof deck.
  for(let j=0;j<10;j++){const a=(j+.5)*Math.PI/10,rr=w*.4;const panel=box(g,x+Math.cos(a)*rr,y+h+2.2+Math.sin(a)*2.6,z,.12,.26,d*.85,s.roof);panel.rotation.z=a;}
 }else if(type==='refinery'){
  for(let j=0;j<4;j++){const zz=z-d*.3+j*d*.2,cap=box(g,x+w*.16,y+h+2.9,zz,w*.6,.13,d*.22,s.roof);cap.rotation.x=-.36;box(g,x+w*.16,y+h+2.6,zz-d*.105,w*.6,.6,.06,0x8baeb5);}
  for(const zz of [-d*.4,d*.4])cylinder(g,x+w*.38,y+h+2.8,z+zz,.48,5.6,0xa0b6b4,12);
 }else{
  for(const side of [-1,1])box(g,x+side*w/2,y+h+.68,z,.35,.12,d+.2,s.trim);
  if(['lab','office','apartment','refinery'].includes(type)){box(g,x+w*.3,y+h+.6,z-d*.33,2,1.2,1.6,0x758e94);for(let i=0;i<5;i++)box(g,x+w*.3,y+h+.3+i*.14,z-d*.33+.82,1.7,.045,.02,0x384e5a);}
 }
 if(type==='bakery'){
  rock(g,x,y+h+1.7,z+d*.32,1.4,1.8,.45,0xf2d79a,1);rock(g,x,y+h+1.7,z+d*.32+.4,.65,.7,.1,0xf1b840,1);
 }
 if(type==='villa'||type==='hotel')for(const zz of [-d*.32,0,d*.32]){for(const side of [-1,1])beam(g,[x+side*w*.32,y+h,z+zz],[x+side*w*.32,y+h+2.4,z+zz],.12,s.trim);beam(g,[x-w*.35,y+h+2.4,z+zz],[x+w*.35,y+h+2.4,z+zz],.13,s.wood);}
 if(['barn','cabin','lodge','stable'].includes(type)){
  for(let yy=.5;yy<h;yy+=.8)for(const side of [-1,1])box(g,x+side*(w/2+.19),y+yy,z,.05,.08,d,s.wood);
 }else if(['warehouse','refinery','hangar','garage'].includes(type)){
  for(const side of [-1,1])for(let j=0;j<6;j++)box(g,x+side*(w/2+.2),y+h-.5,z-d/2+.5+j*(d-1)/5,.05,.5,.1,s.roof);
  beam(g,[x+w/2+.3,y+.3,z-d/2+.4],[x+w/2+.3,y+h+.8,z-d/2+.4],.12,s.roof);
 }
 // Small egg-shaped maker's mark over each entry, shared across the island's industries.
 rock(g,x,y+3.5,z+d/2+.3,.19,.26,.055,s.trim,1);
}
export function islandProp(g,p,raw){
 const k=artKit(raw),{block:box,cylinder,cone,rounded,rock,torus,beam}=k,{x,y,z,w,d,h,kind}=p;
 if(kind==='dome'){
  const shell=new THREE.Mesh(new THREE.SphereGeometry(1,20,10,Math.PI*.15,Math.PI*1.55,0,Math.PI/2),raw.mat(0xb4cfca));shell.position.set(x,y,z);shell.scale.set(4.8,4.6,4.8);g.add(shell);
  const rim=torus(g,x,y,z,4.8,.18,0xd8bd80);rim.rotation.x=Math.PI/2;
  for(const side of [-1,1])beam(g,[x+side*3.9,y-2.3,z],[x+side*3.9,y+.2,z],.2,0x829c9c);
  const tube=cylinder(g,x,y+1.3,z, .65,6.3,0xe4dcc0,12);tube.rotation.x=1.1;
 }else if(kind==='beacon'){
  cylinder(g,x,y+.3,z,2.25,.25,0x567e89,16);cone(g,x,y+2.4,z,2.6,1.2,0x365e71);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(g,[x+Math.cos(a)*2,y,z+Math.sin(a)*2],[x+Math.cos(a)*2,y+2,z+Math.sin(a)*2],.08,0xf0d29b);}
  rock(g,x,y+1,z,.8,1.2,.8,0xffd776,1);cylinder(g,x,y-1.1,z,.25,2.5,0x658a94,10);
 }else if(kind==='crane'){
  box(g,x,y+h/2,z,1.5,h,1.5,0xcaa756);
  for(let k=0;k<h;k+=2){beam(g,[x-.8,y+k,z+.78],[x+.8,y+k+1.8,z+.78],.09,0x846f4c);}
  box(g,x+4,y+h,z,13,.65,1.1,0xdbb660);box(g,x-3,y+h-.7,z,2.8,2,2.1,0x617e87);
  beam(g,[x+9,y+h,z],[x+9,y+3,z],.035,0x435b63);torus(g,x+9,y+2.8,z,.35,.07,0x536974);
 }else if(kind==='solar'){
  for(const sx of [-1,1])beam(g,[x+sx*w*.35,y,z],[x+sx*w*.35,y+1.2,z],.1,0x7c8f8e);
  const panel=box(g,x,y+1.3,z,w,.12,d,0x365b7f);panel.rotation.x=-.3;
  for(const sx of [-.3,0,.3])box(g,x+sx*w,y+1.42,z,.035,.02,d,0x8db5c7);
 }else if(kind==='crop'){
  cylinder(g,x,y+.58,z,.035,1.16,0x9aa251,5);for(const side of [-1,1]){const leaf=cone(g,x+side*.15,y+.75,z,.16,.55,0xc9b96e,.02);leaf.rotation.z=side*.45;}rock(g,x,y+1.2,z,.14,.35,.13,0xdbbf6c,0);
 }else if(kind==='fence'){
  for(const sx of [-1,1])box(g,x+sx*w/2,y+h/2,z,.15,h,.2,0xc0a475);for(const yy of [.35,.82])box(g,x,y+h*yy,z,w,.15,.13,0xd0b78b);
 }else if(kind==='drill'){
  for(const side of [-1,1])beam(g,[x+side*1.4,y,z],[x,y+h,z],.22,0xd1a35f);
  const bit=cone(g,x,y+h*.33,z,.4,h*.65,0x56727d,.1);bit.rotation.z=Math.PI;for(let i=0;i<6;i++){const ring=torus(g,x,y+1+i*.7,z,.45,.1,0x8da2a1);ring.rotation.x=Math.PI/2;}
 }else if(kind==='waterwheel'){
  const rim=torus(g,x,y+h/2,z,2.5,.2,0x8c734e);rim.rotation.y=Math.PI/2;
  for(let i=0;i<10;i++){const a=i*Math.PI/5;beam(g,[x,y+h/2,z],[x,y+h/2+Math.cos(a)*2.5,z+Math.sin(a)*2.5],.12,0xb19665);const plank=box(g,x,y+h/2+Math.cos(a)*2.5,z+Math.sin(a)*2.5,1.5,.18,.6,0xb19665);plank.rotation.x=a;}
 }else if(kind==='telescope'){
  cylinder(g,x,y+h*.35,z,.5,h*.7,0x718d9b,12);const tube=cylinder(g,x,y+h*.85,z,.75,4,0xd6e0ca,16);tube.rotation.x=.9;
 }else if(['car','truck'].includes(kind)){
  rounded(g,x,y+.55,z,w,h*.36,d,0x497c82,.18);rounded(g,x,y+h*.68,z-d*.14,w*.84,h*.48,d*.47,0xe1b574,.17);
  box(g,x,y+h*.73,z-d*.38,w*.7,h*.27,.04,0x8dc5cc);
  for(const sx of [-1,1])for(const sz of [-1,1]){const wheel=cylinder(g,x+sx*w*.48,y+.36,z+sz*d*.31,.4,.25,0x34474c,10);wheel.rotation.z=Math.PI/2;}
  for(const sx of [-1,1])box(g,x+sx*w*.34,y+.6,z-d*.51,.32,.23,.04,0xffdda0);
  if(kind==='truck')box(g,x,y+1.4,z+d*.23,w*.94,1.5,d*.43,0xa0b7b0);
 }else if(kind==='container'){
  box(g,x,y+h/2,z,w,h,d,p.seed%2?0xc16f4e:0x518591);for(let i=0;i<14;i++)for(const side of [-1,1])box(g,x-w/2+.3+i*(w-.6)/13,y+h/2,z+side*d/2,.075,h,.045,0x345d6d);
  for(const zz of [-d/2+.2,d/2-.2])box(g,x+w/2+.03,y+h/2,z+zz,.045,h,.07,0xd1c18c);
 }else if(['tank','silo','incubator'].includes(kind)){
  cylinder(g,x,y+h*.46,z,w*.49,h*.92,kind==='incubator'?0xd3dfca:0x9bafb0,16);cone(g,x,y+h*.96,z,w*.5,h*.16,0x587787);
  for(const yy of [.18,.52,.84]){const r=torus(g,x,y+h*yy,z,w*.5,.07,0xd2b778);r.rotation.x=Math.PI/2;}
  for(let yy=.7;yy<h;yy+=.6)box(g,x,y+yy,z-d*.51,.65,.07,.12,0x485d68);
  if(kind==='incubator'){rock(g,x,y+h*.68,z+w*.49,1.15,1.5,.14,0x75d8d4,1);for(const a of [-1,1])beam(g,[x+a*1.5,y,z],[x+a*2.2,y+h*.55,z],.18,0x638e98);}
 }else if(kind==='radio'){
  for(const side of [-1,1])beam(g,[x+side*2,y,z],[x,y+h,z],.12,0x697c87);
  for(let yy=1;yy<h-1;yy+=1.5)beam(g,[x-1.2,y+yy,z],[x+1.2,y+yy+1,z],.07,0xc7b57e);
  const dish=cone(g,x,y+h*.82,z,2.2,1.3,0xe2d6b2,.2);dish.rotation.x=.9;rock(g,x,y+h+1,z,.35,.5,.35,0xd79260,1);
 }else if(kind==='clock'){
  box(g,x,y+h*.42,z,w,h*.84,d,0xd9bb89);cone(g,x,y+h*.93,z,w*.75,h*.2,0x47737d);
  for(const side of [-1,1]){const face=cylinder(g,x,y+h*.73,z+side*(d/2+.04),1,.06,0xffe5aa,16);face.rotation.x=Math.PI/2;box(g,x,y+h*.73+.25,z+side*(d/2+.09),.075,.6,.04,0x345b67);box(g,x+.2,y+h*.73,z+side*(d/2+.09),.45,.075,.04,0x345b67);}
 }else if(kind==='console'){
  box(g,x,y+.4,z,w,.8,d,0x738d95);const face=box(g,x,y+1,z-.12,w*.82,.6,.11,0x254b61);face.rotation.x=-.22;
  for(let i=0;i<3;i++)box(g,x-w*.25+i*w*.25,y+1,z-.05,.23,.12,.03,0x7ad2ce);
 }else if(kind==='shelf'){
  for(const sx of [-1,1])box(g,x+sx*w/2,y+h/2,z,.12,h,d,0x826548);for(let i=0;i<3;i++){box(g,x,y+.2+i*h*.4,z,w,.12,d,0xa1855f);for(let j=0;j<3;j++)box(g,x-w*.3+j*w*.3,y+.5+i*h*.4,z,.35,.45,d*.75,[0xa9b990,0xc29365,0x759ba3][j]);}
 }else if(kind==='bed'){
  box(g,x,y+.32,z,w,.48,d,0x8a674c);rounded(g,x,y+.63,z,w,.24,d,0xdfd6b1,.12);box(g,x,y+.81,z+d*.15,w,.15,d*.63,0x7ba8a3);rounded(g,x,y+.85,z-d*.3,w*.72,.2,.4,0xf5e6c4,.08);
 }else if(kind==='sofa'){
  rounded(g,x,y+.4,z,w,.55,d,0x6c9991,.14);rounded(g,x,y+.83,z-d*.4,w,.6,.25,0x5e877e,.1);for(const sx of [-1,1])rounded(g,x+sx*w*.46,y+.65,z,.2,.6,d,0x52786f,.08);
 }else if(kind==='counter'){
  box(g,x,y+.45,z,w,.9,d,0xc3a474);box(g,x,y+.95,z,w+.1,.12,d+.1,0xe3d7b4);for(const sx of [-1,1]){box(g,x+sx*w*.25,y+.52,z+d*.51,w*.42,.58,.025,0x96744e);box(g,x+sx*w*.25,y+.61,z+d*.54,.28,.04,.04,0xf0d497);}
 }else if(kind==='bush'){for(let i=0;i<3;i++)rock(g,x+(i-1)*w*.23,y+h*.5,z,w*.4,h*.65,d*.5,i%2?0x67894e:0x7e9e5b,1);
 }else if(kind==='crystal'){const shard=cone(g,x,y+h/2,z,w*.65,h,0x78bac0,.2);shard.rotation.z=.2;rock(g,x,y+.3,z,w,.5,d,0x8b9e94,1);
 }else if(kind==='campfire'){for(let i=0;i<8;i++){const a=i*Math.PI/4;rock(g,x+Math.cos(a),y+.2,z+Math.sin(a),.35,.3,.35,0x7c857b,1);}for(const angle of [-.7,.7]){const log=cylinder(g,x,y+.25,z,.15,1.5,0x755b46,8);log.rotation.set(Math.PI/2,angle,0);}
 }else if(kind==='bollard'){cylinder(g,x,y+.5,z,.17,1,0x4f6a72,8);cylinder(g,x,y+1.0,z,.24,.12,0xddc084,8);
 }else return false;
 return true;
}
export function roadMesh(map,road,material){
 const positions=[],colors=[];
 for(let i=1;i<road.points.length;i++){
  const [ax,az]=road.points[i-1],[bx,bz]=road.points[i],length=Math.hypot(bx-ax,bz-az),steps=Math.ceil(length/2),nx=-(bz-az)/length*road.width/2,nz=(bx-ax)/length*road.width/2;
  for(let j=0;j<steps;j++){
   const verts=[];for(const [t,side]of [[j/steps,-1],[j/steps,1],[(j+1)/steps,-1],[(j+1)/steps,1]]){const x=ax+(bx-ax)*t+nx*side,z=az+(bz-az)*t+nz*side;verts.push([x,groundAt(map,x,z)+.035,z]);}
   for(const k of [0,1,2,2,1,3])positions.push(...verts[k]);
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,material);m.userData.ownedMaterial=true;m.receiveShadow=true;return m;
}
