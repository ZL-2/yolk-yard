import {weapon} from './data.js';
import {ammoType} from './royale-data.js';
import {groundAt} from './terrain.js';
import {canStand,wallDistance,candidates} from './physics.js';
// One host-only table for authored floor sockets, chests and supply rewards.
const sources=['ground','chest','high','supply'];
export const AMMO_DROPS={light:{weight:28,min:18,max:36},medium:{weight:36,min:20,max:40},shells:{weight:24,min:6,max:12},heavy:{weight:9,min:4,max:8},rockets:{weight:3,min:1,max:3}};
export const LOOT_TABLE=[
 ...[['sprinter',28,'assault'],['pip',18,'sidearm'],['zipper',23,'smg'],['scatter',20,'shotgun'],['doubleyolk',16,'shotgun'],['duet',13,'assault'],['anchor',8,'marksman'],['peeper',8,'marksman'],['needle',4,'sniper'],['comet',9,'energy'],['thumper',2,'launcher']].map(([id,weight,category])=>({id,weight,category,weapon:true,ammoType:ammoType(id),sources,rarities:id==='thumper'?[0,0,65,30,5]:[53,30,13,3.5,.5]})),
 ...[['bandage',18,0],['medkit',10,1],['mini',30,1],['flask',16,2],['splash',9,2],['popper',8,1],['impulse',6,2],['launchpad',3,3]].map(([id,weight,rarity])=>({id,weight,rarity,category:['bandage','medkit'].includes(id)?'health':['mini','flask','splash'].includes(id)?'shield':'utility',sources:id==='launchpad'?['chest','high','supply']:sources,counts:id==='mini'?[2,3]:id==='bandage'?[2,3]:[1,2]})),
 ...Object.entries(AMMO_DROPS).map(([id,v])=>({id,...v,category:'ammo',ammoType:id,sources:['ground']})),
];
export function weighted(list,random,weight=o=>o.weight){const total=list.reduce((n,o)=>n+weight(o),0);let r=random()*total;for(const entry of list){r-=weight(entry);if(r<=0)return entry;}return list.at(-1);}
const quantity=(r,min,max)=>min+Math.floor(r()*(max-min+1));
function rarity(entry,source,random){const weights=source==='supply'?[0,0,35,50,15]:source==='high'?[5,38,42,13,2]:source==='chest'?[12,48,31,8,1]:entry.rarities;return weighted(weights.map((weight,id)=>({weight:entry.id==='thumper'&&id<2?0:weight,id})),random).id;}
export function rollItem(random,source='ground',role='mixed'){
 const category=role==='mixed'?weighted([{id:'weapon',weight:52},{id:'utility',weight:26},{id:'ammo',weight:22}],random).id:role;
 const entries=LOOT_TABLE.filter(e=>e.sources.includes(source)&&(category==='weapon'?e.weapon:category==='ammo'?e.category==='ammo':!e.weapon&&e.category!=='ammo'));
 const e=weighted(entries,random);
 if(e.weapon)return {id:e.id,weapon:true,count:1,rarity:rarity(e,source,random),ammo:weapon(e.id).magazine};
 if(e.category==='ammo')return {id:e.id,ammoType:e.id,count:quantity(random,e.min,e.max),rarity:0};
 return {id:e.id,count:quantity(random,...e.counts),rarity:e.rarity};
}
export function matchingAmmo(item,random){const type=ammoType(item.id),a=AMMO_DROPS[type];return {id:type,ammoType:type,count:quantity(random,a.min,a.max),rarity:0};}
export function rollChest(random,source='chest'){const gun=rollItem(random,source,'weapon');return [gun,matchingAmmo(gun,random),rollItem(random,source,'utility')];}
// Highest support *below this floor*, never the highest rooftop at X/Z.
export function supportBelow(map,x,z,y){let floor=groundAt(map,x,z);for(const b of candidates(map,{x,y,z},null,0,0))if(b.y+b.h<=y+.24&&Math.abs(x-b.x)<b.w/2&&Math.abs(z-b.z)<b.d/2)floor=Math.max(floor,b.y+b.h);return floor;}
export function validLootPoint(map,p,margin=.7){return p.y>=groundAt(map,p.x,p.z)-.06&&Math.abs(supportBelow(map,p.x,p.z,p.y)-p.y)<.26&&canStand(map,p,margin);}
export function placeLoot(map,point,existing=[]){
 const base={x:point.x,y:Number.isFinite(point.y)?point.y:groundAt(map,point.x,point.z),z:point.z};let best=null,bestScore=-Infinity;
 for(let i=0;i<64;i++){
  const a=i*2.399963,r=i===0?0:.65+Math.sqrt(i)*.42,x=base.x+Math.cos(a)*r,z=base.z+Math.sin(a)*r;
  const y=supportBelow(map,x,z,base.y+.02),candidate={x,y,z};
  if(Math.abs(y-base.y)>1.0||!validLootPoint(map,candidate))continue;
  const dx=x-base.x,dy=y-base.y,dz=z-base.z,len=Math.hypot(dx,dy,dz);
  if(len>0&&wallDistance(map,{...base,y:base.y+.62},{x:dx/len,y:dy/len,z:dz/len},len)<len-.1)continue;
  let separation=2;for(const item of existing)if(Math.abs(item.y-y)<1.2)separation=Math.min(separation,Math.hypot(item.x-x,item.z-z));
  const score=separation-r*.025;if(score>bestScore){bestScore=score;best=candidate;}if(separation>1.15)return candidate;
 }
 return best;
}
export function seedIslandLoot(sim){
 sim.chests=[];const armed=new Set();
 for(const point of sim.map.floorLoot){
  if(sim.random()>point.chance||!validLootPoint(sim.map,point))continue;
  const item=rollItem(sim.random,'ground',point.role),drop=sim.dropLoot(point,item);
  if(drop?.weapon){if(point.floor===0)armed.add(point.building);sim.dropLoot(point,matchingAmmo(item,sim.random));}
 }
 // Each structure has a usable early-game weapon, with variable sockets and contents.
 for(const [index]of sim.map.buildings.entries())if(!armed.has(index)){
  const choices=sim.map.floorLoot.filter(p=>p.building===index&&p.floor===0&&p.role==='weapon'&&validLootPoint(sim.map,p));
  const point=choices[Math.floor(sim.random()*choices.length)];if(!point)continue;
  const item=rollItem(sim.random,'ground','weapon');if(sim.dropLoot(point,item))sim.dropLoot(point,matchingAmmo(item,sim.random));
 }
 for(const p of sim.map.chests)if(sim.random()<p.chance&&validLootPoint(sim.map,p,.8))sim.chests.push({id:p.id,x:p.x,y:p.y,z:p.z,poi:p.poi,source:p.source,opened:false,supply:false,contents:rollChest(sim.random,p.source)});
 // A poor random roll must not strip a major landing district of chests.
 for(const district of sim.map.districts){
  let count=sim.chests.filter(c=>c.poi===district.id).length;
  for(const point of sim.map.chests.filter(p=>p.poi===district.id&&!sim.chests.some(c=>c.id===p.id))){
   if(count>=3)break;if(!validLootPoint(sim.map,point,.8))continue;
   sim.chests.push({id:point.id,x:point.x,y:point.y,z:point.z,poi:point.poi,source:point.source,opened:false,supply:false,contents:rollChest(sim.random,point.source)});count++;
  }
 }
 sim.lootVersion++;
}
