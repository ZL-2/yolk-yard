import * as T from 'three';
import {environmentKit,environmentMaterial} from './environment-surfaces.js';

// These are visual shells only. The authoritative prop/collider record is never
// changed, and every part stays a direct child for streaming/destruction batches.
export const ENVIRONMENT_PROP_KINDS=Object.freeze([
 'rock','bush','crop','logs','campfire','crystal','planter','crate','barrels','shield-barrel',
 'car','truck','wreck','bench','fence','lamp','bollard','solar','container','generator','pump',
 'tank','silo','incubator','console','shelf','bed','sofa','counter','target','checkpoint',
 'excavator','drill','waterwheel','telescope','radio','crane','gantry','headframe','vault-rack',
 'tent','medical-tent','dome','bio-dome','beacon','clock','watchtower','water-tower',
]);
const kinds=new Set(ENVIRONMENT_PROP_KINDS),cache=new Map();
function shared(key,create){if(!cache.has(key)){const g=create();g.userData.shared=true;cache.set(key,g);}return cache.get(key);}
function mesh(g,geometry,color,kind,x,y,z,sx=1,sy=1,sz=1){
 const material=environmentMaterial(color,kind);if(geometry.attributes.color)material.vertexColors=true;
 const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;m.userData.environmentSurface=kind;g.add(m);return m;
}
function random(seed){let s=(seed|0)^0x51f15e;return()=>{s=(Math.imul(s,1664525)+1013904223)|0;return (s>>>0)/4294967296;};}
function geometry(positions,uv,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;}
function quad(out,a,b,c,d,color){for(const [i,u,v]of [[0,0,0],[1,1,0],[2,1,1],[0,0,0],[2,1,1],[3,0,1]]){out.p.push(...[a,b,c,d][i]);out.uv.push(u,v);if(out.c)out.c.push(...color);}}
function prism(g,profile,width,color,kind,x,y,z){
 const key='profile:'+profile.flat().join(',')+':'+width;
 const geo=shared(key,()=>{const out={p:[],uv:[]},n=profile.length;
  for(let j=0;j<n;j++){const a=profile[j],b=profile[(j+1)%n];quad(out,[-width/2,a[0],a[1]],[-width/2,b[0],b[1]],[width/2,b[0],b[1]],[width/2,a[0],a[1]]);}
  for(let j=1;j<n-1;j++)for(const side of [-1,1]){const ids=side<0?[0,j+1,j]:[0,j,j+1];for(const i of ids){out.p.push(side*width/2,profile[i][0],profile[i][1]);out.uv.push((profile[i][1]+2)/4,profile[i][0]);}}
  return geometry(out.p,out.uv);
 });return mesh(g,geo,color,kind,x,y,z);
}
function lathe(g,key,profile,color,kind,x,y,z,r=1,h=1,n=12){
 return mesh(g,shared('lathe:'+key+':'+n,()=>new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),n)),color,kind,x,y,z,r,h,r);
}
function ring(g,k,x,y,z,r,t,color,axis='y',kind='metal'){
 const m=lathe(g,'ring:'+r+':'+t,[[r-t,-t],[r+t,-t],[r+t,t],[r-t,t],[r-t,-t]],color,kind,x,y,z,1,1,12);if(axis==='z')m.rotation.x=Math.PI/2;else if(axis==='x')m.rotation.z=Math.PI/2;return m;
}
function endGrain(g,x,y,z,r,side){
 const geo=shared('end-grain',()=>{const p=[],uv=[],c=[],rings=[0,.34,.39,.66,.71,1],n=10;
  for(let j=0;j<rings.length-1;j++)for(let a=0;a<n;a++){const aa=a*Math.PI*2/n,bb=(a+1)*Math.PI*2/n,A=rings[j],B=rings[j+1],tint=j%2?[.47,.32,.18]:[.71,.55,.34];
   const out={p,uv,c};quad(out,[Math.cos(aa)*A,Math.sin(aa)*A,0],[Math.cos(aa)*B,Math.sin(aa)*B,0],[Math.cos(bb)*B,Math.sin(bb)*B,0],[Math.cos(bb)*A,Math.sin(bb)*A,0],tint);
  }return geometry(p,uv,c);
 });const m=mesh(g,geo,0xffffff,'wood',x,y,z,r,r,1);if(side<0)m.rotation.y=Math.PI;return m;
}
function fracturedRock(seed,detail){
 return shared('rounded-boulder:'+((seed|0)%16)+':'+detail,()=>{
  // The old ring shell was wound inward: back-face culling exposed its far
  // interior and made rocks look sliced open. An outward closed geodesic shell
  // gives every viewing direction a complete rounded silhouette, including its
  // underside. Deformation depends on position so UV seams cannot split apart.
  const g=new T.IcosahedronGeometry(1,detail?2:1),p=g.attributes.position,phase=((seed|0)%16)*.713;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=.91+.055*Math.sin(x*4+phase)*Math.cos(z*3-phase)+.035*Math.sin(y*5+z*2+phase);p.setXYZ(i,x*r,y*r,z*r);}
  g.computeBoundingBox();const b=g.boundingBox,size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());g.translate(-center.x,-b.min.y,-center.z);g.scale(.98/size.x,1/size.y,.98/size.z);
  const colors=new Float32Array(p.count*3),normals=new Float32Array(p.count*3),sums=new Map(),keys=[],a=new T.Vector3(),v=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();
  const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(':');
  for(let i=0;i<p.count;i++){keys[i]=key(i);if(!sums.has(keys[i]))sums.set(keys[i],new T.Vector3());const tone=.84+.07*p.getY(i)+.025*Math.sin(p.getY(i)*17+p.getX(i)*4+phase);colors.set([tone*.79,tone*.82,tone*.75],i*3);}
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);v.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);normal.crossVectors(v.sub(a),c.sub(a));for(let j=0;j<3;j++)sums.get(keys[i+j]).add(normal);}
  for(let i=0;i<p.count;i++)normals.set(sums.get(keys[i]).clone().normalize().toArray(),i*3);
  g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();g.userData.roundedBoulder=true;g.userData.artRevision=160;return g;
 });
}
function foliage(seed,detail,crop=false){
 return shared('leaves:'+((seed|0)%8)+':'+detail+':'+crop,()=>{
  const rng=random(seed%8),out={p:[],uv:[],c:[]},count=crop?(detail?14:6):(detail?64:24);
  for(let i=0;i<count;i++){
   const a=i*2.399+rng()*.5,rad=crop?.08+rng()*.10:Math.sqrt(rng())*.48,cy=crop?.18+(i/count)*.57:.18+rng()*.65,xx=Math.cos(a)*rad,zz=Math.sin(a)*rad;
   const len=crop?.25+rng()*.12:.12+rng()*.13,ww=len*(crop?.20:.42),dx=Math.cos(a),dz=Math.sin(a),lift=.06+rng()*.08;
   const points=[[xx-dx*len*.3,cy,zz-dz*len*.3],[xx-dz*ww,cy+lift,zz+dx*ww],[xx+dx*len,cy+lift*.2,zz+dz*len],[xx+dz*ww,cy+lift,zz-dx*ww]],ridge=[xx+dx*len*.22,cy+lift*1.3,zz+dz*len*.22],tone=.65+rng()*.3,col=crop?[tone*.66,tone*.71,tone*.30]:[tone*.36,tone*.58,tone*.26];
   for(let j=0;j<4;j++)for(const reverse of [false,true])for(const v of reverse?[points[(j+1)%4],points[j],ridge]:[points[j],points[(j+1)%4],ridge]){out.p.push(...v);out.uv.push((v[0]-xx)/len*.45+.5,(v[2]-zz)/len*.45+.5);out.c.push(...col);}
  }const g=geometry(out.p,out.uv,out.c);g.computeBoundingBox();const b=g.boundingBox,size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());g.translate(-center.x,-b.min.y,-center.z);g.scale(1/size.x,1/size.y,1/size.z);return g;
 });
}
function foliageProp(g,p,k,detail){
 const {x,y,z,w,h,d,kind,seed}=p,{block:B,cylinder:C,beam}=k;
 if(kind==='rock'){mesh(g,fracturedRock(seed,detail),0xffffff,'stone',x,y,z,w,h,d);
  if(detail)mesh(g,fracturedRock(seed+3,false),0xa2a48e,'stone',x+w*.34,y,z-d*.28,w*.22,h*.19,d*.24);
 }else if(kind==='bush'){
  mesh(g,foliage(seed,detail),0xffffff,'leaf',x,y,z,w*.90,h,d*.90);
  for(let j=0;j<(detail?4:2);j++){const a=j*2.4;beam(g,[x,y,z],[x+Math.cos(a)*w*.22,y+h*.65,z+Math.sin(a)*d*.22],.022,0x665641,'bark');}
 }else if(kind==='crop'){
  mesh(g,foliage(seed,detail,true),0xffffff,'leaf',x,y,z,w,h,d);
  for(let j=0;j<(detail?3:1);j++){const xx=x+(j-1)*w*.17,zz=z+(j%2-.5)*d*.22,hh=h*(.83+j*.07);C(g,xx,y+hh*.5,zz,.014,hh,0x918a3d,5,'leaf');const ear=k.rock(g,xx,y+hh*.93,zz,w*.09,h*.13,d*.08,0xb6a264,1,'leaf');ear.rotation.z=(j-1)*.12;}
 }else if(kind==='logs'||kind==='campfire'){
  const count=kind==='logs'?5:3,rad=kind==='logs'?Math.min(h*.235,w*.14):Math.min(h*.27,w*.11),length=kind==='logs'?d:Math.min(w,d)*.70;
  for(let i=0;i<count;i++){const xx=kind==='logs'?x+(i%3-1)*rad*1.85:x,yy=y+rad+Math.floor(i/3)*rad*1.75,log=C(g,xx,yy,z,rad,length,0x65513b,10,'bark');log.rotation.x=Math.PI/2;if(kind==='campfire'){log.rotation.z=(i-1)*.8;continue;}for(const side of [-1,1])endGrain(g,xx,yy,z+side*(length/2+.002),rad*.88,side);}
  if(kind==='campfire')for(let i=0;i<8;i++){const a=i*Math.PI/4;mesh(g,fracturedRock(i,false),0x8b8e80,'stone',x+Math.cos(a)*w*.40,y,z+Math.sin(a)*d*.40,w*.16,h*.26,d*.16);}
 }else if(kind==='planter'){
  const wall=Math.min(w,d)*.09,ph=h*.56;B(g,x,y+ph/2,z,w,ph,d,0x9e9883,'stone');B(g,x,y+ph+.008,z,w-wall*2,.04,d-wall*2,0x463b2b,'soil');
  for(const side of [-1,1]){B(g,x+side*(w-wall)/2,y+ph,z,wall,.12,d+.04,0xb4ae95,'stone');B(g,x,y+ph,z+side*(d-wall)/2,w,.12,wall,0xb4ae95,'stone');}
  mesh(g,foliage(seed,detail),0xffffff,'leaf',x,y+ph,z,w*.72,h*.55,d*.75);
 }else if(kind==='crystal'){
  for(let j=0;j<(detail?5:3);j++){const a=j*2.4,rr=j?1:.3,m=k.cone(g,x+Math.cos(a)*w*.2*rr,y+h*(j?.32:.5),z+Math.sin(a)*d*.2*rr,w*(j?.15:.22),h*(j?.6:1),j%2?0x6b9a9f:0x86c1bc,.08,'metal');m.rotation.z=Math.cos(a)*.13;}
  mesh(g,fracturedRock(seed,false),0x89978d,'stone',x,y,z,w,h*.24,d);
 }else return false;return true;
}
function crate(g,p,k,detail){
 const {x,y,z,w,h,d}=p,{block:B,beam}=k,edge=Math.min(w,d,h)*.075;
 B(g,x,y+h*.5,z,w*.94,h*.94,d*.94,0x725c43,'wood');
 const n=detail?5:3;for(let j=0;j<n;j++)for(const side of [-1,1])B(g,x-w*.5+(j+.5)*w/n,y+h*.5,z+side*d*.486,w/n*.94,h*.91,.026,0x9e8056,'wood');
 for(const side of [-1,1]){B(g,x,y+h*.12,z+side*d*.51,w,.12*h,edge,0xb49b6b,'wood');B(g,x,y+h*.88,z+side*d*.51,w,.12*h,edge,0xb49b6b,'wood');beam(g,[x-w*.38,y+h*.19,z+side*d*.53],[x+w*.38,y+h*.81,z+side*d*.53],edge*.65,0xb09a72,'wood');}
 for(const sx of [-1,1])for(const sz of [-1,1]){B(g,x+sx*w*.47,y+h*.5,z+sz*d*.45,edge,h,edge*1.3,0xbba17a,'wood');if(detail)for(const yy of [.16,.84]){B(g,x+sx*w*.43,y+h*yy,z+sz*d*.535,edge*2,.10*h,.025,0x4e5751,'metal');}}
 for(const sx of [-1,1]){B(g,x+sx*w*.503,y+h*.60,z,.018,h*.10,d*.28,0x3e3d32,'rubber');B(g,x+sx*w*.517,y+h*.67,z,.02,h*.035,d*.35,0x5d655d,'metal');}
}
function barrel(g,p,k,detail,shield=false){
 const {x,y,z,w,h,d}=p,{block:B,cylinder:C}=k,n=detail?(shield?16:12):10,count=shield?1:2,rad=Math.min(w/(count===1?2.05:4.3),d*.45),height=h*.96;
 for(let j=0;j<count;j++){
  const xx=x+(j-(count-1)/2)*rad*2.2,body=shield?0x244958:0x796f50;
  lathe(g,'drum',[[0,0],[.93,0],[1,.035],[1,.08],[.94,.10],[.94,.25],[1,.27],[1,.31],[.94,.33],[.94,.67],[1,.69],[1,.73],[.94,.75],[.94,.91],[1,.93],[1,.98],[.93,1],[0,1]],body,'paint',xx,y,z,rad,height,n);
  for(const yy of [.04,.29,.71,.96]){C(g,xx,y+height*yy,z,rad*1.005,height*.026,shield?0x80bdac:0x8e978e,n,'metal');}
  C(g,xx+rad*.36,y+height+.012,z-rad*.25,rad*.12,.035,0x3b4947,8,'metal');
  if(detail){B(g,xx,y+height*.52,z-rad*.956,rad*1.08,height*.28,.014,shield?0x3bb1ab:0xc3af76,'paint');B(g,xx,y+height*.52,z+rad*.956,rad*1.08,height*.28,.014,shield?0x3bb1ab:0xc3af76,'paint');}
  if(shield){for(const side of [-1,1]){const zz=z+side*rad*.98;B(g,xx,y+height*.53,zz,rad*.61,height*.055,.025,0xdcf5e4,'paint');B(g,xx,y+height*.53,zz,rad*.16,height*.22,.025,0xdcf5e4,'paint');}for(const yy of [.20,.83]){C(g,xx,y+height*yy,z,rad*.958,height*.045,0x4ed3be,n,'paint');}}
 }
}
function vehicle(g,p,k,detail){
 const {x,y,z,w,h,d,kind}=p,{block:B,cylinder:C,beam}=k,truck=kind==='truck',body=truck?0x697962:0x4d716f,metal=0x6d7774,glass=0x263e47,tyre=0x242d2c,r=Math.min(h*.25,w*.20),front=-d*.42,rear=d*.38;
 const shell=prism(g,[[h*.25,-d*.48],[h*.50,-d*.49],[h*.63,-d*.18],[h*.57,d*.38],[h*.43,d*.48],[h*.25,d*.48]],w*.92,body,'paint',x,y,z);
 shell.name=truck?'Utility truck body':'Abandoned sedan body';
 B(g,x,y+h*.23,z,w*.8,h*.12,d*.83,0x394540,'metal');
 const cabFront=truck?-d*.31:-d*.17,cabRear=truck?d*.02:d*.25,roofFront=truck?-d*.22:-d*.07,roofRear=truck?-d*.03:d*.17;
 prism(g,[[h*.53,cabFront],[h*.98,roofFront],[h*.98,roofRear],[h*.55,cabRear]],w*.79,body,'paint',x,y,z);
 // Raked windshield and rear window: thin opaque glass avoids transparency sorting.
 for(const [za,zb,ya,yb]of [[cabFront-.006,roofFront-.006,h*.58,h*.92],[cabRear+.006,roofRear+.006,h*.60,h*.92]]){
  const out={p:[],uv:[]},v=[[-w*.345,ya,za],[w*.345,ya,za],[w*.345,yb,zb],[-w*.345,yb,zb]];quad(out,...(za<0?v.reverse():v));mesh(g,shared('car-glass:'+out.p.join(','),()=>geometry(out.p,out.uv)),glass,'metal',x,y,z);
 }
 for(const side of [-1,1]){
  const win=prism(g,[[h*.59,cabFront+.07*d],[h*.91,roofFront+.025*d],[h*.91,roofRear-.025*d],[h*.59,cabRear-.055*d]],.014,glass,'metal',x+side*w*.403,y,z);win.name='Inset side glazing';
  B(g,x+side*w*.414,y+h*.75,z+(cabFront+cabRear)/2,.035,h*.37,.055*d,body,'paint');
  B(g,x+side*w*.476,y+h*.46,z+d*.07,.03,h*.035,d*.12,0x9caaa4,'metal');
  B(g,x+side*w*.52,y+h*.70,z+cabFront+.05*d,w*.12,h*.08,d*.065,body,'paint');
  for(const zz of [front,rear]){const wheel=C(g,x+side*w*.45,y+r,z+zz,r,w*.12,tyre,detail?14:10,'rubber');wheel.rotation.z=Math.PI/2;const hub=C(g,x+side*w*.518,y+r,z+zz,r*.56,.035,metal,10,'metal');hub.rotation.z=Math.PI/2;const cap=C(g,x+side*w*.541,y+r,z+zz,r*.20,.02,0x333e3d,8,'metal');cap.rotation.z=Math.PI/2;
   if(detail)for(let a=0;a<6;a++){const q=a*Math.PI/3,b=B(g,x+side*w*.54,y+r+Math.cos(q)*r*.38,z+zz+Math.sin(q)*r*.38,.025,r*.14,r*.055,0xa2aaa2,'metal');b.rotation.x=-q;}
  }
  B(g,x+side*w*.31,y+h*.43,z-d*.494,w*.22,h*.115,.04,0xd7d8b9,'paint');B(g,x+side*w*.36,y+h*.43,z+d*.49,w*.11,h*.12,.04,0xa34b39,'paint');
 }
 B(g,x,y+h*.31,z-d*.501,w*.91,h*.09,.06,metal,'metal');B(g,x,y+h*.31,z+d*.50,w*.9,h*.09,.07,metal,'metal');
 B(g,x,y+h*.44,z-d*.496,w*.38,h*.14,.03,0x273432,'rubber');if(detail)for(let i=0;i<5;i++)B(g,x-w*.15+i*w*.075,y+h*.44,z-d*.515,w*.025,h*.12,.025,0x8c9690,'metal');
 if(truck){B(g,x,y+h*.59,z+d*.26,w*.91,h*.10,d*.44,0x59644f,'paint');for(const side of [-1,1])B(g,x+side*w*.43,y+h*.76,z+d*.26,.07,h*.31,d*.44,body,'paint');B(g,x,y+h*.76,z+d*.47,w*.88,h*.31,.07,body,'paint');for(const side of [-1,1])beam(g,[x+side*w*.39,y+h*.60,z+d*.06],[x+side*w*.39,y+h*.96,z+d*.06],.036,metal,'metal');}
}
function street(g,p,k,detail){
 const {x,y,z,w,h,d,kind}=p,{block:B,cylinder:C,beam}=k,steel=0x485b5b,wood=0x97805d;
 if(kind==='bench'){
  for(let j=0;j<(detail?5:3);j++){const n=detail?5:3;B(g,x,y+h*.53,z-d*.39+(j+.5)*d*.78/n,w,.08,d*.70/n,wood,'wood');}
  for(let j=0;j<3;j++){const back=B(g,x,y+h*(.66+j*.12),z-d*.37,w,.10,h*.06,wood,'wood');back.rotation.x=-.12;}
  for(const side of [-1,1]){for(const zz of [-d*.30,d*.31])beam(g,[x+side*w*.34,y,z+zz],[x+side*w*.34,y+h*.52,z+zz],.042,steel,'metal');beam(g,[x+side*w*.34,y+h*.12,z-d*.36],[x+side*w*.34,y+h*.97,z-d*.41],.04,steel,'metal');beam(g,[x+side*w*.44,y+h*.77,z-d*.3],[x+side*w*.44,y+h*.77,z+d*.26],.037,steel,'metal');}
 }else if(kind==='fence'){
  for(const sx of [-1,1]){B(g,x+sx*(w/2-.06),y+h*.5,z,.14,h,.18,0x8b7857,'wood');const cap=k.cone(g,x+sx*(w/2-.06),y+h+.035,z,.10,.10,0xa48f6c,0,'wood');cap.rotation.y=Math.PI/4;}
  for(const yy of [.32,.76])B(g,x,y+h*yy,z,w,.13,.085,0xab9872,'wood');if(detail){beam(g,[x-w*.44,y+h*.29,z+.06],[x+w*.44,y+h*.79,z+.06],.034,0x8e7959,'wood');for(const side of [-1,1])for(const yy of [.32,.76])B(g,x+side*(w/2-.06),y+h*yy,z+.098,.045,.045,.014,0x484f49,'metal');}
 }else if(kind==='lamp'||kind==='bollard'){
  const bollard=kind==='bollard',rad=bollard?Math.min(w,d)*.38:Math.min(.085,w*.23),stem=bollard?h*.88:h*.85;
  lathe(g,'pole-base',[[0,0],[1,0],[1,.10],[.7,.17],[.55,.43],[.43,1],[0,1]],steel,'metal',x,y,z,rad*2,Math.min(h*.20,.45),12);
  C(g,x,y+stem/2,z,rad,stem,steel,10,'metal');
  if(bollard){C(g,x,y+h*.91,z,rad*1.13,h*.08,0xb7a770,10,'paint');k.cone(g,x,y+h*.97,z,rad*1.18,h*.06,steel,.45,'metal');}
  else{const lw=Math.min(.48,h*.12);B(g,x,y+h*.88,z,lw,.31,lw,0xd4cfaa,'paint');for(const sx of [-1,1])for(const sz of [-1,1])B(g,x+sx*lw*.49,y+h*.88,z+sz*lw*.49,.025,.33,.025,steel,'metal');k.cone(g,x,y+h*.95,z,lw*.77,h*.10,steel,0,'metal');C(g,x,y+h*.84,z,lw*.7,.05,steel,8,'metal');if(detail){B(g,x,y+h*.33,z+rad,.09,.17,.02,0x71817b,'metal');for(const xx of [-rad,rad])B(g,x+xx,y+.02,z,.035,.04,.035,0xb4b7a2,'metal');}}
 }else if(kind==='solar'){
  const angle=-.26,cy=y+h*.72,toWorld=(xx,yy,zz)=>[x+xx,cy+yy*Math.cos(angle)-zz*Math.sin(angle),z+yy*Math.sin(angle)+zz*Math.cos(angle)],panel=(xx,yy,zz,ww,hh,dd,c,kind='metal')=>{const pos=toWorld(xx,yy,zz),m=B(g,...pos,ww,hh,dd,c,kind);m.rotation.x=angle;return m;};
  for(const sx of [-1,1])for(const zz of [-d*.30,d*.30])beam(g,[x+sx*w*.33,y,z+zz],toWorld(sx*w*.33,-.06,zz),.045,0x748580,'metal');
  panel(0,0,0,w,.09,d,0x87958d);panel(0,.055,0,w*.965,.018,d*.94,0x192e42);
  const columns=detail?8:4,rows=detail?4:2;for(let a=1;a<columns;a++)panel(-w*.48+a*w*.96/columns,.068,0,.015,.01,d*.94,0x738999);for(let b=1;b<rows;b++)panel(0,.068,-d*.47+b*d*.94/rows,w*.96,.01,.015,0x738999);
  B(g,x,y+h*.39,z+d*.10,w*.16,h*.22,.08,0x3f504d,'paint');if(detail)beam(g,toWorld(w*.26,-.07,d*.18),[x,y+h*.40,z+d*.14],.012,0x2b3532,'rubber');
 }else if(kind==='checkpoint'){
  for(const side of [-1,1]){B(g,x+side*w*.43,y+h*.38,z,w*.075,h*.76,d*.23,0x687871,'metal');B(g,x+side*w*.43,y+h*.07,z,w*.12,h*.14,d*.42,0x8b8e7f,'stone');}
  B(g,x,y+h*.72,z,w,h*.14,d*.10,0xc3ac69,'paint');for(let j=0;j<7;j++){const stripe=B(g,x-w*.40+j*w*.8/6,y+h*.72,z-d*.055,w*.035,h*.14,.016,0x344343,'paint');stripe.rotation.z=-.2;}
  B(g,x-w*.29,y+h*.27,z+d*.30,w*.18,h*.54,d*.30,0x69766a,'paint');B(g,x-w*.29,y+h*.37,z+d*.458,w*.11,h*.14,.015,0x2f4343,'metal');
 }else return false;return true;
}
function container(g,p,k,detail){
 const {x,y,z,w,h,d,seed}=p,{block:B}=k,color=seed%2?0x97654e:0x4f757a,trim=0x84918a;
 B(g,x,y+h/2,z,w,h,d,color,'paint');
 const count=detail?Math.min(20,Math.max(8,Math.round(w/.42))):6;
 for(const side of [-1,1])for(let i=0;i<count;i++)B(g,x-w*.47+i*w*.94/(count-1),y+h*.5,z+side*(d*.5+.022),.035,h*.90,.035,color,'paint');
 for(const sx of [-1,1])for(const sz of [-1,1]){B(g,x+sx*w*.495,y+h*.5,z+sz*d*.49,.12,h,.12,trim,'metal');for(const yy of [.04,.96])B(g,x+sx*w*.485,y+h*yy,z+sz*d*.47,.18,.14,.18,0x4b5b57,'metal');}
 for(const side of [-1,1]){B(g,x+side*w*.501,y+h*.50,z,.025,h*.90,.025,0x2e423f,'rubber');for(const zz of [-d*.30,d*.30]){B(g,x+side*w*.516,y+h*.50,z+zz,.028,h*.84,.045,0xa4aea0,'metal');B(g,x+side*w*.535,y+h*.48,z+zz,.025,.075,d*.18,0xc4c5aa,'metal');}if(detail)for(const zz of [-d*.43,d*.43])for(const yy of [.22,.78])B(g,x+side*w*.525,y+h*yy,z+zz,.055,.18,.14,trim,'metal');}
 for(const zz of [-d*.49,d*.49])for(const yy of [.03,.97])B(g,x,y+h*yy,z+zz,w,.10,.10,trim,'metal');
}
function equipment(g,p,k,detail){
 const {x,y,z,w,h,d,kind}=p,{block:B,cylinder:C,beam}=k,steel=0x71837b,paint=0x687d68,dark=0x293c3b;
 if(kind==='generator'||kind==='pump'){
  B(g,x,y+h*.10,z,w,.15*h,d,0x3d5149,'metal');
  if(kind==='generator'){
   B(g,x,y+h*.47,z,w*.88,h*.68,d*.84,paint,'paint');B(g,x-w*.23,y+h*.61,z-d*.427,w*.30,h*.29,.022,0x354e4b,'rubber');B(g,x-w*.23,y+h*.66,z-d*.443,w*.20,h*.10,.02,0x93b8a0,'metal');
   for(let i=0;i<(detail?8:4);i++)B(g,x+w*.22,y+h*.26+i*h*.055,z-d*.432,w*.32,h*.019,.022,dark,'rubber');
   for(const side of [-1,1]){B(g,x+side*w*.46,y+h*.5,z,.04,h*.62,d*.72,steel,'metal');for(let j=0;j<4;j++)B(g,x+side*w*.485,y+h*.36+j*h*.09,z,.025,h*.025,d*.55,dark,'rubber');}
   for(const side of [-1,1]){beam(g,[x+side*w*.32,y+h*.82,z-d*.27],[x+side*w*.32,y+h*.94,z-d*.27],.045,dark,'metal');beam(g,[x+side*w*.32,y+h*.94,z-d*.27],[x+side*w*.32,y+h*.94,z+d*.27],.045,dark,'metal');}
   C(g,x+w*.30,y+h*.90,z+d*.29,w*.035,h*.25,dark,8,'metal');C(g,x+w*.30,y+h*1.025,z+d*.29,w*.05,.025,steel,8,'metal');
  }else{
   const motor=C(g,x-w*.14,y+h*.42,z,w*.27,d*.68,paint,14,'paint');motor.rotation.x=Math.PI/2;
   for(const yy of [.27,.38,.49,.60])B(g,x-w*.14,y+h*yy,z,w*.55,h*.035,d*.72,steel,'metal');C(g,x+w*.27,y+h*.53,z,w*.12,h*.74,steel,12,'metal');
   const nozzle=C(g,x+w*.27,y+h*.84,z-d*.28,w*.14,d*.56,steel,12,'metal');nozzle.rotation.x=Math.PI/2;ring(g,k,x+w*.27,y+h*.84,z-d*.57,w*.18,.035,0x9faaa0,'z');
   const valve=ring(g,k,x+w*.28,y+h*.65,z+d*.22,w*.14,.02,0xa56443,'z','paint');for(const a of [0,Math.PI/2]){const m=B(g,x+w*.28,y+h*.65,z+d*.22,w*.25,.025,.026,0xb2764c,'paint');m.rotation.z=a;}
  }
  if(detail)for(const sx of [-1,1])for(const sz of [-1,1])C(g,x+sx*w*.42,y+h*.19,z+sz*d*.42,.045,.03,0xafb2a1,6,'metal');
 }else if(['tank','silo','incubator'].includes(kind)){
  const r=Math.min(w,d)*.47;
  lathe(g,'tank',[[0,0],[.83,0],[.98,.04],[1,.10],[1,.88],[.94,.94],[.58,1],[0,1]],kind==='incubator'?0xa3b7a4:0x8d9b91,'metal',x,y,z,r,h,detail?20:12);
  for(const yy of [.14,.48,.84])C(g,x,y+h*yy,z,r*1.009,Math.min(.06,h*.014),0xb5baa5,detail?20:12,'metal');
  if(detail){for(const side of [-1,1])beam(g,[x+side*r*.19,y+h*.06,z-r*1.01],[x+side*r*.19,y+h*.94,z-r*1.01],.026,dark,'metal');for(let yy=.16;yy<.94;yy+=Math.max(.06,.32/h))B(g,x,y+h*yy,z-r*1.02,r*.40,.035,.07,steel,'metal');}
  C(g,x,y+h*1.015,z,r*.19,h*.04,steel,10,'metal');
  const outlet=C(g,x+r*.65,y+h*.16,z,r*.13,w*.49,dark,10,'metal');outlet.rotation.z=Math.PI/2;
  if(kind==='incubator'){B(g,x,y+h*.57,z+r*.96,w*.34,h*.40,.10,0x335a60,'metal');B(g,x,y+h*.57,z+r*1.015,w*.26,h*.31,.018,0x70a99e,'paint');for(const side of [-1,1])B(g,x+side*w*.14,y+h*.72,z+r*1.03,.035,.035,.016,0xc9cdaa,'metal');}
 }else if(kind==='console'){
  prism(g,[[0,-d*.48],[h*.58,-d*.48],[h,-d*.28],[h*.72,d*.40],[0,d*.48]],w,paint,'paint',x,y,z);
  const angle=-.30,face=B(g,x,y+h*.82,z-d*.31,w*.83,h*.40,.05,dark,'metal');face.rotation.x=angle;
  const screen=B(g,x-w*.13,y+h*.84,z-d*.35,w*.40,h*.25,.02,0x76a79c,'metal');screen.rotation.x=angle;
  for(let j=0;j<3;j++){const m=B(g,x+w*.29,y+h*(.74+j*.085),z-d*.375,.06,.045,.025,[0xb7c793,0xcc9b55,0xa65039][j],'paint');m.rotation.x=angle;}
  for(let j=0;j<(detail?5:3);j++)B(g,x,y+h*.28+j*h*.05,z-d*.488,w*.65,.018,.018,dark,'rubber');
 }else return false;return true;
}
function furniture(g,p,k,detail){
 const {x,y,z,w,h,d,kind}=p,{block:B,cylinder:C}=k,wood=0x887052,steel=0x586963;
 if(kind==='shelf'||kind==='vault-rack'){
  for(const sx of [-1,1])for(const sz of [-1,1])B(g,x+sx*w*.47,y+h*.5,z+sz*d*.46,.06,h,.06,kind==='shelf'?wood:steel,kind==='shelf'?'wood':'metal');
  for(let i=0;i<3;i++){const yy=y+h*(.06+i*.31);B(g,x,yy,z,w,.06,d,kind==='shelf'?0xa0875d:0x6d7d70,kind==='shelf'?'wood':'metal');
   const n=kind==='vault-rack'?Math.min(5,Math.max(2,Math.floor(d/2))):3;for(let j=0;j<n;j++){const xx=kind==='vault-rack'?x:x+(j-1)*w*.3,zz=kind==='vault-rack'?z-d*.4+j*d*.8/(n-1):z;B(g,xx,yy+h*.11,zz,kind==='vault-rack'?w*.78:w*.23,h*.18,kind==='vault-rack'?d*.7/n:d*.74,[0x73816a,0x9c825b,0x52716c][j%3],'paint');if(detail)B(g,xx,yy+h*.12,zz+(kind==='vault-rack'?d*.7/n:d*.74)*.505,.13,.045,.015,0xc5b890,'paint');}
  }
 }else if(kind==='bed'){
  B(g,x,y+h*.28,z,w,h*.22,d,wood,'wood');for(const sx of [-1,1])for(const sz of [-1,1])B(g,x+sx*w*.40,y+h*.14,z+sz*d*.40,.07,h*.28,.07,wood,'wood');
  B(g,x,y+h*.51,z,w*.96,h*.24,d*.96,0xb7b19a,'fabric');B(g,x,y+h*.66,z+d*.15,w*.98,h*.09,d*.65,0x667e73,'fabric');B(g,x,y+h*.69,z-d*.30,w*.66,h*.18,d*.20,0xd7d0b6,'fabric');B(g,x,y+h*.55,z-d*.49,w,h*.88,.08,wood,'wood');
  if(detail)for(let j=0;j<4;j++)B(g,x-w*.34+j*w*.225,y+h*.71,z+d*.1,.015,.012,d*.56,0x7e9382,'fabric');
 }else if(kind==='sofa'){
  B(g,x,y+h*.34,z,w,h*.48,d,0x5a7264,'fabric');B(g,x,y+h*.73,z-d*.39,w,h*.54,d*.22,0x60786a,'fabric');for(const sx of [-1,1])B(g,x+sx*w*.445,y+h*.58,z,w*.11,h*.59,d,0x52695e,'fabric');
  for(const sx of [-1,1]){B(g,x+sx*w*.21,y+h*.61,z+d*.04,w*.39,h*.12,d*.69,0x6f8577,'fabric');if(detail)B(g,x+sx*w*.21,y+h*.82,z-d*.255,w*.39,h*.29,.025,0x718a77,'fabric');}
  for(const sx of [-1,1])for(const sz of [-1,1])B(g,x+sx*w*.40,y+h*.07,z+sz*d*.37,.07,h*.14,.07,wood,'wood');
 }else if(kind==='counter'){
  B(g,x,y+h*.45,z,w,h*.90,d,0x9a835e,'wood');B(g,x,y+h*.94,z,w*1.03,h*.12,d*1.05,0xc2bda4,'stone');
  for(const sx of [-1,1]){B(g,x+sx*w*.245,y+h*.46,z+d*.505,w*.46,h*.70,.035,0x7f6c50,'wood');B(g,x+sx*w*.245,y+h*.65,z+d*.53,w*.17,.025,.05,steel,'metal');if(detail)B(g,x+sx*w*.245,y+h*.43,z+d*.528,w*.38,h*.50,.015,0x9a8059,'wood');}
 }else if(kind==='target'){
  B(g,x,y+h*.06,z,w*.80,h*.12,d*.85,wood,'wood');C(g,x,y+h*.42,z,.035,h*.74,steel,8,'metal');
  const board=C(g,x,y+h*.70,z,w*.46,.06,0xc5be9b,16,'wood');board.rotation.x=Math.PI/2;board.scale.y=1.24;
  for(const side of [-1,1]){const inner=C(g,x,y+h*.70,z+side*.036,w*.28,.015,0x595d4f,16,'paint');inner.rotation.x=Math.PI/2;const bull=C(g,x,y+h*.70,z+side*.049,w*.12,.016,0xb86e4c,12,'paint');bull.rotation.x=Math.PI/2;}
 }else return false;return true;
}
function industrial(g,p,k,detail){
 const {x,y,z,w,h,d,kind}=p,{block:B,cylinder:C,beam}=k,steel=0x63736d,ochre=0xb1985b,dark=0x2e4140;
 if(kind==='excavator'){
  for(const side of [-1,1]){B(g,x+side*w*.34,y+h*.14,z,w*.29,h*.28,d*.78,0x35423d,'rubber');if(detail)for(let j=0;j<9;j++)B(g,x+side*w*.34,y+h*.285,z-d*.35+j*d*.70/8,w*.30,.055,d*.035,0x58645b,'metal');for(const zz of [-d*.31,0,d*.31]){const m=C(g,x+side*w*.49,y+h*.15,z+zz,h*.12,.035,0x6d7966,10,'metal');m.rotation.z=Math.PI/2;}}
  C(g,x,y+h*.32,z,w*.33,h*.12,steel,12,'metal');B(g,x,y+h*.44,z,w*.90,h*.23,d*.66,ochre,'paint');
  prism(g,[[h*.53,-d*.22],[h*.88,-d*.20],[h*.88,d*.08],[h*.53,d*.15]],w*.42,0x73857a,'paint',x-w*.22,y,z);
  B(g,x-w*.22,y+h*.73,z-d*.208,w*.34,h*.22,.025,0x2b4851,'metal');B(g,x-w*.445,y+h*.73,z-d*.06,.025,h*.21,d*.21,0x2b4851,'metal');
  const a=[x+w*.25,y+h*.48,z-d*.1],b=[x+w*.31,y+h*.98,z-d*.28],c=[x+w*.35,y+h*.25,z-d*.48];beam(g,a,b,w*.06,ochre,'paint');beam(g,b,c,w*.045,0xa28a50,'paint');beam(g,[a[0]+.08,a[1]-.05,a[2]],[b[0]+.08,b[1]-.18,b[2]],.045,0xa0aaa0,'metal');
  prism(g,[[h*.10,-d*.51],[h*.25,-d*.51],[h*.21,-d*.35],[h*.09,-d*.39]],w*.29,dark,'metal',x+w*.35,y,z);
 }else if(kind==='drill'){
  for(const side of [-1,1]){beam(g,[x+side*w*.43,y,z],[x+side*w*.13,y+h*.96,z],w*.055,ochre,'paint');B(g,x+side*w*.43,y+h*.035,z,w*.18,h*.07,d*.65,dark,'metal');}
  B(g,x,y+h*.87,z,w*.60,h*.16,d*.36,steel,'metal');C(g,x,y+h*.45,z,w*.09,h*.78,steel,10,'metal');
  for(let j=0;j<(detail?8:4);j++){const m=k.cone(g,x,y+h*(.13+j*.075),z,w*.14,h*.055,0x96a198,.66,'metal');m.rotation.z=.06;}
  k.cone(g,x,y+h*.07,z,w*.10,h*.16,dark,0,'metal').rotation.z=Math.PI;
 }else if(kind==='waterwheel'){
  const r=Math.min(h*.46,d*.50),cy=y+h*.50;for(const side of [-1,1])ring(g,k,x+side*w*.33,cy,z,r,.07,0x796348,'x','wood');
  const axle=C(g,x,cy,z,r*.11,w*1.05,steel,10,'metal');axle.rotation.z=Math.PI/2;
  for(let j=0;j<(detail?12:8);j++){const n=detail?12:8,a=j*Math.PI*2/n,yy=cy+Math.cos(a)*r,zz=z+Math.sin(a)*r;for(const side of [-1,1])beam(g,[x+side*w*.33,cy,z],[x+side*w*.33,yy,zz],.055,0x9d8257,'wood');const paddle=B(g,x,yy,zz,w*.78,r*.13,r*.24,0xa18b64,'wood');paddle.rotation.x=a;}
 }else if(kind==='telescope'){
  for(let j=0;j<3;j++){const a=j*Math.PI*2/3;beam(g,[x+Math.cos(a)*w*.43,y,z+Math.sin(a)*d*.43],[x,y+h*.50,z],.055,steel,'metal');}
  C(g,x,y+h*.55,z,w*.17,h*.30,dark,12,'metal');const tube=C(g,x,y+h*.79,z,w*.27,d*.86,0xb4baaa,detail?16:10,'paint');tube.rotation.x=.85;
  const axis=new T.Vector3(0,1,0).applyEuler(tube.rotation),center=new T.Vector3(x,y+h*.79,z);for(const side of [-1,1]){const at=center.clone().addScaledVector(axis,d*.43*side),rim=C(g,at.x,at.y,at.z,w*.29,.06,dark,12,'metal');rim.quaternion.copy(tube.quaternion);}
  const at=center.clone().addScaledVector(axis,-d*.434),lens=C(g,at.x,at.y,at.z,w*.235,.014,0x203f49,16,'metal');lens.quaternion.copy(tube.quaternion);
 }else if(kind==='radio'){
  for(const side of [-1,1])beam(g,[x+side*w*.45,y,z],[x,y+h,z],.045,steel,'metal');const tiers=Math.min(detail?15:6,Math.ceil(h/1.7));
  for(let j=0;j<tiers;j++){const lo=j/tiers,hi=(j+1)/tiers,wide=w*.45*(1-lo),narrow=w*.45*(1-hi);beam(g,[x-wide,y+h*lo,z],[x+narrow,y+h*hi,z],.022,0x8b9787,'metal');}
  for(const side of [-1,1]){B(g,x+side*w*.36,y+h*.78,z,w*.11,h*.14,.13,0xc0c6b0,'paint');beam(g,[x,y+h*.77,z],[x+side*w*.36,y+h*.77,z],.025,steel,'metal');}
  const dish=k.cone(g,x,y+h*.67,z-d*.18,w*.31,h*.09,0xb6c2b0,.25,'metal');dish.rotation.x=.8;C(g,x,y+h*1.005,z,.06,.08,0xb66b47,8,'paint');
 }else if(['crane','gantry','headframe'].includes(kind)){
  const crane=kind==='crane',spread=crane?0:kind==='gantry'?9:4,span=crane?Math.max(w,13):spread*2+8;
  for(const side of crane?[0]:[-1,1]){const xx=x+side*spread,n=detail?Math.ceil(h/2.5):Math.min(6,Math.ceil(h/2.5));for(const zz of [-.36,.36])beam(g,[xx,y,z+zz],[xx,y+h,z+zz],.09,ochre,'paint');for(let j=0;j<n;j++){beam(g,[xx,y+j*h/n,z-.36],[xx,y+(j+1)*h/n,z+.36],.044,steel,'metal');}B(g,xx,y+.14,z,1.4,.28,1.5,0x717e6f,'stone');}
  B(g,x+(crane?span*.25:0),y+h,z,span,.34,1.15,ochre,'paint');for(const zz of [-.5,.5])beam(g,[x-span*.24,y+h+.60,z+zz],[x+span*(crane?.74:.5),y+h+.60,z+zz],.05,ochre,'paint');
  const hookX=x+(crane?span*.68:2);beam(g,[hookX,y+h,z],[hookX,y+h*.20,z],.022,dark,'metal');ring(g,k,hookX,y+h*.18,z,.23,.045,steel,'z');
  B(g,x-(crane?span*.16:spread),y+h-.55,z,1.8,1.4,1.6,0x496060,'paint');B(g,x-(crane?span*.16:spread),y+h-.44,z+.81,1.5,.75,.02,0x2c4650,'metal');
 }else if(kind==='wreck'){
  prism(g,[[0,-d*.4],[h*.34,-d*.5],[h*.75,-d*.14],[h*.62,d*.31],[h*.24,d*.48],[0,d*.37]],w*.61,0x596b65,'paint',x,y,z);
  const wing=B(g,x+w*.18,y+h*.19,z,w*.81,.10,d*.63,0x748278,'metal');wing.rotation.z=.09;const tail=B(g,x-w*.25,y+h*.70,z+d*.28,w*.13,h*.57,.09,0x7a8171,'paint');tail.rotation.x=-.2;
  for(const side of [-1,1]){const nacelle=C(g,x+side*w*.24,y+h*.29,z-d*.25,h*.23,d*.58,dark,12,'metal');nacelle.rotation.x=Math.PI/2;ring(g,k,x+side*w*.24,y+h*.29,z-d*.55,h*.23,.04,0x8c9587,'z');}
  if(detail)for(let j=0;j<5;j++)B(g,x-w*.15+j*w*.065,y+h*.54,z-d*.27,.04,h*.16,.035,0x283c3e,'rubber');
 }else if(kind==='tent'||kind==='medical-tent'){
  const medic=kind==='medical-tent',cloth=medic?0x9caa90:0x707958;
  const out={p:[],uv:[]};quad(out,[-w*.5,0,-d*.5],[-w*.5,0,d*.5],[0,h,d*.5],[0,h,-d*.5]);quad(out,[0,h,-d*.5],[0,h,d*.5],[w*.5,0,d*.5],[w*.5,0,-d*.5]);mesh(g,shared('tent:'+w+':'+h+':'+d,()=>geometry(out.p,out.uv)),cloth,'fabric',x,y,z);
  for(const zz of [-d*.5,d*.5]){for(const side of [-1,1])beam(g,[x+side*w*.5,y,z+zz],[x,y+h,z+zz],.035,steel,'metal');B(g,x,y+h*.25,z+zz,w*.30,h*.50,.025,0x4a5749,'fabric');}
  if(detail)for(const zz of [-d*.38,0,d*.38])for(const side of [-1,1])beam(g,[x+side*w*.25,y+h*.52,z+zz],[x+side*w*.57,y+.02,z+zz],.009,0xb7b99c,'fabric');
  if(medic)for(const side of [-1,1]){const a=B(g,x+side*w*.28,y+h*.47,z,w*.16,.03,d*.20,0xe3ddbd,'fabric');a.rotation.z=side*Math.atan2(h,w*.5);const b=B(g,x+side*w*.28,y+h*.47,z,w*.055,.04,d*.50,0xe3ddbd,'fabric');b.rotation.z=a.rotation.z;}
 }else return false;return true;
}
function landmarkEquipment(g,p,k,detail){
 const {x,y,z,w,h,d,kind}=p,{block:B,cylinder:C,beam}=k,steel=0x657b73,dark=0x304b4c;
 if(kind==='dome'||kind==='bio-dome'){
  const bio=kind==='bio-dome',radius=Math.min(w,d)*.49,domeH=bio?h:h*.72;
  const shell=shared('observatory-shell:'+detail+':'+bio,()=>new T.SphereGeometry(1,detail?20:12,detail?8:5,0,bio?Math.PI*2:Math.PI*1.72,0,Math.PI/2));
  mesh(g,shell,bio?0x5c8d82:0xabbab0,bio?'metal':'paint',x,y,z,w*.49,domeH,d*.49);
  ring(g,k,x,y+.035,z,radius,.06,0x8b9f8b,'y','metal');
  const sections=detail?8:4;for(let i=0;i<sections;i++){const a=i*Math.PI*2/sections;if(!bio&&a>Math.PI*1.7)continue;for(let j=0;j<4;j++){const ta=j*Math.PI/8,tb=(j+1)*Math.PI/8;beam(g,[x+Math.cos(a)*Math.cos(ta)*w*.495,y+Math.sin(ta)*domeH,z+Math.sin(a)*Math.cos(ta)*d*.495],[x+Math.cos(a)*Math.cos(tb)*w*.495,y+Math.sin(tb)*domeH,z+Math.sin(a)*Math.cos(tb)*d*.495],.025,0xa9bda7,'metal');}}
  if(!bio){const tube=C(g,x,y+h*.49,z,radius*.16,h*.68,0x576f69,12,'metal');tube.rotation.x=.95;C(g,x,y+h*.17,z,radius*.19,h*.34,steel,12,'metal');}
  else C(g,x,y+h*.97,z,radius*.13,h*.08,0xb7c6a6,12,'paint');
 }else if(kind==='beacon'){
  const r=Math.min(w,d)*.40,deck=h*.68;C(g,x,y+deck*.48,z,r*.30,deck*.96,0x6d867f,12,'metal');C(g,x,y+deck,z,r,.09,0x85958b,16,'metal');
  for(let i=0;i<6;i++){const a=i*Math.PI/3;beam(g,[x+Math.cos(a)*r*.88,y+deck,z+Math.sin(a)*r*.88],[x+Math.cos(a)*r*.88,y+h*.91,z+Math.sin(a)*r*.88],.025,0xb9ba98,'metal');}
  C(g,x,y+h*.80,z,r*.47,h*.19,0xcbbf8b,10,'paint');k.cone(g,x,y+h*.95,z,r*1.12,h*.13,dark,0,'metal');
  if(detail){for(const side of [-1,1])beam(g,[x+side*r*.26,y+.2,z+r*.35],[x+side*r*.26,y+deck,z+r*.35],.018,0x425f5b,'metal');for(let j=0;j<6;j++)B(g,x,y+deck*(j+1)/7,z+r*.35,r*.56,.035,.04,0x738a7c,'metal');}
 }else if(kind==='clock'){
  B(g,x,y+h*.42,z,w,h*.84,d,0xb7a48a,'stone');for(const yy of [.05,.64,.84])B(g,x,y+h*yy,z,w*1.05,.13,d*1.05,0x8a8b7b,'stone');k.cone(g,x,y+h*.93,z,w*.72,h*.20,dark,0,'metal');
  for(const side of [-1,1]){const r=Math.min(w*.36,h*.06),zz=z+side*(d*.5+.04),face=C(g,x,y+h*.73,zz,r,.045,0xd4caaa,20,'paint');face.rotation.x=Math.PI/2;ring(g,k,x,y+h*.73,zz+side*.035,r,.045,0x5c766c,'z');
   if(detail)for(let j=0;j<12;j++){const a=j*Math.PI/6,m=B(g,x+Math.sin(a)*r*.82,y+h*.73+Math.cos(a)*r*.82,zz+side*.061,.035,r*.14,.018,dark,'metal');m.rotation.z=-a;}
   B(g,x,y+h*.73+r*.25,zz+side*.074,.045,r*.55,.025,dark,'metal');B(g,x+r*.19,y+h*.73,zz+side*.077,r*.45,.045,.025,dark,'metal');
  }
 }else if(kind==='watchtower'||kind==='water-tower'){
  const water=kind==='water-tower',top=h*(water?.76:.80),wood=0x7a6b50;
  for(const sx of [-1,1])for(const sz of [-1,1])beam(g,[x+sx*w*.45,y,z+sz*d*.45],[x+sx*w*.31,y+top,z+sz*d*.31],.10,steel,'metal');
  const tiers=detail?4:2;for(let j=0;j<tiers;j++)for(const side of [-1,1]){const lo=top*j/tiers,hi=top*(j+1)/tiers;beam(g,[x-w*.40,y+lo,z+side*d*.40],[x+w*.33,y+hi,z+side*d*.33],.038,0x52675c,'metal');}
  if(water){lathe(g,'water-tower',[[0,0],[.82,0],[1,.07],[1,.82],[.9,.94],[0,1]],0x99aaa0,'metal',x,y+top,z,Math.min(w,d)*.61,h*.24,detail?20:12);for(const yy of [.80,.95])C(g,x,y+h*yy,z,Math.min(w,d)*.615,.055,0xb3bba4,16,'metal');}
  else{B(g,x,y+top,z,w*1.22,.16,d*1.22,wood,'wood');B(g,x,y+h*.88,z,w,h*.15,d,0x6e7c67,'wood');for(const side of [-1,1]){B(g,x,y+h*.89,z+side*(d*.5+.02),w*.81,h*.065,.025,0x4c7271,'metal');B(g,x+side*(w*.5+.02),y+h*.89,z,.025,h*.065,d*.72,0x4c7271,'metal');}B(g,x,y+h*.975,z,w*1.23,.15,d*1.23,dark,'metal');}
  if(detail){for(const side of [-1,1])beam(g,[x+side*.20,y+.1,z-d*.38],[x+side*.20,y+top,z-d*.38],.018,dark,'metal');for(let j=0;j<Math.ceil(top/.45);j++)B(g,x,y+.20+j*.45,z-d*.38,.44,.025,.04,0x9aab93,'metal');}
 }else return false;return true;
}
export function detailEnvironmentProp(g,input,raw,detail=true){
 if(!kinds.has(input.kind))return false;
 const p={...input,x:Number(input.x)||0,y:Number(input.y)||0,z:Number(input.z)||0,w:Math.max(.05,Number(input.w)||2),h:Math.max(.05,Number(input.h)||1.4),d:Math.max(.05,Number(input.d)||1.5),seed:Number(input.seed)||0},k=environmentKit(raw),start=g.children.length;
 if(!foliageProp(g,p,k,detail)){
  if(p.kind==='crate')crate(g,p,k,detail);
  else if(p.kind==='barrels'||p.kind==='shield-barrel')barrel(g,p,k,detail,p.kind==='shield-barrel');
  else if(p.kind==='car'||p.kind==='truck')vehicle(g,p,k,detail);
  else if(p.kind==='container')container(g,p,k,detail);
  else if(!street(g,p,k,detail)&&!equipment(g,p,k,detail)&&!furniture(g,p,k,detail)&&!industrial(g,p,k,detail)&&!landmarkEquipment(g,p,k,detail))return false;
 }
 for(let i=start;i<g.children.length;i++){g.children[i].userData.environmentProp=p.kind;g.children[i].userData.environmentRevision=159;}
 return true;
}
