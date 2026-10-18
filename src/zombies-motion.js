import {Quaternion,MathUtils} from 'three';
import payload from './zombies-motion-data.js';
import mixamo from './mixamo-clips.js';
const decoded=new Map(),q1=new Quaternion(),q2=new Quaternion();
function sample(pack,id,time,bones,weight=1){const clip=pack.clips[id],key=(pack===payload?'z:':'m:')+id;if(!clip)return;if(!decoded.has(key)){const bytes=Uint8Array.from(atob(clip.data),c=>c.charCodeAt(0));decoded.set(key,new Int16Array(bytes.buffer));}const data=decoded.get(key),stride=3+pack.bones.length*4,t=clip.loop?time%clip.duration:Math.min(clip.duration,time),frame=Math.min(t*pack.rate,clip.frames-1),a=Math.floor(frame)*stride,b=Math.min(Math.floor(frame)+1,clip.frames-1)*stride,f=frame-Math.floor(frame);bones.hips.position.y=MathUtils.lerp(bones.hips.position.y,MathUtils.lerp(data[a+1],data[b+1],f)/10000,weight);for(let i=0;i<pack.bones.length;i++){const bone=bones[pack.bones[i]];if(!bone)continue;q1.fromArray(data,a+3+i*4).normalize();q2.fromArray(data,b+3+i*4).normalize();q1.slerp(q2,f);bone.quaternion.slerp(q1,weight);}}
export function animateInfected(model,e,dt,time){
 const h=model.userData.human,b=h.bones,speed=Math.hypot(e.vx||0,e.vz||0);
 h.zMotion??={id:null,time:0,blend:1,from:{},yaw:e.yaw||0,air:false,land:0};
 const s=h.zMotion,air=e.state==='leap'||(e.lift||0)>.1;
 if(s.air&&!air)s.land=.3;s.air=air;s.land=Math.max(0,s.land-dt);
 const turn=Math.atan2(Math.sin((e.yaw||0)-s.yaw),Math.cos((e.yaw||0)-s.yaw));s.yaw=e.yaw||0;
 const id=e.health<=0?'death':e.state==='emerge'?'rise':e.disguised?'guard':e.state==='stagger'?'stagger':air?((e.leapProgress||0)<.2?'leap-start':'leap'):s.land>0?'land':e.state==='climb'?'climb':e.state==='attack'?(e.ability==='charge'?'charge':['slam','pulse','summon'].includes(e.ability)?'cast':['heavy','elite','colossus','mimic'].includes(e.type)?'hook':'attack'):speed>2.5?'run':speed>.2?'walk':Math.abs(turn)>.035?'turn':'idle';
 if(s.id!==id){s.id=id;s.time=0;s.blend=0;for(const [name,bone]of Object.entries(b))s.from[name]=bone.quaternion.clone();}else s.time+=dt;
 for(const bone of Object.values(b)){bone.position.copy(bone.userData.rest);bone.quaternion.identity();}
 const heavy=['heavy','colossus','boss'].includes(e.type),pace=heavy?.82:e.type==='leaper'?1.16:1;
 if(id==='run')sample(mixamo,'run-forward',s.time*Math.max(.8,speed/3.5),b);
 else if(id==='death')sample(mixamo,'death',s.time,b);
 else sample(payload,id==='turn'?'walk':id,s.time*(id==='walk'?Math.max(.6,speed/1.55)*pace:1),b);
 // Additive silhouettes preserve bone lengths and the authored foot cadence.
 if(['walk','run','idle','turn'].includes(id)){
  b.chest.rotation.x+=(heavy?.12:e.type==='runner'?.07:e.type==='mimic'?.2:.025);
  if(e.type==='armored'){b.armL.rotation.x-=.28;b.forearmL.rotation.x-=.42;}
  if(e.type==='disruptor'){b.armL.rotation.z-=.12;b.armR.rotation.z+=.12;}
  if(id==='turn'){b.hips.rotation.y+=MathUtils.clamp(turn*2,-.2,.2);b.head.rotation.y+=MathUtils.clamp(turn,-.15,.15);}
 }
 if(e.ability==='slam'&&id==='cast'){const f=MathUtils.clamp((time-(e.attackAt-1.5))/1.5,0,1);b.armL.rotation.x-=Math.sin(f*Math.PI)*1.1;b.armR.rotation.x-=Math.sin(f*Math.PI)*1.1;b.chest.rotation.x+=Math.sin(f*Math.PI)*.22;}
 if(e.ability==='pulse'||e.ability==='summon'){b.armL.rotation.z-=.5;b.armR.rotation.z+=.5;b.forearmL.rotation.x-=.4;b.forearmR.rotation.x-=.4;}
 s.blend=Math.min(1,s.blend+dt/(id==='stagger'?.08:.18));
 for(const [name,bone]of Object.entries(b))if(s.from[name])bone.quaternion.copy(s.from[name].clone().slerp(bone.quaternion,s.blend));
 model.updateMatrixWorld(true);
}
