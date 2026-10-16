import {Quaternion,Vector3,MathUtils} from 'three';
import payload from './mixamo-clips.js';
import {itemDrawProfile} from './equip.js';

// Shared, quantized, pre-baked mocap: no FBX loader, AI model, animation mixer
// or per-character copy of the source tracks is needed during a match.
export const MOTION_NAMES=Object.freeze(Object.keys(payload.clips));
const bones=payload.bones,stride=3+bones.length*4,decoded=new Map();
const q1=new Quaternion(),q2=new Quaternion(),q3=new Quaternion(),root=new Vector3();
const directions=['forward','forward-right','right','backward-right','backward','backward-left','left','forward-left'];
const clamp=MathUtils.clamp;
function clip(id){
 const info=payload.clips[id];if(!info)throw Error('Unknown character animation: '+id);
 if(!decoded.has(id)){const bytes=Uint8Array.from(atob(info.data),c=>c.charCodeAt(0));decoded.set(id,new Int16Array(bytes.buffer));}
 return {info,data:decoded.get(id)};
}
export function motionInfo(id){const c=payload.clips[id];return c?{duration:c.duration,distance:c.distance,frames:c.frames,loop:c.loop}:null;}
function indices(info,time,loop=info.loop){
 const t=loop?((time%info.duration)+info.duration)%info.duration:clamp(time,0,info.duration);
 const frame=Math.min(t*payload.rate,info.frames-1),a=Math.floor(frame),b=Math.min(a+1,info.frames-1);
 return [a*stride,b*stride,frame-a];
}
function readQuaternion(data,offset,q){return q.set(data[offset]/32767,data[offset+1]/32767,data[offset+2]/32767,data[offset+3]/32767).normalize();}
function sample(id,time,target,weight=1,upperOnly=false,loop){
 const {info,data}=clip(id),[a,b,t]=indices(info,time,loop);
 if(!upperOnly){root.set(MathUtils.lerp(data[a],data[b],t)/10000,MathUtils.lerp(data[a+1],data[b+1],t)/10000,MathUtils.lerp(data[a+2],data[b+2],t)/10000);target.hips.position.lerp(root,weight);}
 for(let i=0;i<bones.length;i++){
  const name=bones[i];if(upperOnly&&(name==='hips'||/^(thigh|shin|foot|toe)/.test(name)))continue;
  readQuaternion(data,a+3+i*4,q1);readQuaternion(data,b+3+i*4,q2);q1.slerp(q2,t);target[name].quaternion.slerp(q1,weight);
 }
}
export function motionSelection(p,time,speed){
 if(p.health!==undefined&&p.health<=0)return {id:p.crouching?'crouch-death':'death',freeHands:true};
 if(p.downed)return {id:'crawl',frozen:speed<.1,freeHands:true};
 if(p.reviving)return {id:'revive',freeHands:true};
 if(p.mantle)return {id:'mantle',progress:clamp((p.mantle.elapsed||0)/Math.max(.01,p.mantle.duration||.44),0,1),freeHands:true,levelRoot:true};
 if(p.traversal)return {id:'hang',freeHands:false,levelRoot:true};
 if(p.vehicleId)return {id:'sit',freeHands:false};
 if(p.emote)return {id:p.emote.id==='shuffle'?'shuffle':p.emote.id,at:Math.max(0,time-(p.emote.start??time)),freeHands:p.emote.id!=='crown'};
 if(p.sliding)return {id:'slide',at:clamp(p.slideAge||0,0,.12)+.18,freeHands:false};
 if(p.flight==='dive'||p.flight==='launch')return {id:'airborne',freeHands:false,levelRoot:true};
 if(p.flight==='glide')return {id:'hang',freeHands:false,levelRoot:true};
 if(p.grounded===false)return {id:(p.vy||0)>0?'jump':'fall',freeHands:false,levelRoot:true};
 return {id:'locomotion',freeHands:false};
}
export function animateCharacterMotion(h,p,dt,time,{menu=false}={}){
 const b=h.bones,speed=menu&&p.lobbyPatrol?p.lobbyPatrol.speed:Math.hypot(p.vx||0,p.vz||0),s=motionSelection(p,time,speed);
 if(s.id==='locomotion'&&speed<.75&&(['jump','fall'].includes(h.mocap?.id)||h.mocap?.id==='land'&&h.mocap.elapsed<.22))s.id='land';
 // A missing optional clip is a development error, never a silent state swap.
 if(s.id!=='locomotion'&&!payload.clips[s.id])return null;
 let state=h.mocap;
 if(!state){state=h.mocap={id:'',elapsed:0,phase:0,blend:1,previous:[],from:[],previousRoot:new Vector3(0,.93,0),fromRoot:new Vector3(0,.93,0)};for(const name of bones){state.previous.push(b[name].quaternion.clone());state.from.push(b[name].quaternion.clone());}}
 const changed=state.id!==s.id;
 if(changed){state.id=s.id;state.elapsed=0;state.blend=0;state.fromRoot.copy(state.previousRoot);state.from.forEach((q,i)=>q.copy(state.previous[i]));}
 else state.elapsed+=dt;
 if(s.id==='locomotion'){
  const forward=menu?speed:-(p.vx||0)*Math.sin(p.yaw||0)-(p.vz||0)*Math.cos(p.yaw||0),side=menu?0:(p.vx||0)*Math.cos(p.yaw||0)-(p.vz||0)*Math.sin(p.yaw||0);
  const angle=(Math.atan2(side,forward)/(Math.PI/4)+8)%8,index=Math.floor(angle),w=angle-index;
  const gait=p.crouching?'crouch':p.sprinting?'sprint':speed>3.2?'run':'walk';
  const unarmed=!p.weapon&&!p.inventory&&!p.aim&&!p.building&&!menu;
  const a=unarmed&&index===0&&!p.crouching?(speed>3.2?'unarmed-run':'unarmed-walk'):gait+'-'+directions[index],c=unarmed&&index===0?a:gait+'-'+directions[(index+1)%8],info=payload.clips[a];
  state.phase=(state.phase+speed*dt/Math.max(.3,info.distance))%1;
  sample(a,state.phase*info.duration,b);sample(c,state.phase*payload.clips[c].duration,b,w);
  const idle=p.crouching?(p.aim?'crouch-aim':'crouch-idle'):unarmed?'unarmed-idle':p.aim?'aim':'idle';
  sample(idle,time,b,1-MathUtils.smoothstep(speed,.08,.75));
  state.gait=gait;state.direction=directions[index];
 }else{
  const info=payload.clips[s.id],at=s.progress!==undefined?s.progress*info.duration:s.at??(s.frozen?.5:s.id==='land'?state.elapsed/.22*info.duration:state.elapsed);
  sample(s.id,at,b,1,false,s.id==='crawl'&&!s.frozen?true:undefined);
  if(s.id==='slide'){b.hips.position.x=0;b.hips.position.z=0;}
  if(s.levelRoot)b.hips.position.set(0,.93,0); // Physics owns height/trajectory.
 }
 // Host-clock action layers retain movement underneath and exact gameplay timing.
 let action=null,progress=0;
 if(s.id==='locomotion'||s.id==='jump'||s.id==='fall'){
  if(p.throwProgress>=0&&p.throwProgress<=1){action='throw';progress=p.throwProgress;}
  else if(p.use){action=['mini','flask'].includes(p.use.id)?'drink':'heal';progress=clamp((time-(p.use.start??time))/Math.max(.1,(p.use.end??time+1)-(p.use.start??time)),0,1);}
  else if(p.swingAt&&time-p.swingAt<.55){action='melee';progress=clamp((time-p.swingAt)/.55,0,1);}
  else if(p.reloadEnd>time){action='reload';progress=clamp(1-(p.reloadEnd-time)/Math.max(.1,p.reloadDuration||2),0,1);}
  else if(p.equipUntil>time){const age=time-(p.equipStarted??time),holster=p.equipHolster||0,route=itemDrawProfile(p.inventory?.[p.slot]||{id:p.weapon,weapon:true}).route;action=(age<holster?'holster':'draw')+(route==='back'?'':'-hip');progress=clamp(age<holster?age/holster:(age-holster)/Math.max(.1,p.equipUntil-(p.equipStarted??time)-holster),0,1);}
  else if(p.building){action='build';progress=(time*.4)%1;}
  if(action&&payload.clips[action])sample(action,progress*payload.clips[action].duration,b,1,true,false);
  b.chest.rotateX(-(p.pitch||0)*.12+(p.shotRecoil||0)*.018);b.head.rotateX(-(p.pitch||0)*.3);
  if(menu){b.head.rotateY(p.scan||p.lobbyPatrol?.headYaw||0);b.chest.rotateY((p.scan||0)*.3);}
 }
 if(!changed&&state.action!==action){state.blend=0;state.fromRoot.copy(state.previousRoot);state.from.forEach((q,i)=>q.copy(state.previous[i]));}
 state.blend=Math.min(1,state.blend+dt/(s.id==='slide'?.1:.16));const blend=state.blend*state.blend*(3-2*state.blend);
 b.hips.position.lerpVectors(state.fromRoot,b.hips.position,blend);
 bones.forEach((name,i)=>{q3.copy(b[name].quaternion);b[name].quaternion.copy(state.from[i]).slerp(q3,blend);state.previous[i].copy(b[name].quaternion);});state.previousRoot.copy(b.hips.position);
 state.action=action;state.freeHands=s.freeHands;return state;
}
