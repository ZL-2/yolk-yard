export const AFK_SECONDS=59,AFK_WARNING_SECONDS=12;
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function newActivity(time=0){return {last:time,started:time,active:0,distance:0,contributions:0,damage:0,seen:[],lookYaw:0,lookPitch:0,initialized:false};}
// Repeated packets, idle animation, slot toggles and tiny camera jitter do not
// qualify. Keep a bounded recent signature window to reject simple input loops.
export function meaningfulActivity(a,kind,signature,time){
 a.seen=a.seen.filter(e=>time-e.time<90).slice(-160);
 const key=kind+':'+signature;
 if(a.seen.filter(e=>e.key===key).length>=2)return false;
 a.seen.push({key,time});a.last=time;return true;
}
export function observeInput(a,input,time){
 if(!a.initialized){a.lookYaw=input.yaw||0;a.lookPitch=input.pitch||0;a.initialized=true;return false;}
 const yaw=input.yaw||0,pitch=input.pitch||0;
 if(Math.abs(angle(yaw-a.lookYaw))+Math.abs(pitch-a.lookPitch)<.07)return false;
 a.lookYaw=yaw;a.lookPitch=pitch;
 return meaningfulActivity(a,'look',Math.round(angle(yaw)*8)+','+Math.round(pitch*8),time);
}
export function observeMotion(a,p,dt,time){
 if(a.x!==undefined){const distance=Math.hypot(p.x-a.x,p.z-a.z);if(distance>.035&&distance<Math.max(1,dt*35)){
  a.distance+=distance;
  if(a.distance-(a.lastDistance||0)>.7){a.lastDistance=a.distance;meaningfulActivity(a,'move',Math.round(p.x/2)+','+Math.round(p.z/2),time);}
 }}a.x=p.x;a.z=p.z;
 if(time-a.last<6)a.active+=Math.min(1.5,Math.max(0,dt));
}
export function activityRemaining(a,time){return Math.max(0,AFK_SECONDS-(time-a.last));}

// Only accepted gameplay results qualify; failed edits and slot toggles do not.
export function activityEvent(e){
 const cue=e.cue||'',build=e.type==='build-result'&&e.ok&&e.changed;
 const contribution=build||['harvest','pickup','inventory-change','revived'].includes(e.type)||e.type==='royale-cue'&&(/^(pickup-|complete-)/.test(cue)||['chest-open','ammo-pickup','build-place','harvest-hit'].includes(cue));
 const action=contribution||['shot','launch'].includes(e.type)||e.type==='royale-cue'&&['item-drop','glider-deploy','glider-cut','pickaxe-swing','launch'].includes(cue);
 return action?{signature:e.type+':'+(cue||e.weapon||e.buildId||''),contribution}:null;
}
