import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ZOMBIES_MAP,Z_ZONES,Z_BUILDINGS,Z_STATIONS,Z_CACHE_SITES,Z_CONTRACTS,Z_LOOT_SITES,Z_EXFILS} from './zombies-map.js';
import {Z_PERKS} from './zombies-config.js';
import {architectureUV,architectureAtlasMaterial} from './architecture-surfaces.js';
import {blacktideTerrainMesh} from './zombies-terrain.js';
import {groundAt} from './terrain.js';
import {makeBlaster} from './zombies-weapons.js';

export function buildBlacktide(parent){
 const labels=[],materials=new Map(),batches=new Map(),unit=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,10),matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();
 const texture=document.createElement('canvas');texture.width=texture.height=128;const c=texture.getContext('2d');c.fillStyle='#d0d0c6';c.fillRect(0,0,128,128);let seed=74;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<6000;i++){c.fillStyle=`rgba(30,39,35,${random()*.16})`;c.fillRect(random()*128,random()*128,1,1);}const surface=new T.CanvasTexture(texture);surface.wrapS=surface.wrapT=T.RepeatWrapping;surface.colorSpace=T.SRGBColorSpace;
 const mat=(color,glow=false)=>{const key=color+'-'+glow;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.88,metalness:.12,...(glow?{emissive:color,emissiveIntensity:.7}:{map:surface})}));return materials.get(key);};
 const add=(geometry,x,y,z,w,h,d,color,ry=0,kind='paint')=>{matrix.compose(position.set(x,y,z),rotation.setFromAxisAngle(new T.Vector3(0,1,0),ry),scale.set(w,h,d));const g=architectureUV(geometry.clone().applyMatrix4(matrix),kind),tint=new T.Color(color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));const key=Math.floor(x/54)+','+Math.floor(z/54);if(!batches.has(key))batches.set(key,{color,geos:[]});batches.get(key).geos.push(g);};
 const box=(x,y,z,w,h,d,color,ry=0,kind='paint')=>add(unit,x,y,z,w,h,d,color,ry,kind),pipe=(x,y,z,r,h,color)=>add(cylinder,x,y,z,r,h,r,color);
 const label=(group,text,x,y,z,width=4,color='#eedcaa')=>{const cv=document.createElement('canvas');cv.width=512;cv.height=96;const ctx=cv.getContext('2d');ctx.fillStyle='#172527';ctx.fillRect(0,0,512,96);ctx.fillStyle=color;ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text.toUpperCase(),256,49,490);const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,width*96/512),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));m.position.set(x,y,z);m.userData.ownedMaterial=true;group.add(m);if(group===parent)labels.push(m);return m;};
 parent.add(blacktideTerrainMesh(ZOMBIES_MAP));
 // Continuous, connected road grid. Curbs are outside the traffic corridor.
 for(const n of [-162,-54,54,162]){box(n,.025,0,9,.035,350,0x39423f);box(0,.026,n,350,.035,9,0x39423f);for(const side of [-1,1]){box(n+side*5,.055,0,.35,.08,350,0x899084);box(0,.055,n+side*5,350,.08,.35,0x899084);}for(let j=-170;j<175;j+=7){box(n,.052,j,.12,.01,3,0xcbbd86);box(j,.053,n,3,.01,.12,0xcbbd86);}}
 for(const zone of Z_ZONES){box(zone.x,.04,zone.z,7,.04,94,0x46504a);box(zone.x,.04,zone.z,94,.04,7,0x46504a);label(parent,zone.name,zone.x,3.8,zone.z+44,9);for(const x of [-39,39]){pipe(zone.x+x,2.8,zone.z+40,.12,5.6,0x3c4a44);box(zone.x+x,5.6,zone.z+40,1.2,.15,.6,0xf1dba4);}}
 for(const b of ZOMBIES_MAP.boxes){if(b.zStation)continue;const zone=Z_ZONES.find(z=>z.id===Z_BUILDINGS.find(o=>o.id===b.building)?.zone);const colors={facade:zone?.theme==='town'?0x969481:zone?.theme==='hospital'?0x9faaa1:zone?.theme==='lab'?0x788a88:0x78817b,lintel:0x879189,roof:0x485954,desk:0x726858,cabinet:0x445b54,platform:0x6d7972,step:0x747d71,container:0x556f69,reactor:0x546b67,barrier:0x8c9181,shelves:0x495b55,pallet:0x897255,bed:0x8caaa0,curtain:0x6d8a80,server:0x243e40,workbench:0x64796a,table:0x786b57,booth:0x496a60,counter:0x969483,dresser:0x8b7a61,archive:0x576960,partition:0x84978b};box(b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,colors[b.kind]||0x69766b,0,b.kind==='facade'?(zone?.theme==='town'?'brick':zone?.theme==='woods'?'timber':'concrete'):b.kind==='roof'?'roof':['cabinet','reactor','container'].includes(b.kind)?'metal':'concrete');}
 for(const b of Z_BUILDINGS){const {x,z,w,d,h}=b;box(x,.025,z,w,.04,d,0x5a655e);for(const side of [-1,1]){for(let xx=-w/2+2.5;xx<w/2-1;xx+=3){if(Math.abs(xx)<3)continue;box(x+xx,2.5,z+side*(d/2+.27),1.6,1.25,.035,0x263d40);box(x+xx,2.5,z+side*(d/2+.295),.07,1.3,.04,0x76877c);box(x+xx,2.5,z+side*(d/2+.3),1.65,.07,.04,0x76877c);}box(x,h+.25,z+side*d/2,w+.8,.35,.6,0x4d5f56);}label(parent,b.name,x,3.9,z+d/2+.3,Math.min(8,w-2));
  box(x+3,h+.55,z-2,2.7,.6,2.1,0x6e7d6f);box(x-3,h+.4,z+2,1,.4,1,0x303f3a);
  for(const xx of [-w/2+1.5,w/2-1.5])for(const zz of [-d/2+3,d/2-3]){box(x+xx,.4,z+zz,1,.8,1.2,0x514d3e);box(x+xx,.85,z+zz,.95,.06,1.1,0x8e8265);}if(['clinic','hospital'].includes(b.kind)){for(let i=0;i<3;i++){box(x-5+i*4,.65,z,2.3,.25,1,0xbbc6b7);for(const dz of [-.4,.4])box(x-5+i*4,.3,z+dz,1.9,.6,.07,0x5d7068);}label(parent,'MEDICAL / TRIAGE',x,2.7,z-d/2+.4,6,'#a9d6bc');}if(['lab','vault','reactor'].includes(b.kind)){for(let i=0;i<3;i++){box(x-w/2+2,1.2,z-4+i*3,1.4,2.4,1.3,0x283c3d);box(x-w/2+2.72,1.6,z-4+i*3,.025,.8,.8,0x76a89f);}}
 }
 // Architectural identity: clinic awnings, industrial gantries, cabin roofs,
 // civic columns, shop shutters, ventilation and readable evacuation trails.
 for(const b of Z_BUILDINGS){const {x,z,w,d,h}=b;
  if(['cabin','barracks'].includes(b.kind)){for(const side of [-1,1])box(x+side*w*.25,h+.8,z,w*.57,.22,d+.8,0x4f594c,0,'roof');for(let n=-2;n<=2;n++)box(x+n*2,1.2,z+d/2+.35,.12,2.4,.13,0x806b52);}
  if(['hangar','warehouse','reactor'].includes(b.kind)){for(const side of [-1,1]){box(x+side*(w/2-.8),h*.5,z,.22,h,.25,0x4d615a);box(x,h-.7,z+side*(d/2-1),w-.5,.3,.3,0x60766a);}for(let n=0;n<4;n++)pipe(x-w/2+2+n*1.2,h+.7,z-d/2+2,.32,1.4,0x859382);}
  if(['office','archive','tower'].includes(b.kind)){for(const side of [-1,1]){pipe(x+side*2.9,1.8,z+d/2+.8,.22,3.6,0xb3b8a0);box(x+side*2.9,3.65,z+d/2+.8,.8,.25,.8,0x879786);}box(x,3.9,z+d/2+.8,7,.3,2.2,0x788e80);}
  if(['clinic','hospital'].includes(b.kind)){box(x,3.35,z+d/2+1.1,7,.15,2,0x576f69);box(x-w/2+3,3,z+d/2+.3,.35,1.2,.06,0xcbd7ba);box(x-w/2+3,3,z+d/2+.34,1.1,.35,.06,0xcbd7ba);}
  if(b.kind==='shop'){box(x,3.3,z+d/2+1,8,.16,2,0x637c68);for(let i=0;i<8;i++)box(x-3.5+i,3.4,z+d/2+1,.35,.05,2,0xa8a485);}
  for(const side of [-1,1]){box(x+side*(w/2-.7),2.8,z+d/2+.31,.25,.65,.1,0xc0b786);for(let n=0;n<4;n++)box(x+side*(w/2-.8)-n*.09,1.1+n*.12,z+d/2+.29,.045,.22,.02,0x4f5a4f);}
  for(const side of [-1,1]){box(x+side*1.25,.08,z+d/2+1.8,.12,.025,2.2,0xbca972);box(x+side*1.25,2.85,z+d/2+.31,.12,.1,.04,0xb7c9a3);}
 }
 // Distinct landmarks, roadside props and horizon silhouettes, all statically batched.
 for(let i=0;i<120;i++){const x=-174+random()*348,z=-174+random()*348;if(Z_BUILDINGS.some(b=>Math.abs(x-b.x)<b.w/2+6&&Math.abs(z-b.z)<b.d/2+6)||[-162,-54,54,162].some(n=>Math.abs(x-n)<7||Math.abs(z-n)<7)||Z_STATIONS.some(t=>Math.hypot(x-t.x,z-t.z)<5))continue;const floor=groundAt(ZOMBIES_MAP,x,z);if(z<-60||x>150){pipe(x,floor+2,z,.24,4,0x4b4a3c);for(let n=0;n<3;n++){const cone=new T.ConeGeometry(2.5-n*.5,4,7);add(cone,x,floor+4+n*1.5,z,1,1,1,0x354b3c);cone.dispose();}}else{box(x,floor+.25,z,.7,.5,.6,0x697463,random()*3);}}
 for(let i=0;i<5;i++){pipe(-12+i*6,6,-133,2.1,12,0x87978a);pipe(-12+i*6,12.6,-133,.9,1.2,0x485953);}for(const x of [-5,5]){pipe(x,17,-116,.5,34,0x66796b);box(x,27,-116,1.1,1.5,1.1,0xb3966a);}
 const aerial=new T.Group();aerial.position.set(108,14,-108);const dish=new T.Mesh(new T.SphereGeometry(5,20,12,0,Math.PI*2,0,Math.PI*.35),mat(0xc0c6ae));dish.rotation.x=Math.PI/2;const tower=new T.Mesh(new T.CylinderGeometry(.6,1.8,14,8),mat(0x5b7069));tower.position.y=-7;aerial.add(dish,tower);parent.add(aerial);
 box(-197,-.4,0,34,.1,500,0x405e65);for(let i=0;i<22;i++)box(-195,.02,-200+i*20,25,.025,.16,0x819b99);
 for(let i=0;i<38;i++){const x=-220+random()*440,z=-210-random()*100;box(x,9,z,10+random()*18,18+random()*35,15,0x6e8075);}
 const stationGroups=new Map(),lootGroups=new Map(),contractGroups=new Map();
 const localBox=(group,x,y,z,w,h,d,color)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);group.add(m);return m;};
 for(const t of [...Z_STATIONS,...Z_CACHE_SITES]){const g=new T.Group();g.position.set(t.x,t.y,t.z);parent.add(g);stationGroups.set(t.id,g);if(t.kind==='exfil'){const ring=new T.Mesh(new T.RingGeometry(7.8,8,48),new T.MeshBasicMaterial({color:0x91dfb2,side:T.DoubleSide,transparent:true,opacity:.75}));ring.rotation.x=-Math.PI/2;ring.position.y=.06;g.add(ring);localBox(g,0,.75,0,.35,1.5,.35,0x789e82);label(g,'EXTRACTION / CALL TRANSPORT',0,2.2,0,4,'#a7efbd');continue;}
  const tint=t.kind==='perk'?new T.Color(Z_PERKS[t.perk].color).getHex():0xd7b371;
  if(t.kind==='wall'){localBox(g,0,1.25,0,1.5,.85,.1,0x283e3e);const gun=makeBlaster(t.weapon);gun.position.y=1.3;gun.rotation.y=Math.PI/2;g.add(gun);}
  else if(t.kind==='forge'){localBox(g,0,.65,0,2,1.3,1.2,0x344c4e);for(const x of [-1,1])localBox(g,x,1.2,0,.18,2.2,1.4,0x9ca789);const ring=new T.Mesh(new T.TorusGeometry(.65,.085,8,24),mat(0x94d0bf,true));ring.position.y=1.6;g.add(ring);g.userData.rotor=ring;}
  else if(t.kind==='cache'){localBox(g,0,.45,0,1.7,.9,1.2,0x394f4b);for(const x of [-.7,.7])localBox(g,x,.45,0,.1,1,1.23,0xb3a171);g.userData.lid=localBox(g,0,1,0,1.7,.08,1.2,0x9cb6a3);}
  else if(t.kind==='perk'){localBox(g,0,.9,0,.8,1.8,.6,0x334c4b);localBox(g,0,1.35,.32,.65,.55,.04,tint);localBox(g,0,.6,.33,.5,.13,.08,0xc1c4a8);}
  else{localBox(g,0,.6,0,.8,1.2,.65,0x465c54);localBox(g,0,1.3,0,.8,.2,.7,tint);}label(g,t.name,0,t.kind==='forge'?2.8:2.1,0,2.7);
 }
 for(const c of Z_CONTRACTS){const g=new T.Group();g.position.set(c.x,0,c.z);parent.add(g);contractGroups.set(c.id,g);localBox(g,0,.85,0,.6,1.7,.4,0x334a43);localBox(g,0,1.35,.23,.48,.45,.04,0xe8c575);const beam=new T.Mesh(new T.OctahedronGeometry(.2),mat(0xe5c16a,true));beam.position.y=2.5;g.add(beam);g.userData.beacon=beam;label(g,c.name,0,2,0,3);}
 for(const s of Z_LOOT_SITES){const g=new T.Group();g.position.set(s.x,0,s.z);parent.add(g);lootGroups.set(s.id,g);localBox(g,0,.45,0,.9,.9,.65,s.medical?0x96a89a:0x59684e);localBox(g,0,.92,0,.94,.08,.7,0xb5b895);localBox(g,0,.5,.34,.3,.08,.025,0xc0bd83);}
 for(const {geos}of batches.values()){const mesh=new T.Mesh(mergeGeometries(geos),architectureAtlasMaterial());mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);geos.forEach(g=>g.dispose());}unit.dispose();cylinder.dispose();parent.traverse(o=>{if(o.material)o.userData.ownedMaterial=true;});parent.userData.blacktide={labels,stationGroups,contractGroups,lootGroups,doors:new Map(),shutters:new Map(),aerial};
}
