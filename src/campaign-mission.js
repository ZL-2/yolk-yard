// Blackglass runs locally and never creates a multiplayer room or awards Marks.
export const SAVE_KEY='blackglass-checkpoint-v1';
export const PREF_KEY='blackglass-preferences-v1';
export const MISSION_ID='blackglass-01';
export const STAGES=Object.freeze([
 {title:'Blind the perimeter',detail:'Cut the security feed at the junction box. Stay low to avoid the patrol.',target:{x:-6,z:27},action:'Cut perimeter power',seconds:1.5,spawn:{x:0,z:43,yaw:0},chapter:'01 / THE APPROACH'},
 {title:'Enter operations',detail:'Clear the courtyard patrol, then breach the marked operations door.',target:{x:0,z:-27},action:'Breach operations',seconds:1.8,spawn:{x:0,z:21,yaw:0},chapter:'02 / NO SIGNAL',clear:'yard'},
 {title:'Recover the archive',detail:'Find the terminal in the rear server room. Recover the evacuation manifest.',target:{x:9,z:-58},action:'Recover transmission archive',seconds:6,spawn:{x:0,z:-25,yaw:0},chapter:'03 / THE TRUTH',clear:'interior'},
 {title:'Silence the uplink',detail:'Leave through the rear exit. Overload the dish control unit before the archive is erased.',target:{x:-10,z:-81},action:'Overload uplink',seconds:3,spawn:{x:0,z:-66,yaw:0},chapter:'04 / BLACKGLASS',clear:'relay'},
 {title:'Reach extraction',detail:'Cross the relay yard to the landing pad. Keep the extraction zone clear.',target:{x:10,z:-108},action:'Board extraction',seconds:1.5,spawn:{x:-9,z:-84,yaw:-.55},chapter:'05 / LAST LIGHT',clear:'extraction'},
]);
export const ENEMIES=Object.freeze([
 {id:'y1',group:'yard',x:4,z:10,patrol:[-3,10],yaw:0},
 {id:'y2',group:'yard',x:-21,z:-4,patrol:[-21,-15],yaw:Math.PI},
 {id:'y3',group:'yard',x:15,z:-13,patrol:[13,-4],yaw:Math.PI},
 {id:'y4',group:'yard',x:-5,z:-19,patrol:[5,-19],yaw:Math.PI},
 {id:'y5',group:'yard',x:18,z:-22,patrol:[11,-22],yaw:Math.PI},
 {id:'i1',group:'interior',x:-6,z:-37,patrol:[-6,-31],yaw:Math.PI},
 {id:'i2',group:'interior',x:7,z:-37,patrol:[4,-37],yaw:Math.PI},
 {id:'i3',group:'interior',x:-6,z:-51,patrol:[-6,-58],yaw:Math.PI},
 {id:'i4',group:'interior',x:9,z:-52,patrol:[9,-55],yaw:Math.PI},
 {id:'r1',group:'relay',x:3,z:-71,patrol:[13,-71],yaw:Math.PI},
 {id:'r2',group:'relay',x:-18,z:-78,patrol:[-18,-70],yaw:Math.PI},
 {id:'r3',group:'relay',x:17,z:-88,patrol:[7,-88],yaw:Math.PI},
 {id:'e1',group:'extraction',x:-17,z:-97,patrol:[-10,-97],yaw:Math.PI},
 {id:'e2',group:'extraction',x:22,z:-98,patrol:[22,-107],yaw:Math.PI},
 {id:'e3',group:'extraction',x:2,z:-114,patrol:[-8,-114],yaw:Math.PI},
 {id:'e4',group:'extraction',x:-5,z:-91,patrol:[-1,-96],yaw:0},
]);
const GROUP_STAGE={yard:0,interior:2,relay:3,extraction:4};
export const groupStage=group=>GROUP_STAGE[group]??99;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function validSave(value){
 if(!value||value.mission!==MISSION_ID||!Number.isInteger(value.stage)||value.stage<1||value.stage>=STAGES.length)return null;
 const defeated=Array.isArray(value.defeated)?[...new Set(value.defeated.filter(id=>ENEMIES.some(e=>e.id===id)))]:[];
 return {mission:MISSION_ID,stage:value.stage,defeated,kills:clamp(Number(value.kills)||0,0,ENEMIES.length),shots:clamp(Number(value.shots)||0,0,100000),hits:clamp(Number(value.hits)||0,0,100000),elapsed:clamp(Number(value.elapsed)||0,0,86400),difficulty:['story','regular'].includes(value.difficulty)?value.difficulty:'regular'};
}
export function readSave(storage){try{return validSave(JSON.parse(storage?.getItem(SAVE_KEY)));}catch{return null;}}
export function checkpoint(mission){return validSave({mission:MISSION_ID,stage:mission.stage,defeated:mission.defeated,kills:mission.kills,shots:mission.shots,hits:mission.hits,elapsed:mission.elapsed,difficulty:mission.difficulty});}
export function interactionBlocked(stage,enemies,extractionTime=0){
 const group=STAGES[stage]?.clear;
 if(group&&enemies.some(e=>e.group===group&&e.health>0))return stage===4?'Clear the landing zone':'Hostiles nearby — secure the area';
 if(stage===4&&extractionTime<22)return 'Extraction inbound · '+Math.ceil(22-extractionTime)+'s';
 return '';
}
// Slab intersection, shared by bullets, sight and blast cover. World coordinates in metres.
export function rayBox(origin,direction,box,max=Infinity){
 if(box.active===false)return Infinity;
 let lo=0,hi=max;
 for(const axis of ['x','y','z']){
  const min=box[axis]-box['s'+axis]/2,maxAxis=box[axis]+box['s'+axis]/2,d=direction[axis];
  if(Math.abs(d)<1e-8){if(origin[axis]<min||origin[axis]>maxAxis)return Infinity;continue;}
  let a=(min-origin[axis])/d,b=(maxAxis-origin[axis])/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return Infinity;
 }
 return lo;
}
export function blockedRay(a,b,boxes){const length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(!length)return false;const d={x:(b.x-a.x)/length,y:(b.y-a.y)/length,z:(b.z-a.z)/length};return boxes.some(box=>rayBox(a,d,box,length-.05)<length-.05);}
export function moveBody(body,dx,dz,boxes,radius=.32,height=1.7){
 const collide=(x,z)=>boxes.some(b=>b.active!==false&&body.y+height>b.y-b.sy/2+.03&&body.y<b.y+b.sy/2-.03&&x>b.x-b.sx/2-radius&&x<b.x+b.sx/2+radius&&z>b.z-b.sz/2-radius&&z<b.z+b.sz/2+radius);
 // Substeps keep sprinting and frame stalls from tunnelling through thin fences.
 const count=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.18));
 for(let i=0;i<count;i++){if(!collide(body.x+dx/count,body.z))body.x+=dx/count;if(!collide(body.x,body.z+dz/count))body.z+=dz/count;}
 body.x=clamp(body.x,-25.7,25.7);body.z=clamp(body.z,-118,48);
}
export function createMission(saved=null,difficulty='regular'){
 const save=validSave(saved),stage=save?.stage||0;
 return {stage,defeated:save?.defeated||[],kills:save?.kills||0,shots:save?.shots||0,hits:save?.hits||0,elapsed:save?.elapsed||0,difficulty:save?.difficulty||difficulty,extractionTime:0,completed:false,checkpoint:save};
}
