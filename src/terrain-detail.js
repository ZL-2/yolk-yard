import * as T from 'three';
import {groundAt} from './terrain.js';
import {modelEnvironment} from './model-surfaces.js';

// Update 159: visual-only terrain. Collision samples, triangle diagonals, sea
// level and map dimensions are deliberately unchanged. One indexed mesh per
// 32x32-cell chunk replaces six duplicated vertices per cell. Every chunk uses
// the same globally computed normals, material and road control map.
export const TERRAIN_DETAIL_REVISION=159;
export const TERRAIN_DETAIL_BUDGET=Object.freeze({chunkCells:32,controlSize:1024,atlasSize:[768,512],coastSize:256,oceanTriangles:2});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,y)=>{let n=Math.imul(x+71,374761393)^Math.imul(y+37,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295;};
const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=smooth(0,1,x-ix),v=smooth(0,1,y-iy);return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);};
const roadIndices=new WeakMap();
let detailAtlas;

function dataTexture(data,w,h,{repeat=false,srgb=false,mipmaps=true}={}){
 const texture=new T.DataTexture(data,w,h,T.RGBAFormat,T.UnsignedByteType);
 texture.wrapS=texture.wrapT=repeat?T.RepeatWrapping:T.ClampToEdgeWrapping;
 texture.magFilter=T.LinearFilter;texture.minFilter=mipmaps?T.LinearMipmapLinearFilter:T.LinearFilter;
 texture.generateMipmaps=mipmaps;texture.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;
 texture.anisotropy=4;texture.needsUpdate=true;return texture;
}

// The six tiles contain actual original material color and relief, not a
// magnified noise overlay: crossed grass fibers, soil stones, sand ripples,
// stratified/fissured rock, asphalt aggregate, and a low-frequency blend tile.
function terrainAtlas(){
 if(detailAtlas)return detailAtlas;
 const tile=256,w=768,h=512,data=new Uint8Array(w*h*4),height=new Float32Array(tile*tile),rgb=new Float32Array(tile*tile*3);
 const palettes=[[0x66734c,0x85915b],[0x675944,0x99856a],[0xb7a47a,0xdac797],[0x6e7468,0xa0a291],[0x303b3d,0x606866],[0x68794d,0x9da16b]].map(p=>p.map(c=>new T.Color(c)));
 for(let layer=0;layer<6;layer++){
  for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
   const u=x/tile,v=y/tile,n=hash(x,y),n2=hash(x+129,y+541),patch=noise(x/29,y/29),grain=noise(x/3,y/3),i=y*tile+x;
   let tone=.4+patch*.25+(n-.5)*.18,relief=grain*.4;
   if(layer===0){
    const blade=Math.pow(Math.max(0,Math.sin(x*1.62+Math.sin(y*.16)*1.7)),7)*(.35+.65*Math.sin(y*.11+x*.03)**2);
    const cross=Math.pow(Math.max(0,Math.sin((x+y*.62)*1.03)),10)*.3;
    tone=.18+patch*.34+blade*.44+cross+(n-.5)*.16;relief=blade*.55+cross*.4+grain*.2;
   }else if(layer===1){
    const pebble=Math.max(0,grain-.54)*2.7;tone=.25+patch*.43+pebble*.32+(n-.5)*.2;relief=pebble*.6+grain*.22;
   }else if(layer===2){
    const ripple=Math.sin(v*2*Math.PI*11+Math.sin(u*2*Math.PI*3)*.8);tone=.48+patch*.18+ripple*.055+(n-.5)*.12;relief=.45+ripple*.12+(n-.5)*.11;
   }else if(layer===3){
    const vein=Math.abs(Math.sin(y*.077+Math.sin(x*.022)*2+noise(x/38,y/38)*2));
    const crack=1-smooth(.03,.14,vein);tone=.23+patch*.45+(n-.5)*.18-crack*.20;relief=.32+grain*.3-crack*.32+Math.sin(y*.15)*.08;
   }else if(layer===4){
    const stone=n>.76?(n-.76)*2.4:0;tone=.2+grain*.2+stone*.62+(n2-.5)*.08;relief=grain*.24+stone*.25;
   }else{tone=patch*.65+noise(x/72,y/72)*.35;relief=tone;}
   const a=palettes[layer][0],b=palettes[layer][1],blend=clamp(tone);
   rgb[i*3]=a.r+(b.r-a.r)*blend;rgb[i*3+1]=a.g+(b.g-a.g)*blend;rgb[i*3+2]=a.b+(b.b-a.b)*blend;height[i]=clamp(relief);
  }
  // A periodic edge crossfade prevents seams while inset atlas sampling keeps
  // filtering from bleeding sand into grass or rock into asphalt.
  const edge=12;
  for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
   const i=y*tile+x,wx=x<edge?(edge-x)/(edge*2):x>=tile-edge?(x-(tile-edge))/(edge*2):0,wy=y<edge?(edge-y)/(edge*2):y>=tile-edge?(y-(tile-edge))/(edge*2):0;
   const xx=tile-1-x,yy=tile-1-y,ix=y*tile+xx,iy=yy*tile+x,ixy=yy*tile+xx,j=((Math.floor(layer/3)*tile+y)*w+(layer%3)*tile+x)*4;
   for(let k=0;k<3;k++)data[j+k]=Math.round(clamp(T.MathUtils.lerp(T.MathUtils.lerp(rgb[i*3+k],rgb[ix*3+k],wx),T.MathUtils.lerp(rgb[iy*3+k],rgb[ixy*3+k],wx),wy))*255);
   data[j+3]=Math.round(clamp(T.MathUtils.lerp(T.MathUtils.lerp(height[i],height[ix],wx),T.MathUtils.lerp(height[iy],height[ixy],wx),wy))*255);
  }
 }
 // RGB is already linear; the alpha channel is the material's height signal.
 detailAtlas=dataTexture(data,w,h,{mipmaps:true});detailAtlas.userData={shared:true,terrainDetail:true,revision:TERRAIN_DETAIL_REVISION};return detailAtlas;
}

