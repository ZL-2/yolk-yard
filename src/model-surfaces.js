import * as T from 'three';
export {T as THREE};

// Original, renderer-independent surfaces. All models share these small maps;
// the same HDR sky is uploaded correctly in gameplay and portrait renderers.
export const MODEL_ART_REVISION=155;
export const SURFACE_KINDS=Object.freeze(['skin','cloth','metal','polymer','rubber','wood','glass','leather','paint']);
const tile=128,columns=4,rows=3,width=tile*columns,height=tile*rows;
const finish={skin:[.58,.0],cloth:[.93,0],metal:[.30,.91],polymer:[.69,.02],rubber:[.96,0],wood:[.56,0],glass:[.10,.08],leather:[.77,0],paint:[.47,.36]};
const materials=new Map(),textures=new Map();let atlas,environment,atlasMaterial;
const hash=(x,y)=>{let a=Math.imul(x+17,374761393)^Math.imul(y+23,668265263);a=Math.imul(a^(a>>>13),1274126177);return (a>>>0)/4294967295;};
function tex(bytes,w,h,srgb=false){const t=new T.DataTexture(bytes,w,h);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;t.userData.shared=true;return t;}
function sample(kind,x,y){
 const n=hash(x,y),fine=hash(x*3,y*3),grain=Math.sin(x*.11+Math.sin(y*.028)*2.2),fiber=((x%4===0?1:0)+(y%4===0?1:0))*.5;
 let relief=(n-.5)*.07,shade=.97+(n-.5)*.045;
 if(kind==='cloth'){relief=(fiber-.35)*.28+(n-.5)*.065;shade=.94+fiber*.045+(fine-.5)*.035;}
 if(kind==='skin'){relief=(n>.90?-.10:0)+(fine-.5)*.026;shade=.97+(n-.5)*.023;}
 if(kind==='metal'){relief=Math.sin(y*1.7)*.045+(fine-.5)*.026;shade=.96+(n-.5)*.025+(x%53===0?.035:0);}
 if(kind==='wood'){relief=grain*.16+Math.sin(x*.52+Math.sin(y*.06))*.048;shade=.88+grain*.085+(n-.5)*.025;}
 if(kind==='leather'){relief=(n-.5)*.17;shade=.94+(n-.5)*.058;}
 if(kind==='rubber'||kind==='polymer'){relief=(fine-.5)*.12;shade=.96+(n-.5)*.025;}
 if(kind==='paint'){relief=(n-.5)*.047;shade=.95+(n-.5)*.035+(y%57===0?-.045:0);}
 if(kind==='glass'){relief=0;shade=1;}
 return {shade,relief,rough:T.MathUtils.clamp(finish[kind][0]+(n-.5)*.07,.04,1),metal:finish[kind][1]};
}
function maps(){
 if(atlas)return atlas;
 const diffuse=new Uint8Array(width*height*4),normal=new Uint8Array(width*height*4),rough=new Uint8Array(width*height*4),metal=new Uint8Array(width*height*4);
 for(let index=0;index<columns*rows;index++){
  const kind=SURFACE_KINDS[index]||'polymer';
  for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
   const s=sample(kind,x,y),dx=sample(kind,(x+1)%tile,y).relief-s.relief,dy=sample(kind,x,(y+1)%tile).relief-s.relief;
   const i=((Math.floor(index/columns)*tile+y)*width+(index%columns)*tile+x)*4;
   const c=Math.round(T.MathUtils.clamp(s.shade,0,1)*255),r=Math.round(s.rough*255),m=Math.round(s.metal*255);
   diffuse.set([c,c,c,255],i);normal.set([Math.round(128-dx*95),Math.round(128-dy*95),254,255],i);rough.set([r,r,r,255],i);metal.set([m,m,m,255],i);
  }
 }
 atlas={map:tex(diffuse,width,height,true),normalMap:tex(normal,width,height),roughnessMap:tex(rough,width,height),metalnessMap:tex(metal,width,height)};return atlas;
}
function kindMaps(kind){
 if(textures.has(kind))return textures.get(kind);const source=maps(),index=SURFACE_KINDS.indexOf(kind),result={};
 for(const [name,t]of Object.entries(source)){
  const bytes=new Uint8Array(tile*tile*4);for(let y=0;y<tile;y++){const from=((Math.floor(index/columns)*tile+y)*width+(index%columns)*tile)*4;bytes.set(t.image.data.subarray(from,from+tile*4),y*tile*4);}result[name]=tex(bytes,tile,tile,name==='map');
 }
 textures.set(kind,result);return result;
}
export function modelEnvironment(){
 if(environment)return environment;
 const w=256,h=128,data=new Uint16Array(w*h*4),sun=new T.Vector3(-.34,.85,.4).normalize();
 const sky=new T.Color(0x669bcb),horizon=new T.Color(0xe1e4db),earth=new T.Color(0x53604b),c=new T.Color(),d=new T.Vector3();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const theta=(1-y/(h-1))*Math.PI,phi=x/w*Math.PI*2;d.set(-Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta));
  c.copy(horizon).lerp(sky,Math.pow(Math.max(d.y,0),.45)).lerp(earth,1-T.MathUtils.smoothstep(d.y,-.18,0));
  const glow=Math.pow(Math.max(0,d.dot(sun)),280)*4.8;c.r+=glow;c.g+=glow*.89;c.b+=glow*.74;
  const i=(y*w+x)*4;data[i]=T.DataUtils.toHalfFloat(c.r);data[i+1]=T.DataUtils.toHalfFloat(c.g);data[i+2]=T.DataUtils.toHalfFloat(c.b);data[i+3]=T.DataUtils.toHalfFloat(1);
 }
 environment=new T.DataTexture(data,w,h,T.RGBAFormat,T.HalfFloatType);environment.mapping=T.EquirectangularReflectionMapping;environment.magFilter=environment.minFilter=T.LinearFilter;environment.needsUpdate=true;environment.userData.shared=true;return environment;
}
export function modelMaterial(color,kind='paint',options={}){
 if(!finish[kind])kind='paint';const value=new T.Color(color).getHex(),key=JSON.stringify([value,kind,options]);if(materials.has(key))return materials.get(key);
 const maps=kindMaps(kind),m=new T.MeshPhysicalMaterial({color:value,...maps,normalScale:new T.Vector2(.22,.22),roughness:1,metalness:1,envMap:modelEnvironment(),envMapIntensity:.72,clearcoat:kind==='paint'?.24:kind==='glass'?1:0,clearcoatRoughness:.28,...(kind==='glass'?{transparent:true,opacity:.36,depthWrite:false}:{}),...options});
 m.userData={shared:true,surfaceKind:kind,surface:kind,artRevision:MODEL_ART_REVISION};materials.set(key,m);return m;
}
export function surfaceUV(geometry,kind='paint'){
 const index=Math.max(0,SURFACE_KINDS.indexOf(kind)),p=geometry.attributes.position;let uv=geometry.attributes.uv;
 if(!uv){uv=new T.Float32BufferAttribute(new Float32Array(p.count*2),2);for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i),p.getY(i)+p.getZ(i)*.2);geometry.setAttribute('uv',uv);}
 let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;for(let i=0;i<uv.count;i++){minU=Math.min(minU,uv.getX(i));maxU=Math.max(maxU,uv.getX(i));minV=Math.min(minV,uv.getY(i));maxV=Math.max(maxV,uv.getY(i));}
 const baseX=(index%columns)*tile+2,baseY=Math.floor(index/columns)*tile+2,range=tile-4;
 for(let i=0;i<uv.count;i++)uv.setXY(i,(baseX+(uv.getX(i)-minU)/Math.max(1e-6,maxU-minU)*range)/width,(baseY+(uv.getY(i)-minV)/Math.max(1e-6,maxV-minV)*range)/height);
 geometry.userData.surfaceKind=kind;uv.needsUpdate=true;return geometry;
}
export function surfaceAtlasMaterial(){
 if(!atlasMaterial){atlasMaterial=new T.MeshPhysicalMaterial({vertexColors:true,...maps(),normalScale:new T.Vector2(.22,.22),roughness:1,metalness:1,envMap:modelEnvironment(),envMapIntensity:.72});atlasMaterial.userData={shared:true,surfaceAtlas:true,artRevision:MODEL_ART_REVISION};}return atlasMaterial;
}
export function modelSurfaceDiagnostics(){return {revision:MODEL_ART_REVISION,kinds:SURFACE_KINDS.length,atlasSize:[width,height],materials:materials.size,environment:!!environment};}
