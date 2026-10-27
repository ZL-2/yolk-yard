import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {modelEnvironment} from './model-surfaces.js';

// Native game geometry, shared between the game and approval viewer. Static
// pieces are batched by material. Animated pieces keep their own pivots; no
// geometry or particle allocations occur in the animation loop.
const templates=new Map(),textures=new Map(),bindings=new WeakMap(),batchMaterials=new Map();
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const material=(color,roughness=.5,metalness=0,extra={})=>{
  const m=new THREE.MeshStandardMaterial({color,roughness,metalness,envMap:modelEnvironment(),envMapIntensity:.72,...extra});m.userData.shared=true;return m;
};
function mesh(group,geometry,mat,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1]){
  const m=new THREE.Mesh(geometry,mat);m.position.set(...position);m.rotation.set(...rotation);m.scale.set(...scale);m.castShadow=m.receiveShadow=true;m.userData.keepDynamic=true;group.add(m);return m;
}
const rounded=(g,m,p,s,r=.015)=>mesh(g,new RoundedBoxGeometry(...s,3,r),m,p);
function line(g,m,a,b,r=.008,segments=8){
  const d=V(...b).sub(V(...a)),o=mesh(g,new THREE.CylinderGeometry(r,r,d.length(),segments),m,V(...a).add(V(...b)).multiplyScalar(.5).toArray());
  o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o;
}
const ball=(g,m,p,s)=>mesh(g,new THREE.SphereGeometry(1,18,12),m,p,[0,0,0],s);
function curve(g,m,points,r=.006,segments=32){return mesh(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>V(...p))),segments,r,6,false),m);}
const ring=(g,m,r,t,p,rot=[0,0,0])=>mesh(g,new THREE.TorusGeometry(r,t,6,36),m,p,rot);
function batch(g){
  for(const c of g.children)if(c.isGroup)batch(c);
  g.updateMatrix();const groups=new Map();
  for(const m of [...g.children])if(m.isMesh&&!m.userData.animated){
    m.updateMatrix();const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrix);
    let target=m.material;const family=target.userData.batchFamily;
    if(family){
      if(!batchMaterials.has(family)){const shared=target.clone();shared.color.set('#ffffff');shared.vertexColors=true;shared.userData={shared:true};batchMaterials.set(family,shared);}
      target=batchMaterials.get(family);const count=geo.attributes.position.count,colors=new Float32Array(count*3),c=m.material.color;for(let n=0;n<count;n++){colors[n*3]=c.r;colors[n*3+1]=c.g;colors[n*3+2]=c.b;}geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    }
    if(!groups.has(target))groups.set(target,[]);groups.get(target).push(geo);m.geometry.dispose();g.remove(m);
  }
  for(const [mat,geos]of groups){const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());geo.computeBoundingSphere();geo.userData.shared=true;mesh(g,geo,mat);}
  return g;
}
function engraving(text,sub='',color='#e0e7df',background='#293936'){
  const key=[text,sub,color,background].join('|');if(textures.has(key))return textures.get(key);
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
  ctx.fillStyle=background;ctx.fillRect(0,0,512,256);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(16,16,480,224);
  ctx.textAlign='center';ctx.fillStyle=color;ctx.font='600 112px Georgia';ctx.fillText(text,256,143);
  ctx.font='500 24px sans-serif';ctx.fillText(sub,256,203);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.userData.shared=true;t.anisotropy=4;textures.set(key,t);return t;
}
function label(g,text,sub,w,h,p,rotation=[0,0,0],color,bg){
  const m=material('#ffffff',.42,.35,{map:engraving(text,sub,color,bg)});return mesh(g,new THREE.PlaneGeometry(w,h),m,p,rotation);
}
function surfaceTexture(kind){
  if(textures.has(kind))return textures.get(kind);
  const n=128,data=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const k=(y*n+x)*4,v=kind==='cloth'?185+((x%4===0||y%4===0)?-16:10)+((x*17+y*13)%11):200+Math.sin(y*2.2)*14+((x*11+y*3)%13);
    data[k]=data[k+1]=data[k+2]=v;data[k+3]=255;
  }
  const t=new THREE.DataTexture(data,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='cloth'?12:2,kind==='cloth'?12:2);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.needsUpdate=true;t.userData.shared=true;textures.set(kind,t);return t;
}

