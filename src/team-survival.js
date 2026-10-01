import {isTeamRoyale,teammates} from './teams.js';
import {dist,wallDistance} from './physics.js';
import {eyeHeight} from './stance.js';
import {navigate} from './bot-navigation.js';
import {newBrain} from './bot-perception.js';
import {skillFor} from './bot-config.js';
import {ROYALE_TEAM_BOT as teamPolicy} from './bot-config.js';
export const REVIVE_RULES=Object.freeze({seconds:10,range:2.6,health:30,vitality:100,bleed:2,decay:1,damageDelay:.75});
export const activeMember=p=>!!p&&p.contestant&&p.health>0&&!p.downed&&!p.spectating&&!p.afkRemoved;
export function mayDown(sim,p,source){return isTeamRoyale(sim.options)&&!p.downed&&!['Left round','Team eliminated','Disconnected'].includes(source)&&[...sim.players.values()].some(o=>teammates(sim.options,p,o)&&activeMember(o));}
export function downPlayer(sim,p,attacker,source,precision,shotId){
 const applied=p.health;if(attacker&&attacker!==p){p.damageLedger??={};p.damageLedger[attacker.id]=sim.time;}
 // `health` is vitality while DOWNED, not normal combat health. All normal
 // weapon/build/loot/use paths are gated by the explicit state.
 Object.assign(p,{downed:true,lifeState:'DOWNED',health:REVIVE_RULES.vitality,shield:0,downedAt:sim.time,downCount:(p.downCount||0)+1,knockedBy:attacker?.id||null,knockSource:source,reviveProgress:0,reviverId:null,reviving:null,reviveBlockedUntil:sim.time+.5,sliding:false,crouching:false,sprinting:false,flight:'ground',reloadEnd:0,burstLeft:0,building:false,editing:false,use:null,chestProgress:0,fireLatch:true});
 sim.emit('hit',{player:attacker?.id,target:p.id,amount:applied,shotId,sourceX:attacker?.x,sourceY:attacker?.y,sourceZ:attacker?.z,x:p.x,y:p.y+1,z:p.z,precision});
 sim.emit('knocked',{player:attacker?.id,target:p.id,name:attacker?.name||source,targetName:p.name,weapon:source});
 sim.emit('royale-cue',{cue:'teammate-down',player:p.id,x:p.x,y:p.y,z:p.z});
}
export function reviveAccessible(map,reviver,target){
 if(!reviver||!target||Math.abs(reviver.y-target.y)>1.1||dist(reviver,target)>REVIVE_RULES.range)return false;
 const a={x:reviver.x,y:reviver.y+Math.min(1,eyeHeight(reviver)),z:reviver.z},b={x:target.x,y:target.y+.4,z:target.z},delta={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},length=Math.hypot(delta.x,delta.y,delta.z)||.001;
 return wallDistance(map,a,{x:delta.x/length,y:delta.y/length,z:delta.z/length},length)>=length-.04;
}
export function reviveTarget(sim,p){return [...sim.players.values()].filter(o=>o.downed&&o.health>0&&!o.spectating&&(!o.reviverId||o.reviverId===p.id)&&teammates(sim.options,p,o)&&reviveAccessible(sim.map,p,o)).sort((a,b)=>dist(p,a)-dist(p,b))[0];}
export function prepareRevive(sim,p,input){
 p.reviving=null;
 if(!activeMember(p)||p.flight!=='ground'||!input.interact||input.fire||input.jump||input.sprint||Math.hypot(input.forward||0,input.strafe||0)>.1||sim.time<(p.reviveBlockedUntil||0))return false;
 const target=reviveTarget(sim,p);if(!target||sim.time<(target.reviveBlockedUntil||0))return false;
 p.reviving=target.id;p.reloadEnd=0;p.burstLeft=0;p.use=null;p.building=false;p.editing=false;p.aim=false;
 return true;
}
export function tickRevives(sim,dt){
 for(const target of sim.players.values()){
  if(!target.downed||target.health<=0||target.spectating)continue;
  const reviver=[...sim.players.values()].find(p=>p.reviving===target.id&&activeMember(p)&&teammates(sim.options,p,target)&&(p.bot||sim.time-p.lastInput<=.4)&&sim.time>=(p.reviveBlockedUntil||0)&&sim.time>=(target.reviveBlockedUntil||0)&&reviveAccessible(sim.map,p,target));
  target.reviverId=reviver?.id||null;
  target.reviveProgress=Math.max(0,Math.min(REVIVE_RULES.seconds,(target.reviveProgress||0)+(reviver?dt:-dt*REVIVE_RULES.decay)));
  if(target.reviveProgress+1e-7<REVIVE_RULES.seconds||!reviver)continue;
  Object.assign(target,{downed:false,lifeState:'REVIVED',health:REVIVE_RULES.health,shield:0,revivedAt:sim.time,reviveProgress:0,reviverId:null,knockedBy:null,knockSource:null,crouching:true,sliding:false,fireLatch:true,nextShot:sim.time+.3,lastDamage:sim.time,damageLedger:{}});
  reviver.reviving=null;reviver.revives=(reviver.revives||0)+1;
  sim.emit('revived',{player:reviver.id,target:target.id});sim.emit('royale-cue',{cue:'revive-complete',player:target.id,x:target.x,y:target.y,z:target.z});
 }
}
export function resolveDownedTeams(sim){
 if(!isTeamRoyale(sim.options))return;
 for(const p of sim.players.values())if(p.downed&&p.health>0&&!p.spectating&&![...sim.players.values()].some(o=>teammates(sim.options,p,o)&&activeMember(o)))sim.damage(p,null,p.health+1,'Team eliminated');
}
export function rescueBotInput(sim,p){
 if(p.bot&&p.downed&&isTeamRoyale(sim.options)){
  const mates=[...sim.players.values()].filter(o=>activeMember(o)&&teammates(sim.options,p,o)).sort((a,b)=>Number(a.bot)-Number(b.bot)||dist(p,a)-dist(p,b));
  const mate=mates.find(o=>o.reviving===p.id||dist(p,o)<=teamPolicy.rescueHold)||mates[0];
  const still={yaw:p.yaw,pitch:0,forward:0,strafe:0,slot:p.slot,fire:false,interact:false,jump:false,sprint:false,swapSlot:-1};
  if(!mate||p.reviverId||mate.reviving===p.id||dist(p,mate)<=teamPolicy.rescueHold)return still;
  const brain=p.brain??=newBrain(sim,p),path=navigate(sim,p,brain,mate,skillFor(sim)),yaw=Math.atan2(p.x-mate.x,p.z-mate.z);
  return {...still,yaw,forward:-Math.sin(yaw)*path.mx-Math.cos(yaw)*path.mz,strafe:Math.cos(yaw)*path.mx-Math.sin(yaw)*path.mz};
 }
 if(!activeMember(p)||!isTeamRoyale(sim.options)||p.flight!=='ground')return null;
 const mate=[...sim.players.values()].filter(o=>o.downed&&o.health>0&&!o.spectating&&(!o.reviverId||o.reviverId===p.id)&&teammates(sim.options,p,o)).sort((a,b)=>Number(a.bot)-Number(b.bot)||dist(p,a)-dist(p,b))[0];if(!mate)return null;
 sim.cancelUse?.(p);
 const dx=mate.x-p.x,dz=mate.z-p.z,near=reviveAccessible(sim.map,p,mate);
 const yaw=Math.atan2(-dx,-dz),brain=p.brain??=newBrain(sim,p);
 const path=near?{mx:0,mz:0,jump:false}:navigate(sim,p,brain,mate,skillFor(sim,p));
 return {yaw,pitch:0,forward:-Math.sin(yaw)*path.mx-Math.cos(yaw)*path.mz,strafe:Math.cos(yaw)*path.mx-Math.sin(yaw)*path.mz,jump:path.jump,sprint:!near,interact:near,slot:p.slot,fire:false,reload:false,aim:false,buildMode:false,swapSlot:-1};
}
