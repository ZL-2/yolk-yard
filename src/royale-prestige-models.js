import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Prestige remains on the standard skeleton and hitbox. All outfit detail is
// baked into that skinned mesh; the matching equipment shares cached geometry.
export function prestigeOutfit(i,c,h){
 const {helmet,mask,visor,hood,shoulders,bracers,facet,plate,cord,ring,knee,rings,ellipsoid}=h,metal=i.metal,a=i.accent,d=i.color;
 const solar=i.rank===5,apex=i.rank===1,rift=i.rank===10;
 helmet(apex?'#e5edf0':d,.139,.177,.135);mask(apex?'#e5edf0':metal,.207,.228);
 if(rift){hood(d);for(const s of [-1,1])cord([[s*.09,1.75,-.17],[s*.042,1.705,-.184],[s*.013,1.635,-.187]],.006,a,'head','glass');}
 else visor(a,apex?.16:.205,.033,-.158);
 shoulders(apex?'#e5edf0':metal,solar?.225:apex?.19:.165);bracers(metal);
 rings([[1.46,.098,.09],[1.51,.092,.084]],d,'neck',null,'rubber');
 for(const s of [-1,1]){
  const arm=s<0?'armL':'armR',shin=s<0?'shinL':'shinR';
  facet(s*.102,1.315,-.168,.195,.238,.045,apex?'#e5edf0':d,'chest');
  for(let j=0;j<3;j++){facet(s*.08,1.17-j*.051,-.145,.151,.066,.021,j%2?d:metal,'spine');facet(s*.28,1.386-j*.035,-.073,.159,.067,.023,j===0?metal:d,arm);}
  cord([[s*.17,1.41,-.12],[s*.16,1.33,-.205],[s*.077,1.215,-.195]],.005,a,'chest','glass');
  knee(metal,s,true);facet(s*.12,.274,-.062,.129,.28,.027,apex?'#e5edf0':d,shin);
  plate(s*.12,.26,-.094,.012,.20,.009,a,shin,0,0,'glass');
  for(let j=0;j<3;j++)plate(s*.407,1.10-j*.044,-.103,.076,.013,.012,a,s<0?'forearmL':'forearmR',s*.1,0,'glass');
  if(i.rank===25){
   facet(s*.145,1.83,.013,.085,.25,.025,metal,'head',[[0,-.5],[s*.5,.5],[-s*.4,.2]]);
   for(let j=0;j<3;j++)facet(s*(.31+j*.024),1.455+j*.035,.025,.07,.16,.018,j%2?d:metal,arm,[[0,-.5],[s*.5,.5],[-s*.5,.17]]);
  }else if(rift){
   for(let j=0;j<4;j++){const angle=j*.55;facet(s*(.27+Math.sin(angle)*.07),1.46+Math.cos(angle)*.07,.015,.075,.12,.02,j%2?metal:d,arm,[[0,.5],[.5,-.2],[0,-.5],[-.5,.2]]);}
   ring(s*.141,1.705,.018,.052,.008,metal,'head');
  }else if(solar){
   for(let j=0;j<5;j++){const angle=(j-2)*.46;facet(s*(.29+Math.sin(angle)*.08),1.45+Math.cos(angle)*.09,.015,.042,.18,.015,metal,arm,[[0,.5],[.5,-.5],[-.5,-.5]]);}
   cord([[s*.08,1.83,-.1],[s*.04,1.87,-.11],[0,1.89,-.12]],.01,metal,'head');
  }else{
   for(let j=0;j<4;j++)facet(s*(.29+j*.036),1.46+j*.042,.015,.06,.20-j*.015,.02,j%2?metal:'#e5edf0',arm,[[0,-.5],[s*.5,.5],[-s*.4,.25]]);
  }
 }
 ring(0,1.346,-.222,solar?.065:.049,.008,metal,'chest');ellipsoid(0,1.346,-.232,.028,.038,.015,a,'chest',8,'glass');
 if(solar)for(let j=0;j<12;j++){const t=j*Math.PI/6;cord([[Math.sin(t)*.075,1.346+Math.cos(t)*.075,-.224],[Math.sin(t)*.095,1.346+Math.cos(t)*.095,-.224]],.004,metal,'chest');}
 if(apex){
  // The suspended five-point crown is part of the head rig, not a particle.
  ring(0,1.863,.002,.137,.008,metal,'head');
  for(let j=0;j<5;j++){const t=(j-2)*.46;facet(Math.sin(t)*.135,1.922,-Math.cos(t)*.123,.05,j===2?.16:.118,.015,metal,'head',[[-.5,-.5],[0,.5],[.5,-.5]]);}
  for(const s of [-1,1])plate(s*.045,1.708,-.195,.06,.01,.009,a,'head',s*.14,0,'glass');
 }
}