function wedge(){
  const g=new THREE.Group();g.name='Sixty Degrees';
  const chrome=material('#c5d4d5',.22,.95),brushed=material('#a5b7bc',.38,.88,{roughnessMap:surfaceTexture('brushed')}),dark=material('#15312d',.83),lime=material('#d8f7a0',.4,.1),groove=material('#435556',.55,.6);
  // Tapered rubber grip with diagonal physical wrap, inset heel, end-cap seal.
  mesh(g,new THREE.CylinderGeometry(.025,.033,.56,24),dark,[0,-.31,0]);
  for(let n=0;n<17;n++)ring(g,n===0||n===16?lime:groove,.029-n*.00028,n===0||n===16?.0025:.0012,[0,-.57+n*.031,0],[Math.PI/2,0,.1]);
  for(let n=0;n<8;n++){const a=n*Math.PI/4;line(g,lime,[Math.sin(a)*.029,-.48,Math.cos(a)*.029],[Math.sin(a)*.026,-.18,Math.cos(a)*.026],.0007,4);}
  mesh(g,new THREE.CylinderGeometry(.033,.033,.012,24),chrome,[0,-.596,0]);
  mesh(g,new THREE.CylinderGeometry(.021,.026,.045,24),chrome,[0,-.012,0]);
  for(let n=0;n<12;n++){
    const y=.045+n*.067,r=.0123-n*.00022;
    mesh(g,new THREE.CylinderGeometry(r-.0002,r,.068,16),n%3?chrome:brushed,[0,y,0]);
    ring(g,chrome,r+.0006,.0009,[0,y+.031,0],[Math.PI/2,0,0]);
  }
  // Forged neck curves into the heel. The striking surface is physically lofted
  // sixty degrees from vertical, not a generic axe blade with a club label.
  curve(g,chrome,[[0,.81,0],[.012,.88,0],[.035,.925,.015],[.067,.95,.022]],.016,16);
  mesh(g,new THREE.CylinderGeometry(.018,.019,.07,20),dark,[0,.813,0]);
  ring(g,lime,.018,.002,[0,.793,0],[Math.PI/2,0,0]);
  const head=new THREE.Group();head.name='forged-60-degree-head';head.position.set(.065,.945,.02);head.rotation.x=-Math.PI/3;g.add(head);
  const outline=new THREE.Shape();outline.moveTo(-.052,-.075);outline.quadraticCurveTo(.08,-.11,.24,-.071);outline.quadraticCurveTo(.285,-.047,.273,.056);outline.quadraticCurveTo(.26,.135,.19,.15);outline.quadraticCurveTo(.07,.133,-.036,.056);outline.quadraticCurveTo(-.055,.025,-.052,-.075);
  const body=new THREE.ExtrudeGeometry(outline,{depth:.045,bevelEnabled:true,bevelThickness:.009,bevelSize:.012,bevelSegments:4,steps:1,curveSegments:20});body.translate(0,0,-.035);mesh(head,body,brushed);
  const face=new THREE.ShapeGeometry(outline,20);mesh(head,face,chrome,[0,0,.021]);
  for(let n=0;n<10;n++){
    const y=-.055+n*.017,x0=.006+Math.max(0,y)*.55,x1=.247-Math.max(0,y-.065)*.42;
    line(head,groove,[x0,y,.0225],[x1,y,.0225],.00135,4);
  }
  curve(head,chrome,[[-.045,-.077,.014],[.07,-.093,.014],[.19,-.085,.014],[.258,-.056,.014]],.009,24);
  rounded(head,dark,[.11,.015,-.049],[.183,.091,.008],.012);
  label(head,'60°','LOB / FORGED',.161,.079,[.11,.014,-.055],[0,Math.PI,0],'#e6f2e2','#1f3432');
  for(const x of [.04,.18])mesh(head,new THREE.CylinderGeometry(.007,.007,.004,8),chrome,[x,-.036,-.048],[Math.PI/2,0,0]);
  g.userData.iconKind='pickaxe';g.userData.loftDegrees=60;g.userData.gripY=[-.11,-.37];return batch(g);
}

