// Compact, data-only narrow phases for scenery. Keep the existing map box as
// its spatial-index, destruction and harvest owner; do not voxelize each rock.
// Shape coordinates are world metres; y is the bottom, matching map boxes.
const EPS=1e-9,TAU=Math.PI*2;
const shape=(kind,x,y,z,w,h,d,extra={})=>({kind,x,y,z,w,h,d,...extra});
const overlapY=(s,p,height)=>p.y<s.y+s.h-.015&&p.y+height>s.y+.02;
const verticalDelta=(s,p,height)=>{const cy=s.y+s.h/2;return Math.max(p.y-cy,cy-p.y-height,0);};
const outside=(value,radius)=>Math.max(0,Math.abs(value)-radius);

/** Return null for the unchanged AABB fast path. Existing shape data wins. */
export function environmentCollision(box,map){
 if(box.collisionShape)return box.collisionShape;
 const prop=box.prop!==undefined?map?.props?.[box.prop]:null;
 const tree=box.tree!==undefined?map?.trees?.[box.tree]:null;
 const kind=prop?.kind||(tree||box.kind==='tree'?'tree':box.harvestType);
 const x=box.x,y=box.y,z=box.z,w=box.w,h=box.h,d=box.d;
 if(kind==='rock')return shape('ellipsoid',x,y,z,w*.98,h,d*.98);
 if(kind==='bush'||kind==='crop')return {kind:'none'};
 // The tree's authored thin trunk remains authoritative. Canopies and small
 // roots do not become invisible walking walls or bulletproof foliage.
 if(kind==='tree')return shape('cylinder',x,y,z,w,h,d);
 if(kind==='lamp'||kind==='bollard'){
  const bollard=kind==='bollard',rad=bollard?Math.min(w,d)*.38:Math.min(.085,w*.23),stem=bollard?h*.88:h*.85,parts=[
   shape('cylinder',x,y,z,rad*4,Math.min(h*.20,.45),rad*4),
   shape('cylinder',x,y,z,rad*2,stem,rad*2),
  ];
  if(bollard)parts.push(shape('cylinder',x,y+h*.87,z,rad*2.36,h*.13,rad*2.36));
  else{const lw=Math.min(.48,h*.12);parts.push(shape('box',x,y+h*.83,z,lw,.33,lw),shape('ellipsoid',x,y+h*.90,z,lw*1.54,h*.10,lw*1.54));}
  return {kind:'parts',parts};
 }
 if(kind==='barrels'||kind==='shield-barrel'||kind==='shieldBarrel'){
  const count=kind==='barrels'?2:1,r=Math.min(w/(count===1?2.05:4.3),d*.45),parts=[];
  for(let i=0;i<count;i++)parts.push(shape('cylinder',x+(i-(count-1)/2)*r*2.2,y,z,r*2.02,h*.96,r*2.02));
  return count===1?parts[0]:{kind:'parts',parts};
 }
 if(['tank','silo','incubator'].includes(kind)){const diameter=Math.min(w,d)*.95;return shape('cylinder',x,y,z,diameter,h,diameter);}
 return null;
}

/** AABB enclosing a descriptor, for a dynamic OBB's spatial-index owner. */
export function collisionBounds(s,out={}){
 if(!s||s.kind==='none')return null;
 if(s.kind==='parts'){
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  const partBounds={};for(const p of s.parts||[]){const b=collisionBounds(p,partBounds);if(!b)continue;minX=Math.min(minX,b.x-b.w/2);maxX=Math.max(maxX,b.x+b.w/2);minY=Math.min(minY,b.y);maxY=Math.max(maxY,b.y+b.h);minZ=Math.min(minZ,b.z-b.d/2);maxZ=Math.max(maxZ,b.z+b.d/2);}
  if(!Number.isFinite(minX))return null;Object.assign(out,{x:(minX+maxX)/2,y:minY,z:(minZ+maxZ)/2,w:maxX-minX,h:maxY-minY,d:maxZ-minZ});return out;
 }
 const c=Math.abs(Math.cos(s.yaw||0)),sn=Math.abs(Math.sin(s.yaw||0)),w=s.kind==='obb'?s.w*c+s.d*sn:s.w,d=s.kind==='obb'?s.w*sn+s.d*c:s.d;
 Object.assign(out,{x:s.x,y:s.y,z:s.z,w,h:s.h,d});return out;
}

