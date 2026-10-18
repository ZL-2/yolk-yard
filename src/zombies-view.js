import * as THREE from 'three';
import {BlacktideAtmosphere} from './zombies-atmosphere.js';
import {InfectedActors,ExpeditionActors} from './zombies-actors.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {ZOMBIES,Z_TYPES,Z_PERKS,Z_POWERUPS} from './zombies-config.js';
import {ZOMBIES_MAP,Z_ZONES,Z_DOORS,Z_STATIONS,Z_CACHE_SITES,Z_ENTRANCES} from './zombies-map.js';
import {makeBlaster} from './zombies-weapons.js';
import {clamp} from './data.js';

const amber=0xffba68,cyan=0x72e5db;
const material=(color,glow=false)=>{const m=new THREE.MeshStandardMaterial({color,roughness:glow?.3:.85,metalness:glow?.25:.15,...(glow?{emissive:color,emissiveIntensity:1.1}:{})});m.userData.zombiesOwned=true;return m;};
let weatheredSurface;
function surfaceTexture(){
 if(weatheredSurface)return weatheredSurface;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#d1d3cf';c.fillRect(0,0,256,256);let seed=173;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<16000;i++){const shade=100+Math.floor(random()*130);c.fillStyle=`rgba(${shade},${shade},${shade},.13)`;c.fillRect(random()*256,random()*256,1+random()*2,1+random()*2);}
 for(let i=0;i<38;i++){c.fillStyle='rgba(35,42,40,.05)';c.beginPath();c.ellipse(random()*256,random()*256,3+random()*22,2+random()*10,random()*6.28,0,6.28);c.fill();}
 weatheredSurface=new THREE.CanvasTexture(canvas);weatheredSurface.colorSpace=THREE.SRGBColorSpace;weatheredSurface.wrapS=weatheredSurface.wrapT=THREE.RepeatWrapping;weatheredSurface.userData.shared=true;return weatheredSurface;
}
function label(parent,text,x,y,z,width=3,color='#f6d39c'){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#10272dec';c.fillRect(0,0,768,128);c.fillStyle=color;c.fillRect(0,0,7,128);c.font='bold 37px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text.toUpperCase(),388,66,724);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/6),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.userData.ownedMaterial=true;mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
export {buildBlacktide} from './zombies-world.js';

// 42 reusable articulated rigs write into five instanced batches. The skeleton
// is lightweight scene data, not 1,000 separately rendered Mesh objects.
function infectedRig(){
 const root=new THREE.Group(),parts=[],joint=(parent,x,y,z)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
 const part=(parent,shape,kind,x,y,z,w,h,d,types=null)=>{const o=new THREE.Object3D();o.position.set(x,y,z);o.scale.set(w,h,d);parent.add(o);parts.push({o,shape,kind,types});return o;};
 const hips=joint(root,0,.93,0),spine=joint(hips,0,.15,0),head=joint(spine,0,.51,-.04);
 part(hips,'round','cloth',0,0,0,.34,.23,.23);part(spine,'round','cloth',0,.16,0,.43,.42,.25);part(spine,'box','metal',0,.17,.11,.3,.32,.08);
 part(hips,'box','dark',0,.065,0,.36,.065,.25);part(hips,'box','metal',0,.065,-.13,.09,.06,.025);part(spine,'limb','skin',0,.4,0,.12,.16,.12);
 for(const side of [-1,1]){part(spine,'box','dark',side*.14,.2,-.125,.045,.34,.025);part(spine,'box','cloth',side*.1,.11,-.15,.13,.12,.045);}
 part(head,'round','skin',0,.07,0,.25,.3,.23);part(head,'round','skin',0,-.06,-.05,.19,.09,.17);part(head,'round','dark',0,.04,-.116,.21,.05,.025);
 for(const x of [-.065,.065])part(head,'glow','glow',x,.045,-.132,.025,.025,.015);
 part(head,'round','skin',0,.015,-.13,.055,.08,.06);for(const side of [-1,1])part(head,'round','skin',side*.13,.025,0,.045,.085,.055);
 part(head,'box','dark',0,-.07,-.134,.14,.022,.02);part(spine,'box','mark',.1,.17,-.14,.08,.18,.02);
 for(const side of [-1,1]){part(head,'box','dark',side*.066,.078,-.12,.075,.022,.035);part(head,'round','skin',side*.085,-.025,-.09,.08,.075,.06);}
 const legs=[],arms=[];
 for(const side of [-1,1]){
  const thigh=joint(hips,side*.12,-.08,0),knee=joint(thigh,0,-.39,0);legs.push({thigh,knee});
  part(thigh,'limb','cloth',0,-.19,0,.19,.44,.2);part(knee,'limb','cloth',0,-.18,0,.15,.41,.16);part(knee,'round','dark',0,0,-.065,.16,.13,.08);part(knee,'box','dark',0,-.37,-.035,.18,.15,.28);
  const arm=joint(spine,side*.25,.28,0),elbow=joint(arm,0,-.29,0);arms.push({arm,elbow});
  part(arm,'limb','cloth',0,-.13,0,.17,.34,.18);part(elbow,'limb','skin',0,-.15,0,.12,.33,.13);part(elbow,'round','skin',0,-.32,-.015,.12,.15,.09);part(elbow,'limb','cloth',0,-.02,0,.145,.1,.15);
  for(const f of [-1,1])part(elbow,'box','skin',f*.032,-.39,-.01,.028,.1,.035);
 }
 const armored=['armored','heavy','elite','boss'],corrupted=['disruptor','elite','boss'];
 const plates=[];for(const side of [-1,1])plates.push(part(spine,'box','armor',side*.24,.3,0,.25,.23,.32,armored));plates.push(part(spine,'box','armor',0,.2,-.13,.39,.39,.07,armored));
 const growth=part(spine,'round','growth',.16,.4,.09,.2,.3,.22,corrupted);
 for(const side of [-1,1]){part(spine,'limb','growth',side*.25,.46,.14,.1,.37,.11,corrupted);part(spine,'box','metal',side*.3,.3,.1,.15,.12,.22,['heavy','boss']);}
 part(head,'ring','growth',0,.12,.15,.62,.62,.6,['boss']);part(head,'box','metal',0,.13,.05,.28,.18,.2,['armored']);
 return {root,hips,spine,head,legs,arms,parts,plates,growth,id:null,cycle:0,blend:0};
}
const colorScratch=new THREE.Color(),matrix=new THREE.Matrix4(),dummy=new THREE.Object3D(),targetPosition=new THREE.Vector3(),white=new THREE.Color(0xffffff);
export class ZombiesView{
 constructor(scene,world){this.world=world;this.group=new THREE.Group();scene.add(this.group);this.actors=new InfectedActors(this.group);this.atmosphere=new BlacktideAtmosphere(this.group);this.expedition=new ExpeditionActors(this.group);this.rigs=Array.from({length:ZOMBIES.maxAlive+ZOMBIES.maxCorpses},infectedRig);this.batches={};for(const [shape,geometry]of Object.entries({round:new THREE.SphereGeometry(.5,10,7),limb:new THREE.CapsuleGeometry(.5,1,3,8).scale(1,.5,1),ring:new THREE.TorusGeometry(.5,.045,6,24),box:new RoundedBoxGeometry(1,1,1,1,.08),glow:new THREE.SphereGeometry(.5,6,4)})){const mesh=new THREE.InstancedMesh(geometry,shape==='glow'?new THREE.MeshBasicMaterial({color:0xffffff}):material(0xffffff),this.rigs.length*40);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=shape!=='glow';this.group.add(mesh);this.batches[shape]=mesh;}
  this.fx=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.025,4,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,depthWrite:false}),ZOMBIES.maxEffects+ZOMBIES.maxDrops+16);this.fx.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.fx.frustumCulled=false;this.group.add(this.fx);this.pickups=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.3),material(cyan,true),ZOMBIES.maxDrops+12);this.pickups.frustumCulled=false;this.group.add(this.pickups);
 }
 updateContamination(gas){
  if(!this.gasWall){
   const haze=new THREE.MeshBasicMaterial({color:0xc2b763,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false});
   this.gasWall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,35,64,1,true),haze);
   this.gasEdge=new THREE.Mesh(new THREE.RingGeometry(.995,1.005,64),new THREE.MeshBasicMaterial({color:0xf2cf69,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));
   this.gasEdge.rotation.x=-Math.PI/2;this.group.add(this.gasWall,this.gasEdge);
  }
  this.gasWall.visible=this.gasEdge.visible=!!gas?.active;
  if(gas?.active){this.gasWall.position.set(gas.x,17.5,gas.z);this.gasWall.scale.set(gas.radius,1,gas.radius);this.gasEdge.position.set(gas.x,.08,gas.z);this.gasEdge.scale.setScalar(gas.radius);}
 }
 update(state,dt,camera,playing){
  const z=playing&&state?.zombies;this.group.visible=!!z;if(!z){for(const r of this.rigs)r.id=null;this.actors.hide();return;}const time=state.time,art=this.world.userData.blacktide;this.updateContamination(z.gas);this.atmosphere.update(time,camera);
  const near=(g,r)=>Math.hypot(g.position.x-camera.position.x,g.position.z-camera.position.z)<r;if(art){for(const g of art.labels||[])g.visible=near(g,85);for(const [id,mesh]of art.doors)mesh.visible=!z.open.includes(id);for(const [id,g]of art.shutters)g.children.forEach((c,i)=>{if(i<3)c.visible=i<(z.shutters[id]?.health||0);});art.aerial.rotation.y+=dt*.02;for(const [id,g]of art.stationGroups){g.visible=near(g,id.startsWith('exfil-')?100:48);if(id.startsWith('cache-'))g.visible&&=id===Z_CACHE_SITES[z.cache.site].id;if(id.startsWith('core-'))g.visible=!z.quest.cores.includes(Number(id.slice(-1))-1);if(g.userData.rotor)g.userData.rotor.rotation.y+=dt;if(g.userData.lid)g.userData.lid.position.y=z.cache.claimUntil>time?1.5:1;}
   const cache=art.stationGroups.get(Z_CACHE_SITES[z.cache.site].id);if(this.cacheWeapon!==z.cache.weapon||this.cacheSite!==z.cache.site){if(this.cacheModel){this.cacheModel.parent?.remove(this.cacheModel);this.cacheModel.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.userData.ownedMaterial&&o.material&&!o.material.userData.shared){o.material.map?.dispose();o.material.dispose();}});}this.cacheWeapon=z.cache.weapon;this.cacheSite=z.cache.site;this.cacheModel=z.cache.weapon?makeBlaster(z.cache.weapon):null;if(this.cacheModel){this.cacheModel.position.y=1.9;cache.add(this.cacheModel);}}if(this.cacheModel){this.cacheModel.visible=time>=z.cache.busyUntil;this.cacheModel.rotation.y+=dt;}
  }
  this.expedition.update(state,dt,camera);const authored=this.actors.update(z.enemies,time,dt,camera);if(art){for(const [id,g]of art.lootGroups||[])g.visible=near(g,40)&&!z.loot?.find(l=>l.id===id)?.opened;for(const [id,g]of art.contractGroups||[]){const c=z.contracts?.find(c=>c.id===id);g.visible=near(g,70)&&['available','active'].includes(c?.status);if(g.userData.beacon)g.userData.beacon.rotation.y+=dt;}}const ids=new Set(z.enemies.filter(e=>!authored.has(e.id)).map(e=>e.id));for(const r of this.rigs)if(!ids.has(r.id))r.id=null;const counts={round:0,limb:0,ring:0,box:0,glow:0};
  for(const e of z.enemies){if(authored.has(e.id))continue;let r=this.rigs.find(r=>r.id===e.id);if(!r){r=this.rigs.find(r=>r.id===null);if(!r)continue;r.id=e.id;r.root.position.set(e.x,e.y,e.z);r.root.rotation.set(0,e.yaw,0);r.cycle=e.phase;r.blend=0;}const type=Z_TYPES[e.type],speed=Math.hypot(e.vx,e.vz),smooth=1-Math.exp(-18*dt),dead=e.health<=0,death=dead?clamp((time-e.deadAt)/.7,0,1):0,emerge=clamp((e.emergeUntil-time)/1.4,0,1);
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
   r.root.updateMatrixWorld(true);
   const palette={skin:type.color,cloth:type.cloth,dark:0x252d2d,metal:0x4d5e60,mark:0xc5aa72,armor:0x637e80,growth:e.type==='disruptor'?0x889bdd:0x5bb3ac,glow:e.type==='boss'?0xffad71:e.type==='disruptor'?0xb3a2f1:0x9ce1c4};
   for(const p of r.parts){if(p.types&&!p.types.includes(e.type))continue;const batch=this.batches[p.shape],n=counts[p.shape]++;batch.setMatrixAt(n,p.o.matrixWorld);colorScratch.set(palette[p.kind]);if(time-(e.lastHit||-100)<.07)colorScratch.lerp(white,.45);batch.setColorAt(n,colorScratch);}
  }
  for(const [shape,batch]of Object.entries(this.batches)){batch.count=counts[shape];batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;}
  let f=0,p=0;for(const effect of z.effects){const age=clamp((time-effect.born)/(effect.until-effect.born),0,1);dummy.position.set(effect.x,effect.y+.1,effect.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(effect.radius*(effect.kind==='warning'?1:.2+age*.8));dummy.updateMatrix();this.fx.setMatrixAt(f,dummy.matrix);this.fx.setColorAt(f++,colorScratch.set(effect.kind==='warning'?0xff704e:effect.kind==='sanctuary'?0x91e6bd:cyan));}
  for(const drop of z.drops){dummy.position.set(drop.x,drop.y+.85+Math.sin(time*3)*.1,drop.z);dummy.rotation.set(0,time,0);dummy.scale.setScalar(1);dummy.updateMatrix();this.pickups.setMatrixAt(p,dummy.matrix);this.pickups.setColorAt(p++,colorScratch.set(Z_POWERUPS[drop.type]?.color||cyan));}
  for(const b of z.grenades){dummy.position.set(b.x,b.y,b.z);dummy.scale.setScalar(.5);dummy.updateMatrix();this.pickups.setMatrixAt(p,dummy.matrix);this.pickups.setColorAt(p++,colorScratch.set(amber));}
  for(const [id,trap]of Object.entries(z.traps))if(trap.until>time){const s=Z_STATIONS.find(s=>s.id===id);dummy.position.set(s.x,.1,s.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(s.radius);dummy.updateMatrix();this.fx.setMatrixAt(f,dummy.matrix);this.fx.setColorAt(f++,colorScratch.set(cyan));}
  this.fx.count=f;this.fx.instanceMatrix.needsUpdate=true;if(this.fx.instanceColor)this.fx.instanceColor.needsUpdate=true;this.pickups.count=p;this.pickups.instanceMatrix.needsUpdate=true;if(this.pickups.instanceColor)this.pickups.instanceColor.needsUpdate=true;
 }
}
