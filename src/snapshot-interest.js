import {teammates} from './teams.js';
// Render poses are sampled; authoritative damage, projectiles, health,
// inventory, events and host-migration checkpoints are never delayed.
const POSE=['x','y','z','yaw','pitch','vx','vy','vz','grounded','moving','crouching','sliding','lowCrouch','sprintBlend'];
export class SnapshotInterest {
 constructor(){this.poses=new Map();this.key=null;}
 players(state,recipient){
  if(!state.royale||!recipient)return state.players;
  const key=state.royale.matchId+':'+state.round+':'+state.options.map;
  if(key!==this.key){this.poses.clear();this.key=key;}
  const observer=state.players.find(p=>p.id===(recipient.watchingId||recipient.killerId)&&p.health>0)||recipient;
  if(this.framePlayers!==state.players||this.frameTime!==state.time){this.framePlayers=state.players;this.frameTime=state.time;this.rows=new Map();this.arrays=new Map();}
  const radius=observer.aim?750:observer.flight&&observer.flight!=='ground'?350:180,living=new Set();
  let selection='';const result=state.players.map(p=>{
   living.add(p.id);if(p.id===recipient.id||p.id===observer.id||teammates(state.options,p,recipient)||p.health<=0||p.spectating||p.boss||(p.x-observer.x)**2+(p.z-observer.z)**2<radius*radius){selection+='1';return p;}selection+='0';
   let sample=this.poses.get(p.id);
   if(!sample||state.time-sample.time>=.1||(p.x-sample.pose.x)**2+(p.y-sample.pose.y)**2+(p.z-sample.pose.z)**2>144||p.flight!==sample.flight||p.shotSerial!==sample.shot){const pose={};for(const k of POSE)pose[k]=p[k];sample={pose,time:state.time,flight:p.flight,shot:p.shotSerial};this.poses.set(p.id,sample);this.arrays.clear();}
   const cached=this.rows.get(p.id);if(cached?.sample===sample)return cached.row;
   const row={};for(const key of Object.keys(p))row[key]=p[key];for(const key of POSE)row[key]=sample.pose[key];row.presentationAt=sample.time;
   row.combatState=undefined;row.weaponCooldowns=undefined;row.pendingFireUntil=undefined;row.lastFirePress=undefined;
   this.rows.set(p.id,{sample,row});return row;
  });
  for(const id of this.poses.keys())if(!living.has(id))this.poses.delete(id);
  if(this.arrays.has(selection))return this.arrays.get(selection);this.arrays.set(selection,result);return result;
 }
}
