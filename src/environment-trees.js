import * as T from 'three';
import {environmentAtlasMaterial,environmentUV} from './environment-surfaces.js';

// Original, opaque vegetation. Each species has matching near/far silhouettes;
// the cell baker combines just two surfaces rather than hundreds of leaf draws.
const ART_REVISION=159,VARIANTS=8,assemblies=new Map(),TAU=Math.PI*2;
const up=new T.Vector3(0,1,0);
const palette={
 oak:[0x8c3c29,0xb35b2d,0xd29443],
 autumn:[0x92502e,0xbc733b,0xc79950],
 orchard:[0xa64d25,0xcc762b,0xd7a846],
 pine:[0x302c3d,0x494037,0x6c563d],
 palm:[0x625131,0x8b6531,0xad853d],
};
const colors=new Map();
function color(value){if(!colors.has(value))colors.set(value,new T.Color(value));return colors.get(value);}
function random(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const point=(x,y,z)=>new T.Vector3(x,y,z);
const radial=(angle,r,y)=>point(Math.cos(angle)*r,y,Math.sin(angle)*r);

class Surface {
 constructor(kind){this.kind=kind;this.p=[];this.n=[];this.uv=[];this.c=[];}
 tri(a,b,c,tint,uv=[[0,0],[1,0],[.5,1]],normals){
  const n=normals?null:b.clone().sub(a).cross(c.clone().sub(a)).normalize(),col=color(tint);
  for(let i=0;i<3;i++){
   this.p.push(...[a,b,c][i].toArray());this.n.push(...(normals?.[i]||n).toArray());this.uv.push(...uv[i]);this.c.push(col.r,col.g,col.b);
  }
 }
 geometry(){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));
  environmentUV(g,this.kind);g.computeBoundingBox();g.computeBoundingSphere();g.userData.shared=true;g.userData.environmentAtlas=true;g.userData.environmentSpeciesGeometry=true;g.userData.artRevision=ART_REVISION;return g;
 }
}

// Continuous tapered rings produce smooth trunk normals, bent trunks, branching
// roots, and bark flutes without separate high-cost cylinder objects.
function tube(surface,points,radii,tint,sides=6,phase=0,cap=true){
 const rings=[],normals=[];
 for(let j=0;j<points.length;j++){
  const axis=points[Math.min(points.length-1,j+1)].clone().sub(points[Math.max(0,j-1)]).normalize();
  const tangent=Math.abs(axis.y)<.96?up.clone().cross(axis).normalize():point(1,0,0),bitangent=axis.clone().cross(tangent).normalize(),ring=[],ns=[];
  for(let k=0;k<sides;k++){
   const angle=k/sides*TAU+phase,n=tangent.clone().multiplyScalar(Math.cos(angle)).addScaledVector(bitangent,Math.sin(angle));
   ring.push(points[j].clone().addScaledVector(n,radii[j]*(1+.085*Math.sin(k*2.71+phase))));ns.push(n);
  }
  rings.push(ring);normals.push(ns);
 }
 for(let j=0;j<rings.length-1;j++)for(let k=0;k<sides;k++){
  const next=(k+1)%sides,a=rings[j][k],b=rings[j][next],c=rings[j+1][k],d=rings[j+1][next],u=k/sides,v=next===0?1:next/sides,v0=j/(rings.length-1),v1=(j+1)/(rings.length-1);
  surface.tri(a,b,c,tint,[[u,v0],[v,v0],[u,v1]],[normals[j][k],normals[j][next],normals[j+1][k]]);
  surface.tri(b,d,c,tint,[[v,v0],[v,v1],[u,v1]],[normals[j][next],normals[j+1][next],normals[j+1][k]]);
 }
 if(cap)for(let k=0;k<sides;k++){
  const next=(k+1)%sides,last=rings.length-1;surface.tri(points[0],rings[0][next],rings[0][k],tint);surface.tri(points[last],rings[last][k],rings[last][next],tint);
 }
}

// Four triangles make a curved, creased leaf with an actual midrib silhouette.
// No opacity texture or transparent foliage fill-rate is required.
function leaf(surface,base,tip,width,tint,fold=.15){
 const direction=tip.clone().sub(base),side=up.clone().cross(direction).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
 const mid=base.clone().lerp(tip,.48),left=mid.clone().addScaledVector(side,width),right=mid.clone().addScaledVector(side,-width),ridge=mid.clone().addScaledVector(up,fold);
 surface.tri(base,left,ridge,tint);surface.tri(left,tip,ridge,tint);surface.tri(tip,right,ridge,tint);surface.tri(right,base,ridge,tint);
}

