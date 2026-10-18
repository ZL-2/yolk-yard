import {BoxFightSimulation} from './box-fights.js';
import {Simulation} from './simulation.js';
import {zoneMap} from './zone-wars-map.js';
import {ZONE_RULES,zoneLoadout,zoneStormPath,zoneStormAt,constrainZoneMovement,bounceZonePad} from './zone-wars-rules.js';
import {rebuildMap} from './building.js';
import {weapon} from './data.js';
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
  p.materials={wood:500,brick:500,metal:500};p.bank={light:300,medium:300,shells:60,heavy:40,rockets:6};this.syncInventory(p);
 }
 moveWithCommands(p,input,dt,commands){Simulation.prototype.moveWithCommands.call(this,p,input,dt,commands);const prepared=['prepare','waiting'].includes(this.boxStage);constrainZoneMovement(p,this.map,prepared);if(bounceZonePad(p,this.map,prepared))this.emit('royale-cue',{player:p.id,cue:'launch',x:p.x,y:p.y,z:p.z});const damage=fallDamage(p.landing);if(damage)this.damage(p,null,damage,'Fall');}
 damage(victim,attacker,amount,...args){const alive=victim.health>0;super.damage(victim,attacker,amount,...args);if(alive&&victim.health<=0&&attacker&&attacker!==victim){for(const m of ['brick','metal'])attacker.materials[m]=Math.min(500,attacker.materials[m]+50);for(const a of ['light','medium'])attacker.bank[a]=Math.min(500,attacker.bank[a]+30);attacker.bank.shells=Math.min(150,attacker.bank.shells+10);}}
 takeLoot(p,item,options){const ok=super.takeLoot(p,item,options);for(const m of ['wood','brick','metal'])p.materials[m]=Math.min(500,p.materials[m]);return ok;}
 tick(dt){super.tick(dt);if(this.boxStage!=='fight')return;for(const p of this.players.values()){if(p.health<=0||p.spectating)continue;for(const pad of this.pads||[])if(Math.hypot(p.x-pad.x,p.z-pad.z)<1.5&&Math.abs(p.y-pad.y)<1.2&&this.time>(p.zonePadAt||0)){p.zonePadAt=this.time+1.5;launchPlayer(p,{source:'launchpad',vy:25});}if(p.flight==='glide'&&p.grounded)p.flight='ground';}}
 snapshot(options){const s=super.snapshot(options);s.zonewars={...s.boxfight,eventFloor:this.roundEventFloor||0,location:'Tilted District',phases:6,stormPhase:this.storm.index+1};s.boxfight.stormIn=this.storm.seconds;s.royale.queueEnds=this.queueEnds;s.royale.matchEnd=ZONE_RULES.roundLimit;return s;}
}
