import {Simulation} from './simulation.js';
import {weapon} from './data.js';
import {inventory} from './building.js';
import {canStand} from './physics.js';
import {groundAt} from './terrain.js';
import {initializeBossAwareness} from './boss-awareness.js';
export const HENCHMEN=Object.freeze({count:4,health:100,shield:25,weapon:'sprinter',rarity:1,notice:28,leash:20,reaction:2,burst:.13,cycle:4.2,aimError:.095});
export function henchmanDefinition(boss){return {...boss,...HENCHMEN,ability:null};}
export function initializeHenchmen(sim,boss,def){
 const reserved=[boss.home],name=def.name.split(' ').at(-1),candidates=[...(boss.patrol||[])];
 for(let ring=0;ring<4;ring++)for(let i=0;i<12;i++){const angle=i*Math.PI/6,point={x:boss.home.x+Math.sin(angle)*(3+ring*3),z:boss.home.z+Math.cos(angle)*(3+ring*3)};candidates.push({...point,y:boss.home.y},{...point,y:groundAt(sim.map,point.x,point.z)});}
 for(let i=0;i<HENCHMEN.count;i++){
  const point=candidates.find(q=>reserved.every(r=>Math.hypot(q.x-r.x,q.z-r.z)>1.2)&&canStand(sim.map,q))||boss.home;reserved.push(point);
  const p=Simulation.prototype.addPlayer.call(sim,def.id+'-guard-'+(i+1),{name:name+' Sentinel '+(i+1),color:def.color,accent:def.accent,outfit:def.outfit},true);
  Object.assign(p,{henchman:true,guardIndex:i,boss:false,bossId:def.id,contestant:false,spectating:false,lateSpectator:false,connected:false,team:-2,...point,home:{...point},health:HENCHMEN.health,shield:HENCHMEN.shield,maxHealth:HENCHMEN.health,maxShield:HENCHMEN.shield,grounded:true,flight:'ground',slot:1,inventory:inventory(),materials:{wood:0,brick:0,metal:0},bank:{medium:90,light:0,shells:0,heavy:0,rockets:0},stamina:100,lastDamage:-100,aggroAt:0,patrolIndex:i,patrolWait:0,scanAt:sim.time+i*.05});
  p.patrol=(boss.patrol||[]).filter(q=>canStand(sim.map,q));if(!p.patrol.length)p.patrol=[{...point}];
  p.inventory[1]={id:HENCHMEN.weapon,weapon:true,rarity:HENCHMEN.rarity,count:1,ammo:weapon(HENCHMEN.weapon,HENCHMEN.rarity).magazine};
  sim.syncInventory(p);initializeBossAwareness(sim,p);
 }
}
export function henchmanAwake(sim,p){
 // Shared, twice-per-second district checks let distant guards sleep without
 // adding twelve full bot planners or ray scans to every simulation frame.
 if(!sim.guardOccupancy||sim.time>=sim.guardOccupancy.at){
  const contestants=[...sim.players.values()].filter(o=>o.contestant&&o.health>0&&!o.spectating&&o.flight==='ground'),sites={};
  for(const boss of sim.players.values())if(boss.boss)sites[boss.bossId]=contestants.some(o=>(o.x-boss.home.x)**2+(o.z-boss.home.z)**2<96*96);
  sim.guardOccupancy={at:sim.time+.5,sites};
 }
 return sim.guardOccupancy.sites[p.bossId]||sim.time-p.lastDamage<3;
}
