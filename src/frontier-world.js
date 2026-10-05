import {mapVaults,vaultState,vaultOpen} from './vaults.js';
import {canFight} from './stance.js';
import {dist,direction,wallDistance,canStand} from './physics.js';
import {rebuildMap} from './building.js';
import {WORLD_RULES} from './world-rules.js';
export {WORLD_RULES};
export function initializeFrontier(sim){sim.doors=Object.fromEntries((sim.map.doors||[]).map(d=>[d.id,{open:false,changedAt:-100}]));sim.vaults=mapVaults(sim.map).map(v=>({id:v.id,open:false,openedAt:0}));sim.vault=sim.vaults[0]||null;rebuildMap(sim);}
export function doorNear(map,p,range=WORLD_RULES.doorRange){const d=direction(p.yaw);let best,bestDistance=Infinity;for(const o of map.doors||[]){const x=o.x-p.x,z=o.z-p.z,r=x*x+z*z,score=r+(p.y-o.y)**2;if(Math.abs(p.y-o.y)<2&&r<range*range&&score<bestDistance&&x*d.x+z*d.z>-.1){best=o;bestDistance=score;}}return best;}
export function setDoor(sim,door,open,p=null){
 if(!door||door.vault&&open&&!vaultOpen(sim,door.vaultId||sim.map.vault?.id)||sim.worldDamage['world-door-'+door.id]?.destroyed)return false;
 const state=sim.doors?.[door.id];if(!state||state.open===open||sim.time-state.changedAt<WORLD_RULES.doorCooldown)return false;
 if(!open&&[...sim.players.values()].some(p=>p.health>0&&p.y<door.y+door.h&&p.y+1.8>door.y&&Math.abs(p.x-door.x)<door.w/2+.4&&Math.abs(p.z-door.z)<.6))return false;
 state.open=open;state.changedAt=sim.time;sim.buildVersion++;rebuildMap(sim,{navigationChanged:!!door.vault});sim.emit('royale-cue',{cue:open?'door-open':'door-close',player:p?.id,x:door.x,y:door.y,z:door.z});return true;
}
export function frontierPrompt(map,state,p){
 if(!canFight(p)||p.flight!=='ground')return null;
 if(p.traversal)return {kind:'ride',text:'JUMP TO RELEASE'};
 const v=mapVaults(map).find(v=>!vaultOpen(state,v.id)&&dist(p,v.reader)<3);if(v)return {kind:'vault',text:p.inventory?.some(i=>i?.id===(v.key||'asterKeycard'))?'HOLD USE · UNLOCK '+v.name.toUpperCase():v.name.toUpperCase()+' KEYCARD REQUIRED',progress:p.vaultProgress||0};
 const door=doorNear(map,p);if(door&&!door.vault&&!state.worldDamage?.['world-door-'+door.id]?.destroyed)return {kind:'door',id:door.id,text:state.doors?.[door.id]?.open?'CLOSE DOOR':'OPEN DOOR · SPRINT TO BARGE'};
 for(const line of map.traversal||[])for(const endpoint of ['from','to'])if(dist(p,line[endpoint])<2.6)return {kind:'traversal',id:line.id,endpoint,text:line.type==='ascender'?'USE ASCENDER':'RIDE ZIP LINE'};
 return null;
}
export function frontierInteract(sim,p,input,dt){
 if(!canFight(p)||p.flight!=='ground')return false;
 if(!input.interact&&!p.sprinting){p.vaultProgress=0;return false;}
 const v=mapVaults(sim.map).find(v=>!vaultOpen(sim,v.id)&&dist(p,v.reader)<3),nearVault=!!v;
 if(nearVault&&input.interact){
  const card=p.inventory.findIndex(i=>i?.id===(v.key||'asterKeycard'));
  const eye={x:p.x,y:p.y+1.2,z:p.z},goal={x:v.reader.x,y:v.reader.y+1.2,z:v.reader.z},d=dist(eye,goal)||1;
  if(card<0||sim.time-p.lastDamage<.25||wallDistance(sim.map,eye,{x:(goal.x-eye.x)/d,y:(goal.y-eye.y)/d,z:(goal.z-eye.z)/d},d)<d-.15){p.vaultProgress=0;return true;}
  if(p.vaultId!==v.id){p.vaultId=v.id;p.vaultProgress=0;}p.vaultProgress=(p.vaultProgress||0)+dt;
  if(p.vaultProgress>=WORLD_RULES.vaultUse){const state=vaultState(sim,v.id);state.open=true;state.openedAt=sim.time;p.inventory[card]=null;p.vaultProgress=0;setDoor(sim,sim.map.doors.find(d=>d.id===v.doorId),true,p);sim.syncInventory(p);sim.emit('vault-open',{player:p.id,vaultId:v.id,name:v.name,x:v.x,y:v.y,z:v.z});sim.emit('royale-cue',{cue:'vault-unlock',player:p.id,x:v.x,y:v.y,z:v.z});}
  p.interactLatch=true;return true;
 }
 p.vaultProgress=0;
 const door=doorNear(sim.map,p);
 if(door&&!door.vault&&!sim.worldDamage['world-door-'+door.id]?.destroyed){
  if((p.sprinting||p.bot&&input.interact)&&!sim.doors[door.id]?.open){setDoor(sim,door,true,p);return false;}
  if(input.interact&&!p.interactLatch&&!p.bot){setDoor(sim,door,!sim.doors[door.id]?.open,p);p.interactLatch=true;return true;}
 }
 if(input.interact&&!p.interactLatch&&!p.traversal&&!(p.traversalLock>0))for(const line of sim.map.traversal||[])for(const endpoint of ['from','to'])if(dist(p,line[endpoint])<2.6){
  const from=line[endpoint],to=line[endpoint==='from'?'to':'from'];
  if(!canStand(sim.map,from))continue;
  const route=[line.from,...line.via||[],line.to].map(q=>({...q}));if(endpoint==='to')route.reverse();
  p.traversal={id:line.id,type:line.type,from:{...from},to:{...to},route,progress:0,speed:line.speed};p.use=null;p.reloadEnd=0;p.burstLeft=0;p.sprinting=false;p.interactLatch=true;p.grounded=false;p.vy=0;p.fall={apex:p.y,immune:true,source:'traversal'};sim.emit('royale-cue',{cue:'traversal-grab',player:p.id,x:p.x,y:p.y,z:p.z});return true;
 }
 return false;
}
export function keycardRoute(map,state,p){
 const v=mapVaults(map).find(v=>!vaultOpen(state,v.id)&&p?.inventory?.[p.slot]?.id===(v.key||'asterKeycard'));if(!v)return null;
 const nearRoom=Math.abs(p.x-v.x)<13&&Math.abs(p.z-v.z)<12;
 if(nearRoom&&p.y<v.y+1.5)return [{...v.reader,label:'VAULT READER'}];
 if(!v.stairs?.length)return [{...v.entrance,label:'VAULT ENTRANCE'},{...v.reader,label:'VAULT READER'}];
 const onStairs=Math.abs(p.x-v.x)<3.5&&p.z>=v.z+8.8&&p.z<=v.entrance.z+3&&p.y<=v.entrance.y+.6;
 if(onStairs)return [...v.stairs.filter(s=>s.y<p.y+.5&&s.z<p.z-.3),{...v.reader,label:'VAULT READER'}];
 return [{...v.entrance,label:'VAULT ENTRANCE'},...v.stairs,{...v.reader,label:'VAULT READER'}];
}