const digits={'#':['01010','11111','01010','11111','01010'],'0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['111','001','111','100','111'],'3':['111','001','111','001','111'],'4':['101','101','111','001','001'],'5':['111','100','111','001','111'],'6':['111','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','111']};
export function prestigeGear(i,slot,g,{box,tube,part,blade},rank=i.rank){
 const glow=[],a=i.accent,d=i.color,m=i.metal,solar=i.rank===5,apex=i.rank===1,rift=i.rank===10;
 const light=(geo,x=0,y=0,z=0)=>{geo.translate(x,y,z);glow.push(geo);};
 const gem=(x,y,z,r)=>{part(g,new T.OctahedronGeometry(r*1.25),m,x,y,z,'metal');light(new T.OctahedronGeometry(r),x,y,z+.02);};
 const ring=(x,y,z,r,t=.012)=>part(g,new T.TorusGeometry(r,t,5,32),m,x,y,z,'metal');
 if(slot==='backbling'){
  // Pleated double-sided cape, armored yoke, luminous insignia and live rank.
  const pos=[],uv=[],idx=[],nx=16,ny=12,length=apex?1.03:rift?.96:.89,width=solar?.64:.56;
  for(let j=0;j<=ny;j++)for(let k=0;k<=nx;k++){const u=k/nx,v=j/ny;pos.push((u-.5)*width*(.8+.35*v),.13-v*length-(j===ny?(rift?Math.abs(u-.5)*.1:Math.cos(u*Math.PI*4)*.025):0),.10+.16*v+Math.cos(u*Math.PI*8)*.014*v);uv.push(u,v);if(j<ny&&k<nx){const n=j*(nx+1)+k;idx.push(n,n+nx+1,n+1,n+1,n+nx+1,n+nx+2);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex([...idx,...idx.flatMap((n,k)=>k%3===0?[idx[k],idx[k+2],idx[k+1]]:[])]);geo.computeVertexNormals();part(g,geo,apex?'#e5edf0':d,0,0,0,'cloth');
  for(const s of [-1,1]){tube(g,m,[s*width*.40,.13,.105],[s*width*.575,.13-length,.27],.01,'cloth');box(g,m,s*.17,.14,.06,.19,.075,.10,'metal');tube(g,d,[s*.19,.13,-.03],[s*.15,-.16,-.04],.022,'leather');}
  box(g,d,0,.105,.10,.20,.16,.055,'metal');ring(0,.09,.143,.065);gem(0,.09,.148,.04);
  if(rift)for(const s of [-1,1]){const fin=blade(g,m,[[s*.06,.17],[s*.18,.31],[s*.30,.18],[s*.25,-.04],[s*.18,.12]],.03);fin.position.z=.1;}
  else if(solar)for(let k=0;k<10;k++){const t=k*Math.PI/5;tube(g,m,[Math.sin(t)*.082,.09+Math.cos(t)*.082,.14],[Math.sin(t)*.125,.09+Math.cos(t)*.125,.14],.008);}
  else for(const s of [-1,1])for(let k=0;k<(apex?4:2);k++){const fin=blade(g,apex?'#e5edf0':m,[[s*(.1+k*.04),.14],[s*(.17+k*.05),.29+k*.025],[s*(.24+k*.035),.24],[s*(.16+k*.03),.06]],.025);fin.position.z=.09;}
  const label='#'+(Number.isInteger(rank)&&rank>0&&rank<=25?rank:i.rank),pixels=.026,total=[...label].reduce((n,c)=>n+digits[c][0].length+1,0)-1;let offset=-total*pixels/2;
  for(const char of label){const rows=digits[char];rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')box(g,apex?d:a,offset+x*pixels,-.26-y*pixels,.19+y*.005,pixels*.85,pixels*.85,.008,'paint');}));offset+=(rows[0].length+1)*pixels;}
  for(const s of [-1,1]){tube(g,m,[s*.11,-.48,.218],[0,-.59,.239],.008,'cloth');tube(g,m,[0,-.59,.239],[s*.15,-.72,.255],.006,'cloth');}
  g.userData.displayRank=Number(label.slice(1));
 }else if(slot==='glider'){
  box(g,d,0,2.98,0,.38,.20,1.20,'metal');gem(0,3.12,-.28,.11);
  for(const s of [-1,1]){
   tube(g,m,[s*.28,1.94,0],[s*.92,2.98,0],.025);box(g,'#16242e',s*.28,1.94,0,.13,.08,.12,'rubber');
   const fins=apex?6:solar?7:rift?4:5;
   for(let n=0;n<fins;n++){
    const x=s*(.32+n*.28),z=-.6+n*.17,y=3.07-n*.025;
    const pts=rift?[[0,0],[s*.65,.38],[s*1.05,.11],[s*.59,-.64],[s*.3,-.20]]:[[0,0],[s*.48,.33],[s*.82,.17],[s*.56,-.74],[0,-.26]];
    const wing=blade(g,n%2===0?(apex?'#e5edf0':m):d,pts,.055);wing.rotation.x=-Math.PI/2;wing.position.set(x,y,z);
    tube(g,m,[x,y+.035,z],[x+s*.54,y+.035,z+.48],.012);light(new T.BoxGeometry(.055,.025,.36),x+s*.3,y+.045,z+.15);
   }
   if(i.rank===25)box(g,d,s*.83,2.93,.32,.26,.26,.72,'metal');
   if(rift){const halo=ring(s*1.24,3.1,0,.49,.025);halo.rotation.x=Math.PI/2;light(new T.OctahedronGeometry(.12),s*1.24,3.14,0);}
  }
  if(solar||apex){const halo=ring(0,3.19,0,solar?.68:.4,.025);halo.rotation.x=Math.PI/2;if(apex){const crown=blade(g,m,[[-.2,0],[-.23,.31],[-.1,.18],[0,.36],[.1,.18],[.23,.31],[.2,0]],.06);crown.position.set(0,3.28,-.15);}}
 }else if(slot==='trail'){
  for(const s of [-1,1])for(let strand=0;strand<2;strand++){
   const points=Array.from({length:12},(_,j)=>{const t=j/11;return new T.Vector3(s*(.43+t*.3)+Math.sin(t*(rift?11:7)+strand*Math.PI)*(rift?.15:.06),1.25+t*3.8,.15+Math.cos(t*7+strand)*.12);});
   light(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,strand?.012:.023,4,false));
   for(let n=0;n<5;n++){const p=points[n*2+1],geo=rift?new T.OctahedronGeometry(.055+n*.007):solar?new T.TorusGeometry(.055+n*.01,.009,4,12):apex?new T.OctahedronGeometry(.036+n*.006):new T.BoxGeometry(.028,.11,.025);light(geo,p.x+s*.075,p.y,p.z);}
  }
 }
 if(glow.length){const parts=glow.map(p=>p.index?p.toNonIndexed():p.clone()),geo=mergeGeometries(parts);[...glow,...parts].forEach(p=>p.dispose());const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({color:a,transparent:true,opacity:slot==='trail'?.6:.95,depthWrite:false,toneMapped:false}));mesh.userData.keepDynamic=true;g.add(mesh);}
 g.userData.rankReward=i.rank;return g;
}