export function watermelonWrapTexture(){
  if(textures.has('watermelon'))return textures.get('watermelon');
  const n=512,data=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=(x+y*.38)%256,v=y%256,dx=u-128,dy=v-127,r=Math.hypot(dx,dy);let c=[243,240,222];
    if((x+y*.38)%256<16)c=[21,80,50];
    if(r<90&&dy> -32)c=r>79?[24,94,56]:r>69?[167,207,104]:r>65?[244,233,189]:[236+Math.round(Math.sin(x*.15+y*.11)*6),65,91];
    if(r<63&&dy> -25){const sx=(u+11)%30-15,sy=(v+5)%31-15;if(sx*sx/7+sy*sy/28<1)c=[29,49,39];}
    if((x*29+y*31)%227===0)c=c.map(v=>v*.94);
    const k=(y*n+x)*4;data.set([...c,255],k);
  }
  let t;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=n;const ctx=canvas.getContext('2d');ctx.putImageData(new ImageData(new Uint8ClampedArray(data),n,n),0,0);
    // Repeated can-lid graphics retain the requested brand at game scale.
    for(const [x,y]of [[128,128],[384,384]]){
      ctx.save();ctx.translate(x,y);ctx.fillStyle='#f7f4e9';ctx.strokeStyle='#252923';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,104,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#db3557';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,0,93,0,Math.PI*2);ctx.stroke();
      ctx.textAlign='center';ctx.fillStyle='#20231f';ctx.font='900 57px Arial Black, sans-serif';ctx.fillText('CUBA',0,5);
      ctx.fillStyle='#b32646';ctx.font='bold 19px sans-serif';ctx.fillText('WATERMELON',0,35);
      ctx.fillStyle='#314c31';ctx.font='bold 12px sans-serif';ctx.fillText('WHITE',0,-47);ctx.restore();
    }
    t=new THREE.CanvasTexture(canvas);
  }else t=new THREE.DataTexture(data,n,n);
  t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1.5,1);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;t.userData.shared=true;t.needsUpdate=true;textures.set('watermelon',t);return t;
}
export function applyWatermelonWrap(g){
  const map=watermelonWrapTexture();let index=0;g.updateMatrixWorld(true);const inverse=g.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),position=V(),normal=V(),normalMatrix=new THREE.Matrix3();
  g.traverse(m=>{
    if(!m.isMesh||!m.material?.color||m.material.transparent||m===g.userData.lens)return;
    const old=m.material,mat=old.clone();
    // Alternate cream/red/green trim makes the print read across the receiver,
    // stock and magazine while leaving sight glass and transparent FX intact.
    const trim=(index++%6===0);mat.map=trim?null:map;mat.color.set(trim?(index%2?'#1e503b':'#e8516b'):'#ffffff');mat.metalness=.25;mat.roughness=.42;mat.emissiveIntensity=0;
    mat.userData={...mat.userData,shared:false};m.material=mat;m.userData.ownedMaterial=true;
    if(!trim){
      // Metric box projection keeps melon slices the same size across long,
      // narrow and curved parts. It never changes a shared weapon template.
      const geo=m.geometry.clone();geo.userData={...geo.userData,shared:false};const p=geo.attributes.position,n=geo.attributes.normal,uv=new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2);matrix.multiplyMatrices(inverse,m.matrixWorld);normalMatrix.getNormalMatrix(matrix);
      for(let k=0;k<p.count;k++){position.fromBufferAttribute(p,k).applyMatrix4(matrix);normal.fromBufferAttribute(n,k).applyNormalMatrix(normalMatrix);const ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z);let u,v;if(ax>=ay&&ax>=az){u=position.z*(normal.x>0?-1:1);v=position.y;}else if(ay>=az){u=position.z;v=position.x;}else{u=position.x*(normal.z>0?1:-1);v=position.y;}uv.setXY(k,u*3.3,v*3.3);}
      geo.setAttribute('uv',uv);m.geometry=geo;m.userData.ownedGeometry=true;
      // Atlas UVs no longer apply once the paint pattern has its own mapping.
      mat.normalMap=null;mat.roughnessMap=null;mat.metalnessMap=null;
    }
  });g.userData.iconKind='wrap';return g;
}

