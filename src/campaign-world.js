import * as T from 'three';
import {createFacilityLayout,floorAt,surfaceHeight,CollisionIndex,moveFacilityBody} from './campaign-layout.js';
import {FacilityNavigator} from './campaign-navigation.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function surface(kind){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),rand=rng(kind.length*971),data=c.createImageData(256,256);
 for(let i=0;i<data.data.length;i+=4){const n=rand(),v=(kind==='asphalt'?96:170)+(n-.5)*(kind==='asphalt'?85:42);data.data[i]=data.data[i+1]=data.data[i+2]=v;data.data[i+3]=255;}c.putImageData(data,0,0);
 if(kind==='concrete'){c.fillStyle='rgba(20,25,28,.19)';c.fillRect(0,0,256,2);c.fillRect(0,0,2,256);for(const [x,y]of [[8,8],[248,8],[8,248],[248,248]]){c.beginPath();c.arc(x,y,2,0,7);c.fill();}for(let i=0;i<28;i++){c.fillStyle='rgba(30,35,40,.055)';c.fillRect(rand()*256,rand()*35,2+rand()*7,50+rand()*180);}for(let i=0;i<350;i++){c.fillStyle=rand()>.5?'rgba(230,232,220,.1)':'rgba(35,39,32,.1)';c.beginPath();c.ellipse(rand()*256,rand()*256,rand()*12,rand()*6,rand()*3,0,7);c.fill();}}
 if(kind==='metal'){c.fillStyle='rgba(20,25,25,.18)';for(let x=0;x<256;x+=32){c.fillRect(x,0,3,256);c.fillStyle='rgba(240,245,250,.10)';c.fillRect(x+3,0,2,256);c.fillStyle='rgba(20,25,25,.18)';}}
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function labelTexture(text,sub='',color='#d9c89a'){
 const c=document.createElement('canvas');c.width=512;c.height=192;const g=c.getContext('2d');g.fillStyle='#182326';g.fillRect(0,0,512,192);g.strokeStyle=color;g.lineWidth=4;g.strokeRect(12,12,488,168);g.fillStyle=color;g.font='bold 47px monospace';g.textAlign='center';g.fillText(text,256,88);g.font='19px monospace';g.fillText(sub,256,135);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
export function createWorld(scene){
 const layout=createFacilityLayout(),{boxes,surfaces,props,lights,covers}=layout,index=new CollisionIndex(boxes),random=rng(70937),buckets=new Map(),owned=[],dynamic=[],textures=new Set();
 const concrete=surface('concrete'),asphalt=surface('asphalt'),metal=surface('metal');[concrete,asphalt,metal].forEach(t=>textures.add(t));
 const mat=(color,map,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,map,bumpMap:map,bumpScale:map?.035:0,roughness,metalness});
 const m={concrete:mat('#747a76',concrete,.77),darkConcrete:mat('#404b4e',concrete,.84),asphalt:mat('#45545b',asphalt,.34,.2),steel:mat('#647578',metal,.38,.7),dark:mat('#202c30',metal,.55,.45),rust:mat('#674737',metal,.7,.4),olive:mat('#454e43',metal),crate:mat('#5a5b49',metal),white:mat('#d7d7bd',null,.5),black:mat('#101a20',null,.8),paint:mat('#c6b673',null,.65),glass:mat('#456470',null,.16,.83),puddle:mat('#1b282d',null,.16,.55),amber:new T.MeshBasicMaterial({color:'#ffd08b'}),cyan:new T.MeshBasicMaterial({color:'#a1d6d9'}),red:new T.MeshBasicMaterial({color:'#ef6144'}),rock:mat('#414b50',concrete,.97)};
 function add(g,material,x,y,z,rotation=[0,0,0],scale=[1,1,1]){g.applyMatrix4(new T.Matrix4().compose(V(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),V(...scale)));const key=material.uuid+':'+Math.floor(x/32)+':'+Math.floor(z/32);if(!buckets.has(key))buckets.set(key,{material,parts:[]});buckets.get(key).parts.push(g);}
 function box(x,y,z,sx,sy,sz,material=m.concrete){const g=new T.BoxGeometry(sx,sy,sz),uv=g.attributes.uv;for(let i=0;i<uv.count;i++){const f=Math.floor(i/4);uv.setXY(i,uv.getX(i)*(f<2?sz:sx)/2,uv.getY(i)*(f===2||f===3?sz:sy)/2);}add(g,material,x,y,z);}
 const cyl=(x,y,z,r,h,material=m.steel,rotation=[0,0,0],segments=12)=>add(new T.CylinderGeometry(r,r,h,segments),material,x,y,z,rotation);
 function beam(a,b,r=.035,material=m.steel){const d=V(b[0]-a[0],b[1]-a[1],b[2]-a[2]),g=new T.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));add(g,material,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);}
 function sign(text,sub,x,y,z,w=3,rotation=0){const texture=labelTexture(text,sub);textures.add(texture);const material=new T.MeshBasicMaterial({map:texture}),mesh=new T.Mesh(new T.PlaneGeometry(w,w*.375),material);mesh.position.set(x,y,z);mesh.rotation.y=rotation;scene.add(mesh);owned.push(mesh);return mesh;}
 function ring(x,y,z,r,material=m.steel,rotation=[Math.PI/2,0,0],tube=.035){add(new T.TorusGeometry(r,tube,5,64),material,x,y,z,rotation);}
 const glow=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{color:{value:new T.Color('#a88049')}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 uv0;uniform vec3 color;void main(){float a=pow(max(0.,1.-length(uv0-.5)*2.),3.)*.35;gl_FragColor=vec4(color,a);}'});
 function lightPool(x,y,z,color='#a88049',size=13){const material=glow.clone();material.uniforms.color.value.set(color);const mesh=new T.Mesh(new T.PlaneGeometry(size,size),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y+.015,z);scene.add(mesh);owned.push(mesh);}
 // Immutable measured geometry. Dynamic gates own both the mesh and the same collider.
 for(const b of boxes){if(b.unlock){const mesh=new T.Mesh(new T.BoxGeometry(b.sx,b.sy,b.sz),m.steel);mesh.position.set(b.x,b.y,b.z);scene.add(mesh);owned.push(mesh);dynamic.push({box:b,mesh});}else if(!b.invisible)box(b.x,b.y,b.z,b.sx,b.sy,b.sz,m[b.material]);
  if(b.cover){for(const x of [b.x-b.sx*.35,b.x+b.sx*.35])box(x,b.y,b.z,.06,b.sy+.04,b.sz+.05,m.steel);if(b.material==='olive')for(let z=b.z-b.sz/2+.25;z<b.z+b.sz/2;z+=.4)for(const x of [b.x-b.sx/2-.02,b.x+b.sx/2+.02])box(x,b.y,z,.04,b.sy,.07,m.steel);}
 }
 for(const s of surfaces){
  if(s.ramp){const a=surfaceHeight(s,s.x,s.z-s.sz/2),b=surfaceHeight(s,s.x,s.z+s.sz/2),pos=[s.x-s.sx/2,a,s.z-s.sz/2,s.x+s.sx/2,a,s.z-s.sz/2,s.x+s.sx/2,b,s.z+s.sz/2,s.x-s.sx/2,b,s.z+s.sz/2],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,s.sx/2,0,s.sx/2,s.sz/2,0,s.sz/2],2));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();add(g,m.concrete,0,0,0);
   for(let z=s.z-s.sz/2+.3;z<s.z+s.sz/2;z+=s.id.includes('stairs')?.45:2){const y=surfaceHeight(s,s.x,z);if(s.id.includes('stairs')){box(s.x,y,z,s.sx,.18,.45,m.steel);box(s.x,y+.095,z-.2,s.sx,.025,.045,m.paint);}else box(s.x,y+.014,z,s.sx,.025,.05,m.paint);}
   for(const x of [s.x-s.sx/2+.08,s.x+s.sx/2-.08]){beam([x,a+1.05,s.z-s.sz/2],[x,b+1.05,s.z+s.sz/2]);for(let z=s.z-s.sz/2;z<=s.z+s.sz/2;z+=2)cyl(x,surfaceHeight(s,x,z)+.5,z,.035,1.05);}
  }else if(!/upper|roof/.test(s.id)){
   // Concrete terrace retaining faces embedded in the natural cliff, down to rock.
   box(s.x,(s.y-3)/2,s.z,s.sx,s.y+3,s.sz,m.darkConcrete);
   box(s.x,s.y-.22,s.z,s.sx+.15,.18,s.sz+.15,m.concrete);
  }
 }
 // Rail the exposed platform edges; omit rails wherever a neighbouring floor connects.
 for(const s of surfaces.filter(s=>!s.ramp&&!/upper|roof/.test(s.id))){for(const axis of ['x','z'])for(const side of [-1,1]){
  const len=axis==='x'?s.sx:s.sz;for(let t=-len/2+1;t<len/2;t+=2){const x=s.x+(axis==='x'?t:side*s.sx/2),z=s.z+(axis==='x'?side*s.sz/2:t),nx=x+(axis==='z'?side*.6:0),nz=z+(axis==='x'?side*.6:0),outside=floorAt(surfaces,nx,nz,s.y+.6);
   if(Math.abs(outside-s.y)<1.3)continue;const indoors=x>=7.5&&x<=56.5&&z>=-30.5&&z<=6.5;if(indoors)continue;
   cyl(x,s.y+.5,z,.035,1);const dx=axis==='x'?1:0,dz=axis==='z'?1:0;for(const y of [s.y+.55,s.y+1.05])beam([x-dx,y,z-dz],[x+dx,y,z+dz]);
  }
 }}
 function consoleProp(x,y,z){box(x,y+.91,z,3.1,.08,1.3,m.steel);for(const xx of [-.7,.7]){box(x+xx,y+1.35,z-.2,.85,.54,.06,m.dark);box(x+xx,y+1.35,z-.161,.74,.43,.015,m.cyan);for(let row=0;row<3;row++)box(x+xx,y+1.2+row*.1,z-.15,.55,.012,.01,m.dark);}box(x,y+.97,z+.25,1,.035,.28,m.black);cyl(x,y+.4,z+1.2,.035,.7);box(x,y+.6,z+1.2,.5,.1,.5,m.dark);box(x,y+.9,z+1.45,.5,.6,.08,m.dark);}
 function terminal(p){box(p.x,p.y+.8,p.z,1.3,1.6,.55,m.steel);box(p.x,p.y+1.4,p.z+.29,1.05,.6,.04,m.black);sign(p.label,p.sub,p.x,p.y+1.42,p.z+.32,1.05);box(p.x+.48,p.y+.7,p.z+.31,.09,.09,.02,m.amber);}
 function hvac(x,y,z){box(x,y+.8,z,3,1.6,2,m.steel);for(const dx of [-.75,.75]){cyl(x+dx,y+1.63,z,.55,.06,m.dark);ring(x+dx,y+1.68,z,.5,m.steel);for(let a=0;a<6;a++){const r=a*Math.PI/3;beam([x+dx,y+1.69,z],[x+dx+Math.cos(r)*.46,y+1.69,z+Math.sin(r)*.46],.025);}}for(let yy=.3;yy<1.4;yy+=.13)box(x,y+yy,z+1.02,2.6,.035,.04,m.dark);}
 function generator(x,y,z){box(x,y+1,z,3,2,4,m.olive);for(let zz=-1.5;zz<1.5;zz+=.18)box(x+1.52,y+1,z+zz,.04,1.5,.05,m.dark);cyl(x+.8,y+2.5,z-1,.1,1,m.dark);box(x,y+2.01,z,3.1,.08,4.1,m.steel);sign('POWER','STATION 07',x,y+1.2,z+2.03,2);}
 function smallDish(x,y,z,r=1.5){const g=new T.SphereGeometry(r,20,8,0,Math.PI*2,0,.9);g.rotateX(.7);add(g,m.white,x,y+1.8,z);cyl(x,y+.8,z,.07,1.6);}
 let dishAssembly=null;
 for(const p of props){const {x,y,z}=p;
  if(p.type==='terminal')terminal(p);
  if(p.type==='console')consoleProp(x,y,z);
  if(p.type==='sign')sign(p.label,p.sub,x,y,z,p.w);
  if(p.type==='rack'){for(let yy=.25;yy<2.4;yy+=.23){box(x,y+yy,z+.72,.95,.14,.04,m.steel);box(x+.36,y+yy,z+.75,.04,.04,.02,m.cyan);box(x+.25,y+yy,z+.75,.03,.03,.02,m.amber);}}
  if(p.type==='table'||p.type==='workbench'){box(x,y+.8,z,4,.15,1.8,m.steel);for(const dx of [-1.7,1.7])box(x+dx,y+.4,z,.12,.8,1.5,m.dark);if(p.type==='table'){box(x,y+.9,z,2,.025,1,m.paint);for(let i=0;i<4;i++)box(x-1.3+i*.8,y+.68,z+1.5,.5,.1,.5,m.dark);}else for(const dx of [-1,0,1])box(x+dx,y+1.15,z,.5,.6,.5,m.olive);}
  if(p.type==='hvac')hvac(x,y,z);
  if(p.type==='generator')generator(x,y,z);
  if(p.type==='radome'){cyl(x,y+.5,z,1.8,1,m.steel);add(new T.SphereGeometry(2,24,12,0,Math.PI*2,0,Math.PI/2),m.white,x,y+.9,z);}
  if(p.type==='smallDish')smallDish(x,y,z);
  if(p.type==='supply'){box(x,y+.5,z,1.4,1,.65,m.olive);sign('SUPPLIES','E / REARM & TREAT',x,y+.55,z+.34,1.1);}
  if(p.type==='gatepost'){box(x,y+2.2,z,.45,4.4,.45,m.steel);box(x,y+4.5,z,.5,.16,.5,m.amber);}
  if(p.type==='gatehouse'){box(x,y+3.5,z,8.5,.25,8.5,m.steel);box(x,y+2,z+4.03,4,1.05,.04,m.glass);sign('07','PERIMETER CONTROL',x,y+2.9,z+4.06,3);box(x,y+1,z+4.1,.1,2,.1,m.dark);}
  if(p.type==='truck'){
   box(x,y+.85,z,2.8,.65,6,m.dark);box(x,y+1.85,z-1.8,2.65,1.65,2,m.olive);box(x,y+2.1,z-2.83,2.35,.8,.04,m.glass);box(x,y+1.5,z+1.4,2.8,.5,3,m.olive);for(const xx of [x-1.4,x+1.4]){box(xx,y+1.8,z+1.4,.1,.6,3,m.steel);for(const zz of [z-1.9,z+1.9]){cyl(xx,y+.65,zz,.6,.38,m.black,[0,0,Math.PI/2],18);cyl(xx+(xx<x?-.2:.2),y+.65,zz,.26,.04,m.steel,[0,0,Math.PI/2]);}}for(const xx of [-1,1])box(x+xx,y+1.2,z-2.85,.4,.22,.05,m.amber);

  }
  if(p.type==='helipad'){
   ring(x,y+.03,z,12,m.paint,[Math.PI/2,0,0],.13);for(const xx of [-2.3,2.3])box(x+xx,y+.04,z,.45,.05,6,m.paint);box(x,y+.04,z,4.6,.05,.45,m.paint);
   for(let a=0;a<Math.PI*2;a+=Math.PI/8){const xx=x+Math.cos(a)*13,zz=z+Math.sin(a)*13;box(xx,y+.08,zz,.22,.12,.22,m.amber);}sign('EXTRACTION','NORTH / PAD 01',x,y+1.6,z-11,4);
  }
  if(p.type==='mast'){
   const h=48;for(const [dx,dz]of [[-1.3,-1.3],[1.3,-1.3],[1.3,1.3],[-1.3,1.3]]){beam([x+dx,y,z+dz],[x+dx*.3,y+h,z+dz*.3],.11);}
   for(let yy=0;yy<h;yy+=3){const k=1-yy/h*.7,k2=1-(yy+3)/h*.7;for(const side of [-1,1]){beam([x-1.3*k,y+yy,z+side*1.3*k],[x+1.3*k2,y+yy+3,z+side*1.3*k2],.045);beam([x+side*1.3*k,y+yy,z-1.3*k],[x+side*1.3*k2,y+yy+3,z+1.3*k2],.045);}if(yy%12===0){box(x,y+yy,z,3,.12,3,m.steel);box(x,y+yy+.2,z,.2,.2,.2,m.red);smallDish(x+1.6,y+yy,z,.9);}}
   box(x,y+h,z,.2,.3,.2,m.red);for(const [dx,dz]of [[-12,0],[7,-10]])beam([x,y+35,z],[x+dx,y,z+dz],.016);
  }
  if(p.type==='dish'){
   // 28 m paraboloid, 24 radial ribs, concentric bracing and three feed struts.
   const group=new T.Group(),parts=[],radius=14,rings=16,segments=64,vertices=[],uv=[],indices=[];
   for(let r=0;r<=rings;r++)for(let a=0;a<=segments;a++){const rr=radius*r/rings,angle=a/segments*Math.PI*2;vertices.push(Math.cos(angle)*rr,rr*rr/56,Math.sin(angle)*rr);uv.push(a/segments,r/rings);}
   for(let r=0;r<rings;r++)for(let a=0;a<segments;a++){const i=r*(segments+1)+a;indices.push(i,i+1,i+segments+1,i+1,i+segments+2,i+segments+1);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const dm=new T.MeshStandardMaterial({color:'#adb6b3',metalness:.67,roughness:.39,side:T.DoubleSide});group.add(new T.Mesh(g,dm));
   const localBeam=(a,b,r=.055)=>{const d=new T.Vector3(...b).sub(new T.Vector3(...a)),gg=new T.CylinderGeometry(r,r,d.length(),6);gg.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));gg.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);parts.push(gg.toNonIndexed());gg.dispose();};
   for(let a=0;a<24;a++){const angle=a/24*Math.PI*2;for(let r=2;r<14;r+=2){const at=(rr,offset=0)=>[Math.cos(angle)*rr,rr*rr/56-.16+offset,Math.sin(angle)*rr];localBeam(at(r),at(r+2),.07);localBeam(at(r,-1),at(r+2,-1),.055);localBeam(at(r,-1),at(r+2),.035);}}
   for(const r of [3,6,9,12,14]){const gg=new T.TorusGeometry(r,.065,5,64);gg.rotateX(Math.PI/2);gg.translate(0,r*r/56-.2,0);parts.push(gg.toNonIndexed());gg.dispose();}
   for(let a=0;a<3;a++){const angle=a*Math.PI*2/3;localBeam([Math.cos(angle)*13.5,3.3,Math.sin(angle)*13.5],[0,8,0],.12);}const ribs=new T.Mesh(mergeGeometries(parts),m.steel);parts.forEach(g=>g.dispose());group.add(ribs);const feed=new T.Mesh(new T.CylinderGeometry(.5,.32,1.5,16),m.dark);feed.position.set(0,8,0);group.add(feed);group.position.set(x,y+20,z);group.rotation.set(.67,0,.12);group.traverse(o=>{o.castShadow=true;o.receiveShadow=true;});scene.add(group);owned.push(group);dishAssembly=group;
   cyl(x,y+14,z,1.5,8,m.steel,undefined,20);box(x,y+10,z,20,.4,20,m.concrete);for(const xx of [x-6,x+6])beam([xx,y+10,z-5],[x,y+20,z],.32);for(const yy of [y+10,y+16]){box(x,yy,z,9,.25,7,m.steel);for(const xx of [-4.4,4.4])beam([x+xx,yy+1,z-3.5],[x+xx,yy+1,z+3.5],.06);}
   for(let yy=y+1;yy<y+10;yy+=2){box(x,y+yy-y,z+9.04,2,.8,.04,m.glass);}sign('STATION SEVEN','PRIMARY UPLINK',x,y+7,z+9.06,7);
  }
 }
 // Detailed exterior facade: structural joints, inset glazing, conduits and cable trays.
 for(const z of [6.32,-30.32]){for(const x of [18,28,38,48]){box(x,18,z,7,1.75,.04,m.glass);for(const dx of [-3.5,0,3.5])box(x+dx,18,z+.03,.06,1.85,.08,m.steel);}for(let x=8;x<=56;x+=6)box(x,14,z,.035,3.6,.03,m.dark);}
 for(const x of [7.65,56.35]){for(let z=-28;z<=4;z+=4){box(x,15,z,.04,.7,2,m.glass);box(x,19.7,z,.05,.06,3.8,m.steel);}beam([x,15.6,-29],[x,15.6,5],.07,m.rust);}
 for(const y of [12,16])for(const z of [-10,-24,1])for(const x of [20,40]){box(x,y+3.6,z,2.2,.07,.2,m.cyan);lightPool(x,y,z,'#7199a3',10);lights.push({x,y:y-.7,z,interior:true});}
 for(const l of lights.filter(l=>!l.interior)){const {x,y,z}=l;cyl(x,y+2.5,z,.07,5);box(x,y+5,z,.65,.16,.4,m.dark);box(x,y+4.9,z,.5,.06,.3,m.amber);lightPool(x,y,z);}
 // Wet seams, drain grates and restrained reflective puddles on exterior terraces.
 for(const s of surfaces.filter(s=>!s.ramp&&!/upper|roof/.test(s.id))){for(let i=0;i<Math.floor(s.sx*s.sz/35);i++){const x=s.x+(random()-.5)*(s.sx-1),z=s.z+(random()-.5)*(s.sz-1);if(x>8&&x<56&&z>-30&&z<6)continue;const shape=new T.Shape(),radius=.3+random()*1.1;for(let n=0;n<=12;n++){const a=n/12*Math.PI*2,r=radius*(.65+random()*.35),xx=Math.cos(a)*r,zz=Math.sin(a)*r*.4;n?shape.lineTo(xx,zz):shape.moveTo(xx,zz);}shape.closePath();const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);add(g,m.puddle,x,s.y+.02,z);}if(s.sz>20)for(let z=s.z-s.sz/2+3;z<s.z+s.sz/2;z+=8){box(s.x-s.sx/2+1,s.y+.03,z,.65,.02,1.3,m.black);for(let dz=-.5;dz<=.5;dz+=.16)box(s.x-s.sx/2+1,s.y+.05,z+dz,.6,.02,.03,m.steel);}}
 // Continuous angular cliff faces wrap exposed retaining walls down into the sea.
 const coastNoise=(x,z)=>{const n=Math.sin(x*12.9898+z*78.233)*43758.5453;return n-Math.floor(n);};
 for(const s of surfaces.filter(s=>!s.ramp&&!/upper|roof/.test(s.id)))for(const axis of ['x','z'])for(const side of [-1,1]){
  const length=axis==='x'?s.sx:s.sz,n=Math.ceil(length/4);for(let i=0;i<n;i++){
   const t0=-length/2+i*length/n,t1=-length/2+(i+1)*length/n,mid=(t0+t1)/2;
   const at=t=>({x:s.x+(axis==='x'?t:side*s.sx/2),z:s.z+(axis==='x'?side*s.sz/2:t)}),center=at(mid),ox=axis==='z'?side:0,oz=axis==='x'?side:0;
   if(Math.abs(floorAt(surfaces,center.x+ox,center.z+oz,s.y+1.3)-s.y)<1.3)continue;
   const edge=t=>{const p=at(t),noise=coastNoise(p.x,p.z);return [[p.x+ox*(.5+noise),s.y-1.3+noise*.6,p.z+oz*(.5+noise)],[p.x+ox*(2.6+noise*1.8),Math.max(-1,s.y-6.5)+noise*1.5,p.z+oz*(2.6+noise*1.8)],[p.x+ox*(5+noise*2),-4.5,p.z+oz*(5+noise*2)]];};
   const a=edge(t0),b=edge(t1),v=[];for(let band=0;band<2;band++)v.push(...a[band],...b[band],...b[band+1],...a[band],...b[band+1],...a[band+1]);
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(v.flatMap((_,k)=>k%3===0?[v[k]/4,v[k+1]/4]:[]),2));g.computeVertexNormals();add(g,m.rock,0,0,0);
  }
 }
 m.rock.side=T.DoubleSide;
 for(let i=0;i<19;i++){const z=99-i*11,x=-53+Math.sin(i*2.4)*7,g=new T.IcosahedronGeometry(3+random()*3,0).toNonIndexed();g.computeVertexNormals();add(g,m.rock,x,-3,z,[random()*.5,random()*3,random()*.4],[1,1.3+random(),.8]);}
 // Mountain silhouettes beyond the playable island retain the image's coastal scale.
 for(let a=0;a<3;a++){const g=new T.PlaneGeometry(950,190,150,24),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),d=p.getY(i),ridge=70+Math.sin(x*.011)*32+Math.sin(x*.027)*24+Math.sin(x*.087)*9;p.setXYZ(i,x,ridge*(1-Math.abs(d)/110)+Math.sin(x*.1+d*.2)*4-7,d-330);}g.computeVertexNormals();g.rotateY((a-1)*.65);add(g,m.rock,0,0,-30);}
 const waterMat=new T.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`varying vec3 worldP;uniform float time;
 void main(){vec3 v=position;v.z+=sin(v.x*.16+v.y*.09+time*.7)*.24+sin(v.x*.31-v.y*.12-time*.9)*.12;vec4 world=modelMatrix*vec4(v,1.);worldP=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
 fragmentShader:`varying vec3 worldP;uniform float time;
 void main(){vec2 p=worldP.xz;float a=dot(p,vec2(.16,.09))+time*.7,b=dot(p,vec2(.31,-.12))-time*.9,c=dot(p,vec2(.61,.34))+sin(a)*.7+time*1.2;
 vec2 slope=cos(a)*vec2(.16,.09)*.24+cos(b)*vec2(.31,-.12)*.12+cos(c)*vec2(.61,.34)*.035;
 vec3 normal=normalize(vec3(-slope.x,1.,-slope.y)),view=normalize(cameraPosition-worldP),halfLight=normalize(view+normalize(vec3(-.6,.5,-.4)));
 float fresnel=pow(1.-max(0.,dot(normal,view)),4.),glint=pow(max(0.,dot(normal,halfLight)),100.);float wave=sin(a)*.5+sin(b)*.3+sin(c)*.15;
 vec3 color=mix(vec3(.022,.044,.058),vec3(.067,.096,.115),fresnel)+wave*vec3(.008,.013,.016)+glint*vec3(.20,.25,.29);
 float fog=1.-exp(-distance(cameraPosition,worldP)*.0025);color=mix(color,vec3(.065,.095,.12),fog);gl_FragColor=vec4(color,1.);}`});
 const water=new T.Mesh(new T.PlaneGeometry(1500,1500,100,100),waterMat);water.rotation.x=-Math.PI/2;water.position.y=-2.5;scene.add(water);owned.push(water);
 const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;uniform float time;float h(vec2 a){return fract(sin(dot(a,vec2(127.1,311.7)))*43758.5453);}float n(vec2 a){vec2 i=floor(a),f=fract(a);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}void main(){vec3 c=mix(vec3(.07,.105,.13),vec3(.012,.025,.043),smoothstep(0.,.7,p.y));vec2 u=p.xz/max(.12,p.y)*2.;float cloud=n(u+time*.003)*.5+n(u*2.4)*.3+n(u*5.)*.15;float moon=pow(max(0.,dot(normalize(vec3(-.6,.5,-.4)),p)),500.);c+=vec3(.055,.064,.07)*cloud+vec3(.5,.58,.63)*moon;gl_FragColor=vec4(c,1.);}'});
 const sky=new T.Mesh(new T.SphereGeometry(850,32,16),skyMat);scene.add(sky);owned.push(sky);
 const rainGeo=new T.BufferGeometry(),rainPositions=new Float32Array(750*6);for(let i=0;i<750;i++){const x=(random()-.5)*65,y=random()*35,z=(random()-.5)*65;rainPositions.set([x,y,z,x-.09,y-.8,z+.06],i*6);}rainGeo.setAttribute('position',new T.BufferAttribute(rainPositions,3));const rain=new T.LineSegments(rainGeo,new T.LineBasicMaterial({color:'#aac2cf',transparent:true,opacity:.16,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);owned.push(rain);
 for(const {material,parts}of buckets.values()){const normal=parts.map(g=>g.index?g.toNonIndexed():g),geometry=mergeGeometries(normal);parts.forEach(g=>g.dispose());normal.forEach(g=>g.dispose());if(!geometry)throw Error('Could not prepare coastal facility geometry');geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.castShadow=material!==m.amber&&material!==m.cyan;mesh.receiveShadow=true;scene.add(mesh);owned.push(mesh);}
 // Four local lights are recycled; no light per prop or render-time geometry allocation.
 const lightPool3D=Array.from({length:4},()=>{const l=new T.PointLight('#ffcf8e',12,17,1.4);scene.add(l);owned.push(l);return l;});let lastLight=-1,stage=0;
 const world={...layout,boxes,index:new CollisionIndex(boxes),materials:m,dish:dishAssembly,supplies:props.filter(p=>p.type==='supply'),
  floor(x,z,ceiling=Infinity){return floorAt(surfaces,x,z,ceiling);},
  move(body,dx,dz,radius=.3,height=1.7){moveFacilityBody(this,body,dx,dz,radius,height);},
  setStage(value){stage=value;lastLight=-1;for(const d of dynamic){d.box.active=value<d.box.unlock;d.mesh.visible=d.box.active;}if(dishAssembly)dishAssembly.rotation.z=value>=5?.42:.12;this.navigation?.rebuild();},
  update(time,player){waterMat.uniforms.time.value=time;skyMat.uniforms.time.value=time;rain.position.set(player.x,(player.y||0)-(time*12)%12,player.z);rain.visible=!(player.x>8&&player.x<56&&player.z>-30&&player.z<6&&(player.y||0)<20);if(time-lastLight>.5||lastLight<0){lastLight=time;const nearest=lights.map(l=>({l,d:Math.hypot(l.x-player.x,l.z-player.z,(l.y-(player.y||0))*2)})).sort((a,b)=>a.d-b.d);lightPool3D.forEach((light,i)=>{const l=nearest[i]?.l;light.visible=!!l; if(l){light.position.set(l.x,l.y+4,l.z);light.color.set(l.interior?'#9ed0df':'#ffcf8e');light.intensity=l.interior?10:stage>0?6:12;}});}},
  dispose(){const gs=new Set(),ms=new Set();for(const root of owned){root.traverse(n=>{if(n.geometry)gs.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:n.material?[n.material]:[]){ms.add(m);for(const t of Object.values(m))if(t?.isTexture)textures.add(t);}});scene.remove(root);}gs.forEach(g=>g.dispose());Object.values(m).forEach(v=>ms.add(v));ms.add(glow);ms.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 };
 world.setStage(0);world.navigation=new FacilityNavigator(world);return world;
}
