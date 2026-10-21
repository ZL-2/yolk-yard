import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function surface(kind){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),rand=rng(kind.length*971),data=c.createImageData(256,256);
 for(let i=0;i<data.data.length;i+=4){const n=rand(),v=(kind==='asphalt'?96:170)+(n-.5)*(kind==='asphalt'?85:42);data.data[i]=data.data[i+1]=data.data[i+2]=v;data.data[i+3]=255;}c.putImageData(data,0,0);
 if(kind==='concrete'){c.fillStyle='rgba(20,25,28,.19)';c.fillRect(0,0,256,2);c.fillRect(0,0,2,256);for(const [x,y]of [[8,8],[248,8],[8,248],[248,248]]){c.beginPath();c.arc(x,y,2,0,7);c.fill();}for(let i=0;i<14;i++){c.fillStyle='rgba(30,35,40,.025)';c.fillRect(rand()*256,0,2+rand()*7,256);}}
 if(kind==='metal'){c.fillStyle='rgba(20,25,25,.18)';for(let x=0;x<256;x+=32){c.fillRect(x,0,3,256);c.fillStyle='rgba(240,245,250,.10)';c.fillRect(x+3,0,2,256);c.fillStyle='rgba(20,25,25,.18)';}}
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function labelTexture(text,sub='',color='#d9c89a'){
 const c=document.createElement('canvas');c.width=512;c.height=192;const g=c.getContext('2d');g.fillStyle='#182326';g.fillRect(0,0,512,192);g.strokeStyle=color;g.lineWidth=4;g.strokeRect(12,12,488,168);g.fillStyle=color;g.font='bold 47px monospace';g.textAlign='center';g.fillText(text,256,88);g.font='19px monospace';g.fillText(sub,256,135);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
export function createWorld(scene){
 const random=rng(70937),boxes=[],buckets=new Map(),owned=[],animated=[],lamps=[];
 const concrete=surface('concrete'),asphalt=surface('asphalt'),metal=surface('metal');
 const mat=(color,map,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,map,bumpMap:map,bumpScale:map?.015:0,roughness,metalness});
 const m={concrete:mat('#65716b',concrete,.88),darkConcrete:mat('#404b4a',concrete),asphalt:mat('#657073',asphalt,.36,.18),steel:mat('#526062',metal,.43,.6),dark:mat('#202a2c',metal,.55,.4),rust:mat('#6b4531',metal,.7,.35),olive:mat('#464f3c',metal),crate:mat('#514e3d',concrete),white:mat('#d4d0bd',null,.5),black:mat('#111a1b',null,.8),paint:mat('#b5aa76',null,.9),glass:new T.MeshStandardMaterial({color:'#41595b',metalness:.8,roughness:.18}),amber:new T.MeshBasicMaterial({color:'#ffd899'}),cyan:new T.MeshBasicMaterial({color:'#8dc4b9'}),red:new T.MeshBasicMaterial({color:'#f26745'})};
 const add=(geo,material,x,y,z,rot=null,scale=null)=>{const matrix=new T.Matrix4().compose(V(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(...(rot||[0,0,0]))),scale?V(...scale):V(1,1,1));geo.applyMatrix4(matrix);const key=material.uuid+':'+Math.floor((z+130)/24);if(!buckets.has(key))buckets.set(key,{material,parts:[]});buckets.get(key).parts.push(geo);};
 const box=(x,y,z,sx,sy,sz,material=m.concrete,solid=true)=>{const geo=new T.BoxGeometry(sx,sy,sz),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++){const face=Math.floor(i/4),u=face<2?sz:sx,v=face===2||face===3?sz:sy;uv.setXY(i,uv.getX(i)*u/2,uv.getY(i)*v/2);}add(geo,material,x,y,z);if(solid)boxes.push({x,y,z,sx,sy,sz});};
 const cyl=(x,y,z,r,h,material=m.steel,rot=null,segments=10)=>add(new T.CylinderGeometry(r,r,h,segments),material,x,y,z,rot);
 const beam=(a,b,r,material=m.steel)=>{const d=V(b[0]-a[0],b[1]-a[1],b[2]-a[2]),g=new T.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));add(g,material,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);};
 const sign=(text,sub,x,y,z,width=3,rotation=0)=>{const texture=labelTexture(text,sub),material=new T.MeshBasicMaterial({map:texture});const mesh=new T.Mesh(new T.PlaneGeometry(width,width*.375),material);mesh.position.set(x,y,z);mesh.rotation.y=rotation;scene.add(mesh);owned.push(mesh);return mesh;};
 const glow=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{color:{value:new T.Color('#c69b60')}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform vec3 color;void main(){float a=pow(max(0.,1.-length(vUv-.5)*2.),3.)*.34;gl_FragColor=vec4(color,a);}'});
 const lamp=(x,z,y=5)=>{cyl(x,y/2,z,.065,y);box(x,y,z,.55,.12,.3,m.dark,false);box(x,y-.08,z,.42,.04,.23,m.amber,false);const pool=new T.Mesh(new T.PlaneGeometry(13,13),glow);pool.rotation.x=-Math.PI/2;pool.position.set(x,.025,z);scene.add(pool);owned.push(pool);lamps.push(pool);};
 const crate=(x,z,sx=2,sz=1.7,h=1.4)=>{box(x,h/2,z,sx,h,sz,m.crate);for(const xx of [x-sx*.36,x+sx*.36]){box(xx,h/2,z,.08,h+.05,sz+.04,m.dark,false);}box(x,h+.025,z,sx+.04,.05,sz+.04,m.olive,false);};
 const container=(x,z,length=9)=>{box(x,1.35,z,3,2.7,length,m.olive);for(const xx of [x-1.52,x+1.52])for(let zz=z-length/2+.2;zz<z+length/2;zz+=.5)box(xx,1.35,zz,.045,2.6,.09,m.steel,false);for(const xx of [x-1.45,x+1.45])box(xx,2.7,z,.1,.1,length,m.steel,false);for(const zz of [z-length/2-.02,z+length/2+.02]){box(x,1.35,zz,2.85,2.55,.05,m.steel,false);for(const xx of [x-.7,x+.7])cyl(xx,1.35,zz+.04,.035,2.4);}sign('CARGO','RELAY LOGISTICS',x,1.85,z+length/2+.065,2.1);};
 const fence=(x,z,length,alongX=true)=>{for(let i=-length/2;i<=length/2;i+=2.5){const xx=x+(alongX?i:0),zz=z+(alongX?0:i);cyl(xx,1.45,zz,.035,2.9);for(let y=.25;y<2.6;y+=.38)beam([xx,y,zz],[xx+(alongX?2.5:0),Math.min(2.7,y+1.2),zz+(alongX?0:2.5)],.008,m.steel);}boxes.push({x,y:1.3,z,sx:alongX?length:.1,sy:2.6,sz:alongX?.1:length});};
 // The route uses metres: a service approach, two-lane yard, offices, relay and helipad.
 box(0,-.2,-35,54,.4,172,m.asphalt,false);
 for(const x of [-26.7,26.7]){box(x,1.4,-35,1.2,3,172,m.darkConcrete);box(x,2.96,-35,1.4,.12,172,m.concrete,false);}
 for(const x of [-9.5,9.5]){box(x,1.2,32,1,2.4,33,m.concrete);box(x,2.44,32,1.15,.08,33,m.steel,false);}
 // Painted lanes and drain gratings. No transparent shadow plane stacks.
 for(let z=43;z>-115;z-=8){box(0,.012,z,.12,.016,3,m.paint,false);for(const x of [-24,24]){box(x,.01,z,1.5,.03,.7,m.black,false);for(let q=-.65;q<=.65;q+=.16)box(x+q,.04,z,.04,.04,.7,m.steel,false);}}
 for(let i=0;i<36;i++){const x=(random()-.5)*45,z=45-random()*162;const g=new T.CircleGeometry(.4+random()*1.8,12);g.rotateX(-Math.PI/2);add(g,m.glass,x,.015,z,null,[1,1,.35+random()*.4]);}
 // Entry junction and controllable gate.
 box(-6,1.25,26.8,1,.9,.45,m.steel);cyl(-6,.6,26.8,.04,1.2);sign('POWER','PERIMETER / 01',-6,1.3,27.04,.8);
 for(const x of [-9,9])box(x,2.5,18,.45,5,.5,m.steel);box(0,4.8,18,18,.35,.55,m.steel,false);sign('RESTRICTED','RELAY STATION 07',0,4.5,18.3,3.8);
 const gate=new T.Group();for(let x=-8.8;x<9;x+=.6){const bar=new T.Mesh(new T.BoxGeometry(.07,3.2,.08),m.steel);bar.position.set(x,1.7,18);gate.add(bar);}for(const y of [.5,2.9]){const bar=new T.Mesh(new T.BoxGeometry(18,.1,.12),m.steel);bar.position.set(0,y,18);gate.add(bar);}scene.add(gate);owned.push(gate);const gateBox={x:0,y:1.6,z:18,sx:18,sy:3.2,sz:.2};boxes.push(gateBox);
 box(14,1.7,13,6,3.4,7,m.darkConcrete);box(14,3.5,13,6.5,.2,7.5,m.steel,false);box(14,2,16.52,3.2,1,.03,m.glass,false);sign('07','SECURITY',14,2.9,16.55,2);
 fence(-18,18,16);fence(21,18,10);
 container(-17,3,8);container(-15,-13,8);container(20,-8,10);
 crate(-5,-6,3,2,1.1);crate(6,3,2,2,1.3);crate(9,-15,2.5,2,1.1);crate(-21,-22,3,2,1.3);
 // Parked utility truck: undercarriage, cab, bed, lamps and tyre profile.
 box(12,.85,-1,2.4,.75,5,m.dark);box(12,1.8,-2.1,2.3,1.35,1.8,m.olive);box(12,2,-3.02,1.95,.65,.03,m.glass,false);box(12,1.55,.7,2.4,.55,2.5,m.olive,false);for(const x of [10.8,13.2])for(const z of [-2.2,1.3]){cyl(x,.6,z,.48,.3,m.black,[0,0,Math.PI/2],14);cyl(x+(x<12?-.16:.16),.6,z,.22,.03,m.steel,[0,0,Math.PI/2]);}
 // Operations building. All doors/rooms have honest collider openings.
 for(const x of [-14,14])box(x,2.2,-46,.5,4.4,36,m.concrete);
 for(const z of [-28,-64])for(const x of [-7.8,7.8])box(x,2.2,z,12.4,4.4,.5,m.concrete);
 for(const z of [-28,-64])box(0,3.9,z,3.2,1,.5,m.concrete);
 box(0,4.5,-46,29,.35,37,m.darkConcrete);box(0,.01,-46,28,.03,36,m.darkConcrete,false);
 for(const x of [-8,8])box(x,2.1,-42,12,.3,.22,m.steel,false);
 for(const x of [-9,9])box(x,2.1,-44,10,4.2,.24,m.darkConcrete);
 box(-3.9,2.1,-53,.2,4.2,18,m.concrete);box(4,2.1,-56,.2,4.2,12,m.concrete);
 // Inner hallway has a 4 m opening into each wing.
 for(const [x,z]of [[-9,-34],[-9,-39],[8,-35],[-8,-51],[-8,-57]]){
  box(x,.8,z,3,1.6,1.2,m.dark);box(x,1.65,z,3.2,.08,1.3,m.steel,false);box(x,2.05,z,1,.65,.08,m.black,false);box(x,2.05,z+.055,.85,.49,.02,m.cyan,false);
 }
 for(const x of [6.5,11.5])for(const z of [-49,-54,-60]){box(x,1.2,z,1.2,2.4,1.3,m.dark);for(let y=.35;y<2.3;y+=.32){box(x,y,z+.66,1,.14,.02,m.steel,false);box(x+.38,y,z+.68,.04,.04,.02,m.cyan,false);}}
 box(9,.9,-58.4,2,1.8,.6,m.steel);box(9,1.5,-58.05,1.65,.8,.05,m.black,false);sign('ARCHIVE','EVAC / ENCRYPTED',9,1.5,-58.01,1.4);
 sign('OPERATIONS','AUTHORIZED PERSONNEL ONLY',0,3.85,-27.72,3.1);
 sign('UPLINK →','REAR SERVICE EXIT',0,3,-62.7,2.4);
 const doorMaterial=mat('#47595a',metal,.55,.4);
 const door=new T.Mesh(new T.BoxGeometry(3.1,3.3,.22),doorMaterial);door.position.set(0,1.65,-28);scene.add(door);owned.push(door);const doorBox={x:0,y:1.65,z:-28,sx:3.1,sy:3.3,sz:.25};boxes.push(doorBox);
 const rear=new T.Mesh(new T.BoxGeometry(3.1,3.3,.22),doorMaterial);rear.position.set(0,1.65,-64);scene.add(rear);owned.push(rear);const rearBox={x:0,y:1.65,z:-64,sx:3.1,sy:3.3,sz:.25};boxes.push(rearBox);
 // Ceiling fixtures and floor light pools build depth without many realtime lights.
 for(const z of [-33,-40,-49,-58])for(const x of [-8,0,8]){box(x,4.2,z,1.4,.08,.24,m.cyan,false);const pool=new T.Mesh(new T.PlaneGeometry(10,10),glow.clone());pool.material.uniforms.color.value=new T.Color('#78a5ad');pool.rotation.x=-Math.PI/2;pool.position.set(x,.055,z);scene.add(pool);owned.push(pool);}
 // Massive receiving dish and truss tower.
 box(-17,1.6,-81,5,3.2,5,m.darkConcrete);cyl(-17,7,-81,.65,10,m.steel);for(const x of [-19,-15])for(const z of [-83,-79])beam([x,1,z],[-17,11,-81],.13);
 const dish=new T.Group();const dishGeo=new T.SphereGeometry(7.4,32,14,0,Math.PI*2,0,.8);const dishMaterial=new T.MeshStandardMaterial({color:'#a8aaa0',metalness:.5,roughness:.5,side:T.DoubleSide});dish.add(new T.Mesh(dishGeo,dishMaterial));for(let a=0;a<Math.PI*2;a+=Math.PI/8){const r=5.3;beam([-17,13,-81],[-17+Math.cos(a)*r,15.4,-81+Math.sin(a)*r],.045,m.dark);}dish.position.set(-17,6,-81);dish.rotation.set(.3,0,.2);scene.add(dish);owned.push(dish);cyl(-17,17,-81,.09,5);box(-17,19.5,-81,.4,.6,.4,m.red,false);
 box(-10,1.2,-81.4,1.6,2.4,.7,m.steel);sign('UPLINK','CONTROL / 02',-10,1.65,-81.02,1.3);
 for(const [x,z]of [[21,-72],[-22,-104]]){for(const xx of [-.7,.7])for(const zz of [-.7,.7])cyl(x+xx,11,z+zz,.07,22);for(let y=1;y<22;y+=2)for(const xx of [-.7,.7])beam([x+xx,y,z-.7],[x-xx,y+2,z+.7],.035);for(let y=10;y<22;y+=4)cyl(x,y,z,.4,.3,m.dark);box(x,22.5,z,.2,.3,.2,m.red,false);}
 crate(5,-75,2.8,1.5,1.2);crate(16,-83,2.8,2,1.2);crate(-6,-94,3,1.8,1.1);crate(20,-100,2,2,1.1);crate(1,-103,2.5,1.7,1);
 // Helipad, floodlights, ocean and cliff silhouettes.
 box(10,.02,-108,12,.06,12,m.darkConcrete,false);for(const x of [7.6,12.4])box(x,.061,-108,.3,.02,4,m.paint,false);box(10,.062,-108,4.8,.02,.3,m.paint,false);for(const x of [4.3,15.7])for(const z of [-102.3,-113.7])box(x,.1,z,.18,.15,.18,m.amber,false);
 for(const [x,z]of [[-8,35],[8,22],[-22,6],[22,4],[-9,-22],[9,-22],[-23,-70],[23,-76],[-2,-92],[20,-112]])lamp(x,z);
 for(const x of [-38,38]){box(x,-3,-35,20,6,180,m.darkConcrete,false);for(let z=50;z>-125;z-=11){const geo=new T.IcosahedronGeometry(5,0);add(geo,m.darkConcrete,x+(random()-.5)*5,-2,z,[random(),random(),random()],[1,1.4,1]);}}
 const waterMaterial=new T.ShaderMaterial({uniforms:{time:{value:0},color:{value:new T.Color('#182d39')}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;uniform float time;uniform vec3 color;void main(){float w=sin(p.x*1.8+time)*sin(p.y*.4+time*.7)+sin(p.x*4.7-p.y+time*1.6)*.25;gl_FragColor=vec4(color+max(0.,w-.65)*vec3(.14,.18,.2),1.);}'});
 const water=new T.Mesh(new T.PlaneGeometry(1500,1500),waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=-5;scene.add(water);owned.push(water);
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=240+random()*90,h=35+random()*80;add(new T.ConeGeometry(32+random()*45,h,6),m.darkConcrete,Math.cos(a)*r,h/2-15,-40+Math.sin(a)*r,[0,random(),0]);}
 const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;uniform float time;float hash(vec2 a){return fract(sin(dot(a,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 a){vec2 i=floor(a),f=fract(a);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}void main(){vec3 c=mix(vec3(.10,.15,.18),vec3(.018,.035,.057),smoothstep(0.,.7,p.y));vec2 u=p.xz/max(.12,p.y)*1.9;float n=noise(u+time*.004)*.5+noise(u*2.3)*.25+noise(u*5.1)*.125;c+=vec3(.038,.045,.05)*n;float moon=pow(max(0.,dot(normalize(vec3(-.4,.5,-.7)),p)),140.);c+=vec3(.38,.43,.46)*moon;gl_FragColor=vec4(c,1.);}'});
 const sky=new T.Mesh(new T.SphereGeometry(850,32,16),skyMaterial);scene.add(sky);owned.push(sky);
 const rainGeo=new T.BufferGeometry(),rainCount=900,rainPositions=new Float32Array(rainCount*6);for(let i=0;i<rainCount;i++){const x=(random()-.5)*55,y=random()*25,z=(random()-.5)*55;rainPositions.set([x,y,z,x-.08,y-.65,z+.04],i*6);}rainGeo.setAttribute('position',new T.BufferAttribute(rainPositions,3));const rain=new T.LineSegments(rainGeo,new T.LineBasicMaterial({color:'#a0b5bd',transparent:true,opacity:.13,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);owned.push(rain);
 // Merge immutable props by material and spatial section, preserving frustum culling.
 for(const {material,parts}of buckets.values()){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.castShadow=material!==m.amber&&material!==m.cyan;mesh.receiveShadow=true;scene.add(mesh);owned.push(mesh);}
 return {boxes,materials:m,gate,door,rear,lamps,
  setStage(stage){gateBox.active=stage<1;doorBox.active=stage<2;rearBox.active=stage<3;gate.position.y=stage>=1?4:0;door.visible=stage<2;rear.visible=stage<3;},
  update(time,player){waterMaterial.uniforms.time.value=time;skyMaterial.uniforms.time.value=time;rain.position.set(player.x,-(time*12)%12,player.z);},
  dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();for(const root of owned){root.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const material of Array.isArray(n.material)?n.material:n.material?[n.material]:[]){materials.add(material);for(const v of Object.values(material))if(v?.isTexture)textures.add(v);}});scene.remove(root);}Object.values(m).forEach(v=>materials.add(v));[concrete,asphalt,metal].forEach(v=>textures.add(v));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
 };
}
