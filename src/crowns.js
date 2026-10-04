import {SEASON} from './season-one.js';
import {isWarmup} from './royale-phases.js';
const stores=new WeakMap();
export const CROWN_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 5 5 4-8 4 8 5-5-2 12H5ZM5 20h14"/></svg>';
export function crownRecord(value={}){
 const same=value.season===SEASON.number;
 return {season:SEASON.number,wins:same?Math.max(0,Math.min(1e7,Math.floor(value.wins)||0)):0,owned:same&&value.owned===true,unlocked:value.unlocked===true};
}
export function bindCrownStore(sim,store){stores.set(sim,store);}
export function attachCrown(sim,p,identity=null){
 if(p.bot)return;p.crownIdentity=identity;
 p.crownProgress=crownRecord(stores.get(sim)?.load(identity)||p.crownProgress);
 p.crown=!!p.contestant&&p.crownProgress.owned;
 syncCrown(p);
}
function syncCrown(p){p.crownWins=p.crownProgress?.wins||0;p.crownEmoteUnlocked=!!p.crownProgress?.unlocked;}
function persist(sim,p){
 if(p.bot)return;p.crownProgress=crownRecord(p.crownProgress);p.crownProgress.owned=!!p.crown;
 syncCrown(p);if(p.crownIdentity)stores.get(sim)?.save(p.crownIdentity,{...p.crownProgress});
}
export function resetMatchCrown(p){p.crownedVictory=false;p.emote=null;p.crown=!!p.contestant&&!!p.crownProgress?.owned;}
export function dropCrown(sim,p,{manual=false}={}){
 if(!p.crown||manual&&(p.downed||p.spectating||p.health<=0||p.flight!=='ground'))return false;
 const drop=sim.dropLoot(p,{id:'victoryCrown',crown:true,count:1,rarity:5,droppedBy:p.id,pickupAfter:sim.time+1.5});
 // Losing/eliminating a holder always clears ownership even if the drop is blocked.
 if(!drop&&manual)return false;p.crown=false;persist(sim,p);
 sim.emit('crown-dropped',{player:p.id,name:p.name,x:p.x,y:p.y,z:p.z});return true;
}
export function takeCrown(sim,p,item){
 if(!item.crown||p.crown||p.bot||p.health<=0||p.spectating||p.downed||p.flight!=='ground'||item.droppedBy===p.id&&item.pickupAfter>sim.time)return false;
 p.crown=true;persist(sim,p);sim.removeLoot(item);
 sim.emit('crown-picked-up',{player:p.id,name:p.name,x:p.x,y:p.y,z:p.z});sim.emit('royale-cue',{cue:'crown-pickup',player:p.id,x:p.x,y:p.y,z:p.z});return true;
}
export function awardCrowns(sim,living){
 if(!sim.options.recurring)return; // Custom rooms and practice cannot farm season wins.
 for(const p of living){if(p.bot||p.connected===false)continue;
  p.crownProgress=crownRecord(p.crownProgress);p.crownedVictory=!!p.crown;
  if(p.crownedVictory){p.crownProgress.wins++;p.crownProgress.unlocked=true;}
  p.crown=true;persist(sim,p);sim.emit('crown-victory',{player:p.id,crowned:p.crownedVictory,wins:p.crownWins});
 }
}
export function pulseCrowns(sim){
 if(isWarmup(sim.stage))return;for(const p of sim.players.values())if(p.crown&&p.health>0&&!p.spectating&&p.flight==='ground'){
  p.crownPulseAt=sim.time;sim.emit('royale-cue',{cue:'crown-pulse',player:p.id,x:p.x,y:p.y,z:p.z});
 }
}