function boxRay(o,d,s,max,radius){
 let lo=0,hi=max;
 for(const axis of ['x','y','z']){
  const half=axis==='x'?s.w/2:axis==='z'?s.d/2:s.h/2,center=axis==='y'?s.y+s.h/2:s[axis],min=center-half-radius,upper=center+half+radius,v=d[axis],at=o[axis];
  if(Math.abs(v)<EPS){if(at<min||at>upper)return Infinity;continue;}
  let a=(min-at)/v,b=(upper-at)/v;if(a>b){const swap=a;a=b;b=swap;}lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return Infinity;
 }return lo;
}
function roundRay(o,d,s,max,radius,cylinder){
 // Uniformly expand by the smallest semiaxis. Merely adding radius to each
 // semiaxis underestimates a swept sphere on an elongated ellipse's shoulder.
 const growth=1+radius/Math.min(s.w/2,cylinder?Infinity:s.h/2,s.d/2),a=s.w/2*growth,b=s.h/2*growth,c=s.d/2*growth,ox=(o.x-s.x)/a,oz=(o.z-s.z)/c,vx=d.x/a,vz=d.z/c;
 if(cylinder){
  let lo=0,hi=max;const A=vx*vx+vz*vz,B=2*(ox*vx+oz*vz),C=ox*ox+oz*oz-1;
  if(A<EPS){if(C>0)return Infinity;}
  else{const disc=B*B-4*A*C;if(disc<0)return Infinity;const r=Math.sqrt(Math.max(0,disc));lo=Math.max(lo,(-B-r)/(2*A));hi=Math.min(hi,(-B+r)/(2*A));if(lo>hi)return Infinity;}
  if(Math.abs(d.y)<EPS){if(o.y<s.y-radius||o.y>s.y+s.h+radius)return Infinity;}
  else{let low=(s.y-radius-o.y)/d.y,high=(s.y+s.h+radius-o.y)/d.y;if(low>high){const swap=low;low=high;high=swap;}lo=Math.max(lo,low);hi=Math.min(hi,high);if(lo>hi)return Infinity;}
  return lo;
 }
 const oy=(o.y-s.y-s.h/2)/b,vy=d.y/b,A=vx*vx+vy*vy+vz*vz,B=2*(ox*vx+oy*vy+oz*vz),C=ox*ox+oy*oy+oz*oz-1;
 if(C<=0)return 0;if(A<EPS)return Infinity;const disc=B*B-4*A*C;if(disc<0)return Infinity;const t=(-B-Math.sqrt(Math.max(0,disc)))/(2*A);return t>=0&&t<=max?t:Infinity;
}

/** Radius inflation conservatively sweeps projectiles and camera near planes. */
export function rayShape(o,d,s,max=Infinity,radius=0){
 if(!s||s.kind==='none')return Infinity;
 if(s.kind==='parts'){let best=max,hit=Infinity;for(const p of s.parts||[]){const t=rayShape(o,d,p,best,radius);if(t<=best){best=hit=t;}}return hit;}
 if(s.kind==='ellipsoid'||s.kind==='cylinder')return roundRay(o,d,s,max,radius,s.kind==='cylinder');
 if(s.kind==='obb'){
  const c=Math.cos(s.yaw||0),sn=Math.sin(s.yaw||0),x=o.x-s.x,z=o.z-s.z;
  return boxRay({x:x*c-z*sn,y:o.y,z:x*sn+z*c},{x:d.x*c-d.z*sn,y:d.y,z:d.x*sn+d.z*c},{x:0,y:s.y,z:0,w:s.w,h:s.h,d:s.d},max,radius);
 }
 return boxRay(o,d,s,max,radius);
}

function obbInterval(s,axis,p,radius,out){
 const c=Math.cos(s.yaw||0),sn=Math.sin(s.yaw||0),a=s.w/2,b=s.d/2,other=axis==='x'?'z':'x';let min=-Infinity,max=Infinity;
 // SAT projections of the oriented leaf and the player's square footprint.
 for(let i=0;i<4;i++){
  const nx=i===0?1:i===1?0:i===2?c:sn,nz=i===0?0:i===1?1:i===2?-sn:c,coefficient=axis==='x'?nx:nz;
  const limit=a*Math.abs(nx*c-nz*sn)+b*Math.abs(nx*sn+nz*c)+radius*(Math.abs(nx)+Math.abs(nz));
  const fixed=(p[other]-s[other])*(axis==='x'?nz:nx);
  if(Math.abs(coefficient)<EPS){if(Math.abs(fixed)>=limit)return null;continue;}
  let low=s[axis]+(-limit-fixed)/coefficient,high=s[axis]+(limit-fixed)/coefficient;if(low>high){const swap=low;low=high;high=swap;}min=Math.max(min,low);max=Math.min(max,high);if(min>=max)return null;
 }
 out.min=min;out.max=max;out.top=s.y+s.h;return out;
}

