import {Simulation} from './simulation.js';
import {weapon} from './data.js';
import {inventory} from './building.js';
import {canStand,candidates,boxTop} from './physics.js';
import {groundAt} from './terrain.js';
import {initializeBossAwareness} from './boss-awareness.js';
export const HENCHMEN=Object.freeze({count:4,health:100,shield:25,weapon:'sprinter',rarity:1,notice:28,leash:20,reaction:2,burst:.13,cycle:4.2,aimError:.095});
export function henchmanDefinition(boss){return {...boss,...HENCHMEN,ability:null};}
export function initializeHenchmen(sim,boss,def){
 const reserved=[boss.home],name=def.name.split(' ').at(-1),candidates=[];
 const district=sim.map.districts.reduce((best,d)=>!best||Math.hypot(d.x-boss.home.x,d.z-boss.home.z)<Math.hypot(best.x-boss.home.x,best.z-boss.home.z)?d:best,null);
 for(let i=0;i<32;i++){const a=i*Math.PI/16,r=18+(i%3)*8,x=(district?.x??boss.home.x)+Math.sin(a)*r,z=(district?.z??boss.home.z)+Math.cos(a)*r;candidates.push({x,y:groundAt(sim.map,x,z),z});}
 candidates.push(...(boss.patrol||[]));
 for(let ring=0;ring<4;ring++)for(let i=0;i<12;i++){const angle=i*Math.PI/6,point={x:boss.home.x+Math.sin(angle)*(3+ring*3),z:boss.home.z+Math.cos(angle)*(3+ring*3)};candidates.push({...point,y:boss.home.y},{...point,y:groundAt(sim.map,point.x,point.z)});}
 for(let i=0;i<HENCHMEN.count;i++){
  const point=candidates.find(q=>reserved.every(r=>Math.hypot(q.x-r.x,q.z-r.z)>12)&&canStand(sim.map,q))||boss.home;reserved.push(point);
  const p=Simulation.prototype.addPlayer.call(sim,def.id+'-guard-'+(i+1),{name:name+' Sentinel '+(i+1),color:def.color,accent:def.accent,outfit:def.outfit},true);
  Object.assign(p,{henchman:true,guardIndex:i,boss:false,bossId:def.id,contestant:false,spectating:false,lateSpectator:false,connected:false,team:-2,...point,home:{...point},health:HENCHMEN.health,shield:HENCHMEN.shield,maxHealth:HENCHMEN.health,maxShield:HENCHMEN.shield,grounded:true,flight:'ground',slot:1,inventory:inventory(),materials:{wood:0,brick:0,metal:0},bank:{medium:90,light:0,shells:0,heavy:0,rockets:0},stamina:100,lastDamage:-100,aggroAt:0,patrolIndex:i,patrolWait:0,scanAt:sim.time+i*.05,guardNextAt:sim.time+i*.025+(p.joinedOrder%3)*.008});
  p.patrol=[{...point}];for(let j=0;j<4;j++){const a=(i+j)*Math.PI/2,x=point.x+Math.sin(a)*5,z=point.z+Math.cos(a)*5,q={x,y:groundAt(sim.map,x,z),z};if(Math.abs(q.y-point.y)<1.5&&canStand(sim.map,q))p.patrol.push(q);}
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
 return sim.guardOccupancy.sites[p.bossId]||sim.time-(p.attackerAt??-100)<3;
}

// A sleeping district cannot freeze guards over a destroyed floor. The existing
// spatial query is tiny; awake/airborne guards continue through normal physics.
export function henchmanSupported(sim,p){
 if(p.y-groundAt(sim.map,p.x,p.z)<.06)return true;
 return candidates(sim.map,p).some(b=>Math.abs(boxTop(b,p.x,p.z,.32)-p.y)<.06);
}
