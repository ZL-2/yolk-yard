import {GRID} from './building-rules.js';
export const PIECES=['wall','floor','stairs','roof'];
const bits=(...cells)=>cells.reduce((m,c)=>m|1<<c,0);
const mirror=m=>{let n=0;for(let i=0;i<9;i++)if(m&1<<i)n|=1<<(Math.floor(i/3)*3+2-i%3);return n;};
// Bottom-to-top, left-to-right wall coordinates. Explicit legal pattern families.
const walls=new Map();
function wall(mask,kind,extra={}){walls.set(mask,{kind,...extra});walls.set(mirror(mask),{kind,...extra,mirror:mirror(mask)!==mask});}
wall(0,'solid');
for(let c=0;c<3;c++)wall(bits(c+3),'window');
wall(bits(3,5),'windows');
for(let c=0;c<3;c++)wall(bits(c,c+3),'door',{door:c});
wall(bits(0,3,5),'door-window',{door:0});
wall(bits(6,7,8),'low');wall(bits(3,4,5,6,7,8),'low');
wall(bits(0,1,2,4),'arch');wall(bits(0,1,3,4),'half-arch');
for(const m of [bits(0,1,3),bits(3,6,7),bits(0,1,2,3,4,6)])wall(m,'triangle');
for(const kept of [bits(0,3,6),bits(0,1,3,4,6,7),bits(0,3),bits(0,1),bits(0,1,3,4)])wall(511^kept,'partial');
wall(bits(0,3,6,7,8),'door',{door:0});
export const WALL_PATTERNS=Object.freeze([...walls.keys()]);
export function wallPattern(mask){return walls.get(mask);}
const rotatePoint=i=>{const x=i%3,z=Math.floor(i/3);return (2-x)*3+z;};
const stairPaths=new Map();
for(const base of [[7,4,1],[6,3,0],[6,3,0,1,2],[6,3,0,1,2,5,8]]){
 for(let mirror=0;mirror<2;mirror++)for(let turn=0;turn<4;turn++){
  let path=base.map(i=>mirror?Math.floor(i/3)*3+2-i%3:i);
  for(let k=0;k<turn;k++)path=path.map(rotatePoint);
  stairPaths.set(path.join(','),{path,width:base[0]===7?4:2,turn,mirrored:!!mirror});
 }
}
export const STAIR_PATHS=Object.freeze([...stairPaths.values()].map(v=>v.path));
export function validEdit(piece){
 if(!PIECES.includes(piece.type)||!Number.isInteger(piece.mask)||piece.mask<0)return false;
 if(piece.type==='wall')return walls.has(piece.mask);
 if(piece.type==='stairs')return piece.mask===0&&(!piece.path?.length||stairPaths.has(piece.path.join(',')));
 return piece.mask<15;
}
export function localToWorld(piece,x,y,z){
 const a=(piece.rotation||0)*Math.PI/2,c=Math.round(Math.cos(a)),s=Math.round(Math.sin(a));
 return {x:piece.x+c*x+s*z,y:piece.y+y,z:piece.z-s*x+c*z};
}
export function worldToLocal(piece,v){
 const a=(piece.rotation||0)*Math.PI/2,c=Math.round(Math.cos(a)),s=Math.round(Math.sin(a)),x=v.x-piece.x,z=v.z-piece.z;
 return {x:c*x-s*z,y:v.y-piece.y,z:s*x+c*z};
}
export function editPlanePoint(piece,u,v){
 if(piece.type==='wall')return localToWorld(piece,u*4-2,v*4,0);
 // Stair controls lie on their fixed default inclined plane; roof/floor on base.
 return localToWorld(piece,u*4-2,piece.type==='stairs'?(1-v)*4+.03:.08,v*4-2);
}
export function editRay(piece,o,d,range=8){
 const origin=worldToLocal(piece,o),end=worldToLocal(piece,{x:o.x+d.x,y:o.y+d.y,z:o.z+d.z}),v={x:end.x-origin.x,y:end.y-origin.y,z:end.z-origin.z};
 const n=piece.type==='wall'?{x:0,y:0,z:1}:piece.type==='stairs'?{x:0,y:1,z:1}:{x:0,y:1,z:0};
 const k=piece.type==='wall'?0:piece.type==='stairs'?2.03:.08;
 const den=n.y*v.y+n.z*v.z;if(Math.abs(den)<1e-7)return null;
 const t=(k-n.y*origin.y-n.z*origin.z)/den;if(t<0||t>range)return null;
 const x=origin.x+v.x*t,y=origin.y+v.y*t,z=origin.z+v.z*t,u=(x+2)/4,w=piece.type==='wall'?y/4:(z+2)/4;
 if(u<0||u>1||w<0||w>1)return null;
 const count=piece.type==='wall'||piece.type==='stairs'?3:2;
 return {u,v:w,cell:Math.min(count-1,Math.floor(w*count))*count+Math.min(count-1,Math.floor(u*count)),distance:t,point:{x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t}};
}
// Shared solid boxes: render, player movement, projectile rays and authority all
// use these same volumes. Sloped surfaces use fine steps in this AABB engine.
export function pieceBoxes(p){
 const boxes=[];
 const add=(x,y,z,w,h,d,extra={})=>{if(h<=0||w<=0||d<=0)return;const q=localToWorld(p,x,y,z),odd=(p.rotation||0)%2;boxes.push({...q,w:odd?d:w,h,d:odd?w:d,buildId:p.id,material:p.material,kind:'build',color:p.material,...extra});};
 const mask=p.mask||0;
 if(p.type==='wall'){
  const pattern=wallPattern(mask);
  if(pattern?.kind==='triangle'){
   const kept=[];for(let i=0;i<9;i++)if(!(mask&1<<i))kept.push({x:(i%3+.5)*4/3-2,y:(Math.floor(i/3)+.5)*4/3});
   // Triangle through the outer corners of the retained portion, including mirrored peaks.
   const left=kept.filter(k=>k.x<0).length,right=kept.filter(k=>k.x>0).length;
   const bottom=kept.filter(k=>k.y<2).length,top=kept.filter(k=>k.y>2).length;
   for(let i=0;i<48;i++){const x=-2+(i+.5)/12,height=(left>=right?2-x:2+x)*(kept.length<=3?.5:1);add(x,top>bottom?4-height:0,0,1/12,height,.16);}
  }else if(pattern?.kind==='arch'||pattern?.kind==='half-arch'){
   const half=pattern.kind==='half-arch';
   for(let i=0;i<48;i++){const x=-2+(i+.5)/12,xx=pattern.mirror?-x:x;let bottom;
    if(half)bottom=xx<-1.25?0:2.7+.9*(1-(xx+1.25)/3.25);
    else bottom=Math.abs(x)>1.65?0:2.6+.85*(1-Math.abs(x)/1.65);
    add(x,bottom,0,1/12,4-bottom,.16);
   }
  }else{
   for(let row=0;row<3;row++)for(let col=0;col<3;col++)if(!(mask&1<<(row*3+col)))add((col-1)*4/3,row*4/3,0,4/3,4/3,.16);
   if(pattern?.door!=null){
    // Mask identifies the door column without depending on mirror metadata.
    const c=[0,1,2].find(c=>(mask&(1<<c))&&(mask&(1<<(c+3))));
    const x=(c-1)*4/3,w=1.16;
    add(x-w/2-.04,0,0,.08,8/3,.2);add(x+w/2+.04,0,0,.08,8/3,.2);
    if(p.doorOpen)add(x-w/2,.02,-w/2,.16,2.59,w,{door:true});else add(x,.02,0,w,2.59,.16,{door:true});
   }
  }
 }else if(p.type==='floor'){
  for(let i=0;i<4;i++)if(!(mask&1<<i))add((i%2-.5)*2,0,(Math.floor(i/2)-.5)*2,2,.16,2);
  // The diagonal edit retains a connecting diagonal bridge, not disconnected islands.
  if(mask===6||mask===9)for(let i=0;i<16;i++){const x=-2+(i+.5)/4;add(x,0,mask===6?x:-x,.3,.16,.45);}
 }else if(p.type==='stairs'){
  const path=p.path?.length?p.path:[7,4,1],spec=stairPaths.get(path.join(','));if(!spec)return boxes;
  const pts=path.map(i=>({x:i%3-1,z:Math.floor(i/3)-1})),steps=16;
  if(spec.width===4||path.length===3){
   const a=pts[0],b=pts.at(-1),dx=b.x-a.x,dz=b.z-a.z,alongX=!!dx;
   for(let i=0;i<steps;i++){const f=(i+.5)/steps,x=alongX?-2*Math.sign(dx)+4*f*Math.sign(dx):a.x,z=alongX?a.z:-2*Math.sign(dz)+4*f*Math.sign(dz);add(x,i/4,z,alongX?.25:spec.width,.25,alongX?spec.width:.25);}
  }else{
   // Two half-width flights with a proper landing. All variants transform this
   // canonical footprint instead of overlapping swept boxes at a corner.
   const stairAdd=(x,y,z,w,h,d)=>{
    if(spec.mirrored)x=-x;
    for(let k=0;k<spec.turn;k++){[x,z]=[z,-x];[w,d]=[d,w];}
    add(x,y,z,w,h,d);
   };
   for(let i=0;i<8;i++)stairAdd(-1,i/4,2-(i+.5)/4,2,.25,.25);
   if(path.length===5){
    stairAdd(-1,1.75,-1,2,.25,2);
    for(let i=0;i<8;i++)stairAdd((i+.5)/4,2+i/4,-1,.25,.25,2);
   }else{
    stairAdd(0,1.75,-1,4,.25,2);
    for(let i=0;i<8;i++)stairAdd(1,2+i/4,(i+.5)/4,2,.25,.25);
   }
  }
 }else if(p.type==='roof'){
  const corners=[mask&1?4:0,mask&2?4:0,mask&4?4:0,mask&8?4:0],center=mask===0?2:(mask===6||mask===9?4:corners.reduce((a,b)=>a+b)/4);
  // Four triangular faces share a center; selecting a corner raises it, never deletes it.
  for(let i=0;i<16;i++)for(let j=0;j<16;j++){
   const x=-2+(i+.5)/4,z=-2+(j+.5)/4,u=x/2,v=z/2;let h;
   if(Math.abs(u)>Math.abs(v)){const edge=u>0?[corners[1],corners[3]]:[corners[0],corners[2]];const t=Math.abs(u);h=center*(1-t)+t*(edge[0]*(1-v/t)/2+edge[1]*(1+v/t)/2);}
   else{const edge=v>0?[corners[2],corners[3]]:[corners[0],corners[1]];const t=Math.abs(v);h=center*(1-t)+t*(edge[0]*(1-u/t)/2+edge[1]*(1+u/t)/2);}
   add(x,Math.max(0,h-.12),z,.25,.18,.25);
  }
 }
 return boxes;
}
