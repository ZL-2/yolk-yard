import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {ZOMBIES,Z_TYPES,Z_PERKS,Z_POWERUPS} from './zombies-config.js';
import {ZOMBIES_MAP,Z_ZONES,Z_DOORS,Z_STATIONS,Z_CACHE_SITES,Z_ENTRANCES} from './zombies-map.js';
import {makeBlaster} from './zombies-weapons.js';
import {clamp} from './data.js';

const amber=0xffba68,cyan=0x72e5db;
const material=(color,glow=false)=>new THREE.MeshStandardMaterial({color,roughness:glow?.3:.85,metalness:glow?.25:.15,...(glow?{emissive:color,emissiveIntensity:1.1}:{})});
function label(parent,text,x,y,z,width=3,color='#f6d39c'){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#10272dec';c.fillRect(0,0,768,128);c.fillStyle=color;c.fillRect(0,0,7,128);c.font='bold 37px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text.toUpperCase(),388,66,724);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/6),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
// Static architecture is merged by material. Decorative machinery stays inside
// authored collision volumes; it cannot create invisible navigation obstacles.
export function buildBlacktide(parent){
 const colors=new Map(),buckets=new Map(),m=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),s=new THREE.Vector3(),unit=new THREE.BoxGeometry(1,1,1),cyl=new THREE.CylinderGeometry(1,1,1,12);
 const batch=(geo,x,y,z,w,h,d,color,rx=0,ry=0)=>{const key=String(color);if(!colors.has(key))colors.set(key,material(color));q.setFromEuler(new THREE.Euler(rx,ry,0));m.compose(v.set(x,y,z),q,s.set(w,h,d));const g=geo.clone().applyMatrix4(m);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(g);};
 const box=(x,y,z,w,h,d,c,ry=0)=>batch(unit,x,y,z,w,h,d,c,0,ry);
 const pipe=(x,y,z,r,h,c,rx=0)=>batch(cyl,x,y,z,r,h,r,c,rx);
 box(0,-.18,0,90,.35,90,0x34474b);
 for(const zone of Z_ZONES){
  box(zone.x,-.006,zone.z,zone.w-.12,.025,zone.d-.12,zone.color);
  // Drain strips, expansion joints and worn hazard borders have physical offsets.
  for(let x=zone.x-zone.w/2+3;x<zone.x+zone.w/2;x+=5)box(x,.018,zone.z,.035,.012,zone.d-.4,0x303f43);
  for(let z=zone.z-zone.d/2+4;z<zone.z+zone.d/2;z+=6)box(zone.x,.02,z,zone.w-.5,.012,.035,0x303f43);
  box(zone.x,.03,zone.z+zone.d/2-1,zone.w-2,.018,.16,0xb29b59);
  label(parent,zone.name,zone.x,4.1,zone.z+zone.d/2-.6,7);
 }
 for(const b of ZOMBIES_MAP.boxes){if(b.zStation)continue;
  const c=b.kind==='roof'?0x354950:b.kind==='cargo'?0x79674e:b.kind==='reactor'?0x203d48:b.kind==='pump'?0x3d6267:b.kind==='step'||b.kind==='platform'?0x5e6a68:b.kind==='column'?0x374950:0x657173;
  box(b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,c);
  if(['wall','boundary'].includes(b.kind)){
   const along=b.w>b.d,len=along?b.w:b.d;
   for(let n=-len/2+1;n<len/2;n+=3.2){const x=along?b.x+n:b.x,z=along?b.z:b.z+n;box(x,b.y+b.h*.55,z,along?.14:b.w+.025,b.h*.88,along?b.d+.025:.14,0x42565c);}
   box(b.x,b.h-.15,b.z,b.w+.06,.2,b.d+.06,0x8b9290);
   box(b.x,1.05,b.z,b.w+.018,.12,b.d+.018,0xb49a60);
  }
  if(b.kind==='roof'){for(let z=b.z-b.d/2+1;z<b.z+b.d/2;z+=4)box(b.x,b.y-.12,z,b.w,.25,.35,0x718083);}
  if(['cargo','console'].includes(b.kind)){for(const dz of [-.32,.32])box(b.x,b.y+b.h+.02,b.z+dz*b.d,b.w,.03,.08,0xc0a16d);}
 }
 // Exposed pipework, breaker cabinets, a maritime aerial and a distant sea wall.
 for(const x of [-12.5,12.5]){pipe(x,4.4,26,.18,32,0x9e7654,Math.PI/2);for(const z of [12,20,28,36])box(x,4.4,z,.55,.55,.09,0x45575b);}
 for(const x of [-1.2,1.2])pipe(x,2.2,24,.55,4,0x678b8b);
 for(let i=0;i<5;i++){box(-1.9+i*.95,1.8,-20,.25,2.6,7.05,0x7f9699);box(-1.9+i*.95,2.7,-20,.08,.5,7.07,0x8fb9b3);}
 for(const side of [-1,1])for(let i=0;i<5;i++){const x=side*45,z=-38+i*18;pipe(x,9,z,.15,5,0x728083);box(x,11.2,z,.7,.5,.7,0xb4a478);}
 for(let i=0;i<4;i++){const x=28+(i%2?1:-1)*2.7,z=-28+(i<2?1:-1)*2.7;pipe(x,10,z,.18,20,0x526d72);}
 for(let y=5;y<22;y+=4)box(28,y,-28,6,.18,6,0x577c82);
 const aerial=new THREE.Mesh(new THREE.TorusGeometry(4,.23,8,48),material(cyan,true));aerial.position.set(28,19,-28);parent.add(aerial);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;box(28+Math.cos(a)*4,19+Math.sin(a)*4,-28,.3,.8,.4,0xa1c9c6,a);}
 // Practical floodlights: emissive fixtures and pooled light, no per-fixture shadows.
 for(const zone of Z_ZONES){for(const dx of [-9,9])box(zone.x+dx,4.6,zone.z,1,.12,.5,0xe1bf83);}
 for(const [x,z]of [[-29,22],[0,25],[28,-25]]){const light=new THREE.PointLight(0xffc78b,22,28,2);light.position.set(x,4.5,z);parent.add(light);}
 const doors=new Map();for(const d of Z_DOORS){const mesh=new THREE.Mesh(new THREE.BoxGeometry(d.w,5.1,d.d),material(0x6b5b48));mesh.position.set(d.x,2.55,d.z);parent.add(mesh);doors.set(d.id,mesh);for(const face of [-1,1]){const along=d.w<d.d,sign=label(parent,d.name+' / '+d.cost,d.x+(along?face*.53:0),3.1,d.z+(along?0:face*.53),4);if(along)sign.rotation.y=Math.PI/2;}}
 const stationGroups=new Map();for(const t of [...Z_STATIONS,...Z_CACHE_SITES]){
  const group=new THREE.Group();group.position.set(t.x,t.y,t.z);parent.add(group);stationGroups.set(t.id,group);
  const add=(x,y,z,w,h,d,c)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(c));mesh.position.set(x,y,z);group.add(mesh);return mesh;};
  const tint=t.kind==='perk'?Z_PERKS[t.perk].color||amber:['core','conduit','finale','power'].includes(t.kind)?cyan:amber;
  if(t.kind==='wall'){add(0,1.3,0,1.4,.8,.12,0x253d45);const w=makeBlaster(t.weapon);w.rotation.y=Math.PI/2;w.position.set(0,1.35,.1);group.add(w);}
  else if(t.kind==='cache'){add(0,.45,0,1.7,.9,1.25,0x2b4248);for(const x of [-.8,.8])add(x,.8,0,.1,1.3,1.3,0xa98c5b);const lid=add(0,1,0,1.5,.08,1.1,0x78b3ae);group.userData.lid=lid;}
  else if(t.kind==='perk'){add(0,.9,0,.8,1.8,.6,0x3f535c);add(0,1.35,.32,.62,.6,.05,tint);add(0,.6,.34,.5,.12,.12,0xb4b9aa);}
  else if(t.kind==='forge'){add(0,.65,0,2,1.3,1.2,0x375460);for(const x of [-1,1])add(x,1.2,0,.2,2.2,1.3,0x84988e);const ring=new THREE.Mesh(new THREE.TorusGeometry(.7,.1,8,24),material(cyan,true));ring.position.y=1.8;group.add(ring);group.userData.rotor=ring;}
  else if(t.kind==='log'){add(0,.6,0,.6,1.2,.35,0x546366);add(0,1.26,0,.42,.12,.28,0xc2a06b);}
  else if(t.kind==='core'){const core=new THREE.Mesh(new THREE.OctahedronGeometry(.22),material(cyan,true));core.position.y=1.1;group.add(core);group.userData.rotor=core;add(0,.4,0,.45,.8,.45,0x577577);}
  else{add(0,.6,0,1.1,1.2,.65,0x38525d);add(0,1.3,0,1,.35,.7,0x7b8e8e);add(0,1.5,.1,.6,.06,.36,tint);}
  label(group,t.name,0,t.kind==='forge'?3:2.3,0,t.kind==='wall'?2.7:2.4);
 }
 const shutters=new Map();for(const e of Z_ENTRANCES){const group=new THREE.Group();group.position.set(e.x,e.y,e.z);parent.add(group);shutters.set(e.id,group);for(let i=0;i<3;i++){const board=new THREE.Mesh(new THREE.BoxGeometry(2,.22,.14),material(0x80715a));board.position.set(0,.5+i*.5,0);board.rotation.z=(i%2?1:-1)*.12;group.add(board);}label(group,'QUARANTINE',0,2,0,2.3,'#e8ad81');}
 for(const [key,geos]of buckets){const merged=mergeGeometries(geos,false),mesh=new THREE.Mesh(merged,colors.get(key));mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);for(const g of geos)g.dispose();}unit.dispose();cyl.dispose();
 parent.userData.blacktide={doors,stationGroups,shutters,aerial};
}

