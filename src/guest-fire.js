import {gun} from './data.js';
import {updateCombatAccuracy,firedAccuracy,weaponReadyAt} from './combat.js';
import {COMBAT_LIMITS} from './weapon-balance.js';
import {muzzleOrigin} from './physics.js';
// Immediate presentation only. Accepted server trajectories own tracers/damage.
export class GuestFire{
 constructor(){this.reset();}
 reset(){this.session=null;this.key=null;this.next=0;this.cooldowns={};this.shotgunReady=0;this.pending=0;this.held=false;this.burst=0;this.sent=[];this.echoes=[];this.accuracy=null;this.lastAck=-1;}
 step(player,input,time,now,round){
  const session=`${round}:${player.id}:${player.health>0}`,w=gun(player),key=`${player.slot}:${w.id}`;
  if(this.session!==session){this.reset();this.session=session;}if(this.key!==key){this.key=key;this.burst=0;this.pending=0;this.held=false;this.accuracy=null;}
  this.sent=this.sent.filter(s=>s.seq>player.ack&&now-s.at<1);this.echoes=this.echoes.filter(s=>now-s.at<1).slice(-64);
  const pressed=input.fire&&!this.held;this.held=!!input.fire&&time>=(player.equipUntil||0);if(pressed)this.pending=time+COMBAT_LIMITS.triggerBuffer;
  const eligible=player.health>0&&!player.downed&&!player.reviving&&!player.spectating&&(!player.inventory||player.flight==='ground'&&player.inventory?.[player.slot]?.weapon)&&input.slot===player.slot&&!input.buildMode&&!input.reload&&!player.reloadEnd&&!player.use;
  if(!this.accuracy||player.ack!==this.lastAck&&!this.sent.length){this.accuracy={...player.combatState};this.lastAck=player.ack;}
  player.aim=!!input.aim;updateCombatAccuracy(player,w,this.accuracy,1/60,time,Math.hypot(player.vx||0,player.vz||0));
  player.shotSpread=this.accuracy.spread;player.firstShot=this.accuracy.firstShot;player.recoilPitch=this.accuracy.recoilPitch;player.recoilYaw=this.accuracy.recoilYaw;
  if(!eligible){this.burst=0;return null;}const outstanding=this.sent.filter(s=>s.weapon===w.id&&s.slot===player.slot).length;
  if((player.ammo[player.slot]||0)<=outstanding||time+1e-9<(player.equipUntil||0))return null;
  if(this.burst){if(time+1e-9<this.next)return null;this.burst--;}
  else{const ready=Math.max(player.nextShot||0,weaponReadyAt(player,w),this.cooldowns[w.id]||0,w.shotgunLock?this.shotgunReady:0);if(time+1e-9<ready||!(w.automatic?input.fire:this.pending>0&&this.pending+1e-9>=time))return null;this.cooldowns[w.id]=time+w.interval;if(w.shotgunLock)this.shotgunReady=time+w.interval;this.pending=0;this.burst=Math.max(0,(w.burst||1)-1);}
  this.next=time+(w.burstInterval||w.interval);const mark={seq:input.seq,at:now,weapon:w.id,slot:player.slot};this.sent.push(mark);this.echoes.push(mark);
  firedAccuracy(player,w,this.accuracy,time);player.shotSpread=this.accuracy.spread;player.firstShot=false;player.recoilPitch=this.accuracy.recoilPitch;player.recoilYaw=this.accuracy.recoilYaw;
  return {type:w.projectile?'launch':'shot',player:player.id,weapon:w.id,predicted:true,origin:muzzleOrigin({...player,yaw:input.yaw,pitch:input.pitch},w),shots:[]};
 }
 confirm(event,now){this.echoes=this.echoes.filter(s=>now-s.at<1);if(!['shot','launch'].includes(event.type)||event.popper)return false;const i=this.echoes.findIndex(s=>s.weapon===event.weapon);if(i<0)return false;this.echoes.splice(i,1);return true;}
}
