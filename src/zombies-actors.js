import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {Z_TYPES} from './zombies-config.js';
import {makeHumanoid,animateHumanoid} from './humanoid.js';
import {animateInfected} from './zombies-motion.js';
import {makeBlaster} from './zombies-weapons.js';
import {makeArms,updateArms} from './arms.js';
import {EYE,VIEWMODEL} from './physics.js';
import {Z_STATIONS} from './zombies-map.js';
const loader=new GLTFLoader(),templates=new Map();let loading;
export function loadInfectedModels(){return loading??=Promise.all(['hound'].map(async kind=>{try{const gltf=await loader.loadAsync(new URL('models/blacktide/'+kind+'.glb',document.baseURI).href);gltf.scene.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3());templates.set(kind,{gltf,scale:(kind==='hound'?.85:1.84)/size.y,min:bounds.min.y,center:bounds.getCenter(new T.Vector3())});}catch(error){console.warn('Infected model unavailable:',kind,error.message);}}));}
export class InfectedActors{
 constructor(group){this.group=group;this.pool=[];this.ready=true;this.loading=null;}
 load(){return this.loading??=loadInfectedModels();}
 make(kind){if(kind==='hound'&&!templates.has('hound'))return null;if(this.pool.length>=56){const spare=this.pool.find(a=>a.id===null);if(!spare)return null;spare.mixer?.stopAllAction();spare.mixer?.uncacheRoot(spare.model);this.group.remove(spare.root);spare.model.traverse(o=>o.skeleton?.dispose());if(spare.root.userData.lure){spare.root.userData.lure.geometry.dispose();spare.root.userData.lure.material.dispose();}this.pool.splice(this.pool.indexOf(spare),1);}
  const source=templates.get('hound'),hound=kind==='hound'&&source;let model,root=new T.Group(),mixer=null,actions={};
  if(hound){model=clone(source.gltf.scene);model.scale.setScalar(source.scale);model.position.set(-source.center.x*source.scale,-source.min*source.scale,-source.center.z*source.scale);mixer=new T.AnimationMixer(model);for(const clip of source.gltf.animations){actions[clip.name]=mixer.clipAction(clip);if(/Death|Attack/.test(clip.name)){actions[clip.name].setLoop(T.LoopOnce,1);actions[clip.name].clampWhenFinished=true;}}}
  else{const type=Z_TYPES[kind]||Z_TYPES.husk;model=makeHumanoid({color:new T.Color(type.cloth).getStyle(),accent:'#9b9272',infectedSkin:kind==='mercenary'?null:new T.Color(type.color).getStyle(),infectedType:kind==='mercenary'?null:kind});model.userData.human.mesh.castShadow=false;if(kind==='mercenary'){const held=new T.Group(),blaster=makeBlaster('sprinter'),arms=makeArms('sprinter',{},false);held.scale.setScalar(VIEWMODEL.scale);held.position.set(VIEWMODEL.x,EYE+VIEWMODEL.y,VIEWMODEL.z);arms.visible=false;held.add(blaster,arms);model.add(held);Object.assign(model.userData,{held,blaster,arms});}}
  if(kind==='mimic'){const lure=new T.Mesh(new T.BoxGeometry(.8,.7,.6),new T.MeshStandardMaterial({color:0x666751,roughness:.9}));lure.position.y=.35;root.add(lure);root.userData.lure=lure;}root.add(model);root.visible=false;this.group.add(root);const actor={root,model,mixer,actions,kind,id:null,last:'',lod:0,hound:!!hound};this.pool.push(actor);return actor;
 }
 update(enemies,time,dt,camera){void this.load();const ids=new Set(enemies.map(e=>e.id));for(const a of this.pool)if(!ids.has(a.id)){a.id=null;a.root.visible=false;a.mixer?.stopAllAction();a.last='';}
  const handled=new Set();
  for(const e of [...enemies].sort((a,b)=>Math.hypot(a.x-camera.position.x,a.z-camera.position.z)-Math.hypot(b.x-camera.position.x,b.z-camera.position.z))){const distance=Math.hypot(e.x-camera.position.x,e.z-camera.position.z);if(distance>55||handled.size>=28)continue;const kind=e.type;let a=this.pool.find(a=>a.id===e.id);if(!a){a=this.pool.find(a=>a.id===null&&a.kind===kind)||this.make(kind);if(!a)continue;a.id=e.id;a.root.position.set(e.x,e.y,e.z);a.root.rotation.y=e.yaw+(a.hound?Math.PI:0);if(a.model.userData.human)a.model.userData.human.zMotion=null;}
   handled.add(e.id);a.root.visible=true;a.model.visible=!e.disguised;if(a.root.userData.lure)a.root.userData.lure.visible=!!e.disguised;const f=1-Math.exp(-18*dt);a.root.position.lerp(new T.Vector3(e.x,e.y+(e.lift||0)-Math.max(0,e.emergeUntil-time)*.25,e.z),Math.hypot(e.x-a.root.position.x,e.z-a.root.position.z)>5?1:f);const yaw=e.yaw+(a.hound?Math.PI:0);a.root.rotation.y+=Math.atan2(Math.sin(yaw-a.root.rotation.y),Math.cos(yaw-a.root.rotation.y))*f;a.root.scale.setScalar(a.hound?1:Z_TYPES[e.type].scale);a.lod+=dt;const interval=distance>35?1/12:distance>18?1/20:0;if(a.lod<interval)continue;
   if(a.hound){const speed=Math.hypot(e.vx||0,e.vz||0),name=e.health<=0?'Death':e.state==='attack'?'Attack':speed>2?'Run':speed>.1?'Walk':'Idle',action=a.actions[name]||a.actions.Run||Object.values(a.actions)[0];if(action){if(a.last!==name){action.reset().fadeIn(.15).play();a.actions[a.last]?.fadeOut(.15);a.last=name;}a.mixer.update(a.lod);}}
   else if(kind==='mercenary'){const {held,arms,blaster}=a.model.userData;held.visible=e.health>0;const pose=updateArms(arms,-1,blaster);held.rotation.set(pose.rotation[0],pose.rotation[1],pose.rotation[2]);animateHumanoid(a.model,{...e,weapon:'sprinter',grounded:true,aim:e.state==='attack'||e.state==='aim'},a.lod,time);}
   else animateInfected(a.model,e,a.lod,time);a.lod=0;
  }
  for(const a of this.pool)if(a.id!==null&&!handled.has(a.id)){a.root.visible=false;a.id=null;a.last='';a.mixer?.stopAllAction();}return handled;
 }
 hide(){for(const a of this.pool){a.root.visible=false;a.id=null;a.last='';a.mixer?.stopAllAction();}}
}
const materials=new Map();function mat(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.75,metalness:.3}));return materials.get(color);}
function box(g,x,y,z,w,h,d,color){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);g.add(m);return m;}
export function makeExpeditionVehicle(transport=false){
 const g=new T.Group();
 if(transport){
  box(g,0,1,0,3,1.6,6,0x3b5149);box(g,0,1.8,-.5,2.6,1,2,0x263e42);
  box(g,0,1.3,4,.7,.7,5,0x50655a);box(g,0,2,6,.25,2,1.2,0x587160);
  const rotor=new T.Group();rotor.position.y=2.8;box(rotor,0,0,0,11,.06,.22,0x253931);box(rotor,0,0,0,.22,.06,11,0x253931);g.add(rotor);g.userData.rotor=rotor;
  for(const side of [-1,1]){box(g,side*1.6,.15,0,.13,.13,5,0x849386);box(g,side*1.2,.4,0,.13,.8,.13,0x849386);}
 }else{
  // Open four-seat chassis: occupants have space above the seats and a clear
  // sightline over the hood. Roll bars do not form a solid camera-obstructing cab.
  box(g,0,.57,0,1.8,.26,3.2,0x364b43);box(g,0,.87,-1.12,1.75,.36,.78,0x59715e);
  box(g,0,.68,-1.69,1.95,.16,.13,0x293c36);box(g,0,.7,1.67,1.95,.16,.13,0x293c36);
  for(const side of [-1,1]){
   box(g,side*.87,.83,.15,.12,.38,2,0x59715e);box(g,side*.87,1.43,.25,.07,1.3,.07,0x8b9b88);
   box(g,side*.87,1.43,-.85,.07,1.3,.07,0x8b9b88);box(g,side*.87,2.08,-.25,.08,.08,1.35,0x8b9b88);
   box(g,side*.62,1,-1.53,.35,.18,.04,0xe6e4bb);box(g,side*.62,.9,1.63,.28,.12,.04,0xb77450);
   for(const z of [-.45,.7]){box(g,side*.45,.91,z,.59,.15,.55,0x273b36);box(g,side*.45,1.2,z+.28,.59,.55,.12,0x273b36);}
   for(const z of [-1,1]){const w=new T.Mesh(new T.CylinderGeometry(.42,.42,.28,12),mat(0x1d2827));w.rotation.z=Math.PI/2;w.position.set(side*.99,.45,z);w.userData.wheel=true;g.add(w);}
  }
  box(g,0,2.08,-.85,1.8,.08,.08,0x8b9b88);box(g,0,2.08,.35,1.8,.08,.08,0x8b9b88);
  box(g,0,1.25,-.94,1.65,.25,.18,0x314940);const wheel=new T.Mesh(new T.TorusGeometry(.18,.025,5,16),mat(0x1d2827));wheel.position.set(-.45,1.5,-.91);wheel.rotation.x=-.35;g.add(wheel);
 }
 const batches=new Map();for(const m of [...g.children])if(m.isMesh&&!m.userData.wheel){m.updateMatrix();const geometry=m.geometry.clone().applyMatrix4(m.matrix);if(!batches.has(m.material))batches.set(m.material,[]);batches.get(m.material).push(geometry);m.geometry.dispose();g.remove(m);}
 for(const [material,parts]of batches){g.add(new T.Mesh(mergeGeometries(parts),material));parts.forEach(p=>p.dispose());}
 return g;
}
const vehicle=makeExpeditionVehicle;
export class ExpeditionActors{
 constructor(group){this.group=group;this.vehicles=new Map();this.transports=new Map();this.objects=new Map();}
 object(id,kind){let m=this.objects.get(id);if(m)return m;m=new T.Group();m.userData.kind=kind;
  if(kind==='escort')m.add(vehicle());
  else if(kind==='hound'&&templates.has('hound')){const src=templates.get('hound'),dog=clone(src.gltf.scene);dog.scale.setScalar(src.scale);dog.position.set(-src.center.x*src.scale,-src.min*src.scale,-src.center.z*src.scale);m.add(dog);const mixer=new T.AnimationMixer(dog),clip=src.gltf.animations.find(c=>c.name==='Run');if(clip)mixer.clipAction(clip).play();m.userData.mixer=mixer;m.userData.sharedGeometry=true;const ring=new T.Mesh(new T.RingGeometry(.7,.76,16),new T.MeshBasicMaterial({color:0x8af4b9,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.04;ring.userData.owned=true;m.add(ring);}
  else if(kind==='turret'){box(m,0,.3,0,1,.6,1,0x4f6557);box(m,0,1,0,.25,1,.25,0x9f9f82);box(m,0,1.45,-.15,.8,.6,.8,0x3a4d43);box(m,0,1.45,-.9,.15,.15,1,0x2a3933);}
  else if(kind==='defend'||kind==='vault'||kind==='resonator'){const ring=new T.Mesh(new T.RingGeometry(kind==='resonator'?7.8:13.8,kind==='resonator'?8:14,48),new T.MeshBasicMaterial({color:kind==='resonator'?0xbd9ee6:0xeec97b,side:T.DoubleSide,transparent:true,opacity:.7}));ring.rotation.x=-Math.PI/2;ring.position.y=.065;ring.userData.owned=true;m.add(ring);}
  else if(kind==='mine'||kind==='strike'){box(m,0,.12,0,.5,.24,.5,0x7c775b);const ring=new T.Mesh(new T.RingGeometry(kind==='mine'?3.8:11.8,kind==='mine'?4:12,32),new T.MeshBasicMaterial({color:kind==='mine'?0x8ecabd:0xffb76b,side:T.DoubleSide,transparent:true,opacity:.45}));ring.rotation.x=-Math.PI/2;ring.position.y=.04;ring.userData.owned=true;m.add(ring);}
  else{box(m,0,.4,0,.75,.8,.6,kind==='reward'?0x88784c:0x69765c);box(m,0,.84,0,.8,.08,.65,0xd2bb7e);box(m,0,.4,.31,.3,.1,.03,0xf5d78d);}
  this.group.add(m);this.objects.set(id,m);return m;
 }
 update(state,dt,camera){const z=state.zombies;if(!z)return;const near=(v,r=80)=>!camera||Math.hypot(v.x-camera.position.x,v.z-camera.position.z)<r;
  for(const v of z.vehicles||[]){let m=this.vehicles.get(v.id);if(!m){m=vehicle();this.group.add(m);this.vehicles.set(v.id,m);}m.visible=near(v);m.position.lerp(new T.Vector3(v.x,v.y||0,v.z),m.userData.placed?1-Math.exp(-15*dt):1);m.userData.placed=true;m.rotation.set(v.pitch||0,v.yaw||0,v.roll||0,'YXZ');m.traverse(o=>{if(o.userData.wheel)o.rotation.x+=(v.speed||0)*dt/.42;});m.userData.health=v.health;}
  for(const e of z.evacs||[]){let m=this.transports.get(e.id);if(!m){m=vehicle(true);this.group.add(m);this.transports.set(e.id,m);}m.visible=['approaching','landed','departing'].includes(e.status);const remain=e.until-state.time;m.position.set(e.x,e.status==='landed'?1:e.status==='approaching'?1+Math.max(0,remain)*1.4:1+(8-remain)*3,e.z+(e.status==='approaching'?Math.max(0,remain)*2:0));m.userData.rotor.rotation.y+=dt*30;}
  const objects=(z.contracts||[]).flatMap(c=>c.status==='active'?[...c.targets.filter(t=>!c.claimed.includes(t.index)),...(['defend','vault'].includes(c.contractKind)?[{...c,id:c.id+'-area',kind:c.contractKind}]:[]),...(c.rover?[{...c.rover,id:c.id+'-rover',kind:'escort'}]:[])]:c.status==='complete'&&c.reward?[{...c.reward,id:c.id+'-reward',kind:'reward'}]:[]);
  for(const squad of Object.values(z.squads||{})){const op=squad.operation;if(op?.active>=0){const t=Z_STATIONS.find(t=>t.kind==='resonator'&&t.index===op.active);objects.push({...t,id:'resonator-area-'+squad.id,kind:'resonator'});}}
  objects.push(...(z.loot||[]).filter(l=>(l.id.startsWith('drop-')||l.id.startsWith('bag-'))&&!l.opened),...(z.supports||[]).map(s=>({...s,id:'support-'+s.id})));
  const alive=new Set(objects.map(o=>o.id));for(const [id,m]of this.objects)if(!alive.has(id)){this.group.remove(m);m.userData.mixer?.stopAllAction();m.traverse(o=>{o.skeleton?.dispose();if(!m.userData.sharedGeometry||o.userData.owned){o.geometry?.dispose();if(o.userData.owned)o.material?.dispose();}});this.objects.delete(id);}
  for(const o of objects){const m=this.object(o.id,o.kind);m.visible=near(o);const prior=m.position.clone();m.position.lerp(new T.Vector3(o.x,o.y||0,o.z),m.userData.placed?1-Math.exp(-10*dt):1);if(['hound','escort'].includes(o.kind)&&prior.distanceToSquared(m.position)>.001)m.rotation.y=Math.atan2(prior.x-m.position.x,prior.z-m.position.z)+(o.kind==='hound'?Math.PI:0);m.userData.placed=true;if(m.visible)m.userData.mixer?.update(dt);}
 }
}
