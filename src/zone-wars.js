import {BoxFightSimulation} from './box-fights.js';
import {Simulation} from './simulation.js';
import {zoneMap} from './zone-wars-map.js';
import {ZONE_RULES,zoneLoadout,zoneStormPath,zoneStormAt,constrainZoneMovement} from './zone-wars-rules.js';
import {rebuildMap} from './building.js';
import {weapon,clamp} from './data.js';
import {direction,worldHit} from './physics.js';
import {launchPlayer,fallDamage} from './airborne.js';
export class ZoneWarsSimulation extends BoxFightSimulation {
 constructor(options={}){super({...options,mode:'zonewars'});this.zonePath=zoneStormPath(this.random);this.storm=this.initialStorm();}
 get rules(){return ZONE_RULES;}
 battleMap(){return zoneMap();}
 roundMap(){this.zonePath=zoneStormPath(this.random);this.zoneSpawns=[...zoneMap().spawnRooms];for(let i=this.zoneSpawns.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.zoneSpawns[i],this.zoneSpawns[j]]=[this.zoneSpawns[j],this.zoneSpawns[i]];}return zoneMap();}
 roundSpawn(p,i){return {...this.zoneSpawns[i%this.zoneSpawns.length]};}
 initialStorm(){return this.zonePath?zoneStormAt(this.zonePath,0):{active:false,x:0,z:0,radius:94,index:0,seconds:12,nextX:0,nextZ:0,nextRadius:62,closing:false};}
 updateRoundStorm(){this.storm=zoneStormAt(this.zonePath,this.time-this.boxStarted);}
 setBarrier(enabled){this.map.boxPrep=enabled;this.buildVersion++;rebuildMap(this);}
 equip(p){
  if(p.friendSpectator)return;p.boxSpawn??={...this.map.spawnRooms[[...this.players.keys()].indexOf(p.id)%16]};super.equip(p);
  const items=zoneLoadout(this.random);items.forEach((item,i)=>{p.inventory[i+1]={...item,...(item.weapon?{ammo:weapon(item.id).magazine}:{})};});
  p.materials={wood:500,brick:500,metal:500};p.bank={light:300,medium:300,shells:60,heavy:40,rockets:6};p.zoneBrain=null;this.syncInventory(p);
 }
 moveWithCommands(p,input,dt,commands){Simulation.prototype.moveWithCommands.call(this,p,input,dt,commands);constrainZoneMovement(p,this.map,['prepare','waiting'].includes(this.boxStage));const damage=fallDamage(p.landing);if(damage)this.damage(p,null,damage,'Fall');}
 damage(victim,attacker,amount,...args){const alive=victim.health>0;super.damage(victim,attacker,amount,...args);if(alive&&victim.health<=0&&attacker&&attacker!==victim){for(const m of ['brick','metal'])attacker.materials[m]=Math.min(500,attacker.materials[m]+50);for(const a of ['light','medium'])attacker.bank[a]=Math.min(500,attacker.bank[a]+30);attacker.bank.shells=Math.min(150,attacker.bank.shells+10);}}
 takeLoot(p,item,options){const ok=super.takeLoot(p,item,options);for(const m of ['wood','brick','metal'])p.materials[m]=Math.min(500,p.materials[m]);return ok;}
 tick(dt){super.tick(dt);if(this.boxStage!=='fight')return;for(const p of this.players.values()){if(p.health<=0||p.spectating)continue;for(const pad of this.pads||[])if(Math.hypot(p.x-pad.x,p.z-pad.z)<1.5&&Math.abs(p.y-pad.y)<1.2&&this.time>(p.zonePadAt||0)){p.zonePadAt=this.time+1.5;launchPlayer(p,{source:'launchpad',vy:25});}if(p.flight==='glide'&&p.grounded)p.flight='ground';}}
 botInput(p){
  if(this.boxStage!=='fight')return {yaw:p.yaw,pitch:0,slot:1};
  const brain=p.zoneBrain??={next:0,buildAt:0,stuck:0,x:p.x,z:p.z,input:{yaw:p.yaw,slot:1}};
  // Stagger decision work; movement and combat still run every authoritative tick.
  if(this.time<brain.next)return brain.input;brain.next=this.time+.14+(p.botSeed%5)*.008;
  const storm=this.storm,urgent=storm.active&&Math.hypot(p.x-storm.x,p.z-storm.z)>storm.radius-5;
  const enemies=[...this.players.values()].filter(o=>o!==p&&o.health>0&&!o.spectating).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  const target=enemies[0],tx=urgent?storm.nextX:target?.x??0,tz=urgent?storm.nextZ:target?.z??0,distance=Math.hypot(tx-p.x,tz-p.z),yaw=Math.atan2(p.x-tx,p.z-tz),pitch=urgent?0:Math.atan2((target?.y||0)+1.1-p.y-1.5,distance);
  const hit=worldHit(this.map,{x:p.x,y:p.y+1.5,z:p.z},direction(yaw,pitch),Math.min(80,distance)),blocked=hit&&hit.distance<distance-.6;
  const travelled=Math.hypot(p.x-brain.x,p.z-brain.z);brain.stuck=travelled<.07?brain.stuck+.16:0;brain.x=p.x;brain.z=p.z;
  const healing=p.inventory.findIndex((i,n)=>n>0&&i&&!i.weapon&&((p.health<65&&['medkit','splash'].includes(i.id))||(p.shield<45&&['mini','flask','splash'].includes(i.id))));
  if(!urgent&&healing>0&&this.time-p.lastDamage>3){return brain.input={yaw:p.yaw,pitch:0,slot:healing,fire:!p.useLatch};}
  if(urgent&&blocked&&hit.distance<4&&this.time>brain.buildAt&&p.materials.wood>=10){brain.buildAt=this.time+1;return brain.input={yaw,pitch:.2,slot:1,forward:.8,jump:true,buildMode:true,buildType:'stairs',buildMaterial:'wood',fire:true};}
  const close=blocked&&hit.distance<3,slot=close?0:distance<14?1:2,error=(5-this.options.difficulty)*.009*Math.sin(this.time*3+p.botSeed),look=p.yaw+clamp(Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw)),-.55,.55);
  return brain.input={yaw:look+error,pitch,slot,forward:distance>8||urgent?.85:.1,strafe:blocked?(brain.stuck>.7?.8:.35)*Math.sin(p.botSeed):.25*Math.sin(this.time+p.botSeed),sprint:urgent,aim:slot===2,fire:!urgent&&(!blocked||close||!!hit?.box?.buildId)&&Math.abs(look-yaw)<.2&&this.time%1.4>.25,reload:!p.ammo[slot],jump:brain.stuck>.6};
 }
 snapshot(options){const s=super.snapshot(options);s.zonewars={...s.boxfight,eventFloor:this.roundEventFloor||0,location:'Tilted District',phases:6,stormPhase:this.storm.index+1};s.boxfight.stormIn=this.storm.seconds;s.royale.queueEnds=this.queueEnds;s.royale.matchEnd=ZONE_RULES.roundLimit;return s;}
}
