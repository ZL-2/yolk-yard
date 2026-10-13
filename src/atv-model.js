import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original gameplay meshes, not a promotional illustration or remote asset.
export const ATV_ART_REVISION=152;
const palettes=new Map(),environments=new WeakMap();
function surface(kind){
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,n=((x*73+y*151+(x*y)%97)%101)/100;
  const weave=kind==='seat'?Math.sin(x*Math.PI/4)*Math.sin(y*Math.PI/4)*.25:kind==='metal'?Math.sin(y*2.1)*.18:0;
  data[i]=128+Math.round((n-.5+weave)*15);data[i+1]=128+Math.round((n-.5-weave)*15);data[i+2]=254;data[i+3]=255;
 }
 const texture=new T.DataTexture(data,size,size);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;texture.userData.shared=true;return texture;
}
function palette(environment){
 const key=environment?.uuid||'none';if(palettes.has(key))return palettes.get(key);
 const rubber=surface('rubber'),seat=surface('seat'),metal=surface('metal');
 const standard=(color,roughness,metalness=0,normalMap=null)=>new T.MeshStandardMaterial({color,roughness,metalness,envMap:environment,envMapIntensity:.65,normalMap,normalScale:new T.Vector2(.24,.24)});
 const p={paint:new T.MeshPhysicalMaterial({color:0xb94c16,roughness:.29,metalness:.48,clearcoat:1,clearcoatRoughness:.16,envMap:environment,envMapIntensity:.9}),plastic:standard(0x151d22,.73,0,rubber),rubber:standard(0x151719,.94,0,rubber),seat:standard(0x1d2429,.86,0,seat),frame:standard(0x303a40,.4,.78,metal),alloy:standard(0x98a3ac,.28,.92,metal),engine:standard(0x555e63,.5,.8,metal),light:standard(0xcbe4ed,.12,.45),led:new T.MeshStandardMaterial({color:0xf6f6e2,emissive:0xd9e7e9,emissiveIntensity:1.5,roughness:.18}),rear:new T.MeshStandardMaterial({color:0x67180c,emissive:0xa5270d,emissiveIntensity:.35,roughness:.22})};
 for(const m of Object.values(p))m.userData.shared=true;palettes.set(key,p);return p;
}
// Reuse one outdoor reflection capture across all quads and levels of detail.
export function atvEnvironment(renderer){
 if(environments.has(renderer))return environments.get(renderer).texture;
 const scene=new T.Scene(),geometry=new T.SphereGeometry(40,32,16),material=new T.ShaderMaterial({side:T.BackSide,uniforms:{sky:{value:new T.Color(0x669bcb)},horizon:{value:new T.Color(0xe1e4db)},earth:{value:new T.Color(0x53604b)}},vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 direction; uniform vec3 sky; uniform vec3 horizon; uniform vec3 earth; void main(){vec3 d=normalize(direction);vec3 c=mix(horizon,sky,pow(max(d.y,0.0),0.45));c=mix(c,earth,1.0-smoothstep(-0.18,0.0,d.y));float sun=max(0.0,dot(d,normalize(vec3(-0.34,0.85,0.4))));c+=vec3(3.5,3.1,2.6)*pow(sun,320.0);gl_FragColor=vec4(c,1.0);}'});
 scene.add(new T.Mesh(geometry,material));const generator=new T.PMREMGenerator(renderer),target=generator.fromScene(scene,.03,.1,100,{size:128});generator.dispose();geometry.dispose();material.dispose();target.texture.userData.shared=true;environments.set(renderer,target);return target.texture;
}
function batch(group){
 group.updateMatrixWorld(true);const bins=new Map();
 for(const m of [...group.children])if(m.isMesh){const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!bins.has(m.material))bins.set(m.material,[]);bins.get(m.material).push(g);m.geometry.dispose();group.remove(m);}
 for(const [material,parts]of bins){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();geometry.userData.shared=true;const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}return group;
}
function builders(group,p,detail){
 const add=(geometry,material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,p[material]);m.position.set(x,y,z);group.add(m);return m;};
 const box=(x,y,z,w,h,d,mat='plastic',radius=.02)=>add(radius>.024&&Math.min(w,h,d)>.07?new RoundedBoxGeometry(w,h,d,detail===2&&['paint','seat'].includes(mat)?2:1,Math.min(radius,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d),mat,x,y,z);
 const tube=(a,b,r,mat='frame')=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av),m=add(new T.CylinderGeometry(r,r,delta.length(),detail===2?12:8),mat,...av.add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;};
 const cylinder=(x,y,z,r,h,mat='alloy',segments=detail===2?24:12)=>add(new T.CylinderGeometry(r,r,h,segments),mat,x,y,z);
 const path=(points,r,mat='frame')=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(q=>new T.Vector3(...q))),detail===2?24:12,r,detail===2?8:6,false),mat);
 return {add,box,tube,cylinder,path};
}
function fender(sign,z,lip=false,detail=2){
 const vertices=[],uv=[],indices=[],steps=detail===2?20:8,across=3;
 for(let layer=0;layer<2;layer++)for(let i=0;i<=steps;i++)for(let j=0;j<=across;j++){const t=-1.10+i/steps*2.2,u=j/across,x=sign*(.36+u*.70),r=.61+(lip?.025:0);vertices.push(x,.53+Math.cos(t)*r-.025*u*u-layer*.028,z+Math.sin(t)*r);uv.push(u,i/steps);}
 const stride=across+1,half=(steps+1)*stride;
 for(let layer=0;layer<2;layer++)for(let i=0;i<steps;i++)for(let j=0;j<across;j++){const a=layer*half+i*stride+j,b=a+stride;if(layer===0)indices.push(a,b,a+1,a+1,b,b+1);else indices.push(a,a+1,b,a+1,b+1,b);}
 for(let i=0;i<steps;i++)for(const j of [0,across]){const a=i*stride+j,b=a+stride;indices.push(a,a+half,b,b,b+half,a+half);}
 for(const i of [0,steps])for(let j=0;j<across;j++){const a=i*stride+j;indices.push(a,a+1,a+half,a+1,a+half+1,a+half);}
 if(sign<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function wheel(p,detail){
 const g=new T.Group(),k=builders(g,p,detail),segments=detail===2?40:detail===1?24:12;
 const profile=[[.255,-.115],[.30,-.155],[.41,-.175],[.48,-.135],[.505,-.075],[.51,0],[.505,.075],[.48,.135],[.41,.175],[.30,.155],[.255,.115],[.255,-.115]].map(([r,y])=>new T.Vector2(r,y));
 const tire=k.add(new T.LatheGeometry(profile,segments),'rubber');tire.rotation.z=Math.PI/2;
 if(detail>0)for(let i=0;i<(detail===2?28:18);i++)for(const side of [-1,1]){const a=i/(detail===2?28:18)*Math.PI*2,t=k.box(side*.084,Math.cos(a)*.507,Math.sin(a)*.507,.155,.055,.13,'rubber',.014);t.rotation.x=a;t.rotation.z=side*.21;}
 const hub=k.cylinder(0,0,0,.13,.28,'alloy');hub.rotation.z=Math.PI/2;
 for(const side of [-1,1]){const ring=k.add(new T.TorusGeometry(.241,.026,detail===2?8:4,segments),'alloy',side*.13,0,0);ring.rotation.y=Math.PI/2;for(let i=0;i<6;i++){const a=i*Math.PI/3,spoke=k.box(side*.128,Math.cos(a)*.165,Math.sin(a)*.165,.045,.22,.058,'alloy',.012);spoke.rotation.x=a;}if(detail===2)for(let i=0;i<6;i++){const a=i*Math.PI/3,b=k.cylinder(side*.158,Math.cos(a)*.088,Math.sin(a)*.088,.017,.019,'alloy',6);b.rotation.z=Math.PI/2;}}
 return batch(g);
}
function spring(p,sign,z,detail){
 const g=new T.Group(),k=builders(g,p,detail),length=.32;g.position.set(sign*.58,.68,z);g.rotation.z=-sign*.47;k.cylinder(0,0,0,.02,length,'alloy');const points=[];for(let i=0;i<=80;i++){const t=i/80,a=t*Math.PI*14;points.push(new T.Vector3(Math.cos(a)*.058,-length/2+t*length,Math.sin(a)*.058));}k.add(new T.TubeGeometry(new T.CatmullRomCurve3(points),detail===2?112:56,.009,detail===2?6:4,false),detail===2?'paint':'alloy');for(const y of [-length/2,length/2])k.cylinder(0,y,0,.067,.025,'alloy');return batch(g);
}
export function makeATV({detail=2,environment=null}={}){
 const base=palette(environment),p=detail===0?{...base,seat:base.plastic,rubber:base.plastic,engine:base.frame,alloy:base.frame,light:base.led,rear:base.paint}:base,root=new T.Group(),body=new T.Group(),k=builders(body,p,detail);root.name='Frontier ATV 152';body.name='atv-body';root.add(body);
 // Welded chassis, skid plate, finned engine, crankcase and heat shield.
 k.box(0,.49,0,.69,.13,1.48,'frame',.055);k.box(0,.39,0,.68,.045,1.2,'engine');
 for(const s of [-1,1]){k.tube([s*.33,.43,-.95],[s*.33,.6,.9],.036);k.tube([s*.33,.61,.8],[s*.35,.97,.55],.03);k.box(s*.54,.50,.06,.35,.055,.88,'plastic',.05);if(detail>0)for(let i=0;i<6;i++)k.box(s*.54,.536,-.29+i*.13,.31,.018,.018,'frame',.004);}
 k.box(0,.67,.07,.48,.34,.64,'engine',.06);
 if(detail>0){for(let i=0;i<9;i++)k.box(0,.55+i*.034,-.14,.53,.015,.38,'engine',.005);for(const s of [-1,1]){const cover=k.cylinder(s*.286,.68,.05,.14,.028,'alloy');cover.rotation.z=Math.PI/2;for(let i=0;i<6;i++){const a=i*Math.PI/3,b=k.cylinder(s*.308,.68+Math.cos(a)*.104,.05+Math.sin(a)*.104,.012,.018,'frame',6);b.rotation.z=Math.PI/2;}}}
 k.path([[.25,.58,-.26],[.42,.42,-.1],[.49,.45,.49],[.55,.56,.88]],.036,'engine');const muffler=k.cylinder(.52,.58,.73,.095,.37,'alloy');muffler.rotation.x=Math.PI/2;k.box(.52,.68,.73,.18,.018,.33,'plastic');
 for(const z of [-.76,.76]){k.tube([-.74,.49,z],[.74,.49,z],.032,'engine');for(const s of [-1,1]){k.tube([s*.27,.58,z-.14],[s*.77,.43,z],.028);k.tube([s*.27,.58,z+.14],[s*.77,.43,z],.028);}}
 // Contoured cowling, curved fenders and independently fitted black mud lips.
 k.box(0,.84,-.26,.55,.30,.70,'paint',.11);const hood=k.box(0,.89,-.84,.75,.23,.49,'paint',.075);hood.rotation.x=-.18;k.box(0,.94,-.19,.22,.035,.43,'plastic',.04);const cap=k.cylinder(0,.971,-.27,.065,.022,'alloy');cap.rotation.x=-.08;
 for(const s of [-1,1])for(const z of [-.76,.76]){k.add(fender(s,z,false,detail),'paint');if(detail>0){const lip=k.add(fender(s,z,true,detail),'plastic');lip.scale.x=1.028;lip.position.y=-.030;}}
 for(const s of [-1,1]){k.box(s*.43,.80,.15,.09,.17,.63,'plastic',.035);k.box(s*.455,.83,.04,.012,.045,.31,'alloy',.004);}
 // Driver and passenger cushions with stitching and a separate grab rail.
 for(const [z,d,h]of [[-.27,.56,.10],[.34,.64,.14]])k.box(0,1.05-h/2,z,.43,h,d,'seat',.055);
 if(detail===2)for(const s of [-1,1])for(let i=0;i<12;i++)k.box(s*.185,1.052,.02+i*.042,.006,.006,.022,'engine',.002);
 k.path([[-.30,.98,.60],[-.35,1.17,.72],[.35,1.17,.72],[.30,.98,.60]],.024);
 for(const z of [-.94,.96]){k.path([[-.52,1.14,z-.19],[-.55,1.14,z+.19],[.55,1.14,z+.19],[.52,1.14,z-.19],[-.52,1.14,z-.19]],.025);for(let i=-2;i<=2;i++)k.tube([i*.19,1.14,z-.16],[i*.19,1.14,z+.16],.013);for(const s of [-1,1])k.tube([s*.42,1.13,z],[s*.33,.83,z],.024);}
 // Recessed grille, steel brush guard, tow point and individual LED lenses.
 k.box(0,.83,-1.13,.62,.23,.08,'plastic',.03);if(detail>0)for(let i=-3;i<=3;i++)k.box(i*.079,.83,-1.178,.025,.15,.012,'frame',.005);
 k.path([[-.55,.48,-1.25],[-.57,.88,-1.26],[.57,.88,-1.26],[.55,.48,-1.25]],.036);k.tube([-.48,.54,-1.26],[.48,.54,-1.26],.028);k.box(0,.49,-1.31,.18,.07,.055,'alloy');
 for(const s of [-1,1]){k.box(s*.38,.97,-1.13,.24,.15,.12,'plastic',.055);k.box(s*.38,.971,-1.20,.204,.115,.014,'light',.025);for(const dx of [-.05,.05])k.box(s*.38+dx,.974,-1.212,.054,.075,.009,'led',.015);k.box(s*.40,.90,1.17,.21,.07,.045,'rear',.025);}
 if(detail===2){for(const s of [-1,1])for(const z of [-.95,.95])k.cylinder(s*.32,1.015,z,.017,.015,'alloy',6);k.box(0,.989,-.67,.105,.014,.15,'frame');for(const s of [-1,1]){const badge=k.box(s*.018,1.002,-.675,.013,.01,.085,'alloy',.002);badge.rotation.y=s*.45;}}
 batch(body);
 // A steering pivot distinct from the wheel spin axes avoids Euler wobble.
 const steering=new T.Group();steering.name='atv-steering';steering.position.set(0,.89,-.57);const h=builders(steering,p,detail);h.tube([0,0,0],[0,.38,-.06],.026);h.path([[-.41,.36,-.10],[-.22,.38,-.05],[.22,.38,-.05],[.41,.36,-.10]],.024,'alloy');
 for(const s of [-1,1]){const grip=h.cylinder(s*.36,.36,-.10,.038,.16,'rubber');grip.rotation.z=Math.PI/2;if(detail>0){h.tube([s*.24,.33,-.10],[s*.42,.32,-.16],.01,'alloy');h.path([[s*.20,.35,-.10],[s*.15,.07,-.37],[s*.12,-.12,-.22]],.008,'plastic');}}
 h.box(0,.39,-.035,.17,.065,.1,'plastic',.02);h.box(0,.426,-.033,.12,.005,.056,'light',.006);batch(steering);root.add(steering);
 const wheelTemplate=wheel(p,detail);
 for(const [i,[x,z]]of [[-.85,-.76],[.85,-.76],[-.85,.76],[.85,.76]].entries()){const pivot=new T.Group();pivot.name='atv-wheel-'+i;pivot.position.set(x,.53,z);const spin=wheelTemplate.clone();spin.name='atv-spin';pivot.add(spin);root.add(pivot);if(detail>0){const coil=spring(p,Math.sign(x),z,detail);coil.name='atv-spring-'+i;root.add(coil);}}
 const flame=new T.Mesh(new T.ConeGeometry(.105,.65,8),new T.MeshBasicMaterial({color:0x7ad8fa,transparent:true,opacity:.72,depthWrite:false}));flame.name='atv-boost';flame.rotation.x=Math.PI/2;flame.position.set(.52,.58,1.32);flame.visible=false;flame.userData.ownedMaterial=true;flame.geometry.userData.shared=true;root.add(flame);
 const shadow=new T.Mesh(new T.PlaneGeometry(2.6,3.2),new T.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,uniforms:{opacity:{value:.25}},vertexShader:'varying vec2 coords;void main(){coords=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 coords;uniform float opacity;void main(){float a=exp(-dot(coords,coords)*4.5)*opacity;gl_FragColor=vec4(0.015,0.021,0.018,a);}'}));shadow.name='atv-contact-shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;shadow.geometry.userData.shared=true;shadow.material.userData.shared=true;root.add(shadow);
 root.userData.artRevision=ATV_ART_REVISION;root.userData.detail=detail;return root;
}
export function atvModelBudget(model){let triangles=0,meshes=0;model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return {triangles,meshes};}
