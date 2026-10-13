import {ITEMS} from './royale-data.js';

export function cleanHealingUse(p) {
  const use=p.use,item=p.inventory?.[use?.slot];
  if(use?.consumed&&item?.id===use.id&&item.count<=0)p.inventory[use.slot]=null;
}
export function tickHealing(sim,p) {
  const use=p.use,def=ITEMS[use?.id];if(!def?.progressive||p.downed||p.health<=0)return;
  const item=p.inventory[use.slot];if(!item||item.id!==use.id){sim.cancelUse(p,'swap');return;}
  if(!Number.isFinite(use.start)||!Number.isFinite(use.end)){sim.cancelUse(p);return;}
  const elapsed=sim.time-use.start-def.setup;if(elapsed<=0)return;
  if(!use.consumed){if(!(item.count>0)){sim.cancelUse(p);return;}item.count--;use.consumed=true;use.delivered=0;}
  const total=def.amount*Math.min(1,elapsed/(def.duration-def.setup));
  const amount=Math.max(0,total-(use.delivered||0)),key=def.kind==='shield'?'shield':'health';
  const restored=Math.max(0,Math.min(amount,def.cap-p[key]));p[key]+=restored;use.delivered=total;
  if(p.field)p.field.healing+=restored;
  if(p[key]>=def.cap)use.end=Math.min(use.end,sim.time);
}