/** Player body overlap uses the same square footprint as existing AABB physics. */
export function shapeOverlap(s,p,height=1.85,radius=.32){
 if(!s||s.kind==='none')return false;
 if(s.kind==='parts'){for(const part of s.parts||[])if(shapeOverlap(part,p,height,radius))return true;return false;}
 if(!overlapY(s,p,height))return false;
 if(s.kind==='ellipsoid'||s.kind==='cylinder'){
  const x=outside(p.x-s.x,radius)/(s.w/2),z=outside(p.z-s.z,radius)/(s.d/2),y=s.kind==='ellipsoid'?verticalDelta(s,p,height)/(s.h/2):0;
  return x*x+y*y+z*z<1-EPS;
 }
 if(s.kind==='obb'){const interval=obbInterval(s,'x',p,radius,{});return !!interval&&p.x>interval.min&&p.x<interval.max;}
 return Math.abs(p.x-s.x)<s.w/2+radius&&Math.abs(p.z-s.z)<s.d/2+radius;
}

/** Occupied interval along one movement axis at the current body height. */
export function shapeAxisInterval(s,axis,p,height=1.85,radius=.32,out={}){
 if(!s||s.kind==='none')return null;
 if(s.kind==='parts'){
  let min=Infinity,max=-Infinity,top=-Infinity;const scratch={};
  // Preserve genuine gaps between separated parts. Return only the connected
  // occupied interval containing the proposed player coordinate.
  for(const part of s.parts||[]){const hit=shapeAxisInterval(part,axis,p,height,radius,scratch);if(hit&&p[axis]>hit.min&&p[axis]<hit.max){min=Math.min(min,hit.min);max=Math.max(max,hit.max);top=Math.max(top,hit.top);}}
  if(!Number.isFinite(min))return null;
  for(let pass=0;pass<(s.parts||[]).length;pass++){
   let changed=false;for(const part of s.parts||[]){const hit=shapeAxisInterval(part,axis,p,height,radius,scratch);if(hit&&hit.min<max&&hit.max>min){if(hit.min<min||hit.max>max)changed=true;min=Math.min(min,hit.min);max=Math.max(max,hit.max);top=Math.max(top,hit.top);}}if(!changed)break;
  }
  out.min=min;out.max=max;out.top=top;return out;
 }
 if(!overlapY(s,p,height))return null;
 if(s.kind==='obb')return obbInterval(s,axis,p,radius,out);
 const other=axis==='x'?'z':'x',extent=axis==='x'?s.w/2:s.d/2,otherExtent=axis==='x'?s.d/2:s.w/2;
 let reach=extent+radius;
 if(s.kind==='ellipsoid'||s.kind==='cylinder'){
  const u=outside(p[other]-s[other],radius)/otherExtent,v=s.kind==='ellipsoid'?verticalDelta(s,p,height)/(s.h/2):0,q=1-u*u-v*v;
  if(q<=0)return null;reach=extent*Math.sqrt(q)+radius;
 }else if(Math.abs(p[other]-s[other])>=otherExtent+radius)return null;
 out.min=s[axis]-reach;out.max=s[axis]+reach;const support=shapeVerticalInterval(s,p.x,p.z,radius,{});out.top=support?.max??s.y+s.h;return out;
}

/** The actual lower/upper surface under a footprint, including curved rocks. */
export function shapeVerticalInterval(s,x,z,radius=0,out={}){
 if(!s||s.kind==='none')return null;
 if(s.kind==='parts'){
  let min=Infinity,max=-Infinity;const scratch={};for(const part of s.parts||[]){const interval=shapeVerticalInterval(part,x,z,radius,scratch);if(interval){min=Math.min(min,interval.min);max=Math.max(max,interval.max);}}
  if(!Number.isFinite(min))return null;out.min=min;out.max=max;return out;
 }
 if(s.kind==='obb'){const interval=obbInterval(s,'x',{x,z},radius,{});if(!interval||x<=interval.min||x>=interval.max)return null;}
 else if(s.kind==='ellipsoid'||s.kind==='cylinder'){
  const u=outside(x-s.x,radius)/(s.w/2),v=outside(z-s.z,radius)/(s.d/2),q=1-u*u-v*v;if(q<=0)return null;
  if(s.kind==='ellipsoid'){const half=s.h/2*Math.sqrt(q),cy=s.y+s.h/2;out.min=cy-half;out.max=cy+half;return out;}
 }else if(Math.abs(x-s.x)>=s.w/2+radius||Math.abs(z-s.z)>=s.d/2+radius)return null;
 out.min=s.y;out.max=s.y+s.h;return out;
}