// 42 reusable articulated rigs write into four instanced batches. The skeleton
// is lightweight scene data, not 1,000 separately rendered Mesh objects.
function infectedRig(){
 const root=new THREE.Group(),parts=[],joint=(parent,x,y,z)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
 const part=(parent,shape,kind,x,y,z,w,h,d)=>{const o=new THREE.Object3D();o.position.set(x,y,z);o.scale.set(w,h,d);parent.add(o);parts.push({o,shape,kind});return o;};
 const hips=joint(root,0,.93,0),spine=joint(hips,0,.15,0),head=joint(spine,0,.51,-.04);
 part(hips,'round','cloth',0,0,0,.34,.23,.23);part(spine,'round','cloth',0,.16,0,.43,.42,.25);part(spine,'box','metal',0,.17,.11,.3,.32,.08);
 part(head,'round','skin',0,.07,0,.25,.3,.23);part(head,'round','skin',0,-.06,-.05,.19,.09,.17);part(head,'round','dark',0,.04,-.116,.21,.05,.025);
 for(const x of [-.065,.065])part(head,'glow','glow',x,.045,-.132,.025,.025,.015);
 part(head,'round','skin',0,.015,-.13,.055,.08,.06);for(const side of [-1,1])part(head,'round','skin',side*.13,.025,0,.045,.085,.055);
 part(head,'box','dark',0,-.07,-.134,.14,.022,.02);part(spine,'box','mark',.1,.17,-.14,.08,.18,.02);
 const legs=[],arms=[];
 for(const side of [-1,1]){
  const thigh=joint(hips,side*.12,-.08,0),knee=joint(thigh,0,-.39,0);legs.push({thigh,knee});
  part(thigh,'round','cloth',0,-.19,0,.19,.42,.2);part(knee,'round','cloth',0,-.18,0,.15,.39,.16);part(knee,'box','dark',0,-.37,-.035,.18,.15,.28);
  const arm=joint(spine,side*.25,.28,0),elbow=joint(arm,0,-.29,0);arms.push({arm,elbow});
  part(arm,'round','cloth',0,-.13,0,.17,.32,.18);part(elbow,'round','skin',0,-.15,0,.12,.31,.13);part(elbow,'round','skin',0,-.32,-.015,.12,.15,.09);
  for(const f of [-1,1])part(elbow,'box','skin',f*.032,-.39,-.01,.028,.1,.035);
 }
 const plates=[];for(const side of [-1,1])plates.push(part(spine,'box','armor',side*.24,.3,0,.25,.23,.32));plates.push(part(spine,'box','armor',0,.2,-.13,.39,.39,.07));
 const growth=part(spine,'round','growth',.16,.4,.09,.2,.3,.22);
 return {root,hips,spine,head,legs,arms,parts,plates,growth,id:null,cycle:0,blend:0};
}
const colorScratch=new THREE.Color(),matrix=new THREE.Matrix4(),dummy=new THREE.Object3D(),targetPosition=new THREE.Vector3(),white=new THREE.Color(0xffffff);
export class ZombiesView{
 constructor(scene,world){this.world=world;this.group=new THREE.Group();scene.add(this.group);this.rigs=Array.from({length:ZOMBIES.maxAlive+ZOMBIES.maxCorpses},infectedRig);this.batches={};for(const [shape,geometry]of Object.entries({round:new THREE.SphereGeometry(.5,10,7),box:new RoundedBoxGeometry(1,1,1,1,.08),glow:new THREE.SphereGeometry(.5,6,4)})){const mesh=new THREE.InstancedMesh(geometry,shape==='glow'?new THREE.MeshBasicMaterial({color:0xffffff}):material(0xffffff),this.rigs.length*40);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=shape!=='glow';this.group.add(mesh);this.batches[shape]=mesh;}
  this.fx=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.025,4,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,depthWrite:false}),ZOMBIES.maxEffects+ZOMBIES.maxDrops+16);this.fx.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.fx.frustumCulled=false;this.group.add(this.fx);this.pickups=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.3),material(cyan,true),ZOMBIES.maxDrops+12);this.pickups.frustumCulled=false;this.group.add(this.pickups);
 }
 update(state,dt,camera,playing){
  const z=playing&&state?.zombies;this.group.visible=!!z;if(!z){for(const r of this.rigs)r.id=null;return;}const time=state.time,art=this.world.userData.blacktide;
  if(art){for(const [id,mesh]of art.doors)mesh.visible=!z.open.includes(id);for(const [id,g]of art.shutters)g.children.forEach((c,i)=>{if(i<3)c.visible=i<(z.shutters[id]?.health||0);});art.aerial.rotation.z+=dt*(z.power?.3:.04);for(const [id,g]of art.stationGroups){if(id.startsWith('cache-'))g.visible=id===Z_CACHE_SITES[z.cache.site].id;if(id.startsWith('core-'))g.visible=!z.quest.cores.includes(Number(id.slice(-1))-1);if(g.userData.rotor)g.userData.rotor.rotation.y+=dt;if(g.userData.lid)g.userData.lid.position.y=z.cache.claimUntil>time?1.5:1;}
   const cache=art.stationGroups.get(Z_CACHE_SITES[z.cache.site].id);if(this.cacheWeapon!==z.cache.weapon||this.cacheSite!==z.cache.site){if(this.cacheModel){this.cacheModel.parent?.remove(this.cacheModel);this.cacheModel.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.userData.ownedMaterial&&o.material&&!o.material.userData.shared){o.material.map?.dispose();o.material.dispose();}});}this.cacheWeapon=z.cache.weapon;this.cacheSite=z.cache.site;this.cacheModel=z.cache.weapon?makeBlaster(z.cache.weapon):null;if(this.cacheModel){this.cacheModel.position.y=1.9;cache.add(this.cacheModel);}}if(this.cacheModel){this.cacheModel.visible=time>=z.cache.busyUntil;this.cacheModel.rotation.y+=dt;}
  }
  const ids=new Set(z.enemies.map(e=>e.id));for(const r of this.rigs)if(!ids.has(r.id))r.id=null;const counts={round:0,box:0,glow:0};
  for(const e of z.enemies){let r=this.rigs.find(r=>r.id===e.id);if(!r){r=this.rigs.find(r=>r.id===null);if(!r)continue;r.id=e.id;r.root.position.set(e.x,e.y,e.z);r.root.rotation.set(0,e.yaw,0);r.cycle=e.phase;r.blend=0;}const type=Z_TYPES[e.type],speed=Math.hypot(e.vx,e.vz),smooth=1-Math.exp(-18*dt),dead=e.health<=0,death=dead?clamp((time-e.deadAt)/.7,0,1):0,emerge=clamp((e.emergeUntil-time)/1.4,0,1);
   r.root.position.lerp(targetPosition.set(e.x,e.y+(e.lift||0)-emerge*.75-death*.65,e.z),Math.hypot(e.x-r.root.position.x,e.z-r.root.position.z)>5?1:smooth);r.root.rotation.y+=Math.atan2(Math.sin(e.yaw-r.root.rotation.y),Math.cos(e.yaw-r.root.rotation.y))*smooth;r.root.rotation.z=death*1.48;r.root.scale.setScalar(type.scale);r.cycle+=dt*speed*4.3;r.blend+=(Math.min(1,speed/.8)-r.blend)*smooth;
   const far=r.root.position.distanceToSquared(camera.position)>900,animate=!far||Math.floor(time*15)!==r.lastFrame;r.lastFrame=Math.floor(time*15);
   if(animate){const gait=Math.sin(r.cycle),run=speed>2.5,attack=e.state==='attack'?Math.sin(clamp(1-(e.attackEnd-time)/.8,0,1)*Math.PI):0,stagger=Math.max(0,1-(time-(e.lastHit||-100))/.16),crouch=e.type==='leaper'?.18:0;
    r.hips.position.y=.93+crouch*-1+Math.abs(gait)*.027*r.blend;r.spine.rotation.set(.12+crouch+stagger*-.22,Math.sin(r.cycle*.5)*.035*r.blend,Math.sin(time*1.6+e.phase)*.025);r.head.rotation.x=-.1;r.head.rotation.y=Math.sin(time+e.phase)*.06;
    r.legs.forEach(({thigh,knee},i)=>{const phase=r.cycle+i*Math.PI,step=Math.sin(phase)*r.blend;thigh.rotation.x=step*(run?.65:.38);knee.rotation.x=-Math.max(0,-step)*(run?1:.55)-crouch;});
    r.arms.forEach(({arm,elbow},i)=>{const side=i?1:-1;arm.rotation.set(.3+attack*1.6-Math.sin(r.cycle+i*Math.PI)*(run?.45:.12)*r.blend,side*.12,side*.12);elbow.rotation.x=.22+attack*.45;});
    if(e.state==='leap'){r.legs[0].thigh.rotation.x=.8;r.legs[1].thigh.rotation.x=-.5;r.arms.forEach(a=>a.arm.rotation.x=1.5);}if(e.type==='boss')r.spine.rotation.x=.2;
    if(e.type==='disruptor'){r.arms.forEach((a,i)=>{a.arm.rotation.z=(i?1:-1)*(.6+attack*.4);a.elbow.rotation.x=.7;});r.head.rotation.z=Math.sin(time*1.7)*.12;}
    if((e.type==='heavy'||e.type==='boss')&&e.state==='attack'){r.arms.forEach(a=>{a.arm.rotation.x=1+attack*1.8;a.elbow.rotation.x=.4;});r.spine.rotation.x=.2+attack*.2;}
    if(e.type==='elite'&&e.state==='attack'){r.spine.rotation.x=.4;r.arms[0].arm.rotation.x=1.7;}
    if(e.state==='climb'){r.spine.rotation.x=.3;r.arms.forEach((a,i)=>{a.arm.rotation.x=2.6+Math.sin(time*8+i*Math.PI)*.25;a.elbow.rotation.x=.6;});r.legs.forEach((a,i)=>{a.thigh.rotation.x=.7+Math.sin(time*8+i*Math.PI)*.35;a.knee.rotation.x=-1.1;});}
    if(e.state==='emerge'){r.spine.rotation.x=.45;r.arms.forEach(a=>a.arm.rotation.x=1.4);}

   }
   for(const p of r.plates)p.scale.z=['armored','heavy','elite','boss'].includes(e.type)?(p===r.plates[2]?.07:.32):.001;r.growth.scale.setScalar(['disruptor','elite','boss'].includes(e.type)?.24:.001);r.root.updateMatrixWorld(true);
   const palette={skin:type.color,cloth:type.cloth,dark:0x252d2d,metal:0x4d5e60,mark:0xc5aa72,armor:0x637e80,growth:e.type==='disruptor'?0x889bdd:0x5bb3ac,glow:e.type==='boss'?0xffad71:e.type==='disruptor'?0xb3a2f1:0x9ce1c4};
   for(const p of r.parts){const batch=this.batches[p.shape],n=counts[p.shape]++;batch.setMatrixAt(n,p.o.matrixWorld);colorScratch.set(palette[p.kind]);if(time-(e.lastHit||-100)<.07)colorScratch.lerp(white,.45);batch.setColorAt(n,colorScratch);}
  }
  for(const [shape,batch]of Object.entries(this.batches)){batch.count=counts[shape];batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;}
  let f=0,p=0;for(const effect of z.effects){const age=clamp((time-effect.born)/(effect.until-effect.born),0,1);dummy.position.set(effect.x,effect.y+.1,effect.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(effect.radius*(effect.kind==='warning'?1:.2+age*.8));dummy.updateMatrix();this.fx.setMatrixAt(f,dummy.matrix);this.fx.setColorAt(f++,colorScratch.set(effect.kind==='warning'?0xff704e:effect.kind==='sanctuary'?0x91e6bd:cyan));}
  for(const drop of z.drops){dummy.position.set(drop.x,drop.y+.85+Math.sin(time*3)*.1,drop.z);dummy.rotation.set(0,time,0);dummy.scale.setScalar(1);dummy.updateMatrix();this.pickups.setMatrixAt(p,dummy.matrix);this.pickups.setColorAt(p++,colorScratch.set(Z_POWERUPS[drop.type]?.color||cyan));}
  for(const b of z.grenades){dummy.position.set(b.x,b.y,b.z);dummy.scale.setScalar(.5);dummy.updateMatrix();this.pickups.setMatrixAt(p,dummy.matrix);this.pickups.setColorAt(p++,colorScratch.set(amber));}
  for(const [id,trap]of Object.entries(z.traps))if(trap.until>time){const s=Z_STATIONS.find(s=>s.id===id);dummy.position.set(s.x,.1,s.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(s.radius);dummy.updateMatrix();this.fx.setMatrixAt(f,dummy.matrix);this.fx.setColorAt(f++,colorScratch.set(cyan));}
  this.fx.count=f;this.fx.instanceMatrix.needsUpdate=true;if(this.fx.instanceColor)this.fx.instanceColor.needsUpdate=true;this.pickups.count=p;this.pickups.instanceMatrix.needsUpdate=true;if(this.pickups.instanceColor)this.pickups.instanceColor.needsUpdate=true;
 }
}
