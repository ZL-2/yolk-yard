import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {atvEnvironment as outdoorEnvironment} from './atv-model.js';

export const KESTREL_ART_REVISION=154;
const palettes=new Map(),templates=new WeakMap(),headlessTemplates=new Map();
let presentedModel;
const stations=[[-9.4,.12,.14,.55],[-8.9,.95,.55,.8],[-8.0,1.8,1.10,1.08],[-6.8,2.45,1.60,1.10],[-5.2,2.80,1.78,1],[-2,2.90,1.9,1],[.4,2.90,1.9,1],[3.5,2.80,1.85,1],[5.8,2.50,1.60,1.15],[7.5,1.85,1.15,1.3],[8.4,.90,.50,1.6],[8.8,.12,.16,1.6]];
function section(z){
 const i=Math.max(0,stations.findIndex((q,n)=>n<stations.length-1&&z<=stations[n+1][0])),a=stations[i],b=stations[Math.min(i+1,stations.length-1)],t=T.MathUtils.clamp((z-a[0])/(b[0]-a[0]||1),0,1);
 return {rx:T.MathUtils.lerp(a[1],b[1],t),ry:T.MathUtils.lerp(a[2],b[2],t),cy:T.MathUtils.lerp(a[3],b[3],t)};
}
function hullPoint(z,a,offset=0){const s=section(z);return new T.Vector3(Math.cos(a)*(s.rx+offset),s.cy+Math.sin(a)*(s.ry+offset),z);}
function weatheredSkin(){
 const n=256,color=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4),normal=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=(y*n+x)*4,u=x/n,v=y/n,noise=((x*71+y*137+x*y%89)%101)/100,cell=(Math.floor(u*10)*17+Math.floor(v*12)*31)%9;
  const seam=(u*10%1)<.018||(v*12%1)<.018,dust=Math.max(0,Math.cos(u*Math.PI*2))*.12,patch=(cell-4)*2,wear=seam?-.35:0;
  color[i]=Math.max(0,82+patch+noise*8+dust*38+wear*80);color[i+1]=Math.max(0,104+patch+noise*8+dust*16+wear*100);color[i+2]=Math.max(0,94+patch+noise*8+wear*90);color[i+3]=255;
  rough[i]=rough[i+1]=rough[i+2]=Math.min(255,180+noise*35+dust*65);rough[i+3]=255;
  normal[i]=128+Math.round((noise-.5)*12);normal[i+1]=128+Math.round(((cell%3)-1)*5);normal[i+2]=254;normal[i+3]=255;
 }
 const texture=(bytes,srgb=false)=>{const t=new T.DataTexture(bytes,n,n);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;if(srgb)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;t.userData.shared=true;return t;};
 return {map:texture(color,true),roughnessMap:texture(rough),normalMap:texture(normal)};
}
function serialTexture(){
 const font={K:['10001','10010','10100','11000','10100','10010','10001'],E:['11111','10000','10000','11110','10000','10000','11111'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],R:['11110','10001','10001','11110','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],'0':['01110','10001','10011','10101','11001','10001','01110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'-':['00000','00000','00000','11111','00000','00000','00000']};
 const width=256,height=32,data=new Uint8Array(width*height*4),text='KESTREL R-04';
 for(let c=0;c<text.length;c++)for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(font[text[c]]?.[y]?.[x]==='1')for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++){const i=((y*3+5+dy)*width+c*20+x*3+dx)*4;data.set([225,219,186,255],i);}
 const t=new T.DataTexture(data,width,height);t.colorSpace=T.SRGBColorSpace;t.magFilter=T.LinearFilter;t.needsUpdate=true;t.userData.shared=true;return t;
}
function palette(environment){
 const key=environment?.uuid||'none';if(palettes.has(key))return palettes.get(key);
 const skin=weatheredSkin(),standard=(color,roughness,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness,envMap:environment,envMapIntensity:.72});
 const p={skin:new T.MeshPhysicalMaterial({color:0xffffff,...skin,normalScale:new T.Vector2(.12,.12),roughness:.76,metalness:.38,clearcoat:.28,clearcoatRoughness:.35,envMap:environment,envMapIntensity:.8}),paint:standard(0x52645e,.53,.4),dark:standard(0x162326,.7,.2),alloy:standard(0x8f9c9b,.30,.88),rubber:standard(0x171b1c,.95),cabin:standard(0x273639,.83),gold:standard(0xc6a35c,.45,.5),glass:new T.MeshPhysicalMaterial({color:0x365662,roughness:.09,metalness:.24,clearcoat:1,clearcoatRoughness:.07,transparent:true,opacity:.84,depthWrite:false,envMap:environment,envMapIntensity:1.05}),serial:new T.MeshStandardMaterial({map:serialTexture(),roughness:.8,alphaTest:.5,polygonOffset:true,polygonOffsetFactor:-2}),white:new T.MeshStandardMaterial({color:0xfff1cc,emissive:0xffd994,emissiveIntensity:1.5}),amber:new T.MeshStandardMaterial({color:0x9b7128,emissive:0xffb743,emissiveIntensity:.65}),red:new T.MeshStandardMaterial({color:0x951a14,emissive:0xf53020,emissiveIntensity:1}),green:new T.MeshStandardMaterial({color:0x227951,emissive:0x3dc786,emissiveIntensity:1})};
 for(const m of Object.values(p))m.userData.shared=true;palettes.set(key,p);return p;
}
function batch(group){
 group.updateMatrixWorld(true);const bins=new Map();
 for(const m of [...group.children])if(m.isMesh){const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);if(!bins.has(m.material))bins.set(m.material,[]);bins.get(m.material).push(g);m.geometry.dispose();group.remove(m);}
 for(const [material,parts]of bins){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();geometry.userData.shared=true;const m=new T.Mesh(geometry,material);m.castShadow=m.receiveShadow=!material.transparent;group.add(m);}return group;
}
function kit(group,p,detail){
 const add=(geometry,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,p[mat]);m.position.set(x,y,z);group.add(m);return m;};
 const box=(x,y,z,w,h,d,mat='paint',r=.04)=>add(Math.min(w,h,d)>.12&&r>.05?new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d),mat,x,y,z);
 const cyl=(x,y,z,r,h,mat='alloy',segments=detail===2?24:12)=>add(new T.CylinderGeometry(r,r,h,segments),mat,x,y,z);
 const beam=(a,b,r,mat='alloy')=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),m=add(new T.CylinderGeometry(r,r,d.length(),detail===2?10:6),mat,...av.add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;};
 const path=(points,r,mat='dark')=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(q=>q.isVector3?q:new T.Vector3(...q))),detail===2?28:14,r,detail===2?8:5,false),mat);
 return {add,box,cyl,beam,path};
}
function hull(detail,glass=false){
 const longitudinal=detail===2?54:30,around=detail===2?48:24,vertices=[],uv=[],indices=[];
 for(let i=0;i<=longitudinal;i++)for(let j=0;j<=around;j++){const z=-9.4+i/longitudinal*18.2,a=j/around*Math.PI*2,q=hullPoint(z,a,glass?.035:0);vertices.push(...q.toArray());uv.push(j/around,i/longitudinal);}
 for(let i=0;i<longitudinal;i++)for(let j=0;j<around;j++){
  const z=-9.4+(i+.5)/longitudinal*18.2,a=(j+.5)/around*Math.PI*2,cockpit=z>-8.3&&z<-5.2&&Math.sin(a)>.12,door=z>.4&&z<3.5&&Math.cos(a)<-.82;
  if(glass?!cockpit:cockpit||door)continue;const n=i*(around+1)+j,b=n+around+1;indices.push(n,n+1,b,n+1,b+1,b);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function airfoil(outline,thickness=.16){
 const shape=new T.Shape();shape.moveTo(...outline[0]);outline.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:thickness,steps:1,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:1});g.rotateX(Math.PI/2);return g;
}
function landingGear(p,detail,index){
 const g=new T.Group(),k=kit(g,p,detail),main=index<2,sign=index===0?-1:1;g.name='kestrel-gear-'+index;g.position.set(main?sign*2.1:0,-.56,main?3.0:-6.5);
 const centerY=main?-.50:-.58;k.beam([0,0,0],[main?sign*.20:0,centerY,0],.085,'alloy');k.beam([0,.05,-.35],[main?sign*.20:0,centerY+.08,0],.045,'alloy');const center=main?sign*.24:0,r=main?.42:.34;
 const tire=k.add(new T.TorusGeometry(r-.095,.095,detail===2?10:6,detail===2?32:20),'rubber',center,centerY,0);tire.rotation.y=Math.PI/2;const hub=k.cyl(center,centerY,0,r*.63,.22,'alloy');hub.rotation.z=Math.PI/2;
 if(detail===2)for(let i=0;i<8;i++){const a=i*Math.PI/4,b=k.cyl(center+sign*.12,centerY+Math.sin(a)*r*.40,Math.cos(a)*r*.40,.025,.028,'alloy',6);b.rotation.z=Math.PI/2;}
 return batch(g);
}
function engine(p,detail,index){
 const g=new T.Group(),k=kit(g,p,detail),sign=index===0?-1:1;g.name='kestrel-engine-'+index;g.position.set(sign*6.65,2.55,-.65);
 const profile=[[.34,-.8],[.72,-.5],[.84,0],[.83,1.15],[.65,1.72],[.42,2.0]].map(q=>new T.Vector2(...q));k.add(new T.LatheGeometry(profile,detail===2?32:20),'skin');
 k.box(0,.67,-.79,.78,.78,.08,'dark',.09);for(let i=-3;i<=3;i++)k.box(i*.10,.68,-.843,.045,.58,.035,'alloy');k.cyl(0,2.02,0,.33,.20,'alloy');k.cyl(0,2.17,0,.20,.18,'dark');
 const exhaust=k.cyl(0,-.15,.70,.22,.38,'alloy');exhaust.rotation.x=Math.PI/2;k.box(0,-.43,.55,.47,.07,.30,'dark');for(const side of [-1,1])k.box(side*.69,.87,.10,.05,.26,.65,'gold');k.cyl(0,2.41,0,.27,.22,'alloy');batch(g);
 const rotor=new T.Group(),r=kit(rotor,p,detail);rotor.name='kestrel-rotor-'+index;rotor.position.y=2.37;
 for(let i=0;i<4;i++){const blade=r.add(airfoil([[.28,-.08],[2.75,-.27],[3.32,-.16],[3.27,.10],[1.05,.19],[.28,.12]],.055),'dark');blade.rotation.y=i*Math.PI/2;const stripe=r.box(Math.cos(-i*Math.PI/2)*3.07,.015,Math.sin(-i*Math.PI/2)*3.07,.22,.064,.28,'gold');stripe.rotation.y=i*Math.PI/2;}
 batch(rotor);g.add(rotor);
 const blur=new T.Mesh(new T.RingGeometry(.38,3.35,detail===2?48:24),new T.MeshBasicMaterial({color:0x222b2c,transparent:true,opacity:.075,depthWrite:false,side:T.DoubleSide}));blur.name='kestrel-blur-'+index;blur.position.y=2.37;blur.rotation.x=-Math.PI/2;blur.visible=false;blur.geometry.userData.shared=true;blur.material.userData.shared=true;g.add(blur);return g;
}
export function makeKestrel({detail=2,environment=null}={}){
 const p=palette(environment),root=new T.Group(),body=new T.Group(),k=kit(body,p,detail);root.name='Kestrel R-04 twin tiltrotor';root.add(body);k.add(hull(detail),'skin');k.add(hull(detail,true),'glass');k.add(new T.SphereGeometry(.16,12,8),'paint',0,.55,-9.32);k.add(new T.SphereGeometry(.18,12,8),'paint',0,1.6,8.71);
 // Panel frames turn the canopy into individual glazed cockpit panes.
 for(const z of [-8.25,-6.7,-5.21]){const points=[];for(let i=0;i<=12;i++)points.push(hullPoint(z,.16+i/12*(Math.PI-.32),.07));k.path(points,.055,'dark');}
 for(const a of [.16,Math.PI/2,Math.PI-.16]){const points=[];for(let i=0;i<=12;i++)points.push(hullPoint(-8.25+i/12*3.04,a,.075));k.path(points,.06,'dark');}
 // Cockpit furnishings, instrument glass and visible cargo deck/benches.
 k.box(0,.04,-6.1,3.6,.12,3.3,'cabin');k.box(0,1.11,-7.1,2.5,.27,.60,'dark',.09);for(const x of [-.80,0,.80])k.box(x,1.26,-7.1,.53,.014,.34,'glass');
 for(const x of [-.85,.85]){k.box(x,.60,-5.94,.67,.20,.77,'cabin',.09);k.box(x,1.12,-5.55,.66,1.04,.17,'dark',.08);k.beam([x-.27,.69,-6.2],[x-.27,.97,-5.9],.045);k.beam([x+.27,.69,-6.2],[x+.27,.97,-5.9],.045);}
 k.box(0,-.48,1.0,4.3,.12,9.2,'cabin');k.box(0,-.36,1.4,1.8,.025,7.1,'dark');
 for(const side of [-1,1]){k.box(side*1.57,.02,1.0,.68,.17,7.1,'cabin');k.box(side*1.90,.49,1.0,.16,1.0,7.2,'dark');k.box(side*1.5,2.32,1.0,.05,.06,8.4,'amber');}
 for(let i=0;i<9;i++)k.box(0,-.346,-2.0+i*.83,1.5,.023,.06,'gold');
 const doorFrame=[hullPoint(.42,Math.PI-.59,.07),hullPoint(3.5,Math.PI-.59,.07),hullPoint(3.5,Math.PI+.59,.07),hullPoint(.42,Math.PI+.59,.07),hullPoint(.42,Math.PI-.59,.07)];k.path(doorFrame,.065,'alloy');
 // Swept main wing, control surfaces, tailplane and twin stabilizers.
 for(const side of [-1,1]){
  const wing=k.add(airfoil([[side*.5,-2.0],[side*7.05,-1.65],[side*7.5,.25],[side*.5,1.25]],.22),'paint');wing.position.y=2.65;
  k.beam([side*3.0,2.83,.78],[side*6.35,2.83,.25],.018,'dark');k.box(side*2.56,-.12,3.0,.54,.63,2.2,'paint',.15);
  const tail=k.add(airfoil([[side*.5,5.75],[side*4.4,6.75],[side*4.15,8.25],[side*.5,7.20]],.15),'paint');tail.position.y=2.35;
  const fin=k.box(side*1.62,3.5,7.45,.17,3.45,2.05,'paint',.065);fin.rotation.z=-side*.18;const marking=k.box(side*(1.62+Math.sin(.18)*1.13),3.5+Math.cos(.18)*1.13,7.45,.19,.38,1.8,'gold');marking.rotation.z=fin.rotation.z;
  k.box(side*2.82,1.22,-3.60,.15,.55,2.38,'paint',.065);const serial=k.add(new T.PlaneGeometry(2.18,.42),'serial',side*2.905,1.23,-3.6);serial.rotation.y=side*Math.PI/2;
  k.box(side*7.10,2.75,.33,.22,.13,.34,side<0?'red':'green');k.box(side*.55,.67,-9.03,.24,.17,.12,'white',.07);
  k.beam([side*.8,2.65,-3.5],[side*.8,3.63,-3.5],.027,'dark');
 }
 k.box(0,2.89,-3.75,1.2,.27,1.5,'paint',.1);k.box(0,2.96,2.6,.18,.08,2.2,'dark');
 if(detail===2){
  for(const a of [0,.35,1.05,2.08,2.8,Math.PI,3.6,5.8])for(let z=-4.8;z<5.0;z+=.64){if(z>.4&&z<3.5&&Math.cos(a)<-.82)continue;const q=hullPoint(z,a,.035),bolt=k.cyl(q.x,q.y,q.z,.028,.020,'alloy',6);bolt.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.cos(a),Math.sin(a),0));}
  for(const side of [-1,1])for(let i=0;i<8;i++)k.box(side*.56,3.05,-4.2+i*.14,.18,.017,.050,'dark');
 }
 batch(body);
 for(let i=0;i<2;i++)root.add(engine(p,detail,i));for(let i=0;i<3;i++)root.add(landingGear(p,detail,i));
 const door=new T.Group(),d=kit(door,p,detail);door.name='kestrel-cargo-door';door.position.set(-2.87,.70,1.92);d.box(0,0,0,.15,2.16,2.97,'paint',.055);d.box(-.092,.45,0,.025,.71,1.25,'glass');d.box(-.10,-.25,-.96,.06,.12,.34,'alloy');batch(door);root.add(door);
 const beacon=new T.Mesh(new T.SphereGeometry(.10,12,8),p.red.clone());beacon.name='kestrel-beacon';beacon.position.set(0,3.02,1.4);beacon.geometry.userData.shared=true;beacon.userData.ownedMaterial=true;root.add(beacon);
 const shadow=new T.Mesh(new T.PlaneGeometry(18,21),new T.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,vertexShader:'varying vec2 coords;void main(){coords=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 coords;void main(){float a=exp(-dot(coords,coords)*5.0)*0.19;gl_FragColor=vec4(0.012,0.018,0.015,a);}'}));shadow.name='kestrel-contact-shadow';shadow.position.y=-1.46;shadow.rotation.x=-Math.PI/2;shadow.geometry.userData.shared=true;shadow.material.userData.shared=true;root.add(shadow);
 root.userData.artRevision=KESTREL_ART_REVISION;root.userData.detail=detail;return root;
}
export function createKestrel(renderer,detail=2){
 let levels=renderer?templates.get(renderer):headlessTemplates;if(!levels){levels=new Map();templates.set(renderer,levels);}
 if(!levels.has(detail))levels.set(detail,makeKestrel({detail,environment:renderer?.isWebGLRenderer?outdoorEnvironment(renderer):null}));
 const root=levels.get(detail).clone();root.getObjectByName('kestrel-beacon').material=root.getObjectByName('kestrel-beacon').material.clone();return root;
}
export function animateKestrel(root,{parked,time,elapsed},dt){
 presentedModel=root;
 const first=!root._kestrel,n=root._kestrel??={engines:[0,1].map(i=>root.getObjectByName('kestrel-engine-'+i)),rotors:[0,1].map(i=>root.getObjectByName('kestrel-rotor-'+i)),blur:[0,1].map(i=>root.getObjectByName('kestrel-blur-'+i)),gear:[0,1,2].map(i=>root.getObjectByName('kestrel-gear-'+i)),door:root.getObjectByName('kestrel-cargo-door'),beacon:root.getObjectByName('kestrel-beacon'),shadow:root.getObjectByName('kestrel-contact-shadow')};
 const mix=first?1:1-Math.exp(-Math.min(.1,Math.max(0,dt))*4),spool=parked?0:T.MathUtils.smoothstep(elapsed,0,5),tilt=-.55*spool;
 for(let i=0;i<2;i++){n.engines[i].rotation.x=parked?0:T.MathUtils.lerp(n.engines[i].rotation.x,tilt,mix);n.rotors[i].rotation.y=(time*(parked?.15:30)*(i===0?1:-1))%(Math.PI*2);n.blur[i].visible=!parked;}
 for(let i=0;i<3;i++){const axis=i<2?'z':'x',target=parked?0:(i===0?1.20:i===1?-1.20:1.28)*spool;n.gear[i].rotation[axis]=parked?0:T.MathUtils.lerp(n.gear[i].rotation[axis],target,mix);}
 n.door.position.z=parked?4.95:T.MathUtils.lerp(n.door.position.z,4.1,mix);n.beacon.material.emissiveIntensity=parked?.4:Math.sin(time*5)> .78?2.2:.15;n.shadow.visible=!!parked;
}
export function kestrelModelBudget(root){let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return {triangles,meshes};}
export function kestrelDiagnostics(){const m=presentedModel;if(!m)return null;return {revision:m.userData.artRevision,detail:m.userData.detail,visible:m.visible,engines:[0,1].map(i=>m.getObjectByName('kestrel-engine-'+i).rotation.x),rotors:[0,1].map(i=>m.getObjectByName('kestrel-rotor-'+i).rotation.y),gear:[0,1,2].map(i=>m.getObjectByName('kestrel-gear-'+i).rotation.toArray().slice(0,3)),shadow:m.getObjectByName('kestrel-contact-shadow').visible,...kestrelModelBudget(m)};}