function crownRusseLabel(neck=false){
  const key=neck?'crown-russe-neck':'crown-russe-label';if(textures.has(key))return textures.get(key);
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=512;c.height=neck?512:768;const ctx=c.getContext('2d'),red='#d92e26';
  ctx.fillStyle=neck?red:'#f6f5e8';ctx.fillRect(0,0,c.width,c.height);ctx.textAlign='center';
  const crown=(x,y,k,color)=>{ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-44,14);ctx.lineTo(-57,-27);ctx.lineTo(-24,-8);ctx.lineTo(0,-42);ctx.lineTo(24,-8);ctx.lineTo(57,-27);ctx.lineTo(44,14);ctx.closePath();ctx.fill();ctx.fillRect(-43,21,86,10);for(const [x,y]of [[-57,-32],[0,-48],[57,-32]]){ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();}ctx.restore();};
  if(neck){ctx.fillStyle='#fff6e5';ctx.font='bold 61px Georgia';ctx.fillText('CROWN',256,122);crown(256,255,1.15,'#fff6e5');ctx.fillText('RUSSE',256,400);}
  else{
    ctx.strokeStyle='#d5d2bf';ctx.lineWidth=4;ctx.strokeRect(10,10,492,748);
    ctx.save();ctx.beginPath();ctx.rect(24,24,464,720);ctx.clip();ctx.strokeStyle=red;ctx.lineWidth=100;ctx.beginPath();ctx.moveTo(-20,75);ctx.lineTo(530,665);ctx.stroke();ctx.restore();
    ctx.fillStyle='#68685e';ctx.font='22px Georgia';ctx.fillText('FINEST VODKA MADE',256,49);
    ctx.fillStyle='#f6f5e8';ctx.beginPath();ctx.arc(256,367,190,0,Math.PI*2);ctx.fill();ctx.fillStyle=red;ctx.beginPath();ctx.arc(256,367,177,0,Math.PI*2);ctx.fill();
    crown(256,156,.82,red);ctx.fillStyle='#fff8e5';ctx.font='bold 65px Georgia';ctx.fillText('CROWN',256,342);ctx.fillText('RUSSE',256,415);ctx.font='35px Georgia';ctx.fillText('VODKA',256,480);
    ctx.fillStyle='#737369';ctx.font='21px Georgia';ctx.fillText('DISTILLED FROM GRAIN',256,625);ctx.fillText('40% ALC/VOL · 80 PROOF',256,660);ctx.font='26px Georgia';ctx.fillText('CROWN RUSSE',256,711);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.userData.shared=true;textures.set(key,t);return t;
}
function bottle(){
  const g=new THREE.Group();g.name='Crown Russe Vodka';g.userData.iconKind='backbling';
  const glass=material('#edf5ee',.085,.08,{envMapIntensity:1.3,transparent:true,opacity:.22,depthWrite:false}),edge=material('#dce9df',.16,.32),dark=material('#282b28',.86),silver=material('#aeb9b6',.3,.85),leather=material('#434c42',.91),stitch=material('#b8bba7',.85),liquid=material('#e4eee3',.12,.05,{transparent:true,opacity:.15,depthWrite:false}),red=material('#d92e26',.42,.12);
  // Reference silhouette: straight clear body, rounded shoulders, long neck and red screw cap.
  const profile=[[0,-.285],[.073,-.285],[.099,-.282],[.108,-.269],[.111,-.245],[.111,.012],[.108,.039],[.098,.061],[.081,.079],[.057,.093],[.043,.105],[.038,.122],[.036,.234],[.038,.253],[0,.253]];
  mesh(g,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),64),glass,[0,0,.055]);
  for(const y of [-.273,-.264])ring(g,edge,.103,.0025,[0,y,.055],[Math.PI/2,0,0]);
  for(const y of [.131,.247,.258])ring(g,edge,.037,.002,[0,y,.055],[Math.PI/2,0,0]);
  mesh(g,new THREE.CylinderGeometry(.04,.04,.058,48),red,[0,.294,.055]);
  ring(g,red,.04,.0015,[0,.266,.055],[Math.PI/2,0,0]);
  for(let n=0;n<48;n++){const a=n*Math.PI*2/48;line(g,red,[Math.sin(a)*.0403,.27,.055+Math.cos(a)*.0403],[Math.sin(a)*.0403,.318,.055+Math.cos(a)*.0403],.00045,4);}
  const frontLabel=material('#ffffff',.78,0,{map:crownRusseLabel()}),neckLabel=material('#ffffff',.64,0,{map:crownRusseLabel(true)});
  mesh(g,new THREE.CylinderGeometry(.112,.112,.247,48,1,true,-.91,1.82),frontLabel,[0,-.119,.055]);
  mesh(g,new THREE.CylinderGeometry(.0375,.0405,.104,40,1,true,-1.3,2.6),neckLabel,[0,.19,.055]);
  // Narrow side straps and a rear plate keep the front label unobstructed.
  rounded(g,dark,[0,-.087,-.076],[.18,.31,.025],.018);
  for(const side of [-1,1]){
    rounded(g,leather,[side*.109,-.108,.052],[.022,.335,.031],.007);
    for(let n=0;n<13;n++)line(g,stitch,[side*.109,-.261+n*.024,.069],[side*.109,-.253+n*.024,.069],.0007,4);
    rounded(g,silver,[side*.109,.026,.075],[.032,.044,.009],.004);rounded(g,dark,[side*.109,.026,.081],[.019,.029,.005],.002);
    curve(g,leather,[[side*.108,-.25,.054],[side*.086,-.294,.05],[side*.08,-.28,-.064],[side*.08,.04,-.064]],.009,20);
  }
  const fluid=new THREE.Group();fluid.name='icon-liquid';fluid.position.set(0,.031,.055);g.add(fluid);
  mesh(g,new THREE.LatheGeometry([[0,-.272],[.086,-.272],[.102,-.25],[.103,.031],[0,.031]].map(([r,y])=>new THREE.Vector2(r,y)),48),liquid,[0,0,.055]);
  mesh(fluid,new THREE.CylinderGeometry(.102,.102,.004,48),liquid);
  ring(fluid,edge,.102,.001,[0,.002,0],[Math.PI/2,0,0]);
  for(let n=0;n<5;n++){const drop=ball(fluid,glass,[Math.sin(n*2.4)*.073,.007+(n%3)*.006,Math.cos(n*2.4)*.073],[.0015,.002,.0015]);drop.name='bubble-'+n;}
  return batch(g);
}