function roadIndex(map){
 const cached=roadIndices.get(map);if(cached)return cached;
 const cell=24,cells=new Map(),buildings=new Map();
 const insert=(target,item,minX,maxX,minZ,maxZ)=>{for(let z=Math.floor(minZ/cell);z<=Math.floor(maxZ/cell);z++)for(let x=Math.floor(minX/cell);x<=Math.floor(maxX/cell);x++){const key=x+':'+z;if(!target.has(key))target.set(key,[]);target.get(key).push(item);}};
 for(const road of map.roads||[])for(let i=1;i<road.points.length;i++){
  const [ax,az]=road.points[i-1],[bx,bz]=road.points[i],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);if(length<.001)continue;
  const segment={ax,az,dx,dz,length,inverseLength:1/length,width:road.width||5,kind:road.kind||'road'},r=segment.width*.5+1;
  insert(cells,segment,Math.min(ax,bx)-r,Math.max(ax,bx)+r,Math.min(az,bz)-r,Math.max(az,bz)+r);
 }
 for(const b of map.buildings||[])insert(buildings,b,b.x-b.w*.5-.4,b.x+b.w*.5+.4,b.z-b.d*.5-.4,b.z+b.d*.5+.4);
 const result={cell,cells,buildings};roadIndices.set(map,result);return result;
}

function sampleRoad(index,x,z){
 const key=Math.floor(x/index.cell)+':'+Math.floor(z/index.cell);
 for(const b of index.buildings.get(key)||[])if(Math.abs(x-b.x)<b.w*.5+.4&&Math.abs(z-b.z)<b.d*.5+.4)return {road:0,path:0,white:0,yellow:0};
 let road=0,path=0,white=0,yellow=0;
 for(const r of index.cells.get(key)||[]){
  const along=clamp(((x-r.ax)*r.dx+(z-r.az)*r.dz)*r.inverseLength,0,r.length),t=along*r.inverseLength;
  const distance=Math.hypot(x-r.ax-t*r.dx,z-r.az-t*r.dz),half=r.width*.5,coverage=1-smooth(half-.2,half+.45,distance);if(!coverage)continue;
  if(r.kind==='path'){path=Math.max(path,coverage);continue;}
  road=Math.max(road,coverage);
  // Paint is restricted to straight portions, leaving junctions and rounded
  // endpoints unobstructed; no floating road/marking meshes or z fighting.
  if(along<2.5||along>r.length-2.5)continue;
  const edge=(1-smooth(.13,.32,Math.abs(distance-(half-.45))))*coverage;
  const center=1-smooth(r.kind==='runway'?.27:.09,r.kind==='runway'?.52:.25,distance);
  if(r.kind==='taxiway')yellow=Math.max(yellow,center*.84);
  else if(r.kind==='runway'){
   const stripe=(along%12)<6?1:0;white=Math.max(white,edge*.9,center*stripe*.94);
  }else{
   const stripe=(along%9)<4.4?1:0;white=Math.max(white,edge*.65);yellow=Math.max(yellow,center*stripe*.72);
  }
 }
 return {road,path:path*(1-road),white,yellow};
}