// Small lobed leaf bunches occupy the crown; exposed creased leaves break up the
// outline. Far geometry keeps every bunch, not a replacement cone or billboard.
function cluster(surface,center,radius,tint,seed,detail){
 const ring=[],count=detail?8:4,top=center.clone().add(point(.06,radius*.57,-.09)),bottom=center.clone().add(point(-.04,-radius*.43,.04));
 for(let i=0;i<count;i++){
  const a=seed+i/count*TAU,r=radius*(.88+.12*Math.sin(i*2.7+seed));ring.push(center.clone().add(point(Math.cos(a)*r,Math.sin(i*1.9+seed)*radius*.14,Math.sin(a)*r)));
 }
 for(let i=0;i<count;i++){const next=(i+1)%count;surface.tri(top,ring[next],ring[i],tint);surface.tri(bottom,ring[i],ring[next],tint);}
 if(detail)for(let j=0;j<6;j++){
  const a=seed+j/6*TAU,base=center.clone().add(radial(a,radius*.32,(j%2)*radius*.15)),tip=center.clone().add(radial(a,radius*(1.18+(j%2)*.07),radius*(.1+(j%3)*.1)));
  leaf(surface,base,tip,radius*.24,tint,radius*.13);
 }
}

function roots(bark,rng,tint,detail,lean=0){
 if(!detail)return;
 for(let i=0;i<5;i++){
  const a=i/5*TAU+rng()*.35,start=point(lean,.72,0),end=radial(a,.7+rng()*.2,.025),bend=start.clone().lerp(end,.56);bend.y=.18;
  tube(bark,[start,bend,end],[.18,.12,.025],tint,4,a,false);
 }
}

function broadleaf(bark,foliage,kind,variant,detail){
 const rng=random(21613+variant*7717),tints=palette[kind],trunkTint=kind==='orchard'?0x655343:0x615044,lean=(rng()-.5)*.33;
 const points=detail?[point(0,0,0),point(.02,.6,.02),point(lean*.4,2,.06),point(lean,3.8,0),point(lean*.7,5.5,.08),point(.18,7.45,.02)]:[point(0,0,0),point(lean,3.7,0),point(.18,7.45,.02)];
 tube(bark,points,detail?[.4,.33,.27,.22,.15,.04]:[.39,.22,.04],trunkTint,detail?8:5,variant*.3);roots(bark,rng,trunkTint,detail);
 for(let i=0;i<7;i++){
  const a=i*2.39996+variant*.31,base=point(lean*.7,3.5+(i%3)*.42,0),tip=radial(a,2.05+(i%2)*.42,6.4+(i%3)*.58),mid=base.clone().lerp(tip,.55);mid.y+=.3;
  tube(bark,detail?[base,mid,tip]:[base,tip],detail?[.15,.092,.025]:[.15,.025],trunkTint,detail?5:3,a,false);
  if(detail){const twigTip=tip.clone().add(radial(a+.7,.75,.55));tube(bark,[mid,twigTip],[.067,.015],trunkTint,4,a,false);}
 }
 const crowns=[];
 for(const [count,radius,y,size]of [[12,2.28,6.65,1.02],[10,2.03,7.9,1.08],[7,1.12,8.88,1.03],[3,.3,7.78,1.12]]){
  for(let i=0;i<count;i++){
   const a=i/count*TAU+variant*.37+y,r=radius*(.88+rng()*.2),center=radial(a,r,y+(rng()-.5)*.46);center.x+=lean;
   const s=size*(.9+rng()*.2),tint=tints[(i+Math.floor(y))%tints.length],phase=rng()*TAU;crowns.push({center,s,phase});cluster(foliage,center,s,tint,phase,detail);
  }
 }
 if(kind==='orchard'&&detail){
  // Fruit hangs below the outer crown instead of glowing above the leaves.
  for(let i=0;i<10;i++){const p=crowns[i*3].center.clone();p.y-=.54;const fruitTint=i%3===0?0xae5131:0xc59a43;cluster(foliage,p,.14,fruitTint,i,false);}
 }
}

function pine(bark,foliage,variant,detail){
 const rng=random(4537+variant*9349),tints=palette.pine,trunkTint=0x655548,lean=(rng()-.5)*.2;
 const points=detail?[point(0,0,0),point(0,.55,0),point(lean,3,0),point(lean*.7,5.9,.02),point(0,9.8,0)]:[point(0,0,0),point(lean,4.8,0),point(0,9.8,0)];
 tube(bark,points,detail?[.37,.29,.22,.13,.025]:[.37,.16,.025],trunkTint,detail?7:5,variant);roots(bark,rng,trunkTint,detail);
 for(let tier=0;tier<6;tier++)for(let arm=0;arm<6;arm++){
  const a=arm/6*TAU+tier*.43+variant*.31,r=2.65-tier*.39,y=4.25+tier*.98,base=point(lean*.5,y,0),tip=radial(a,r,y-.38+(rng()-.5)*.12),dir=tip.clone().sub(base).normalize(),side=point(-Math.sin(a),0,Math.cos(a));
  if(detail){
   const mid=base.clone().lerp(tip,.53);mid.y+=.12;tube(bark,[base,mid,tip],[.075,.042,.013],trunkTint,4,a,false);
   for(let j=0;j<3;j++)for(const sign of [-1,1]){
    const s=.27+j*.24,attach=base.clone().lerp(tip,s),length=(.8-j*.15)*(1-tier*.067),end=attach.clone().addScaledVector(dir,length*.52).addScaledVector(side,sign*length);end.y+=.12+(j%2)*.08;
    leaf(foliage,attach,end,length*.36,tints[(tier+j+(sign+1)/2)%3],.15);
   }
   leaf(foliage,base.clone().lerp(tip,.5),tip.clone().addScaledVector(dir,.24),Math.max(.14,.37-tier*.035),tints[(tier+1)%3],.15);
  }else{
   const mid=base.clone().lerp(tip,.52);mid.y+=.1;
   leaf(foliage,base,mid,Math.max(.2,.65-tier*.065),tints[tier%3],.14);
   leaf(foliage,base.clone().lerp(tip,.28),tip.clone().addScaledVector(dir,.24),Math.max(.16,.6-tier*.06),tints[(tier+1)%3],.16);
  }
 }
}