const quiltX=(x,z)=>x*(.91-.12*Math.sin(z*.85));
function quiltGeometry(x0,x1,z0,z1,top){
  const nx=8,nz=12,p=[],uv=[],idx=[];
  for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
    const u=ix/nx,v=iz/nz,z=z0+(z1-z0)*v,x=quiltX(x0+(x1-x0)*u,z);
    const puff=Math.pow(Math.sin(Math.PI*v),.6)*(.035+.075*Math.sin(Math.PI*u));
    const arch=.14*Math.cos(z*1.1)-Math.abs(x)*.055;
    p.push(x,arch+(top?puff:-.04),z);uv.push(u,v);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;idx.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}
function sleepingBag(){
  const g=new THREE.Group();g.name='Bedtime Flight';g.userData.iconKind='glider';
  const textile=color=>{const m=material(color,.94,0,{side:THREE.DoubleSide,bumpMap:surfaceTexture('cloth'),bumpScale:.007});m.userData.batchFamily='icon-quilt';return m;};
  const cloth=textile('#205954'),alt=textile('#24615c'),lining=textile('#dabd85'),seam=textile('#7eaa94'),zip=material('#beab7b',.44,.6),nylon=textile('#112d2b'),cord=textile('#e6d9b6');
  const canopy=new THREE.Group();canopy.name='icon-canopy';canopy.position.y=3.0;g.add(canopy);
  for(const side of [-1,1]){
    const wing=new THREE.Group();wing.name='icon-wing-'+(side===1?'right':'left');canopy.add(wing);
    for(let j=0;j<10;j++){
      const z0=-1.13+j*.226,z1=z0+.226,x0=side===1?.025:-1.86,x1=side===1?1.86:-.025;
      mesh(wing,quiltGeometry(x0,x1,z0,z1,true),j%3===0?alt:cloth);mesh(wing,quiltGeometry(x0,x1,z0,z1,false),lining);
      curve(wing,seam,[[quiltX(x0,z0),.14*Math.cos(z0*1.1)-Math.abs(quiltX(x0,z0))*.055+.005,z0],[quiltX((x0+x1)/2,z0),.14*Math.cos(z0*1.1)-.05,z0],[quiltX(x1,z0),.14*Math.cos(z0*1.1)-Math.abs(quiltX(x1,z0))*.055+.005,z0]],.005,14);
    }
    for(const z of [-1.13,1.13])curve(wing,nylon,[[quiltX(side*.02,z),.14*Math.cos(z*1.1),z],[quiltX(side*.9,z),.14*Math.cos(z*1.1)-.05,z],[quiltX(side*1.86,z),.14*Math.cos(z*1.1)-Math.abs(quiltX(side*1.86,z))*.055,z]],.019,20);
    curve(wing,nylon,[[quiltX(side*1.86,-1.13),-.06,-1.13],[quiltX(side*1.86,0),.048,0],[quiltX(side*1.86,1.13),-.06,1.13]],.019,32);
    for(let n=0;n<56;n++){const z=-1.10+n*.04;mesh(wing,new THREE.BoxGeometry(.021,.014,.019),zip,[quiltX(side*1.84,z),.14*Math.cos(z*1.1)-.09,z]);}
    const strap=new THREE.Group();strap.name='icon-tie-'+side;strap.position.set(quiltX(side*1.84,.94),-.04,.94);wing.add(strap);
    curve(strap,nylon,[[0,0,0],[side*.025,-.15,.09],[side*.09,-.29,.12],[side*.13,-.41,.23]],.018,20);
    rounded(strap,zip,[side*.09,-.31,.14],[.08,.065,.025],.01);
  }
  // Hood forms the bag's unmistakable pillow-shaped front. Two padded rings
  // frame a dark interior and a small cream pillow.
  const hood=new THREE.Group();hood.name='icon-hood';hood.position.set(0,.05,-1.07);canopy.add(hood);
  ball(hood,cloth,[0,.085,-.08],[.57,.19,.44]);
  ball(hood,nylon,[0,.235,.035],[.43,.045,.275]);
  const hoodR=ring(hood,cloth,.37,.057,[0,.24,.035],[Math.PI/2,0,0]);hoodR.scale.set(1.34,.83,1);
  ball(hood,lining,[0,.27,.09],[.34,.065,.20]);
  for(const side of [-1,1])curve(hood,cord,[[side*.41,.18,.08],[side*.45,.01,.18],[side*.41,-.20,.28]],.009,20);
  rounded(canopy,nylon,[0,.225,.37],[.34,.015,.22],.012);
  label(canopy,'Zz','FIELD REST',.27,.145,[0,.236,.37],[-Math.PI/2,0,0],'#edd7a7','#143a36');
  // Rounded foot-box and compression straps keep the sleeping-bag silhouette
  // identifiable even with the sides unzipped into wings.
  const foot=new THREE.Group();foot.name='icon-footbox';foot.position.set(0,.035,1.05);canopy.add(foot);
  ball(foot,cloth,[0,0,0],[.47,.14,.18]);
  for(const side of [-1,1]){const belt=ring(foot,nylon,.147,.018,[side*.25,0,0],[0,Math.PI/2,0]);belt.scale.x=1.2;rounded(foot,zip,[side*.25,.146,0],[.08,.015,.055],.006);}
  // Eight suspension lines converge at the game's existing hand anchors.
  const rig=new THREE.InstancedMesh(new THREE.CylinderGeometry(.007,.007,1,6),cord,8);rig.name='icon-cords';rig.userData.animated=true;rig.instanceMatrix.setUsage(THREE.DynamicDrawUsage);rig.frustumCulled=false;rig.geometry.userData.shared=true;g.add(rig);
  for(const side of [-1,1]){
    line(g,zip,[side*.33,1.94,-.14],[side*.33,1.94,.06],.019,12);
    line(g,nylon,[side*.33,1.94,-.13],[side*.33,1.94,.05],.025,12);
  }
  return batch(g);
}

