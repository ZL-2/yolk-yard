import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {modelEnvironment} from './model-surfaces.js';
export {T as THREE};

// One small atlas for the entire non-building environment, not a texture set
// per tree or prop. Opaque foliage is separately batched for inexpensive wind.
export const ENVIRONMENT_REVISION=159;
export const ENVIRONMENT_SURFACES=Object.freeze(['bark','leaf','stone','wood','metal','paint','rubber','fabric','soil']);
const tile=128,columns=4,rows=3,width=tile*columns,height=tile*rows;
const finish={bark:[.98,0],leaf:[.87,0],stone:[.94,0],wood:[.86,0],metal:[.41,.82],paint:[.62,.24],rubber:[.97,0],fabric:[.96,0],soil:[1,0]};
const materials=new Map(),kindTextures=new Map(),geometries=new Map(),atlases=new Map();
const wind={value:0};let atlas;
const hash=(x,y)=>{let n=Math.imul(x+71,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return(n>>>0)/4294967295;};
const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,s=u*u*(3-2*u),t=v*v*(3-2*v);return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),s),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),s),t);};
function sample(kind,x,y){
 const n=hash(x,y),broad=noise(x*.065,y*.065),grain=Math.sin(x*.30+Math.sin(y*.06)*1.5),crack=Math.pow(Math.max(0,Math.sin(x*.23+noise(x*.06,y*.045)*2)),14);
 let shade=.91+(n-.5)*.07,relief=(n-.5)*.08,rough=finish[kind][0];
 if(kind==='bark'){shade=.81+broad*.19-crack*.30;relief=grain*.20-crack*.32+(n-.5)*.09;}
 if(kind==='wood'){const knot=Math.sin(x*.21+Math.sin(y*.025)*3+noise(x*.02,y*.04));shade=.84+knot*.10+(n-.5)*.04;relief=knot*.16+(n-.5)*.045;}
 if(kind==='stone'){const seam=Math.pow(Math.max(0,Math.sin(y*.11+noise(x*.03,y*.04)*4)),18);shade=.82+broad*.20-seam*.14;relief=(broad-.5)*.38+(n-.5)*.14-seam*.12;}
 if(kind==='leaf'){const vein=Math.exp(-Math.abs(x-64)*.48)+Math.pow(Math.max(0,Math.cos((y+Math.abs(x-64)*.6)*.48)),20)*.28;shade=.83+broad*.16+vein*.06;relief=vein*.13+(n-.5)*.025;}
 if(kind==='metal'){shade=.93+(n-.5)*.06-Math.pow(Math.max(0,Math.sin(y*.91)),24)*.07;relief=Math.sin(y*1.7)*.035+(n-.5)*.03;rough+=broad*.12;}
 if(kind==='paint'){const wear=Math.max(0,noise(x*.11,y*.11)-.65);shade=.92+(n-.5)*.04-wear*.3;relief=(n-.5)*.045+wear*.10;rough+=wear*.5;}
 if(kind==='rubber'){relief=(n-.5)*.11;shade=.92+(n-.5)*.07;}
 if(kind==='fabric'){const weave=(x%4<2?1:-1)*(y%4<2?1:-1);relief=weave*.10+(n-.5)*.04;shade=.91+weave*.035;}
 if(kind==='soil'){shade=.78+broad*.22+(n-.5)*.11;relief=(n-.5)*.23+(broad-.5)*.30;}
 return {shade,relief,rough:T.MathUtils.clamp(rough+(n-.5)*.06,0,1),metal:finish[kind][1]};
}
function texture(data,w,h,srgb=false){const t=new T.DataTexture(data,w,h);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=2;t.needsUpdate=true;t.userData.shared=true;return t;}
function maps(){
 if(atlas)return atlas;const data=Array.from({length:4},()=>new Uint8Array(width*height*4));
 for(let index=0;index<columns*rows;index++)for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
  const kind=ENVIRONMENT_SURFACES[index]||'stone',s=sample(kind,x,y),dx=sample(kind,(x+1)%tile,y).relief-s.relief,dy=sample(kind,x,(y+1)%tile).relief-s.relief,i=((Math.floor(index/columns)*tile+y)*width+index%columns*tile+x)*4,c=Math.round(T.MathUtils.clamp(s.shade,0,1)*255),r=Math.round(s.rough*255),m=Math.round(s.metal*255);
  data[0].set([c,c,c,255],i);data[1].set([Math.round(T.MathUtils.clamp(128-dx*125,1,254)),Math.round(T.MathUtils.clamp(128-dy*125,1,254)),250,255],i);data[2].set([r,r,r,255],i);data[3].set([m,m,m,255],i);
 }
 atlas=Object.fromEntries(['map','normalMap','roughnessMap','metalnessMap'].map((name,i)=>[name,texture(data[i],width,height,i===0)]));return atlas;
}
function perKind(kind){if(kindTextures.has(kind))return kindTextures.get(kind);const index=ENVIRONMENT_SURFACES.indexOf(kind),result={};for(const [name,t]of Object.entries(maps())){const data=new Uint8Array(tile*tile*4);for(let y=0;y<tile;y++){const start=((Math.floor(index/columns)*tile+y)*width+(index%columns)*tile)*4;data.set(t.image.data.subarray(start,start+tile*4),y*tile*4);}result[name]=texture(data,tile,tile,name==='map');}kindTextures.set(kind,result);return result;}
function foliageWind(m){
 m.side=T.DoubleSide;m.forceSinglePass=true;
 m.onBeforeCompile=shader=>{shader.uniforms.environmentTime=wind;shader.vertexShader='uniform float environmentTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  vec4 environmentPosition=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
   environmentPosition=instanceMatrix*environmentPosition;
  #endif
  environmentPosition=modelMatrix*environmentPosition;
  float environmentSway=(sin(environmentPosition.x*.71+environmentTime*1.4)+sin(environmentPosition.z*.93-environmentTime*.8))*.027;
  transformed.x+=environmentSway;transformed.z+=environmentSway*.6;`);};
 m.customProgramCacheKey=()=> 'ravelfront-environment-foliage-159';return m;
}
export function environmentMaterial(color,kind='paint'){
 if(!finish[kind])kind='paint';const c=new T.Color(color??0xffffff).getHex(),key=c+':'+kind;if(materials.has(key))return materials.get(key);
 const m=new T.MeshStandardMaterial({color:c,...perKind(kind),normalScale:new T.Vector2(.55,.55),roughness:1,metalness:1,envMap:modelEnvironment(),envMapIntensity:.44});
 m.userData={shared:true,environmentSurface:kind,environmentFoliage:kind==='leaf',artRevision:ENVIRONMENT_REVISION};if(kind==='leaf')foliageWind(m);materials.set(key,m);return m;
}
export function environmentAtlasMaterial(foliage=false){
 if(!atlases.has(foliage)){const m=new T.MeshStandardMaterial({vertexColors:true,...maps(),normalScale:new T.Vector2(.55,.55),roughness:1,metalness:1,envMap:modelEnvironment(),envMapIntensity:.44});m.userData={shared:true,environmentSurface:'atlas',environmentAtlas:true,environmentFoliage:foliage,artRevision:ENVIRONMENT_REVISION};if(foliage)foliageWind(m);atlases.set(foliage,m);}return atlases.get(foliage);
}
export function environmentUV(g,kind='paint'){
 if(g.userData.environmentAtlas||kind==='atlas')return g;const index=Math.max(0,ENVIRONMENT_SURFACES.indexOf(kind)),p=g.attributes.position;let uv=g.attributes.uv;if(!uv){uv=new T.Float32BufferAttribute(new Float32Array(p.count*2),2);for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i),p.getY(i)+p.getZ(i)*.2);g.setAttribute('uv',uv);}
 let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;for(let i=0;i<uv.count;i++){minU=Math.min(minU,uv.getX(i));maxU=Math.max(maxU,uv.getX(i));minV=Math.min(minV,uv.getY(i));maxV=Math.max(maxV,uv.getY(i));}
 const bx=(index%columns)*tile+2,by=Math.floor(index/columns)*tile+2;
 for(let i=0;i<uv.count;i++)uv.setXY(i,(bx+(uv.getX(i)-minU)/Math.max(1e-6,maxU-minU)*(tile-4))/width,(by+(uv.getY(i)-minV)/Math.max(1e-6,maxV-minV)*(tile-4))/height);
 g.userData={...g.userData,environmentAtlas:true};uv.needsUpdate=true;return g;
}
export function updateEnvironmentSurfaces(time){wind.value=Number.isFinite(time)?time:0;}
export function unpackEnvironmentGeometry(g){for(const name of ['normal','color','uv']){const a=g.attributes[name];if(!a||a.array instanceof Float32Array&&!a.normalized)continue;const data=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)data[i*a.itemSize+k]=a.getComponent(i,k);g.setAttribute(name,new T.BufferAttribute(data,a.itemSize));}return g;}
// Position floats stay exact for damage/collision alignment. Static normals,
// colors and atlas UVs do not need 32-bit floats: normalized GPU attributes cut
// these baked vertex streams by 42–44% with subpixel/imperceptible precision loss.
export function packEnvironmentGeometry(g){
 const n=g.attributes.normal,c=g.attributes.color,uv=g.attributes.uv;
 if(n?.array instanceof Float32Array){const data=new Int16Array(n.count*3);for(let i=0;i<data.length;i++)data[i]=Math.round(T.MathUtils.clamp(n.array[i],-1,1)*32767);g.setAttribute('normal',new T.BufferAttribute(data,3,true));}
 if(c?.array instanceof Float32Array){const data=new Uint8Array(c.count*3);for(let i=0;i<data.length;i++)data[i]=Math.round(T.MathUtils.clamp(c.array[i],0,1)*255);g.setAttribute('color',new T.BufferAttribute(data,3,true));}
 if(uv?.array instanceof Float32Array&&g.userData.environmentAtlas){const data=new Uint16Array(uv.count*2);for(let i=0;i<data.length;i++)data[i]=Math.round(T.MathUtils.clamp(uv.array[i],0,1)*65535);g.setAttribute('uv',new T.BufferAttribute(data,2,true));}
 g.userData.compactStatic=true;return g;
}
function geo(key,create){if(!geometries.has(key)){const g=create();g.userData.shared=true;geometries.set(key,g);}return geometries.get(key);}
export function environmentKit(raw={},defaultKind='paint'){
 const add=(g,geometry,x,y,z,sx,sy,sz,c,kind)=>{const m=new T.Mesh(geometry,environmentMaterial(c,kind||defaultKind));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const k={...raw,mat:(c,kind=defaultKind)=>environmentMaterial(c,kind)};
 k.block=(g,x,y,z,w,h,d,c,kind)=>add(g,geo('box',()=>new T.BoxGeometry()),x,y,z,w,h,d,c,kind);
 k.rounded=(g,x,y,z,w,h,d,c,r=.05,kind)=>add(g,geo(`round:${w}:${h}:${d}:${r}`,()=>new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3))),x,y,z,1,1,1,c,kind);
 k.cylinder=(g,x,y,z,r,h,c,n=12,kind)=>add(g,geo('cylinder:'+n,()=>new T.CylinderGeometry(1,1,1,n)),x,y,z,r,h,r,c,kind);
 k.cone=(g,x,y,z,r,h,c,top=0,kind)=>add(g,geo('cone:'+top,()=>new T.CylinderGeometry(top,1,1,10)),x,y,z,r,h,r,c,kind);
 k.torus=(g,x,y,z,r,t,c,kind)=>add(g,geo(`torus:${r}:${t}`,()=>new T.TorusGeometry(r,t,5,16)),x,y,z,1,1,1,c,kind);
 k.rock=(g,x,y,z,w,h,d,c,detail=1,kind)=>add(g,geo('rock:'+detail,()=>new T.IcosahedronGeometry(1,detail)),x,y,z,w,h,d,c,kind||'stone');
 k.ball=(g,x,y,z,w,h,d,c,kind)=>add(g,geo('ball',()=>new T.SphereGeometry(1,10,7)),x,y,z,w,h,d,c,kind);
 k.beam=(g,a,b,r,c,kind)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av),m=add(g,geo('beam',()=>new T.CylinderGeometry(1,1,1,6)),...av.add(bv).multiplyScalar(.5).toArray(),r,v.length(),r,c,kind);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;};return k;
}
export function environmentSurfaceDiagnostics(){return {revision:ENVIRONMENT_REVISION,atlas:[width,height],surfaceKinds:ENVIRONMENT_SURFACES.length,materials:materials.size,geometryTemplates:geometries.size,textureBytes:width*height*4*4+kindTextures.size*tile*tile*4*4};}
