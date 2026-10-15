import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {modelEnvironment} from './model-surfaces.js';

// Original, shared PBR masonry and fittings. Repeating metre-scale UVs retain
// brick/plank dimensions when differently sized walls are merged into a cell.
export const ARCHITECTURE_REVISION=160;
export const ARCHITECTURE_SURFACES=Object.freeze(['brick','plaster','concrete','timber','roof','metal','glass','tile','fabric','paint']);
const tile=128,columns=4,rows=3,width=columns*tile,height=rows*tile;
const finishes={brick:[.92,0],plaster:[.93,0],concrete:[.94,0],timber:[.83,0],roof:[.85,.05],metal:[.39,.83],glass:[.15,.12],tile:[.37,.02],fabric:[.97,0],paint:[.64,.08]};
const metres={brick:[1.8,1.2],plaster:[1.4,1.4],concrete:[2.4,2.4],timber:[1.4,2.2],roof:[1.5,1.1],metal:[1.5,1.5],glass:[1.5,1.5],tile:[1.2,1.2],fabric:[.6,.6],paint:[1.3,1.3]};
const materials=new Map(),kindMaps=new Map(),geometries=new Map();let atlas,atlasMaterial;
const clamp=(x,a=0,b=1)=>T.MathUtils.clamp(x,a,b);
const hash=(x,y)=>{let n=Math.imul(x+121,374761393)^Math.imul(y+19,668265263);n=Math.imul(n^(n>>>13),1274126177);return(n>>>0)/4294967295;};
const noise=(x,y)=>{const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return T.MathUtils.lerp(T.MathUtils.lerp(hash(a,b),hash(a+1,b),s),T.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),s),t);};
const mod=(x,n)=>(x%n+n)%n;
function sample(kind,x,y){
 const n=hash(x,y),broad=noise(x*.07,y*.07),grain=Math.sin(x*.8+Math.sin(y*.045)*3),edge=(v,n,s)=>Math.min(mod(v,n),n-mod(v,n))<s;
 let shade=.93+(n-.5)*.04,relief=(n-.5)*.06,rough=finishes[kind][0],metal=finishes[kind][1];
 if(kind==='brick'){
  const row=Math.floor(y/21.333),bx=x+(row%2)*21.333,mortar=edge(y,21.333,1.2)||edge(bx,42.666,1.1),variation=hash(Math.floor(bx/42.666),row);
  shade=mortar?.69:.78+variation*.18+(n-.5)*.065;relief=mortar?-.36:.03+(broad-.5)*.14+(n-.5)*.12;rough=mortar?.99:.88+(n-.5)*.08;
 }else if(kind==='plaster'){
  const chip=Math.max(0,noise(x*.13,y*.13)-.7);shade=.9+(broad-.5)*.075+(n-.5)*.06-chip*.35;relief=(n-.5)*.19+chip*.45;
 }else if(kind==='concrete'){
  const pore=n>.96?-.22:0,joint=edge(x,64,.5)||edge(y,64,.5);shade=.86+(broad-.5)*.12+(n-.5)*.06+pore*.32-(joint?.055:0);relief=(n-.5)*.10+pore-(joint?.10:0);
 }else if(kind==='timber'){
  const seam=edge(x,25.6,1),knot=Math.sin(x*.21+Math.sin(y*.035)*2.8+noise(x*.025,y*.04));shade=.83+knot*.095+grain*.025-(seam?.14:0);relief=knot*.13+grain*.04-(seam?.23:0);
 }else if(kind==='roof'){
  const row=Math.floor(y/25.6),u=mod(x+(row%2)*12.8,25.6)/25.6,v=mod(y,25.6)/25.6,seam=u<.04||v<.07;
  shade=.81+Math.sin(u*Math.PI)*.10+hash(Math.floor((x+(row%2)*12.8)/25.6),row)*.08-(seam?.15:0);relief=Math.sin(u*Math.PI)*.18+v*.12-(seam?.2:0);
 }else if(kind==='metal'){
  const seam=edge(x,42.666,.7),rivet=(mod(x+6,42.666)<2&&mod(y+5,32)<2);shade=.94+(n-.5)*.04-(seam?.14:0);relief=Math.sin(y*2.2)*.018-(seam?.13:0)+(rivet?.16:0);rough+=broad*.14;
 }else if(kind==='glass'){
  shade=.96+(broad-.5)*.018;relief=0;rough=.12+broad*.055;
 }else if(kind==='tile'){
  const seam=edge(x,32,.8)||edge(y,32,.8);shade=.94+(broad-.5)*.035-(seam?.28:0);relief=(n-.5)*.01-(seam?.17:0);rough=seam?.91:.32;
 }else if(kind==='fabric'){
  const weave=(x%4<2?1:-1)*(y%4<2?1:-1);shade=.91+weave*.04+(n-.5)*.02;relief=weave*.11+(n-.5)*.03;
 }else if(kind==='paint'){
  const worn=Math.max(0,noise(x*.12,y*.12)-.74);shade=.94+(n-.5)*.04-worn*.3;relief=(n-.5)*.075+worn*.1;rough+=worn;
 }
 return {shade:clamp(shade),relief,rough:clamp(rough+(n-.5)*.035),metal};
}
function texture(data,w,h,srgb=false){const t=new T.DataTexture(data,w,h);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;t.userData.shared=true;return t;}
function maps(){
 if(atlas)return atlas;const data=Array.from({length:4},()=>new Uint8Array(width*height*4));
 for(let index=0;index<columns*rows;index++)for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
  const kind=ARCHITECTURE_SURFACES[index]||'plaster',s=sample(kind,x,y),dx=sample(kind,(x+1)%tile,y).relief-s.relief,dy=sample(kind,x,(y+1)%tile).relief-s.relief,i=((Math.floor(index/columns)*tile+y)*width+index%columns*tile+x)*4,c=Math.round(s.shade*255),r=Math.round(s.rough*255),m=Math.round(s.metal*255);
  data[0].set([c,c,c,255],i);data[1].set([Math.round(clamp(128-dx*170,1,254)),Math.round(clamp(128-dy*170,1,254)),250,255],i);data[2].set([r,r,r,255],i);data[3].set([m,m,m,255],i);
 }
 atlas=Object.fromEntries(['map','normalMap','roughnessMap','metalnessMap'].map((name,i)=>[name,texture(data[i],width,height,i===0)]));return atlas;
}
function perKind(kind){if(kindMaps.has(kind))return kindMaps.get(kind);const index=ARCHITECTURE_SURFACES.indexOf(kind),result={};for(const [name,t]of Object.entries(maps())){const data=new Uint8Array(tile*tile*4);for(let y=0;y<tile;y++){const from=((Math.floor(index/columns)*tile+y)*width+index%columns*tile)*4;data.set(t.image.data.subarray(from,from+tile*4),y*tile*4);}result[name]=texture(data,tile,tile,name==='map');}kindMaps.set(kind,result);return result;}
export function architectureMaterial(color,kind='plaster'){
 if(!finishes[kind])kind='paint';const c=new T.Color(color??0xffffff).getHex(),key=c+':'+kind;if(materials.has(key))return materials.get(key);
 // Opaque glass is reserved for closed fixtures: gameplay window holes remain open.
 const m=new T.MeshStandardMaterial({color:c,...perKind(kind),normalScale:new T.Vector2(.55,.55),roughness:1,metalness:1,envMap:modelEnvironment(),envMapIntensity:.48});m.userData={shared:true,architectureSurface:kind,artRevision:ARCHITECTURE_REVISION};materials.set(key,m);return m;
}
export function architectureAtlasMaterial(){
 if(atlasMaterial)return atlasMaterial;
 const m=new T.MeshStandardMaterial({vertexColors:true,...maps(),normalScale:new T.Vector2(.55,.55),roughness:1,metalness:1,envMap:modelEnvironment(),envMapIntensity:.48});
 m.userData={shared:true,architectureSurface:'atlas',architectureAtlas:true,artRevision:ARCHITECTURE_REVISION};
 m.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float architectureKind;\nvarying float vArchitectureKind;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvArchitectureKind=architectureKind;');
  shader.fragmentShader=`varying float vArchitectureKind;
vec4 architectureSample(sampler2D source,vec2 coordinates){
 float kind=floor(vArchitectureKind+.5);
 vec2 grid=vec2(4.,3.),inner=vec2(122./128.);
 vec2 origin=vec2(mod(kind,4.),floor(kind/4.));
 vec2 uv=(origin+vec2(3./128.)+fract(coordinates)*inner)/grid;
 return textureGrad(source,uv,dFdx(coordinates)*inner/grid,dFdy(coordinates)*inner/grid);
}
`+shader.fragmentShader;
  for(const chunk of ['map_fragment','normal_fragment_maps','roughnessmap_fragment','metalnessmap_fragment'])shader.fragmentShader=shader.fragmentShader.replace('#include <'+chunk+'>',T.ShaderChunk[chunk].replace(/texture2D\(\s*(map|normalMap|roughnessMap|metalnessMap)\s*,\s*([A-Za-z0-9_]+)\s*\)/g,'architectureSample($1, $2)'));
 };
 m.customProgramCacheKey=()=> 'ravelfront-architecture-atlas-160';atlasMaterial=m;return m;
}
export function architectureUV(g,kind='plaster'){
 if(kind==='atlas'||g.userData.architectureAtlas&&g.attributes.architectureKind)return g;
 if(!finishes[kind])kind='paint';const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2),ids=new Uint8Array(p.count),index=ARCHITECTURE_SURFACES.indexOf(kind),scale=metres[kind];
 for(let i=0;i<p.count;i++){
  const nx=Math.abs(n?.getX(i)||0),ny=Math.abs(n?.getY(i)||0),nz=Math.abs(n?.getZ(i)||0),horizontal=ny>=nx&&ny>=nz;
  uv[i*2]=(horizontal?p.getX(i):nx>nz?p.getZ(i):p.getX(i))/scale[0];uv[i*2+1]=(horizontal?p.getZ(i):p.getY(i))/scale[1];ids[i]=index;
 }
 g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setAttribute('architectureKind',new T.BufferAttribute(ids,1));g.userData={...g.userData,architectureAtlas:true};return g;
}
export function buildingSurface(box={},b={}){
 const type=b.type||b.kind||'',industrial=['warehouse','refinery','hangar','garage','command','radio','station'].includes(type),timber=['barn','stable','cabin','lodge','shed','mill'].includes(type)||['farm','camp','park'].includes(b.kind);
 if(box.color==='foundation')return 'concrete';
 if(box.color==='roof'||box.kind==='roof-collider')return 'roof';
 if(box.color==='floor')return industrial?'concrete':['hotel','villa','lab','hatchery','bakery'].includes(type)?'tile':timber||['house','apartment','shop'].includes(type)?'timber':'concrete';
 if(box.color==='stair'||box.kind==='step')return industrial?'metal':timber||['house','apartment','shop','bakery'].includes(type)?'timber':'concrete';
 if(box.color==='rail')return industrial?'metal':timber?'timber':'plaster';
 if(box.color==='partition')return industrial?'concrete':timber?'timber':'plaster';
 if(box.color==='lintel')return industrial?'concrete':timber?'timber':'paint';
 return timber?'timber':industrial?'concrete':['apartment','shop','bakery','tower'].includes(type)||b.kind==='town'?'brick':'plaster';
}
function geo(key,create){if(!geometries.has(key)){const g=create();g.userData.shared=true;geometries.set(key,g);}return geometries.get(key);}
export function architectureKit(raw={},building={}){
 const add=(g,geometry,x,y,z,sx,sy,sz,c,kind='paint')=>{const m=new T.Mesh(geometry,architectureMaterial(c,kind));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;m.userData.architectureRevision=ARCHITECTURE_REVISION;g.add(m);return m;};
 const k={...raw,mat:(c,kind='paint')=>architectureMaterial(c,kind)};
 k.block=(g,x,y,z,w,h,d,c,kind='paint')=>add(g,geo('box',()=>new T.BoxGeometry()),x,y,z,w,h,d,c,kind);
 k.rounded=(g,x,y,z,w,h,d,c,r=.035,kind='paint')=>add(g,geo(`round:${w}:${h}:${d}:${r}`,()=>new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3))),x,y,z,1,1,1,c,kind);
 k.cylinder=(g,x,y,z,r,h,c,n=10,kind='metal')=>add(g,geo('cylinder:'+n,()=>new T.CylinderGeometry(1,1,1,n)),x,y,z,r,h,r,c,kind);
 k.cone=(g,x,y,z,r,h,c,top=0,kind='metal')=>add(g,geo('cone:'+top,()=>new T.CylinderGeometry(top,1,1,10)),x,y,z,r,h,r,c,kind);
 k.torus=(g,x,y,z,r,t,c,kind='metal')=>add(g,geo(`torus:${r}:${t}`,()=>new T.TorusGeometry(r,t,4,12)),x,y,z,1,1,1,c,kind);
 k.rock=(g,x,y,z,w,h,d,c,detail=1,kind='plaster')=>add(g,geo('rock:'+detail,()=>new T.IcosahedronGeometry(1,detail)),x,y,z,w,h,d,c,kind);
 k.ball=(g,x,y,z,w,h,d,c,kind='paint')=>add(g,geo('sphere',()=>new T.SphereGeometry(1,10,7)),x,y,z,w,h,d,c,kind);
 k.beam=(g,a,b,r,c,kind='metal')=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av),m=add(g,geo('beam',()=>new T.CylinderGeometry(1,1,1,8)),...av.add(bv).multiplyScalar(.5).toArray(),r,v.length(),r,c,kind);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;};
 return k;
}
export function architectureSurfaceDiagnostics(){return {revision:ARCHITECTURE_REVISION,surfaceKinds:ARCHITECTURE_SURFACES.length,atlas:[width,height],materials:materials.size,geometryTemplates:geometries.size,textureBytes:width*height*4*4+kindMaps.size*tile*tile*4*4};}