function slime(){
  const g=new THREE.Group();g.name='White Goo';g.userData.iconKind='trail';
  const goo=material('#f8fffd',.19,.08,{envMapIntensity:1.25}),pearl=material('#d6e9f2',.26,.15);
  for(let strand=0;strand<4;strand++){
    const side=strand%2===0?-1:1,outer=strand<2,segments=56,rings=8,positions=[],uv=[],normals=[],indices=[];
    const startX=side*(outer?.55:.20),startY=outer?1.3:.12,length=outer?2.8:3.6;
    for(let j=0;j<=segments;j++)for(let k=0;k<=rings;k++){
      const u=j/segments,a=k/rings*Math.PI*2,r=(outer?.065:.045)*Math.pow(1-u,.58)+.001;
      positions.push(startX+side*u*.14+Math.cos(a)*r,startY+u*length,.24+Math.sin(a)*r);
      normals.push(Math.cos(a),0,Math.sin(a));uv.push(u,k/rings);
    }
    for(let j=0;j<segments;j++)for(let k=0;k<rings;k++){const a=j*(rings+1)+k;indices.push(a,a+1,a+rings+1,a+1,a+rings+2,a+rings+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeBoundingSphere();geo.boundingSphere.radius+=.35;geo.userData.shared=true;
    const m=mesh(g,geo,strand<2?goo:pearl);m.name='icon-slime-'+strand;m.userData.animated=true;m.userData.flowPhase=strand*1.7;
  }
  const drops=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),goo,28);drops.name='icon-droplets';drops.userData.animated=true;drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);drops.frustumCulled=false;drops.geometry.userData.shared=true;g.add(drops);
  return g;
}

