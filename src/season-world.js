import {SEASON,rigCharges} from './season-one.js';
import {Simulation} from './simulation.js';
import {weapon} from './data.js';
import {inventory} from './building.js';
import {groundAt} from './terrain.js';
import {canStand,dist,direction,wallDistance} from './physics.js';
import {teammates} from './teams.js';
import {launchPlayer} from './airborne.js';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function initializeSeason(sim){
 sim.smokes=[];sim.relays=[];
 for(const poi of sim.map.districts.filter(p=>['observatory','factory','town'].includes(p.id)||['factory','town'].includes(p.kind)).slice(0,3)){
  const socket=sim.map.floorLoot.find(l=>l.poi===poi.id&&!l.roof&&l.floor===0&&canStand(sim.map,l));
  if(socket)sim.relays.push({id:poi.id,name:poi.name,x:socket.x,y:socket.y,z:socket.z,cooldown:0,progress:0,user:null});
 }
 const poi=sim.map.districts.find(p=>p.id==='observatory'),spots=sim.map.floorLoot.filter(l=>l.poi===poi.id&&!l.roof&&l.floor===0&&canStand(sim.map,l));
 const spot=spots.find(l=>Math.hypot(l.x-poi.x,l.z-poi.z)>12)||spots[0];if(!spot)return;
 const b=Simulation.prototype.addPlayer.call(sim,SEASON.boss.id,{name:SEASON.boss.name,color:'#3b3938',accent:'#e99b49',outfit:'outfit-ember',backbling:'backbling-royal'},true);
 if(!b)return;Object.assign(b,{boss:true,contestant:false,spectating:false,lateSpectator:false,connected:false,team:-2,x:spot.x,y:spot.y,z:spot.z,home:{...spot},health:SEASON.boss.health,shield:SEASON.boss.shield,maxHealth:SEASON.boss.health,maxShield:SEASON.boss.shield,grounded:true,flight:'ground',slot:1,inventory:inventory(),materials:{wood:0,brick:0,metal:0},bank:{medium:210,light:0,shells:0,heavy:0,rockets:0},stamina:100,lastDamage:-100,aggroAt:0});
 b.inventory[1]={id:SEASON.boss.weapon,weapon:true,rarity:SEASON.boss.rarity,count:1,ammo:weapon(SEASON.boss.weapon).magazine};sim.syncInventory(b);
}
export function bossInput(sim,p){
 const input={yaw:p.yaw,pitch:p.pitch||0,slot:1,forward:0,strafe:0};
 // Perception is budgeted at 5Hz. Turning, cooldowns and projectiles use normal ticks.
 if(sim.time>=(p.scanAt||0)){p.scanAt=sim.time+.2;let best=null,bestD=SEASON.boss.notice;
  for(const target of sim.players.values()){if(target===p||!target.contestant||target.health<=0||target.spectating||target.flight!=='ground')continue;const d=dist(p,target);if(d>bestD)continue;const from={x:p.x,y:p.y+1.6,z:p.z},v={x:(target.x-p.x)/d,y:(target.y-p.y)/d,z:(target.z-p.z)/d};if(wallDistance(sim.map,from,v,d)<d-.4||smokeBlocks(sim,from,target))continue;best=target;bestD=d;}
  if(best?.id!==p.targetId)p.aggroAt=sim.time+SEASON.boss.reaction;p.targetId=best?.id||null;
 }
 const target=sim.players.get(p.targetId),farHome=dist(p,p.home)>SEASON.boss.leash,goal=farHome?p.home:target;
 if(goal){const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),yaw=Math.atan2(-dx,-dz);input.yaw=p.yaw+Math.max(-.025,Math.min(.025,wrap(yaw-p.yaw)));input.pitch=Math.atan2((goal.y-p.y),d)+Math.sin(sim.time*2.1)*.012;
  input.forward=farHome||d>28?.55:d<11?-.32:0;input.strafe=!farHome&&target&&d<30?Math.sin(sim.time*.55)*.22:0;
  input.aim=!farHome&&!!target;input.fire=!!target&&!farHome&&dist(p,target)<SEASON.boss.notice&&sim.time>p.aggroAt&&Math.abs(wrap(yaw-p.yaw))<.07&&sim.time%2.7<1.1;input.reload=p.ammo[1]===0;
 }else input.yaw=p.yaw+Math.sin(sim.time*.18)*.002;
 return input;
}
export function damageBoss(sim,p,attacker,amount,source,precision,shotId){
 if(p.health<=0||!Number.isFinite(amount)||amount<=0)return;
 const shield=source==='Storm'?0:Math.min(p.shield,amount);p.shield-=shield;const dealt=Math.min(p.health,amount-shield);p.health-=dealt;p.lastDamage=sim.time;
 sim.emit('hit',{player:attacker?.id,target:p.id,amount:shield+dealt,precision,shield:shield>0,shotId,weapon:source,x:p.x,y:p.y+1.4,z:p.z,sourceX:attacker?.x,sourceY:attacker?.y,sourceZ:attacker?.z});
 if(shield&&p.shield===0)sim.emit('royale-cue',{cue:'shield-break',player:p.id,x:p.x,y:p.y,z:p.z});
 if(p.health===0&&!p.bossDefeated){p.bossDefeated=true;p.spectating=true;p.flight='out';p.reloadEnd=0;sim.dropWeapon(p,SEASON.boss.weapon,4);sim.dropLoot(p,{id:'jumpRig',rarity:5,count:1,charges:SEASON.rig.charges,rechargeAt:0,readyAt:0});sim.dropAmmo(p,'medium',60);sim.emit('boss-defeated',{player:attacker?.id,target:p.id,name:SEASON.boss.name,x:p.x,y:p.y,z:p.z});}
}
export function useSeasonItem(sim,p,item){
 if(item.id==='jumpRig'){if(!rigCharges(item,sim.time)||sim.time<(item.readyAt||0))return false;if(item.charges===SEASON.rig.charges)item.rechargeAt=sim.time+SEASON.rig.recharge;item.charges--;item.readyAt=sim.time+SEASON.rig.cooldown;const d=direction(p.yaw);launchPlayer(p,{source:'shockwave',vy:SEASON.rig.vertical,vx:d.x*SEASON.rig.horizontal,vz:d.z*SEASON.rig.horizontal});sim.emit('royale-fx',{kind:'impulse',x:p.x,y:p.y,z:p.z});sim.emit('rig-used',{player:p.id});return true;}
 if(item.id==='smoke'){sim.smokes??=[];if(sim.smokes.length>=12)sim.smokes.shift();const d=direction(p.yaw);const range=wallDistance(sim.map,{x:p.x,y:p.y+1,z:p.z},d,5);const x=p.x+d.x*Math.max(0,range-.5),z=p.z+d.z*Math.max(0,range-.5);sim.smokes.push({id:++sim.lootId,x,y:groundAt(sim.map,x,z)+1.3,z,radius:4.5,until:sim.time+12});return true;}
 if(item.id==='scanner'){scan(sim,p,55,8);return true;}return false;
}
export function smokeBlocks(sim,a,b){for(const s of sim.smokes||[]){if(s.until<=sim.time)continue;const dx=b.x-a.x,dy=(b.y||0)-(a.y||0),dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz||1,t=Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.y-a.y)*dy+(s.z-a.z)*dz)/l));if(Math.hypot(a.x+dx*t-s.x,(a.y||0)+dy*t-s.y,a.z+dz*t-s.z)<s.radius)return true;}return false;}
function scan(sim,p,range,seconds){sim.markers=sim.markers.filter(m=>m.until>sim.time);for(const enemy of sim.players.values())if(enemy!==p&&enemy.health>0&&!enemy.spectating&&!teammates(sim.options,p,enemy)&&dist(p,enemy)<range)sim.markers.push({id:++sim.markerId,player:p.id,team:p.team,name:'SIGNAL CONTACT',kind:'danger',label:'Last known position',x:enemy.x,y:enemy.y+2,z:enemy.z,until:sim.time+seconds});}
export function seasonInteract(sim,p,input,dt){const r=sim.relays?.find(r=>dist(p,r)<2.8);if(!r||!input.interact||r.cooldown>sim.time||p.lastDamage>sim.time-.4)return false;if(r.user!==p.id){r.user=p.id;r.progress=0;}r.progress+=dt;r.last=sim.time;if(r.progress>=3){r.progress=0;r.cooldown=sim.time+60;scan(sim,p,90,12);sim.markers.push({id:++sim.markerId,player:p.id,team:p.team,global:true,name:'RELAY TRANSMISSION',kind:'danger',label:'Active operator',x:p.x,y:p.y+2,z:p.z,until:sim.time+12});sim.emit('relay-captured',{player:p.id});}return true;}
export function seasonTick(sim){sim.smokes=(sim.smokes||[]).filter(s=>s.until>sim.time);for(const r of sim.relays||[])if(sim.time-(r.last||0)>.2){r.progress=0;r.user=null;}for(const p of sim.players.values())for(const item of p.inventory||[])if(item?.id==='jumpRig')rigCharges(item,sim.time);}