// Efficient, renderer-independent classification for bounded decorative
// scatter. A single sampler captures the spatial road index; it adds no
// colliders and never mutates authoritative terrain or navigation data.
export function createTerrainSurfaceSampler(map){
 const index=roadIndex(map),t=map.terrain,delta=t?.cell||2;
 return (x,z)=>{
  const height=groundAt(map,x,z),dx=(groundAt(map,x-delta,z)-groundAt(map,x+delta,z))/(delta*2),dz=(groundAt(map,x,z-delta)-groundAt(map,x,z+delta))/(delta*2),slope=1-1/Math.hypot(dx,1,dz),roads=sampleRoad(index,x,z);
  const sand=1-smooth(.8,3.2,height),quarry=map.id==='sunnybreak'?1-smooth(.9,1.25,Math.hypot((x+164)/44,(z-67)/40)):0;
  const rock=Math.max(smooth(.13,.47,slope),quarry*.83,smooth(25,35,height)*.42)*(1-sand);
  const soil=smooth(.48,.76,noise(x*.055,z*.055))*.40,land=(1-roads.road)*(1-roads.path);
  return {height,slope,grass:land*(1-sand)*(1-rock)*(1-soil),sand,rock,soil,road:roads.road,path:roads.path};
 };
}

function* createRoadControl(map){
 const size=TERRAIN_DETAIL_BUDGET.controlSize,worldSize=map.terrain.size*2,data=new Uint8Array(size*size*4),index=roadIndex(map);
 for(let y=0;y<size;y++){
  const z=(y+.5)/size*worldSize-map.terrain.size;
  for(let x=0;x<size;x++){
   const wx=(x+.5)/size*worldSize-map.terrain.size,s=sampleRoad(index,wx,z),i=(y*size+x)*4;
   data[i]=Math.round(s.road*255);data[i+1]=Math.round(s.path*255);data[i+2]=Math.round(s.white*255);data[i+3]=Math.round(s.yellow*255);
  }
  if(y%16===15)yield;
 }
 return dataTexture(data,size,size,{mipmaps:true});
}