function surfaceDistance(s,p,radius){
 if(s.kind==='ellipsoid'){const growth=1+radius/Math.min(s.w/2,s.h/2,s.d/2),a=s.w/2*growth,b=s.h/2*growth,c=s.d/2*growth;return Math.abs(Math.hypot((p.x-s.x)/a,(p.y-s.y-s.h/2)/b,(p.z-s.z)/c)-1)*Math.min(a,b,c);}
 if(s.kind==='cylinder'){const growth=1+radius/Math.min(s.w/2,s.d/2),a=s.w/2*growth,c=s.d/2*growth;return Math.min(Math.abs(Math.hypot((p.x-s.x)/a,(p.z-s.z)/c)-1)*Math.min(a,c),Math.abs(p.y-s.y+radius),Math.abs(p.y-s.y-s.h-radius));}
 const c=Math.cos(s.yaw||0),sn=Math.sin(s.yaw||0),dx=p.x-s.x,dz=p.z-s.z,x=s.kind==='obb'?dx*c-dz*sn:dx,z=s.kind==='obb'?dx*sn+dz*c:dz;
 return Math.min(Math.abs(Math.abs(x)-s.w/2-radius),Math.abs(Math.abs(z)-s.d/2-radius),Math.abs(p.y-s.y+radius),Math.abs(p.y-s.y-s.h-radius));
}
export function shapeNormal(s,p,radius=0,out={}){
 if(s.kind==='parts'){let best=Infinity,chosen;for(const part of s.parts||[]){const distance=surfaceDistance(part,p,radius);if(distance<best){best=distance;chosen=part;}}return chosen?shapeNormal(chosen,p,radius,out):Object.assign(out,{x:0,y:1,z:0});}
 let x=0,y=0,z=0;
 if(s.kind==='ellipsoid'){
  const growth=1+radius/Math.min(s.w/2,s.h/2,s.d/2),a=s.w/2*growth,b=s.h/2*growth,c=s.d/2*growth;x=(p.x-s.x)/(a*a);y=(p.y-s.y-s.h/2)/(b*b);z=(p.z-s.z)/(c*c);
 }else if(s.kind==='cylinder'){
  const growth=1+radius/Math.min(s.w/2,s.d/2),a=s.w/2*growth,c=s.d/2*growth,radial=Math.abs(Math.hypot((p.x-s.x)/a,(p.z-s.z)/c)-1)*Math.min(a,c),bottom=Math.abs(p.y-s.y+radius),top=Math.abs(p.y-s.y-s.h-radius);
  if(Math.min(bottom,top)<radial)y=top<bottom?1:-1;else{x=(p.x-s.x)/(a*a);z=(p.z-s.z)/(c*c);}
 }else{
  const c=Math.cos(s.yaw||0),sn=Math.sin(s.yaw||0),dx=p.x-s.x,dz=p.z-s.z,lx=s.kind==='obb'?dx*c-dz*sn:dx,lz=s.kind==='obb'?dx*sn+dz*c:dz;
  let nearest=Math.abs(Math.abs(lx)-s.w/2-radius),axis='x';const dzFace=Math.abs(Math.abs(lz)-s.d/2-radius),bottom=Math.abs(p.y-s.y+radius),top=Math.abs(p.y-s.y-s.h-radius);
  if(dzFace<nearest){nearest=dzFace;axis='z';}if(bottom<nearest){nearest=bottom;axis='bottom';}if(top<nearest)axis='top';
  if(axis==='bottom')y=-1;else if(axis==='top')y=1;else if(axis==='x'){const sign=lx<0?-1:1;x=s.kind==='obb'?sign*c:sign;z=s.kind==='obb'?-sign*sn:0;}else{const sign=lz<0?-1:1;x=s.kind==='obb'?sign*sn:0;z=s.kind==='obb'?sign*c:sign;}
 }
 const length=Math.hypot(x,y,z)||1;out.x=x/length;out.y=y/length;out.z=z/length;return out;
}

/** Editor solids use quarter turns, keeping scaled ellipsoids axis-aligned. */
export function transformCollisionShape(s,origin,record){
 if(!s||s.kind==='none')return s?{kind:'none'}:null;
 if(s.kind==='parts')return {kind:'parts',parts:(s.parts||[]).map(p=>transformCollisionShape(p,origin,record))};
 const angle=record.rotation*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle),sx=record.scale[0],sy=record.scale[1],sz=record.scale[2],dx=(s.x-origin[0])*sx,dz=(s.z-origin[2])*sz;
 const result={...s,x:record.position[0]+dx*c+dz*sn,y:record.position[1]+(s.y-origin[1])*sy,z:record.position[2]-dx*sn+dz*c,h:s.h*sy};
 if(s.kind==='obb'){
  const yaw=s.yaw||0,sc=Math.cos(yaw),ss=Math.sin(yaw),localX=Math.hypot(sx*sc,sz*ss),localZ=Math.hypot(sx*ss,sz*sc);
  result.w=s.w*localX;result.d=s.d*localZ;result.yaw=((Math.atan2(sz*ss,sx*sc)+angle)%TAU+TAU)%TAU;
 }else{result.w=s.w*sx*Math.abs(c)+s.d*sz*Math.abs(sn);result.d=s.w*sx*Math.abs(sn)+s.d*sz*Math.abs(c);}
 return result;
}
