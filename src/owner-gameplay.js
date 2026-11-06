import {weapon,WEAPONS,ROYALE_WEAPONS} from './data.js';
import {ITEMS,AMMO_CAPS} from './royale-data.js';
import {canStand} from './physics.js';
import {groundAt} from './terrain.js';
export const OWNER_GAMEPLAY={
 heal:['Health','Full health'],shield:['Health','Full shield'],restore:['Health','Health + shield'],weak:['Health','Set 10 health'],unshield:['Health','Remove shield'],
 god:['Powers','God mode'],mortal:['Powers','Disable god mode'],freeze:['Powers','Freeze'],unfreeze:['Powers','Unfreeze'],fly:['Powers','Fly'],unfly:['Powers','Land'],fast:['Powers','Double speed'],slow:['Powers','Half speed'],normal:['Powers','Normal speed'],launch:['Powers','Launch upward'],reset:['Powers','Reset powers'],
 ammo:['Equipment','Refill ammunition'],materials:['Equipment','Max materials'],weapon:['Equipment','Give selected weapon'],medkit:['Equipment','Give trauma kit'],mini:['Equipment','Give mini shields'],impulse:['Equipment','Give impulse charges'],scanner:['Equipment','Give recon pulse'],jumpRig:['Equipment','Give jump rig'],shadowstep:['Equipment','Give Shadowstep'],anchorWinch:['Equipment','Give grappler'],
 bring:['Travel','Bring here'],goto:['Travel','Go to selected player'],ground:['Travel','Return to ground'],
};
const guns=new Set([...WEAPONS,...ROYALE_WEAPONS].map(w=>w.id));
export function validateOwnerGameplay(command){
 if(!Object.hasOwn(OWNER_GAMEPLAY,command.action)||!Array.isArray(command.players)||!command.players.length||command.players.length>8)throw Error('Invalid gameplay action.');
 if(command.action==='weapon'&&(!guns.has(command.weapon)||!Number.isInteger(command.rarity)||command.rarity<0||command.rarity>5))throw Error('Choose a supported weapon and rarity.');
}
function landing(sim,point){
 const boxes=sim.map.boxes.filter(b=>!b.doorId),map={...sim.map,boxes};
 for(const radius of [2.5,4,6,9])for(let i=0;i<8;i++){
  const x=point.x+Math.cos(i*Math.PI/4)*radius,z=point.z+Math.sin(i*Math.PI/4)*radius;
  let y=Math.max(groundAt(map,x,z),point.y);
  // A teleport keeps the target's floor when possible, then settles normally.
  if(canStand(map,{x,y,z})&&canStand(sim.map,{x,y,z}))return {x,y,z};
 }throw Error('No clear landing space near this player.');
}
export function applyOwnerGameplay(sim,command){
 validateOwnerGameplay(command);
 if(command.matchId!==sim.matchId)throw Error('The match changed.');
 const targets=command.players.map(id=>sim.players.get(id));
 if(targets.some(p=>!p||p.health<=0||p.spectating||p.downed||p.flight==='transport'||p.vehicleId||p.traversal))throw Error('Choose living, landed players outside vehicles.');
 const operator=sim.players.get(command.operator);
 let destination;
 if(command.action==='ground')destination=targets.map(p=>({p,point:landing(sim,{...p,y:groundAt(sim.map,p.x,p.z)})}));
 if(['bring','goto'].includes(command.action)){
  if(!operator||operator.health<=0||operator.spectating||operator.vehicleId||operator.flight==='transport')throw Error('Your player must be alive and outside a vehicle.');
  if(command.action==='goto'&&targets.length!==1)throw Error('Select one destination player.');
  destination=command.action==='goto'?[{p:operator,point:landing(sim,targets[0])}]:targets.map(p=>({p,point:landing(sim,operator)}));
 }
 if(command.action in ITEMS&&targets.some(p=>!p.inventory||!p.inventory.slice(1).some(i=>!i)))throw Error('A selected inventory is full.');
 if(command.action==='weapon'&&targets.some(p=>p.inventory&&!p.inventory.slice(1).some(i=>!i)))throw Error('A selected inventory is full.');
 if(destination){for(const {p,point}of destination)Object.assign(p,point,{vy:0,grounded:false,flight:'ground',mantle:null,grapple:null,fall:{apex:point.y,immune:true}});return;}
 for(const p of targets){
  const action=command.action;p.ownerEffects??={};
  if(['heal','restore'].includes(action))p.health=p.maxHealth||100;
  if(['shield','restore'].includes(action)){p.shield=100;if(!p.inventory)p.streakArmor=100;}
  if(action==='weak')p.health=10;
  if(action==='unshield'){p.shield=0;p.streakArmor=0;}
  if(action==='god')p.ownerEffects.god=true;
  if(action==='mortal')delete p.ownerEffects.god;
  if(action==='freeze'){p.ownerEffects.frozen=true;p.vx=p.vy=p.vz=0;}
  if(action==='unfreeze')delete p.ownerEffects.frozen;
  if(action==='fly'){p.ownerEffects.fly=true;p.vy=0;}
  if(action==='unfly')delete p.ownerEffects.fly;
  if(['fast','slow','normal'].includes(action))p.ownerEffects.speed=action==='fast'?2:action==='slow'?.5:1;
  if(action==='reset')p.ownerEffects={};
  if(action==='launch'){p.vy=22;p.grounded=false;p.fall={apex:p.y,immune:true};}
  if(action==='ammo'){
   if(p.bank)Object.assign(p.bank,AMMO_CAPS);
   if(p.inventory){for(const item of p.inventory)if(item?.weapon)item.ammo=weapon(item.id).magazine;sim.syncInventory(p);}
   else{const w=weapon(p.weapon);p.ammo[0]=w.magazine;p.reserve[0]=w.reserve;}
  }
  if(action==='materials'&&p.materials)Object.assign(p.materials,{wood:999,brick:999,metal:999});
  if(action==='weapon'){
   if(p.inventory){const slot=p.inventory.findIndex((i,n)=>n>0&&!i);p.inventory[slot]={id:command.weapon,weapon:true,count:1,rarity:command.rarity,ammo:weapon(command.weapon).magazine};sim.syncInventory(p);}
   else{p.weapon=command.weapon;p.ammo[0]=weapon(command.weapon).magazine;p.reserve[0]=weapon(command.weapon).reserve;}
  }
  if(action in ITEMS){const slot=p.inventory.findIndex((i,n)=>n>0&&!i);p.inventory[slot]={id:action,count:1,rarity:ITEMS[action].rarity||2};sim.syncInventory(p);}
 }
}