const dummy=new THREE.Object3D(),rigStart=V(),rigEnd=V(),rigDirection=V(),up=V(0,1,0);
function bindAnimation(g){
  const binding={wings:[],ties:[],slime:[],canopy:null,hood:null,liquid:null,drops:null,cords:null};
  g.traverse(m=>{
    if(m.name.startsWith('icon-wing-'))binding.wings.push(m);
    if(m.name.startsWith('icon-tie-'))binding.ties.push(m);
    if(m.name==='icon-canopy')binding.canopy=m;
    if(m.name==='icon-hood')binding.hood=m;
    if(m.name==='icon-liquid')binding.liquid=m;
    if(m.name==='icon-droplets')binding.drops=m;
    if(m.name==='icon-cords')binding.cords=m;
    if(m.name.startsWith('icon-slime-')){
      const mat=m.material.clone(),time={value:0},phase=m.userData.flowPhase;
      mat.userData={shared:false};mat.onBeforeCompile=shader=>{
        shader.uniforms.iconFlowTime=time;
        shader.vertexShader='uniform float iconFlowTime;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          float u = uv.x;
          float phase = ${phase.toFixed(3)};
          float bend = u * u;
          transformed.x += sin(u * 12.0 - iconFlowTime * 5.2 + phase) * .12 * bend;
          transformed.z += cos(u * 15.0 - iconFlowTime * 4.1 + phase) * .10 * bend;
          transformed.y += sin(u * 20.0 - iconFlowTime * 7.0 + phase) * .028 * u;
          transformed += normal * sin(u * 30.0 - iconFlowTime * 9.0 + phase) * .008 * (1.0 - u);
        `);
      };
      mat.customProgramCacheKey=()=>`jim-slime-${phase}`;m.material=mat;m.userData.ownedMaterial=true;binding.slime.push(time);
    }
  });bindings.set(g,binding);return binding;
}
export function updateIconGear(g,time,{deploy=1,intensity=1}={}){
  if(!g?.userData.iconKind)return;
  const b=bindings.get(g)||bindAnimation(g),t=Number.isFinite(time)?time:0,d=THREE.MathUtils.clamp(Number.isFinite(deploy)?deploy:1,0,1);
  if(b.canopy){
    // The compressed bedroll opens along the zipper; quilt halves then settle
    // into their canopy shape with a soft, decaying fabric overshoot.
    const ease=1-(1-d)**3;b.canopy.scale.set(.22+.78*ease,.65+.35*ease,.18+.82*ease);
    b.wings.forEach((wing,i)=>{const side=i===0?-1:1;wing.rotation.z=side*((1-ease)*1.1+.025*Math.sin(t*2.2+i));wing.rotation.x=.012*Math.sin(t*2.8+i);});
    b.hood.rotation.x=.055*Math.sin(t*2.1);
    b.ties.forEach((tie,i)=>{tie.rotation.x=.25*Math.sin(t*5.2+i);tie.rotation.z=.10*Math.sin(t*3.8+i);});
    if(b.cords){b.canopy.updateMatrix();let n=0;for(let i=0;i<2;i++){const side=i===0?-1:1,wing=b.wings[i];wing.updateMatrix();for(const z of [-.91,-.34,.34,.91]){
      rigStart.set(quiltX(side*1.53,z),.14*Math.cos(z*1.1)-.084,z).applyMatrix4(wing.matrix).applyMatrix4(b.canopy.matrix);rigEnd.set(side*.33,1.94,-.06);rigDirection.subVectors(rigStart,rigEnd);
      dummy.position.copy(rigStart).add(rigEnd).multiplyScalar(.5);const length=rigDirection.length();dummy.quaternion.setFromUnitVectors(up,rigDirection.normalize());dummy.scale.set(1,length,1);dummy.updateMatrix();b.cords.setMatrixAt(n++,dummy.matrix);
    }}b.cords.instanceMatrix.needsUpdate=true;}
  }
  if(b.liquid){b.liquid.rotation.z=Math.sin(t*1.8)*.035;b.liquid.rotation.x=Math.sin(t*1.3+.6)*.025;b.liquid.position.y=.065+Math.sin(t*2.1)*.003;}
  for(const u of b.slime)u.value=t;
  if(b.drops){for(let n=0;n<28;n++){
    const u=(n/28+t*(.30+(n%3)*.018))%1,side=n%2?-1:1,seed=n*2.39996,r=(.018+(n%5)*.004)*(Math.sin(u*Math.PI)*.7+.3)*intensity;
    dummy.position.set(side*(.22+(n%2)*.33+u*.27)+Math.sin(seed+t*1.4)*u*.11,.4+u*3.55,.24+Math.cos(seed+t*.9)*u*.19);
    dummy.rotation.set(Math.sin(seed+t)*.25,0,side*.22);dummy.scale.set(r,r*(1.8+.8*Math.sin(seed+t*2)),r);dummy.updateMatrix();b.drops.setMatrixAt(n,dummy.matrix);
  }b.drops.instanceMatrix.needsUpdate=true;}
}

export function makeIconGear(slot){
  if(!templates.has(slot)){const factory={pickaxe:wedge,backbling:bottle,glider:sleepingBag,trail:slime}[slot];if(!factory)return new THREE.Group();const g=factory();g.traverse(m=>{if(m.geometry)m.geometry.userData.shared=true;});templates.set(slot,g);}
  const g=templates.get(slot).clone(true);bindAnimation(g);updateIconGear(g,0);return g;
}
