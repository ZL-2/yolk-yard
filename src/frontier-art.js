import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const FRONTIER_COLORS={concrete:0x82928f,slate:0x344c59,canvas:0xada68b,steel:0x475e68,teal:0x397a7f,rust:0x9b6951,olive:0x6b775b,equipment:0x4b5e60,light:0xa9d4c5,amber:0xd6b57b,dark:0x203642};
const boxGeo=new THREE.BoxGeometry(1,1,1),cylinderGeo=new THREE.CylinderGeometry(1,1,1,10),coneGeo=new THREE.ConeGeometry(1,1,7),rockGeo=new THREE.IcosahedronGeometry(1,1);
// Vertex-coloured, opaque scenery is baked into one mesh per static section.
// No per-window lights, transparent panes, texture downloads or per-frame scene rebuilding.
export class FrontierArt{
 constructor(){this.parts=[];this.features=0;}
 add(geometry,color,x,y,z,sx,sy,sz,rotation=null){
  const g=geometry.index?geometry.toNonIndexed():geometry.clone(),matrix=new THREE.Matrix4(),q=new THREE.Quaternion();if(rotation)q.setFromEuler(new THREE.Euler(...rotation));matrix.compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(sx,sy,sz));g.applyMatrix4(matrix);g.deleteAttribute('uv');
  const c=new THREE.Color(typeof color==='string'?FRONTIER_COLORS[color]:color),count=g.attributes.position.count,colors=new Float32Array(count*3);for(let i=0;i<count;i++){colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));this.parts.push(g);this.features++;
 }
 box(x,y,z,w,h,d,color='concrete',rotation){this.add(boxGeo,color,x,y,z,w,h,d,rotation);}
 cylinder(x,y,z,r,h,color='steel',rotation){this.add(cylinderGeo,color,x,y,z,r,h,r,rotation);}
 cone(x,y,z,r,h,color='olive'){this.add(coneGeo,color,x,y,z,r,h,r);}
 rock(x,y,z,w,h,d,color=0x738581){this.add(rockGeo,color,x,y,z,w,h,d);}
 beam(a,b,width,color='steel'){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),dir=to.clone().sub(from),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize()),e=new THREE.Euler().setFromQuaternion(q),mid=from.add(to).multiplyScalar(.5);this.box(mid.x,mid.y,mid.z,width,dir.length(),width,color,[e.x,e.y,e.z]);}
 building(x,z,w,d,h,color='slate'){
  this.box(x,h/2,z,w,h,d,color);this.box(x,.22,z,w+.12,.44,d+.12,'concrete');this.box(x,h+.16,z,w+.5,.32,d+.5,'steel');
  // Layered coping, inset window panels, frames and wall buttresses.
  for(const side of [-1,1]){
   const face=z+side*(d/2+.04);for(let px=x-w/2+1.2;px<x+w/2-.8;px+=2.6){this.box(px,h*.56,face,1.8,1.9,.1,'dark');this.box(px,h*.56,face+side*.07,1.47,1.55,.06,'light');this.box(px,h*.56,face+side*.11,.06,1.62,.05,'steel');this.box(px,h*.56-.82,face+side*.1,1.85,.12,.2,'steel');}
   for(const px of [x-w/2+.22,x+w/2-.22])this.box(px,h/2,face+.04,.33,h,.32,'concrete');
   this.box(x,h*.85,face,w,.14,.12,'amber');
  }
  for(const side of [-1,1])for(let pz=z-d/2+1.4;pz<z+d/2-1;pz+=2.8){const xx=x+side*(w/2+.04);this.box(xx,h*.54,pz,.08,1.9,1.8,'dark');this.box(xx+side*.06,h*.54,pz,.03,1.5,1.4,'light');this.box(xx+side*.08,h*.54,pz,.04,1.55,.07,'steel');this.box(xx,h*.85,pz,.09,.14,2.3,'amber');}
  for(const sign of [-1,1])this.box(x+sign*w*.25,h+.5,z,w*.53,.16,d+.6,'steel',[0,0,-sign*.08]);
  this.box(x-w*.25,h+.65,z+d*.2,w*.25,.7,d*.25,'equipment');for(let i=0;i<5;i++)this.box(x-w*.25,h+1.01,z+d*.2+(i-2)*.17,w*.21,.035,.045,'dark');
  this.cylinder(x+w*.32,h+.8,z-d*.27,.06,1.6);this.box(x+w*.32,h+1.61,z-d*.27,.8,.05,.12,'amber');
 }
 wallDetail(b){
  const {x,z,w,d,h,y=0}=b,color=FRONTIER_COLORS[b.color]||FRONTIER_COLORS.concrete;
  this.box(x,y+h/2,z,w,h,d,color);
  if(b.kind==='building'){
   const longX=w>d;for(let at=-Math.max(w,d)/2+1.1;at<Math.max(w,d)/2-.65;at+=2.4)for(const sign of [-1,1]){
    const px=x+(longX?at:sign*(w/2+.04)),pz=z+(longX?sign*(d/2+.04):at),ww=longX?1.3:.08,dd=longX?.08:1.3;
    this.box(px,y+h*.58,pz,ww,1.5,dd,'dark');this.box(px+(longX?0:sign*.055),y+h*.58,pz+(longX?sign*.055:0),longX?1.06:.025,1.15,longX?.025:1.06,'light');
   }
   this.box(x,y+h-.3,z,w+.04,.12,d+.04,'amber');
  }
  if(b.kind==='roof'){this.box(x,y+h+.09,z,w+.2,.18,d+.2,'steel');for(let t=-w/2+.5;t<w/2;t+=1.5)this.box(x+t,y+h+.19,z,.045,.035,d,0x819494);}
  if(b.kind==='container')this.containerDetails(x,z,w,d,h,y);
  if(b.kind==='supply'){for(const yy of [.15,h-.15])this.box(x,y+yy,z,w+.05,.16,d+.05,'steel');for(const dx of [-w*.32,w*.32])this.box(x+dx,y+h/2,z,.18,h+.04,d+.06,'canvas');}
  if(b.kind==='generator'){for(let k=0;k<5;k++)this.box(x,y+h*.6+(k-2)*.21,z+d/2+.025,w*.65,.07,.04,'dark');this.box(x+w*.25,y+h+.22,z,.4,.44,d*.65,'steel');this.cylinder(x-w*.25,y+h+.4,z,.14,.8,'rust');}
  if(['platform','bridge'].includes(b.kind))for(let t=-w/2+.5;t<w/2;t+=2)this.box(x+t,y+h+.01,z,.04,.02,d,0x566b6e);
  if(b.kind==='boundary'){this.box(x,y+h+.13,z,w+.15,.25,d+.15,'steel');const along=w>d;for(let t=-Math.max(w,d)/2+2;t<Math.max(w,d)/2;t+=7)this.box(x+(along?t:0),2.1,z+(along?0:t),along?.35:w+.2,4.2,along?d+.2:.35,'slate');}
 }
 containerDetails(x,z,w,d,h,y=0){const long=w>d;for(let at=-Math.max(w,d)/2+.35;at<Math.max(w,d)/2;at+=.75)for(const side of [-1,1])this.box(x+(long?at:side*(w/2+.025)),y+h/2,z+(long?side*(d/2+.025):at),long?.065:.055,h-.15,long?.055:.065,'steel');for(const yy of [.08,h+.02])this.box(x,y+yy,z,w+.08,.16,d+.08,'steel');for(const side of [-1,1])for(const bar of [-.65,.65])this.box(x+(long?side*(w/2+.05):bar),y+h/2,z+(long?bar:side*(d/2+.05)),long?.06:.08,h-.45,long?.08:.06,'canvas');this.box(x,y+h*.63,z+d/2+.06,Math.min(2.8,w*.7),.22,.035,'amber');}
 container(x,z,w,d,h,color='teal',y=0){this.box(x,y+h/2,z,w,h,d,color);this.containerDetails(x,z,w,d,h,y);}
 radar(x,z,y=0){this.box(x,y+.8,z,4,1.6,4,'equipment');this.cylinder(x,y+4,z,.16,6.5);for(const side of [-1,1])this.beam([x+side*2,y,z],[x,y+6,z],.12);this.box(x,y+6.3,z,6.5,2.3,.2,'light',[.35,.3,0]);for(let i=-2;i<=2;i++)this.box(x+i,y+6.3,z+.17,.07,2.2,.06,'steel',[.35,.3,0]);this.box(x,y+6.3,z+.22,6.4,.06,.06,'steel');this.box(x,y+8,z,.06,1,.06,'amber');}
 crane(x,z){for(const side of [-1,1]){this.box(x+side*3.3,7,z,.5,14,.8,'amber');this.beam([x+side*3.3,0,z],[x,13,z],.2,'steel');}this.box(x,14,z,22,.7,1.2,'amber');for(let t=-10;t<10;t+=3)this.beam([x+t,14,z],[x+t+2,16,z],.14,'steel');this.box(x,16,z,22,.2,.7,'steel');this.cylinder(x+7,10,z,.06,10);this.box(x+7,5,z,.8,.6,.8,'dark');this.box(x-5,14.7,z,3.4,2.2,2,'slate');this.box(x-5,14.8,z+1.04,2.5,1.2,.04,'light');}
 lamp(x,z){this.cylinder(x,2.9,z,.09,5.8);this.box(x,5.7,z,1.4,.18,.6,'slate');this.box(x,5.59,z,1.1,.04,.45,'amber');this.box(x,.18,z,.6,.36,.6,'concrete');}
 pine(x,z,height=7){this.cylinder(x,height*.25,z,.2,height*.5,0x605d4e);for(let i=0;i<3;i++)this.cone(x,height*(.46+i*.15),z,height*(.27-i*.05),height*.46,i%2?0x4c6b61:0x5c7965);}
 truck(x,z){this.box(x,.8,z,2.8,.35,6,'dark');this.box(x,1.8,z+1.8,2.8,2,2.3,'olive');this.box(x,2.3,z+3,2.25,.9,.04,'light');this.box(x,1.4,z-1.4,2.8,1.1,3.4,'olive');for(const sign of [-1,1])for(const zz of [-1.8,1.8])this.cylinder(x+sign*1.4,.63,z+zz,.6,.3,'dark',[0,0,Math.PI/2]);this.box(x,1.05,z+3.2,3,.18,.22,'steel');for(const sign of [-1,1])this.box(x+sign*.9,1.3,z+3.02,.45,.3,.04,'amber');}
 bake(parent){const geometry=mergeGeometries(this.parts);for(const p of this.parts)p.dispose();this.parts=[];const material=new THREE.MeshLambertMaterial({vertexColors:true}),mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.ownedMaterial=true;parent.add(mesh);return mesh;}
}
function sign(world,x,y,z,text){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;const ctx=canvas.getContext('2d');ctx.fillStyle='#203642';ctx.fillRect(0,0,1024,192);ctx.fillStyle='#ddc690';ctx.font='800 60px system-ui';ctx.textAlign='center';ctx.fillText(text,512,118);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(12,2.25),material);mesh.position.set(x,y,z);mesh.userData.ownedMaterial=true;world.add(mesh);}
export function buildFrontierArena(world,map){
 const a=new FrontierArt();a.box(0,-.45,0,map.size*2+100,.6,map.size*2+100,map.district==='freight port'?0x4c7887:0x657d72);a.box(0,-.13,0,map.size*2,.26,map.size*2,map.ground);
 for(const [i,[x,z,w,d,c]]of map.lanes.entries())a.box(x,.02+i*.003,z,w,.03,d,c==='road'?0x4c6067:0x91a099);
 for(const [x,z,w,d]of map.lanes)if(w>d)for(let px=x-w/2+3;px<x+w/2;px+=6)a.box(px,.048,z,2.1,.012,.1,'amber');else for(let pz=z-d/2+3;pz<z+d/2;pz+=6)a.box(x,.048,pz,.1,.012,2.1,'amber');
 for(const b of map.boxes)a.wallDetail(b);
 for(const p of map.landmarks){if(p.type==='radar')a.radar(p.x,p.z,p.y);if(p.type==='crane')a.crane(p.x,p.z);if(p.type==='chimneys'){for(const dx of [-3,3]){a.cylinder(p.x+dx,9,p.z,1.4,18,'rust');a.cylinder(p.x+dx,15,p.z,1.44,.55,'canvas');}a.building(p.x,p.z,12,13,7,'slate');}if(p.type==='factory')a.building(p.x,p.z,25,8,8,'rust');if(p.type==='ship'){a.box(p.x,-.4,p.z,32,2.2,9,'slate');a.building(p.x+9,p.z,8,7,7,'canvas');a.container(p.x-7,p.z,12,5,3,'rust',.7);}}
 for(let i=0;i<12;i++){const angle=i*Math.PI/6,r=map.size+18,x=Math.sin(angle)*r,z=Math.cos(angle)*r;if(map.district==='uplink compound'){a.rock(x,1,z,5,4,5);a.pine(x+3,z+2,7+i%3);}else if(i%3===0)a.building(x,z,10,9,5+i%3,'slate');}
 for(const x of [-map.size+3,map.size-3])for(const z of [-25,25])a.lamp(x,z);
 for(const p of map.details||[]){
  if(p.type==='checkpoint'){a.box(p.x,3.6,p.z,5.8,.4,1.2,'slate');for(const side of [-1,1])a.box(p.x+side*2.7,1.8,p.z,.25,3.6,.3,'amber');a.box(p.x,3.3,p.z+.65,2,.25,.04,'light');}
  if(p.type==='cargo-hook'){a.cylinder(p.x,11,p.z,.06,8,'steel');a.box(p.x,7,p.z,1,.6,1,'dark');for(const side of [-1,1])a.beam([p.x+side*11,15,p.z],[p.x,17,p.z],.14,'steel');}
  if(p.type==='freight')for(let i=0;i<3;i++)a.box(p.x+(i-1)*.45,1.4,p.z+2.53,.2,.6,.04,'canvas');
  if(p.type==='pipework')for(const x of [-8,8]){a.cylinder(p.x+x,6.2,p.z,.25,20,'rust',[Math.PI/2,0,0]);for(const z of [-7,0,7])a.box(p.x+x,5.7,p.z+z,.65,.2,.3,'steel');}
  if(p.type==='furnace'){a.box(p.x,1.15,p.z+1.53,2,.75,.05,'dark');for(let n=-2;n<=2;n++)a.box(p.x+n*.3,1.15,p.z+1.57,.09,.7,.04,'amber');}
 }
 a.bake(world);for(const [i,text]of (map.story||[]).entries())sign(world,(i-1)*20,3.1,map.size-1,text.toUpperCase());sign(world,0,6,-map.size+.9,'RAVELFRONT / '+map.name.toUpperCase());world.userData.frontierDetails=a.features;
}
