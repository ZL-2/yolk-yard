import {ITEMS} from './royale-data.js';
import {canFight} from './stance.js';
import {rigCharges} from './season-one.js';
import {shadowCharges} from './shadowstep.js';
// Shared admission for authoritative use and speculative presentation. Effects,
// inventory consumption, projectiles and mobility always remain authoritative.
export function usableItem(p,time){
 if(!canFight(p)||time<(p.equipUntil||0)||p.use||p.flight!=='ground'||p.traversal)return null;
 const item=p.inventory?.[p.slot],def=ITEMS[item?.id];
 if(!def||!(item.count>0)||def.kind==='keycard')return null;
 if(['winch','jumpRig','shadowstep'].includes(def.kind)&&time<(item.readyAt||0))return null;
 if(def.kind==='jumpRig'&&!rigCharges(item,time)||def.kind==='shadowstep'&&!shadowCharges(item,time))return null;
 if(def.kind==='popper'&&time<(p.nextPopper||0))return null;
 if(def.kind==='heal'&&p.health>=def.cap||def.kind==='shield'&&p.shield>=def.cap)return null;
 return def;
}