const TERRAIN_VERTEX_DECL=`varying vec3 vTerrainWorld;varying vec3 vTerrainNormal;`;
const TERRAIN_FRAGMENT_DECL=`
 varying vec3 vTerrainWorld;varying vec3 vTerrainNormal;
 uniform sampler2D terrainAtlas;uniform sampler2D terrainControl;
 uniform float terrainSize;uniform float terrainQuality;uniform float terrainQuarry;
 vec4 terrainTile(vec2 coordinate,float tile){
  vec2 tileOffset=vec2(mod(tile,3.0),floor(tile/3.0));
  vec2 tileUV=(tileOffset+(fract(coordinate)*252.0+2.0)/256.0)/vec2(3.0,2.0);
  return textureGrad(terrainAtlas,tileUV,dFdx(coordinate)*.984375/vec2(3.0,2.0),dFdy(coordinate)*.984375/vec2(3.0,2.0));
 }
 vec3 terrainReliefNormal(vec3 p,vec3 n,float height){
  vec3 dx=dFdx(p),dy=dFdy(p),r1=cross(dy,n),r2=cross(n,dx);
  float determinant=dot(dx,r1);
  vec3 gradient=sign(determinant)*(dFdx(height)*r1+dFdy(height)*r2);
  return normalize(max(abs(determinant),0.00000001)*n-gradient);
 }
`;
const TERRAIN_SURFACE=`
 vec2 terrainUV=(vTerrainWorld.xz+terrainSize)/(terrainSize*2.0);
 vec4 roadInfo=texture2D(terrainControl,terrainUV);
 float terrainSlope=1.0-clamp(normalize(vTerrainNormal).y,0.0,1.0);
 vec4 macro=terrainTile(vTerrainWorld.xz*.008,5.0);
 float sandMix=1.0-smoothstep(.8,3.2,vTerrainWorld.y);
 float quarryMix=(1.0-smoothstep(.9,1.25,length((vTerrainWorld.xz-vec2(-164.0,67.0))/vec2(44.0,40.0))))*terrainQuarry;
 float rockMix=max(max(smoothstep(.13,.47,terrainSlope),quarryMix*.83),smoothstep(25.0,35.0,vTerrainWorld.y)*.42)*(1.0-sandMix);
 float soilMix=smoothstep(.46,.73,macro.a)*.46;
 vec4 surface=terrainTile(vTerrainWorld.xz/3.2,0.0);
 if(soilMix>.015)surface=mix(surface,terrainTile(vTerrainWorld.xz/2.7,1.0),soilMix);
 if(sandMix>.015)surface=mix(surface,terrainTile(vTerrainWorld.xz/5.0,2.0),sandMix);
 if(rockMix>.015)surface=mix(surface,terrainTile(vTerrainWorld.xz/4.2,3.0),rockMix);
 if(roadInfo.g>.015)surface=mix(surface,terrainTile(vTerrainWorld.xz/2.7,1.0)*vec4(1.13,1.1,1.04,1.0),roadInfo.g);
 if(roadInfo.r>.015)surface=mix(surface,terrainTile(vTerrainWorld.xz/2.4,4.0),roadInfo.r);
 float wetShore=1.0-smoothstep(.55,1.3,vTerrainWorld.y);
 surface.rgb*=mix(.76,1.08,macro.a)*mix(1.0,.68,wetShore);
 float paint=max(roadInfo.b,roadInfo.a);
 vec3 paintColor=mix(vec3(.77,.78,.69),vec3(.65,.47,.13),roadInfo.a/max(.001,paint));
 surface.rgb=mix(surface.rgb,paintColor,paint*.88);
 diffuseColor.rgb*=surface.rgb;
 float terrainRelief=surface.a*mix(.026,.013,roadInfo.r)*terrainQuality*(1.0-paint*.65);
`;

function terrainMaterial(map,control){
 const uniforms={terrainAtlas:{value:terrainAtlas()},terrainControl:{value:control},terrainSize:{value:map.terrain.size},terrainQuality:{value:1},terrainQuarry:{value:map.id==='sunnybreak'?1:0}};
 const material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.94,metalness:0,envMap:modelEnvironment(),envMapIntensity:.16});
 material.name='Ravel Coast layered earth';material.userData={terrainDetail:true,revision:TERRAIN_DETAIL_REVISION,uniforms};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+TERRAIN_VERTEX_DECL).replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vTerrainNormal=mat3(modelMatrix)*objectNormal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+TERRAIN_FRAGMENT_DECL).replace('#include <color_fragment>','#include <color_fragment>\n'+TERRAIN_SURFACE).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.96,.74,roadInfo.r);roughnessFactor=mix(roughnessFactor,.49,wetShore);roughnessFactor=mix(roughnessFactor,.66,paint);').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=terrainReliefNormal(-vViewPosition,normal,terrainRelief);');
 };
 material.customProgramCacheKey=()=>`ravel-terrain-${TERRAIN_DETAIL_REVISION}`;
 material.addEventListener('dispose',()=>control.dispose());return material;
}

function* sharedNormals(terrain){
 const {n,heights:h,cell}=terrain,normals=new Float32Array(n*n*3);
 for(let z=0;z<n-1;z++){
  for(let x=0;x<n-1;x++){
   const a=z*n+x,b=a+n,c=a+1,d=b+1;
   // Same winding/diagonal as groundAt: [a,b,c] and [c,b,d].
   const triangles=[[a,b,c],[c,b,d]];
   for(const tri of triangles){
    const [i,j,k]=tri,ix=i%n,iz=Math.floor(i/n),jx=j%n,jz=Math.floor(j/n),kx=k%n,kz=Math.floor(k/n),ux=(jx-ix)*cell,uy=h[j]-h[i],uz=(jz-iz)*cell,vx=(kx-ix)*cell,vy=h[k]-h[i],vz=(kz-iz)*cell;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    for(const vertex of tri){normals[vertex*3]+=nx;normals[vertex*3+1]+=ny;normals[vertex*3+2]+=nz;}
   }
  }
  if(z%16===15)yield;
 }
 for(let i=0;i<n*n;i++){const j=i*3,length=Math.hypot(normals[j],normals[j+1],normals[j+2])||1;normals[j]/=length;normals[j+1]/=length;normals[j+2]/=length;}
 return normals;
}