function palm(bark,foliage,variant,detail){
 const rng=random(8967+variant*1213),tints=palette.palm,trunkTint=0x8b7352,lean=(rng()-.5)*.55,points=[],radii=[],segments=detail?10:3;
 for(let i=0;i<=segments;i++){
  const t=i/segments;points.push(point(lean*t*t,7.1*t,.12*Math.sin(t*Math.PI)));radii.push((.37-.15*t)*(detail&&i%2===1?1.08:1));
 }
 tube(bark,points,radii,trunkTint,detail?7:5,variant);roots(bark,rng,trunkTint,detail);
 const crown=point(lean,7.08,0);
 for(let i=0;i<8;i++){
  const a=i/8*TAU+variant*.29,dir=radial(a,1,0),side=point(-Math.sin(a),0,Math.cos(a)),length=3.1+rng()*.65;
  const path=t=>crown.clone().addScaledVector(dir,t*length).add(point(0,Math.sin(t*Math.PI)*1.08-t*t*.27,0));
  if(detail){
   const spine=Array.from({length:6},(_,j)=>path(j/5));tube(bark,spine,[.06,.05,.04,.03,.018,.006],0x798347,3,a,false);
   for(let j=0;j<9;j++)for(const sign of [-1,1]){
    const t=.16+j*.085,base=path(t),leafLength=(.33+Math.sin(t*Math.PI)*.75)*(1-(t>.8?.2:0)),tip=base.clone().addScaledVector(side,sign*leafLength).addScaledVector(dir,leafLength*.28);tip.y-=.26+leafLength*.24;
    leaf(foliage,base,tip,.095+(1-t)*.045,tints[(i+j)%3],.08);
   }
   leaf(foliage,path(.86),path(1.09),.1,tints[(i+1)%3],.07);
  }else{
   // A three-panel drooping frond plus four separated pinnate leaflets keeps
   // palm identity visible even at the streamed cell's distant tier.
   for(let j=0;j<3;j++)leaf(foliage,path(j/3),path((j+1)/3),[.4,.56,.29][j],tints[(i+j)%3],.11);
   for(const t of [.35,.67])for(const sign of [-1,1]){const base=path(t),tip=base.clone().addScaledVector(side,sign*.78).addScaledVector(dir,.27);tip.y-=.4;leaf(foliage,base,tip,.19,tints[i%3],.08);}
  }
 }
 for(let i=0;i<3;i++){const p=crown.clone().add(radial(i*2.1,.29,-.27));cluster(bark,p,.21,0x6a5037,i,false);}
}

function assembly(kind,variant,detail){
 const key=`${kind}:${variant}:${detail?1:0}`;if(assemblies.has(key))return assemblies.get(key);
 const bark=new Surface('bark'),foliage=new Surface('leaf');
 if(kind==='palm')palm(bark,foliage,variant,detail);else if(kind==='pine')pine(bark,foliage,variant,detail);else broadleaf(bark,foliage,kind,variant,detail);
 const result={bark:bark.geometry(),foliage:foliage.geometry()};assemblies.set(key,result);return result;
}

/** Append two directly-batchable meshes. Collision, harvesting and placement
 * remain the caller's existing tree object, untouched by these visual assets. */
export function environmentTree(g,t,detail=true){
 const kind=Object.hasOwn(palette,t.kind)?t.kind:'oak',seed=Number.isFinite(t.seed)?t.seed:0,variant=((Math.trunc(seed)%VARIANTS)+VARIANTS)%VARIANTS,shape=assembly(kind,variant,!!detail),height=Number.isFinite(t.h)?Math.max(.25,t.h):10;
 for(const [part,foliage]of [['bark',false],['foliage',true]]){
  const m=new T.Mesh(shape[part],environmentAtlasMaterial(foliage));m.name=`${kind} ${part} ${detail?'detailed':'distant'}`;m.position.set(t.x||0,t.y||0,t.z||0);m.rotation.y=seed*2.399963229728653;m.scale.y=height/10;m.castShadow=m.receiveShadow=true;
  m.userData={environmentTree:true,environmentSpecies:kind,environmentDetail:!!detail,environmentFoliage:foliage,artRevision:ART_REVISION};g.add(m);
 }
 return g;
}

export function environmentTreeDiagnostics(){return {revision:ART_REVISION,assemblies:assemblies.size,maxAssemblies:Object.keys(palette).length*VARIANTS*2,meshesPerTree:2};}
