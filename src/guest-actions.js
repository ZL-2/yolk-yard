import {gun} from './data.js';
import {PICKAXE} from './building-rules.js';
import {usableItem} from './item-use.js';
import {beginEquip} from './equip.js';
import {canFight} from './stance.js';

// Only presentation is speculative. Ammo, inventory ownership, damage and fire
// eligibility continue to come from the authoritative player, not this overlay.
export class GuestActions {
 constructor(){this.reset();}
 reset(){this.key=null;this.equip=null;this.interaction=null;this.held=false;this.action=null;this.fireHeld=false;this.reloadHeld=false;this.reloadPress=0;this.reloadIntent=null;this.nextSwing=0;this.feedback=[];this.echoes=[];}
 session(state,player){
  const key=`${state.royale?.matchId}:${state.options.map}:${state.round}:${player.id}:${player.health>0}:${!!player.downed}:${player.flight}`;
  if(key!==this.key){this.reset();this.key=key;}
 }
 input(state,player,input,time,now){
  this.session(state,player);
  if(!canFight(player)||player.spectating)return;
  let changed=false;
  const slot=Number.isInteger(input.slot)?input.slot:player.slot,max=player.inventory?5:1;
  const selected=this.equip?.slot??player.slot;
  if(slot>=0&&slot<=max&&slot!==selected&&(!player.inventory||player.flight==='ground')&&(!player.vehicleId||player.vehicleSeat>0)){
   const visual={...player,slot};beginEquip(visual,time,true);
   this.equip={slot,seq:input.seq,at:now,confirmed:false,weapon:player.inventory?.[slot]?.id??null,
    equipStarted:visual.equipStarted,equipHolster:visual.equipHolster,equipUntil:visual.equipUntil};
   this.action=null;this.reloadIntent=null;changed=true;
  }
  if(input.interact&&!this.held){this.interaction={seq:input.seq,at:now};changed=true;}
  this.held=!!input.interact;
  const visual=this.present(player,time,now),item=visual.inventory?.[visual.slot];
  const blocked=input.buildMode||input.editing||input.drop||player.reviving||player.traversal||player.vehicleId&&player.vehicleSeat===0;
  if(blocked||slot!==visual.slot||input.sprint&&this.action?.kind==='use'){this.action=null;this.reloadIntent=null;}
  const reloadHeld=!!(input.reloadHeld??input.reload),reloadEdge=reloadHeld&&!this.reloadHeld||(input.reloadPress||0)>this.reloadPress;
  this.reloadHeld=reloadHeld;this.reloadPress=Math.max(this.reloadPress,input.reloadPress||0);
  if(reloadEdge)this.reloadIntent={until:time+.22,slot,seq:input.seq};
  if(this.reloadIntent&&(this.reloadIntent.until<time||this.reloadIntent.slot!==slot))this.reloadIntent=null;
  if(!blocked&&slot===visual.slot&&(!player.inventory||player.flight==='ground')&&time>=(visual.equipUntil||0)){
   const stamp={seq:input.seq,at:now,slot,weapon:item?.id??gun(visual).id,confirmed:false};
   if((!item||item.weapon)&&!this.action&&!player.use&&!player.reloadEnd&&(reloadHeld||this.reloadIntent||input.fire&&player.ammo?.[slot]===0)){
    const w=gun(visual);if(player.reserve?.[slot]>0&&player.ammo?.[slot]<w.magazine){
     const empty=player.ammo[slot]===0,duration=empty?w.reloadEmpty:w.reload;
     this.action={...stamp,kind:'reload',base:player.reloadStarted,start:time,end:time+duration,duration,empty};this.reloadIntent=null;changed=true;
    }
   }else if(item?.pickaxe&&input.fire&&time>=this.nextSwing){
    this.nextSwing=Math.max(time,player.swingAt||0)+PICKAXE.interval;
    this.action={...stamp,kind:'swing',base:player.swingAt,start:time,end:time+.5};changed=true;
   }else if(item&&!item.weapon&&!item.pickaxe&&input.fire&&!this.fireHeld&&!this.action){
    const def=usableItem(visual,time);if(def){this.action={...stamp,kind:'use',base:player.use?.start,start:time,end:time+def.duration};changed=true;}
   }
  }
  if(changed&&this.action?.seq===input.seq){
   const a=this.action,event=a.kind==='reload'?{type:'reload',player:player.id,weapon:a.weapon,duration:a.duration,empty:a.empty}:{type:'royale-cue',player:player.id,cue:a.kind==='swing'?'pickaxe-swing':'use-'+a.weapon};
   this.feedback.push(event);this.echoes=this.echoes.filter(e=>now-e.at<1500);this.echoes.push({at:now,type:event.type,weapon:event.weapon,cue:event.cue});
  }
  this.fireHeld=!!input.fire;
  return changed;
 }
 receive(state,player,now){
  this.session(state,player);
  const e=this.equip;
  if(e&&player.ack>=e.seq){
   if(player.slot!==e.slot||(player.inventory?.[e.slot]?.id??null)!==e.weapon||e.confirmed&&player.equipStarted!==e.hostStarted)this.equip=null;
   else {e.confirmed=true;e.hostStarted=player.equipStarted;}
  }
  const action=this.action;
  if(action&&player.ack>=action.seq){
   const start=action.kind==='reload'?player.reloadStarted:action.kind==='swing'?player.swingAt:player.use?.start;
   const running=action.kind==='reload'?player.reloadEnd>state.time:action.kind==='swing'?start!=null:!!player.use;
   if(player.slot!==action.slot||(player.inventory?.[action.slot]?.id??gun(player).id)!==action.weapon||!running||start===action.base||action.confirmed&&start!==action.hostStarted)this.action=null;
   else {action.confirmed=true;action.hostStarted=start;}
  }
  if(this.interaction&&(player.ack>=this.interaction.seq||now-this.interaction.at>1000))this.interaction=null;
 }
 present(player,time,now){
  let visual=player;const action=this.action;
  if(action){
   if(!action.confirmed&&now-action.at>1500||time>action.end+1)this.action=null;
   else if(action.kind==='reload')visual={...player,reloadStarted:action.start,reloadDuration:action.duration,reloadEmpty:action.empty,reloadEnd:Math.max(action.end,player.reloadEnd||0)};
   else if(action.kind==='swing')visual={...player,swingAt:action.start};
   else visual={...player,use:{...player.use,id:action.weapon,slot:action.slot,start:action.start,end:action.end}};
  }
  const e=this.equip;
  if(!e)return visual;
  if(now-e.at>1500||e.confirmed&&time>=Math.max(e.equipUntil,player.equipUntil||0)){this.equip=null;return visual;}
  // Preserve the local draw timeline across acknowledgements: late packets
  // must not restart a draw that the player has already watched.
  return {...visual,slot:e.slot,equipStarted:e.equipStarted,equipHolster:e.equipHolster,equipUntil:e.equipUntil,
   reloadEnd:this.action?visual.reloadEnd:e.confirmed?player.reloadEnd:0,use:this.action?visual.use:e.confirmed?player.use:null};
 }
 takeFeedback(){return this.feedback.splice(0);}
 confirmFeedback(event,now){this.echoes=this.echoes.filter(e=>now-e.at<1500);const i=this.echoes.findIndex(e=>e.type===event.type&&e.weapon===event.weapon&&e.cue===event.cue);if(i<0)return false;this.echoes.splice(i,1);return true;}
 interacting(now){return !!this.interaction&&now-this.interaction.at<1000;}
}