export function* buildDetailedTerrain(world,map){
 const t=map.terrain;if(!t)return;
 const control=yield* createRoadControl(map),normals=yield* sharedNormals(t),material=terrainMaterial(map,control),chunk=TERRAIN_DETAIL_BUDGET.chunkCells;
 let chunks=0,vertices=0,triangles=0,geometryBytes=0;
 for(let cz=0;cz<t.n-1;cz+=chunk)for(let cx=0;cx<t.n-1;cx+=chunk){
  const width=Math.min(chunk,t.n-1-cx),depth=Math.min(chunk,t.n-1-cz),stride=width+1,count=stride*(depth+1),positions=new Float32Array(count*3),ns=new Float32Array(count*3),colors=new Float32Array(count*3),uv=new Float32Array(count*2),indices=new Uint16Array(width*depth*6);
  for(let z=0;z<=depth;z++)for(let x=0;x<=width;x++){
   const index=z*stride+x,source=(cz+z)*t.n+cx+x,wx=(cx+x)*t.cell-t.size,wz=(cz+z)*t.cell-t.size;
   positions.set([wx,t.heights[source],wz],index*3);ns.set(normals.subarray(source*3,source*3+3),index*3);uv.set([(wx+t.size)/(t.size*2),(wz+t.size)/(t.size*2)],index*2);
   const forest=map.id==='sunnybreak'?(1-smooth(-38,-12,wx))*smooth(75,115,wz):0,farm=map.id==='sunnybreak'?(1-smooth(-105,-70,wx))*(1-smooth(-100,-65,wz)):0;
   colors.set([1-forest*.13+farm*.07,1-forest*.04+farm*.02,1-forest*.08-farm*.1],index*3);
  }
  let at=0;for(let z=0;z<depth;z++)for(let x=0;x<width;x++){const a=z*stride+x,b=a+stride,c=a+1,d=b+1;indices.set([a,b,c,c,b,d],at);at+=6;}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('normal',new T.BufferAttribute(ns,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setIndex(new T.BufferAttribute(indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,material);mesh.name=`Terrain ${cx/chunk}:${cz/chunk}`;mesh.receiveShadow=true;mesh.updateMatrix();mesh.matrixAutoUpdate=false;mesh.userData={keepDynamic:true,terrainChunk:true,ownedMaterial:chunks===0,revision:TERRAIN_DETAIL_REVISION};world.add(mesh);
  chunks++;vertices+=count;triangles+=indices.length/3;geometryBytes+=positions.byteLength+ns.byteLength+colors.byteLength+uv.byteLength+indices.byteLength;yield;
 }
 const ocean=world.children.find(o=>o.userData.terrainOcean);
 world.userData.terrainEnvironment={material,ocean,uniforms:material.userData.uniforms,diagnostics:{revision:TERRAIN_DETAIL_REVISION,chunks,vertices,triangles,geometryBytes,controlBytes:control.image.data.byteLength,atlasBytes:terrainAtlas().image.data.byteLength,normalContinuity:'global triangle-weighted',collision:'exact original triangle grid'}};
}

function coastTexture(map){
 const n=TERRAIN_DETAIL_BUDGET.coastSize,size=map.terrain?.size||256,step=size*2/n,data=new Uint8Array(n*n*4),distance=new Float32Array(n*n),depth=new Float32Array(n*n);
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x,h=groundAt(map,(x+.5)*step-size,(z+.5)*step-size);depth[i]=Math.max(0,.5-h);distance[i]=h>=.47?0:1000;}
 // Two-pass chamfer distance gives a stable coast band with no depth render
 // target, extra camera, shoreline mesh, or per-frame CPU sampling.
 const diag=step*Math.SQRT2;
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x;if(x)distance[i]=Math.min(distance[i],distance[i-1]+step);if(z)distance[i]=Math.min(distance[i],distance[i-n]+step);if(x&&z)distance[i]=Math.min(distance[i],distance[i-n-1]+diag);if(x<n-1&&z)distance[i]=Math.min(distance[i],distance[i-n+1]+diag);}
 for(let z=n-1;z>=0;z--)for(let x=n-1;x>=0;x--){const i=z*n+x;if(x<n-1)distance[i]=Math.min(distance[i],distance[i+1]+step);if(z<n-1)distance[i]=Math.min(distance[i],distance[i+n]+step);if(x<n-1&&z<n-1)distance[i]=Math.min(distance[i],distance[i+n+1]+diag);if(x&&z<n-1)distance[i]=Math.min(distance[i],distance[i+n-1]+diag);data[i*4]=Math.round(clamp(depth[i]/2)*255);data[i*4+1]=Math.round(clamp(distance[i]/48)*255);data[i*4+2]=Math.round(clamp(depth[i]*8)*255);data[i*4+3]=255;}
 return dataTexture(data,n,n,{mipmaps:false});
}

export function createDetailedOcean(map){
 const coast=coastTexture(map),uniforms={waterTime:{value:0},waterQuality:{value:1},waterSize:{value:map.terrain?.size||256},waterCoast:{value:coast}};
 const material=new T.MeshPhysicalMaterial({color:0xffffff,roughness:.24,metalness:.06,ior:1.333,clearcoat:.22,clearcoatRoughness:.22,envMap:modelEnvironment(),envMapIntensity:.8});
 material.name='Breakwater tidal ocean';material.userData={terrainOcean:true,revision:TERRAIN_DETAIL_REVISION,uniforms};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWaterWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vWaterWorld;uniform float waterTime;uniform float waterQuality;uniform float waterSize;uniform sampler2D waterCoast;
  `).replace('#include <color_fragment>',`#include <color_fragment>
   vec2 coastUV=(vWaterWorld.xz+waterSize)/(waterSize*2.0);vec4 coast=texture2D(waterCoast,coastUV);
   float beyond=step(waterSize,max(abs(vWaterWorld.x),abs(vWaterWorld.z)));float shore=mix(coast.g*48.0,48.0,beyond);
   float openSea=smoothstep(1.0,28.0,shore);float depthFade=mix(coast.b,1.0,beyond);
   float waveA=dot(vWaterWorld.xz,vec2(.42,.19))+waterTime*.8;
   float waveB=dot(vWaterWorld.xz,vec2(-.25,.57))-waterTime*1.16;
   float waveC=dot(vWaterWorld.xz,vec2(1.31,.94))+waterTime*1.9;
   float wash=.5+.5*sin(shore*2.6-waterTime*1.4+sin(waveB)*.6);
   float foam=(1.0-smoothstep(.15,3.7,shore))*smoothstep(.01,.3,depthFade)*pow(wash,5.0)*.56;
   vec3 waterColor=mix(vec3(.075,.29,.26),vec3(.014,.075,.115),openSea);
   waterColor+=vec3(.01,.025,.021)*sin(waveA+sin(waveB))*(1.0-openSea)*.65;
   diffuseColor.rgb=mix(waterColor,vec3(.52,.66,.60),foam);
  `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.24,.64,foam);').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float nearShore=mix(.38,1.0,smoothstep(0.0,5.0,shore));
   vec2 waveNormal=vec2(.42,.19)*cos(waveA)*.15+vec2(-.25,.57)*cos(waveB)*.11+vec2(1.31,.94)*cos(waveC)*.027*waterQuality;
   normal=normalize(mat3(viewMatrix)*vec3(-waveNormal.x*nearShore,1.0,-waveNormal.y*nearShore));
  `);
 };
 material.customProgramCacheKey=()=>`ravel-ocean-${TERRAIN_DETAIL_REVISION}`;material.addEventListener('dispose',()=>coast.dispose());
 const mesh=new T.Mesh(new T.PlaneGeometry(1800,1800),material);mesh.name='Breakwater ocean';mesh.rotation.x=-Math.PI/2;mesh.position.y=.5;mesh.userData={keepDynamic:true,terrainOcean:true,ownedMaterial:true,revision:TERRAIN_DETAIL_REVISION};mesh.updateMatrix();mesh.matrixAutoUpdate=false;return mesh;
}

// One uniform write, no per-frame object walk/allocations/geometry rebuilds.
export function updateTerrainEnvironment(world,time,quality='high'){
 const state=world?.userData?.terrainEnvironment;if(!state)return;
 const low=quality==='low',level=low?.45:1;state.uniforms.terrainQuality.value=level;
 const ocean=state.ocean?.material?.userData?.uniforms;if(ocean){ocean.waterTime.value=Number.isFinite(time)?time:0;ocean.waterQuality.value=level;}
}
export function terrainDetailDiagnostics(world){return world?.userData?.terrainEnvironment?.diagnostics||null;}
