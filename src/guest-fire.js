import {gun} from './data.js';
import {updateCombatAccuracy,firedAccuracy} from './combat.js';
import {direction,muzzleOrigin} from './physics.js';
// Predict presentation only: no damage, inventory edits or host acknowledgements.
export class GuestFire {
 constructor(){this.reset();}
 reset(){this.key=null;this.next=0;this.triggerNext=0;this.held=false;this.burst=0;this.sent=[];this.echoes=[];this.accuracy=null;this.lastAck=-1;}
 step(player,input,time,now,round){
  const key=`${round}:${player.id}:${player.slot}:${player.inventory?.[player.slot]?.id||player.weapon}:${player.health>0}`;
  if(this.key!==key){this.reset();this.key=key;}
  this.sent=this.sent.filter(s=>s.seq>player.ack&&now-s.at<1);
  this.echoes=this.echoes.filter(s=>now-s.at<1).slice(-64);
  const pressed=input.fire&&!this.held;this.held=!!input.fire&&time>=(player.equipUntil||0);
  const w=gun(player),eligible=player.health>0&&!player.downed&&!player.reviving&&(!player.inventory||player.flight==='ground'&&player.inventory?.[player.slot]?.weapon)&&input.slot===player.slot&&!input.buildMode&&!input.reload&&!player.reloadEnd&&!player.use;
  if(!this.accuracy||player.ack!==this.lastAck&&!this.sent.length){this.accuracy={...player.combatState};this.lastAck=player.ack;}
  player.aim=!!input.aim;
  updateCombatAccuracy(player,w,this.accuracy,1/60,time,Math.hypot(player.vx||0,player.vz||0));
  player.shotSpread=this.accuracy.spread;player.firstShot=this.accuracy.firstShot;player.recoilPitch=this.accuracy.recoilPitch;player.recoilYaw=this.accuracy.recoilYaw;
  if(!eligible){this.burst=0;return null;}
  if((player.ammo[player.slot]||0)<=this.sent.length||time<(player.equipUntil||0)||now<this.next)return null;
  const continuing=this.burst>0;
  if(!continuing&&!(input.fire&&(w.automatic||pressed)))return null;
  if(!continuing){this.burst=Math.max(0,(w.burst||1)-1);this.triggerNext=now+w.interval;}else this.burst--;
  this.next=this.burst?now+w.burstInterval:this.triggerNext;
  const mark={seq:input.seq,at:now,weapon:w.id};this.sent.push(mark);this.echoes.push(mark);
  firedAccuracy(player,w,this.accuracy,time);player.recoilPitch=this.accuracy.recoilPitch;player.recoilYaw=this.accuracy.recoilYaw;
  const d=direction(input.yaw,input.pitch),origin=muzzleOrigin({...player,yaw:input.yaw,pitch:input.pitch},w),speed=w.boltSpeed||80;
  // Immediate muzzle/recoil/audio only. Tracers and damage require the accepted
  // host trajectory, so a rejected prediction never displays a connecting shot.
  return {type:w.projectile?'launch':'shot',player:player.id,weapon:w.id,predicted:true,origin,shots:[]};
 }
 confirm(event,now){
  this.echoes=this.echoes.filter(s=>now-s.at<1);
  if(!['shot','launch'].includes(event.type)||event.popper)return false;
  const index=this.echoes.findIndex(s=>s.weapon===event.weapon);
  if(index<0)return false;this.echoes.splice(index,1);return true;
 }
}
