import {beginEquip} from './equip.js';
import {canFight} from './stance.js';

// Only presentation is speculative. Ammo, inventory ownership, damage and fire
// eligibility continue to come from the authoritative player, not this overlay.
export class GuestActions {
 constructor(){this.reset();}
 reset(){this.key=null;this.equip=null;this.interaction=null;this.held=false;}
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
   changed=true;
  }
  if(input.interact&&!this.held){this.interaction={seq:input.seq,at:now};changed=true;}
  this.held=!!input.interact;
  return changed;
 }
 receive(state,player,now){
  this.session(state,player);
  const e=this.equip;
  if(e&&player.ack>=e.seq){
   if(player.slot!==e.slot||(player.inventory?.[e.slot]?.id??null)!==e.weapon||e.confirmed&&player.equipStarted!==e.hostStarted)this.equip=null;
   else {e.confirmed=true;e.hostStarted=player.equipStarted;}
  }
  if(this.interaction&&(player.ack>=this.interaction.seq||now-this.interaction.at>1000))this.interaction=null;
 }
 present(player,time,now){
  const e=this.equip;
  if(!e)return player;
  if(now-e.at>1500||e.confirmed&&time>=Math.max(e.equipUntil,player.equipUntil||0)){this.equip=null;return player;}
  // Preserve the local draw timeline across acknowledgements: late packets
  // must not restart a draw that the player has already watched.
  return {...player,slot:e.slot,equipStarted:e.equipStarted,equipHolster:e.equipHolster,equipUntil:e.equipUntil,
   reloadEnd:e.confirmed?player.reloadEnd:0,use:e.confirmed?player.use:null};
 }
 interacting(now){return !!this.interaction&&now-this.interaction.at<1000;}
}
