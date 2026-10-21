// Blackglass runs locally and never creates a multiplayer room or awards Marks.
export const SAVE_KEY='blackglass-checkpoint-v2';
export const PREF_KEY='blackglass-preferences-v1';
export const MISSION_ID='blackglass-coastal-02';
export const STAGES=Object.freeze([
 {title:'Isolate the perimeter',detail:'Follow the seawall to the gate junction. Cut the security feed; darkness slows patrol detection.',target:{x:32,y:4,z:51},action:'Isolate security feed',seconds:2,spawn:{x:42,y:4,z:96,yaw:0},chapter:'01 / THE COAST'},
 {title:'Breach operations',detail:'Secure the logistics yard. Use the cargo lanes and truck for cover, then breach the southern door.',target:{x:30,y:12,z:8},action:'Breach operations',seconds:2,spawn:{x:40,y:4,z:41,yaw:0},chapter:'02 / THRESHOLD',clear:'yard'},
 {title:'Find the command override',detail:'Take either interior staircase to the upper command gallery. Unlock the archive console.',target:{x:22,y:16,z:-3},action:'Obtain archive access',seconds:3,spawn:{x:30,y:12,z:3,yaw:0},chapter:'03 / ABOVE THE NOISE',clear:'command'},
 {title:'Recover the evacuation archive',detail:'Return downstairs to the northeast server room. Download the manifest, then take the rear service exit.',target:{x:48,y:12,z:-25},action:'Recover evacuation manifest',seconds:5,spawn:{x:22,y:16,z:-5,yaw:Math.PI},chapter:'04 / THE TRUTH',clear:'interior'},
 {title:'Sever the uplink',detail:'Climb the western service ramp to the dish terrace. Secure the transmitter control panel.',target:{x:-11,y:16,z:-31},action:'Disable uplink transmission',seconds:4,spawn:{x:28,y:12,z:-32,yaw:Math.PI/2},chapter:'05 / BLACKGLASS',clear:'relay'},
 {title:'Extract with the archive',detail:'Move north through the service block to the elevated landing pad. Hold until the helicopter arrives.',target:{x:30,y:20,z:-95},action:'Board extraction',seconds:2,spawn:{x:-9,y:16,z:-33,yaw:-Math.PI/2},chapter:'06 / LAST LIGHT',clear:'extraction'},
]);
export const ENEMIES=Object.freeze([
 {id:'y1',group:'yard',role:'rifle',x:35,y:12,z:16,patrol:[42,16],yaw:0},
 {id:'y2',group:'yard',role:'flanker',x:23,y:12,z:12,patrol:[24,19],yaw:Math.PI},
 {id:'y3',group:'yard',role:'support',x:60,y:12,z:5,patrol:[60,17],yaw:Math.PI},
 {id:'y4',group:'yard',role:'rifle',x:42,y:12,z:10,patrol:[33,10],yaw:Math.PI},
 {id:'c1',group:'command',role:'support',x:30,y:16,z:1,patrol:[37,1],yaw:Math.PI},
 {id:'c2',group:'command',role:'flanker',x:46,y:16,z:-10,patrol:[40,-10],yaw:Math.PI},
 {id:'c3',group:'command',role:'rifle',x:22,y:16,z:-11,patrol:[29,-11],yaw:0},
 {id:'i1',group:'interior',role:'rifle',x:22,y:12,z:-10,patrol:[28,-10],yaw:Math.PI},
 {id:'i2',group:'interior',role:'flanker',x:38,y:12,z:-10,patrol:[47,-10],yaw:Math.PI},
 {id:'i3',group:'interior',role:'support',x:40,y:12,z:-26,patrol:[47,-26],yaw:Math.PI},
 {id:'i4',group:'interior',role:'rifle',x:23,y:12,z:-20,patrol:[28,-25],yaw:Math.PI},
 {id:'r1',group:'relay',role:'rifle',x:1,y:16,z:-43,patrol:[12,-43],yaw:Math.PI},
 {id:'r2',group:'relay',role:'flanker',x:-34,y:16,z:-28,patrol:[-34,-43],yaw:Math.PI},
 {id:'r3',group:'relay',role:'support',x:-10,y:16,z:-52,patrol:[-4,-52],yaw:Math.PI},
 {id:'r4',group:'relay',role:'rifle',x:36,y:16,z:-49,patrol:[28,-49],yaw:Math.PI},
 {id:'r5',group:'relay',role:'flanker',x:62,y:16,z:-48,patrol:[54,-48],yaw:Math.PI},
 {id:'e1',group:'extraction',role:'rifle',x:26,y:16,z:-62,patrol:[27,-70],yaw:Math.PI},
 {id:'e2',group:'extraction',role:'flanker',x:44,y:16,z:-64,patrol:[37,-70],yaw:Math.PI},
 {id:'e3',group:'extraction',role:'support',x:20,y:20,z:-99,patrol:[20,-91],yaw:Math.PI},
 {id:'e4',group:'extraction',role:'rifle',x:40,y:20,z:-100,patrol:[40,-92],yaw:Math.PI},
]);
const GROUP_STAGE={yard:0,command:2,interior:2,relay:4,extraction:5};
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
 if(group&&enemies.some(e=>e.group===group&&e.health>0))return stage===STAGES.length-1?'Clear the landing zone':'Hostiles nearby — secure the area';
 if(stage===STAGES.length-1&&extractionTime<32)return 'Extraction inbound · '+Math.ceil(32-extractionTime)+'s';
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

}
export function createMission(saved=null,difficulty='regular'){
 const save=validSave(saved),stage=save?.stage||0;
 return {stage,defeated:save?.defeated||[],kills:save?.kills||0,shots:save?.shots||0,hits:save?.hits||0,elapsed:save?.elapsed||0,difficulty:save?.difficulty||difficulty,extractionTime:0,completed:false,checkpoint:save};
}
