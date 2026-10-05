import {BOSSES,bossDefinition,MYTHIC_WEAPONS} from './bosses.js';
import {rollChest} from './royale-loot.js';
import {SEASON,rigCharges} from './season-one.js';
import {Simulation} from './simulation.js';
import {weapon,gun} from './data.js';
import {inventory} from './building.js';
import {groundAt} from './terrain.js';
import {canStand,dist,direction,wallDistance} from './physics.js';
import {teammates} from './teams.js';
import {launchPlayer} from './airborne.js';
import {GRAPPLER,grappleAim,startGrapple} from './grappler.js';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function initializeSeason(sim){
 sim.smokes=[];sim.relays=(sim.map.relays||[]).map(r=>({...r,cooldown:0,progress:0,user:null}));
 sim.bossCaches=[];
 for(const def of BOSSES){
  const house=def.id===SEASON.boss.id?sim.map.buildings[sim.map.bossHouse]:null,site=sim.map.bossSites?.find(s=>s.bossId===def.id);
  const spot=house?{x:house.x-1.5,y:house.baseY,z:house.z-3}:site;
  if(!spot||!canStand(sim.map,spot))continue;
  const b=Simulation.prototype.addPlayer.call(sim,def.id,{name:def.name,color:def.color,accent:def.accent,outfit:def.outfit,backbling:'backbling-royal'},true);
  if(!b)continue;Object.assign(b,{boss:true,bossId:def.id,contestant:false,spectating:false,lateSpectator:false,connected:false,team:-2,x:spot.x,y:spot.y,z:spot.z,home:{x:spot.x,y:spot.y,z:spot.z},health:def.health,shield:def.shield,maxHealth:def.health,maxShield:def.shield,grounded:true,flight:'ground',slot:1,inventory:inventory(),materials:{wood:0,brick:0,metal:0},bank:{medium:210,light:0,shells:60,heavy:36,rockets:0},stamina:100,lastDamage:-100,aggroAt:0});
  b.patrol=house?[[-1.5,-7],[1.5,-3],[1.5,6],[-1.5,3]].map(([dx,dz])=>({x:house.x+dx,y:house.baseY,z:house.z+dz})):site.patrol;b.patrolIndex=0;b.patrolWait=0;
  b.inventory[1]={id:def.weapon,bossId:def.id,weapon:true,rarity:5,count:1,ammo:MYTHIC_WEAPONS[def.id].magazine||weapon(def.weapon).magazine};b.inventory[1].ammo=gun(b).magazine;sim.syncInventory(b);
 }
}
export function bossInput(sim,p){
 const def=bossDefinition(p.bossId||p.id),input={yaw:p.yaw,pitch:p.pitch||0,slot:1,forward:0,strafe:0,interact:false};
 if(p.grapple&&p.grapple.phase!=='return')return {...input,fire:false};
 if(p.bossVeil){
  const veil=p.bossVeil;input.fire=false;
  if(sim.time>=veil.until)p.bossVeil=null;
  else{
   if(sim.time<veil.releaseAt)return input;
   if(!veil.released){veil.released=true;sim.smokes.push({id:++sim.lootId,x:p.x,y:p.y+1.3,z:p.z,radius:3.2,until:sim.time+4});}
   const yaw=Math.atan2(p.x-veil.goal.x,p.z-veil.goal.z);input.yaw=p.yaw+Math.max(-.026,Math.min(.026,wrap(yaw-p.yaw)));input.forward=dist(p,veil.goal)>.6&&Math.abs(wrap(yaw-p.yaw))<.4?.4:0;return input;
  }
 }
 if(sim.time>=(p.scanAt||0)){p.scanAt=sim.time+.2;let best=null,bestD=def.notice;if(def.ability==='winch'&&sim.time-(p.attackerAt||-100)<10){const t=sim.players.get(p.attackerId);if(t?.health>0&&t.contestant&&t.flight==='ground'&&sim.accessible(p,t,GRAPPLER.range)&&!smokeBlocks(sim,p,t)){best=t;bestD=dist(p,t);}}
  for(const target of sim.players.values()){if(target===p||!target.contestant||target.health<=0||target.spectating||target.flight!=='ground')continue;const d=dist(p,target);if(d>bestD)continue;const from={x:p.x,y:p.y+1.55,z:p.z},dy=target.y+.9-from.y,len=Math.hypot(target.x-p.x,dy,target.z-p.z)||1,v={x:(target.x-p.x)/len,y:dy/len,z:(target.z-p.z)/len};if(wallDistance(sim.map,from,v,len)<len-.4||smokeBlocks(sim,from,{...target,y:target.y+.9}))continue;best=target;bestD=d;}
  if(best?.id!==p.targetId)p.aggroAt=sim.time+def.reaction;p.targetId=best?.id||null;
 }
 const target=sim.players.get(p.targetId),farHome=dist(p,p.home)>def.leash&&!(p.pursuitUntil>sim.time);
 if(p.bossWindup){
  input.yaw=p.yaw;input.fire=false;
  if(sim.time>=p.bossWindup.until){const victim=sim.players.get(p.bossWindup.target);p.bossWindup=null;
   if(victim?.health>0&&!victim.downed&&dist(p,victim)<GRAPPLER.range&&!smokeBlocks(sim,p,victim)&&sim.accessible(p,victim,GRAPPLER.range)){
    p.pursuitUntil=sim.time+5;startGrapple(p,{origin:{x:p.x,y:p.y+1.7,z:p.z},anchor:{x:victim.x,y:victim.y+1.3,z:victim.z},length:dist(p,victim),valid:true},sim.time);sim.emit('boss-winch',{player:p.id,target:victim.id,x:p.x,y:p.y,z:p.z});
   }
  }return input;
 }
 if(target&&!farHome&&sim.time>p.aggroAt&&sim.time>=(p.abilityAt||0)){
  if(def.ability==='winch'&&dist(p,target)>8&&dist(p,target)<GRAPPLER.range){p.abilityAt=sim.time+5;p.bossWindup={target:target.id,until:sim.time+.95};sim.emit('royale-cue',{cue:'boss-windup',player:p.id,x:p.x,y:p.y,z:p.z});return input;}
  if(def.ability==='veil'&&sim.time-p.lastDamage<3&&p.patrol?.length){p.abilityAt=sim.time+18;p.patrolIndex=(p.patrolIndex+1)%p.patrol.length;p.bossVeil={goal:{...p.patrol[p.patrolIndex]},releaseAt:sim.time+.65,until:sim.time+4.65,released:false};p.targetId=null;p.patrolWait=0;input.fire=false;sim.emit('royale-cue',{cue:'boss-veil',player:p.id,x:p.x,y:p.y,z:p.z});return input;}
 }
 let goal=farHome?p.home:target;
 if(!goal&&p.patrol?.length){goal=p.patrol[p.patrolIndex%p.patrol.length];if(dist(p,goal)<.85){if(!p.patrolWait)p.patrolWait=sim.time+1.6;if(sim.time>=p.patrolWait){p.patrolIndex++;p.patrolWait=0;goal=p.patrol[p.patrolIndex%p.patrol.length];}}}
 if(goal){const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),yaw=Math.atan2(-dx,-dz),error=target&&!farHome?Math.sin(sim.time*1.37)*def.aimError:0;
  input.yaw=p.yaw+Math.max(-.026,Math.min(.026,wrap(yaw+error-p.yaw)));const pitch=target?Math.atan2(goal.y+.85-(p.y+1.55),d)+Math.sin(sim.time*.83)*.025:0;input.pitch=p.pitch+(pitch-p.pitch)*.07;
  const close=def.ability==='winch'?8:23;
  input.forward=farHome?.4:target?(d>close&&dist(p,p.home)<def.leash*.65?.3:0):!p.patrolWait&&Math.abs(wrap(yaw-p.yaw))<.4?.34:0;
  input.aim=def.ability==='veil';input.fire=!!target&&!farHome&&d<(def.ability==='winch'?10:def.notice)&&sim.time>p.aggroAt&&Math.abs(wrap(yaw-p.yaw))<.13&&sim.time%def.cycle<def.burst&&!smokeBlocks(sim,p,target);input.reload=p.ammo[1]===0;
 }return input;
}
export function damageBoss(sim,p,attacker,amount,source,precision,shotId){
 if(p.health<=0||!Number.isFinite(amount)||amount<=0)return;
 const def=bossDefinition(p.bossId||p.id);if(p.bossWindup){p.bossWindup=null;p.abilityAt=sim.time+8;sim.emit('boss-interrupted',{player:attacker?.id,target:p.id});}
 const shield=source==='Storm'?0:Math.min(p.shield,amount);p.shield-=shield;const dealt=Math.min(p.health,amount-shield);p.health-=dealt;p.lastDamage=sim.time;if(attacker?.contestant){p.attackerId=attacker.id;p.attackerAt=sim.time;p.scanAt=0;}
 sim.emit('hit',{player:attacker?.id,target:p.id,amount:shield+dealt,precision,shield:shield>0,shotId,weapon:source,x:p.x,y:p.y+1.4,z:p.z,sourceX:attacker?.x,sourceY:attacker?.y,sourceZ:attacker?.z});
 if(shield&&p.shield===0)sim.emit('royale-cue',{cue:'shield-break',player:p.id,x:p.x,y:p.y,z:p.z});
 if(p.health===0&&!p.bossDefeated){p.bossDefeated=true;p.spectating=true;p.flight='out';p.reloadEnd=0;p.bossWindup=null;p.bossVeil=null;
  sim.dropLoot(p,{id:def.weapon,bossId:def.id,weapon:true,rarity:5,count:1,ammo:gun(p).magazine});
  if(def.ability==='rig'){sim.dropLoot(p,{id:'jumpRig',rarity:5,count:1,charges:SEASON.rig.charges,rechargeAt:0,readyAt:0});sim.dropAmmo(p,'medium',60);sim.dropLoot(p,{id:'asterKeycard',count:1,rarity:4});}
  if(def.ability==='winch'){sim.dropLoot(p,{id:'anchorWinch',rarity:5,count:1,readyAt:0});sim.dropLoot(p,{id:'rookKeycard',count:1,rarity:4});sim.dropAmmo(p,'shells',12);sim.dropLoot(p,{id:'metal',resource:'metal',count:60,rarity:0});}
  if(def.ability==='veil'){sim.dropLoot(p,{id:'veilProjector',rarity:5,count:3});sim.dropLoot(p,{id:'nyxKeycard',count:1,rarity:4});sim.dropAmmo(p,'heavy',12);sim.dropLoot(p,{id:'mini',count:3,rarity:1});sim.dropLoot(p,{id:'wood',resource:'wood',count:60,rarity:0});}
  sim.emit('boss-defeated',{player:attacker?.id,target:p.id,name:def.name,x:p.x,y:p.y,z:p.z});
 }
}
export function winchCharges(item,time){
 return item?.id==='anchorWinch'?Infinity:0;
}
export function bossCachePrompt(caches,p){
 const c=caches?.find(c=>!c.opened&&dist(p,c)<3);if(!c)return null;
 return {kind:'cache',text:p.inventory?.some(i=>i?.id===c.key)?'HOLD USE · UNLOCK '+c.name.toUpperCase():c.name.toUpperCase()+' KEYCARD REQUIRED',progress:p.cacheProgress||0};
}
function useBossCache(sim,p,input,dt){
 const c=sim.bossCaches?.find(c=>!c.opened&&dist(p,c)<3);
 if(!c||!input.interact){p.cacheProgress=0;p.cacheId=null;return false;}
 const card=p.inventory.findIndex(i=>i?.id===c.key);
 if(card<0||sim.time-p.lastDamage<.25||!sim.accessible(p,c,3)){p.cacheProgress=0;return true;}
 if(p.cacheId!==c.id){p.cacheId=c.id;p.cacheProgress=0;}p.cacheProgress=(p.cacheProgress||0)+dt;
 if(p.cacheProgress>=1.5){c.opened=true;p.inventory[card]=null;p.cacheProgress=0;sim.syncInventory(p);
  for(const item of rollChest(sim.random,'epic'))sim.dropLoot(c,item);sim.dropLoot(c,{id:'flask',count:1,rarity:1});
  sim.emit('royale-cue',{cue:'vault-unlock',player:p.id,x:c.x,y:c.y,z:c.z});sim.emit('boss-cache-open',{player:p.id,name:c.name});
 }p.interactLatch=true;return true;
}
export function useSeasonItem(sim,p,item){
 if(item.id==='jumpRig'){if(!rigCharges(item,sim.time)||sim.time<(item.readyAt||0))return false;if(item.charges===SEASON.rig.charges)item.rechargeAt=sim.time+SEASON.rig.recharge;item.charges--;item.readyAt=sim.time+SEASON.rig.cooldown;const d=direction(p.yaw);launchPlayer(p,{source:'shockwave',vy:SEASON.rig.vertical,vx:d.x*SEASON.rig.horizontal,vz:d.z*SEASON.rig.horizontal});sim.emit('royale-fx',{kind:'impulse',x:p.x,y:p.y,z:p.z});sim.emit('rig-used',{player:p.id});return true;}
 if(item.id==='anchorWinch'){
  if(sim.time<(item.readyAt||0))return false;
  const aim=grappleAim(sim.map,p,wallDistance);item.readyAt=sim.time+GRAPPLER.cooldown;
  startGrapple(p,aim,sim.time);sim.emit('royale-cue',{cue:'grappler-fire',player:p.id,x:p.x,y:p.y,z:p.z});sim.emit('winch-used',{player:p.id,valid:aim.valid});return true;
 }
 if(item.id==='veilProjector'){sim.smokes.push({id:++sim.lootId,x:p.x,y:p.y+1.3,z:p.z,radius:4,until:sim.time+6});return true;}
 if(item.id==='smoke'){sim.smokes??=[];if(sim.smokes.length>=12)sim.smokes.shift();const d=direction(p.yaw);const range=wallDistance(sim.map,{x:p.x,y:p.y+1,z:p.z},d,5);const x=p.x+d.x*Math.max(0,range-.5),z=p.z+d.z*Math.max(0,range-.5);sim.smokes.push({id:++sim.lootId,x,y:groundAt(sim.map,x,z)+1.3,z,radius:4.5,until:sim.time+12});return true;}
 if(item.id==='scanner'){scan(sim,p,55,8);return true;}return false;
}
export function smokeBlocks(sim,a,b){for(const s of sim.smokes||[]){if(s.until<=sim.time)continue;const dx=b.x-a.x,dy=(b.y||0)-(a.y||0),dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz||1,t=Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.y-a.y)*dy+(s.z-a.z)*dz)/l));if(Math.hypot(a.x+dx*t-s.x,(a.y||0)+dy*t-s.y,a.z+dz*t-s.z)<s.radius)return true;}return false;}
function scan(sim,p,range,seconds){sim.markers=sim.markers.filter(m=>m.until>sim.time);for(const enemy of sim.players.values())if(enemy!==p&&enemy.health>0&&!enemy.spectating&&!teammates(sim.options,p,enemy)&&dist(p,enemy)<range)sim.markers.push({id:++sim.markerId,player:p.id,team:p.team,name:'SIGNAL CONTACT',kind:'danger',label:'Last known position',x:enemy.x,y:enemy.y+2,z:enemy.z,until:sim.time+seconds});}
export function seasonInteract(sim,p,input,dt){if(useBossCache(sim,p,input,dt))return true;const r=sim.relays?.find(r=>dist(p,r)<2.8);if(!r||!input.interact||r.cooldown>sim.time||p.lastDamage>sim.time-.4)return false;if(r.user!==p.id){r.user=p.id;r.progress=0;}r.progress+=dt;r.last=sim.time;if(r.progress>=3){r.progress=0;r.cooldown=sim.time+60;scan(sim,p,90,12);sim.markers.push({id:++sim.markerId,player:p.id,team:p.team,global:true,name:'RELAY TRANSMISSION',kind:'danger',label:'Active operator',x:p.x,y:p.y+2,z:p.z,until:sim.time+12});sim.emit('relay-captured',{player:p.id});}return true;}
export function seasonTick(sim){sim.smokes=(sim.smokes||[]).filter(s=>s.until>sim.time);for(const r of sim.relays||[])if(sim.time-(r.last||0)>.2){r.progress=0;r.user=null;}for(const p of sim.players.values()){const phase=p.grapple?.phase;if(phase!==p.grapplePhase){if(phase==='pull'||phase==='return')sim.emit('royale-cue',{cue:phase==='pull'?'grappler-latch':'grappler-return',player:p.id,x:p.x,y:p.y,z:p.z});p.grapplePhase=phase;}for(const item of p.inventory||[]){if(item?.id==='jumpRig')rigCharges(item,sim.time);if(item?.id==='anchorWinch')winchCharges(item,sim.time);}}}
