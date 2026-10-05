import {ITEMS} from './royale-data.js';
export function restores(p,item){
 const d=ITEMS[item?.id];if(!d)return false;
 return d.kind==='heal'&&p.health<Math.min(100,d.cap||100)||d.kind==='shield'&&p.shield<Math.min(100,d.cap||100)||d.kind==='splash'&&(p.health<100||p.shield<100);
}
export function recoverySlot(p){
 const slots=p.inventory.map((item,slot)=>({item,slot})).filter(({item,slot})=>slot>0&&item?.count>0&&restores(p,item));
 const score=({item})=>{const d=ITEMS[item.id];return (p.health<100&&['heal','splash'].includes(d.kind)?100:0)+(d.kind==='shield'&&d.cap===50&&p.shield<50?30:0)+(d.kind==='heal'&&d.cap===75&&p.health<75?20:0)-d.duration;};
 slots.sort((a,b)=>score(b)-score(a));return slots[0]?.slot??-1;
}
export function recoverySwapSlot(p){
 const guns=p.inventory.map((i,slot)=>({i,slot})).filter(({i})=>i?.weapon);
 if(guns.length>1)return guns.sort((a,b)=>(a.i.rarity||0)-(b.i.rarity||0))[0].slot;
 return p.inventory.findIndex((i,slot)=>slot>0&&i&&!i.weapon&&!restores(p,i)&&!['keycard','winch','jumpRig'].includes(ITEMS[i.id]?.kind));
}
