import {RoyaleSimulation} from './royale.js';
import {Simulation} from './simulation.js';
import {BOX_RULES as R,BOX_ARENAS,BOX_LOADOUTS,boxSpawn,boxTeam,constrainBoxMovement} from './box-fight-rules.js';
import {boxMap} from './box-fight-map.js';
import {matchOptions} from './match-options.js';
import {weapon,gun,clamp,nameKey} from './data.js';
import {inventory,resetBuilding,rebuildMap,buildingTick,constructionTick} from './building.js';
import {resetStance} from './stance.js';
import {resetAirborne} from './airborne.js';
import {newActivity} from './activity.js';
import {resetFieldRecord} from './field-record.js';
import {beginEquip} from './equip.js';
import {gateBuildFire} from './field-refinement.js';
import {tickLootMotion} from './loot-motion.js';
import {tickHealing} from './progressive-healing.js';
import {ammoType} from './royale-data.js';
import {teammates} from './teams.js';
import {emoteInput} from './emotes.js';

export class BoxFightSimulation extends RoyaleSimulation {
 constructor(options={}){
  super({...options,mode:options.mode==='zonewars'?'zonewars':'boxfight'});this.maxPlayers=this.options.capacity;this.boxStage='waiting';this.stage='active';this.boxRound=0;this.roundWins={};this.roundHistory=[];this.boxEnd=0;this.queueEnds=0;this.boxDraws=0;this.seriesWinner=null;this.map=this.battleMap();resetBuilding(this);this.setBarrier(true);this.storm={active:false,x:0,z:0,radius:40,index:0,seconds:this.rules.stormWait,nextX:0,nextZ:0,nextRadius:0};this.nav={path:()=>[]};
 }
 get rules(){return R;}
 roundMap(){const arena=this.options.boxArena==='rotate'?BOX_ARENAS[Math.floor((this.boxRound-1)/2)%BOX_ARENAS.length].id:this.options.boxArena;return boxMap(arena);}
 roundSpawn(p,i,total){return boxSpawn(this.map,i,this.options.boxFormat==='ffa'?total:this.options.teamSize,p.team,p.teamSlot||0,this.boxRound,this.options.boxFormat==='ffa');}
 setInput(id,input,remote=false){if(input?.round!==undefined&&input.round!==this.round)return;super.setInput(id,input,remote);}
 initialStorm(){return {active:false,x:0,z:0,radius:Math.hypot(this.map.boxArena.width,this.map.boxArena.depth)/2+1,index:0,seconds:this.rules.stormWait,nextX:0,nextZ:0,nextRadius:0,closing:false};}
 updateRoundStorm(){const age=this.time-this.boxStarted,start=Math.hypot(this.map.boxArena.width,this.map.boxArena.depth)/2+1,t=clamp((age-this.rules.stormWait)/this.rules.stormClose,0,1);this.storm={active:age>=this.rules.stormWait,x:0,z:0,radius:start*(1-t),index:0,seconds:Math.max(0,(age<this.rules.stormWait?this.rules.stormWait:this.rules.stormWait+this.rules.stormClose)-age),dps:t>=1?25:10,nextX:0,nextZ:0,nextRadius:0,closing:age>=this.rules.stormWait};}
 battleMap(){return boxMap(this?.options?.map);}
 spawn(p){p.health=100;p.grounded=true;p.awaitingEntry=false;}
 waitForEntry(){}
 addPlayer(id,profile,bot=false,spectator=false){
  if(bot)return null;
  const p=Simulation.prototype.addPlayer.call(this,id,profile,false,spectator);if(!p)return null;
  Object.assign(p,{inventory:inventory(),materials:{wood:0,brick:0,metal:0},bank:{light:0,medium:0,shells:0,heavy:0,rockets:0},ammo:Array(6).fill(0),reserve:Array(6).fill(0),accuracyState:Array.from({length:6},()=>({})),shield:100,stamina:100,flight:'ground',contestant:!spectator,spectating:spectator,lateSpectator:spectator,friendSpectator:spectator,awaitingEntry:false,connected:true,waitingRound:this.phase==='results'||this.phase==='playing'&&this.boxStage!=='waiting',boxWins:0,boxRoundKills:0,boxDamage:0});
  this.assignTeam(p);if(p.waitingRound||spectator){p.health=0;p.spectating=true;p.lateSpectator=true;}else this.equip(p);
  return p;
 }
 assignTeam(p,admission){
  if(admission)Object.assign(p,{partyId:admission.partyId,partySize:admission.partySize||1,memberId:admission.memberId});
  if(!p.contestant){p.team=-1;return;}
  if(this.options.boxFormat==='ffa'){p.team=-1;p.teamSlot=0;return;}
  const others=[...this.players.values()].filter(o=>o!==p&&o.contestant&&!o.bot),size=this.options.teamSize;
  const counts=[0,1].map(t=>others.filter(o=>o.team===t).length);
  const mate=p.partyId&&(p.partySize||1)<=size&&others.find(o=>o.partyId===p.partyId);
  let team=mate?mate.team:counts[0]<=counts[1]?0:1;
  if(counts[team]>=size)team=1-team;
  p.team=team;p.teamSlot=Array.from({length:size},(_,i)=>i).find(i=>!others.some(o=>this.players.has(o.id)&&o.team===team&&o.teamSlot===i))??0;
 }
 admitPlayer(id,profile,admission=null){
  if(this.players.has(id)){const p=this.players.get(id);p.connected=true;return p;}
  if(admission?.exactMatch&&(this.matchId!==admission.exactMatch))return null;
  if([...this.players.values()].some(p=>!p.bot&&nameKey(p.name)===nameKey(profile.name)))return null;
  if(admission?.spectator&&admission.friendSpectator!==false){const p=this.addPlayer(id,profile,false,true);if(p)p.watchId=admission.watchId;return p;}
  const seats=[...this.players.values()].filter(p=>p.contestant&&!p.bot);
  if(seats.length>=this.options.capacity)return null;
  const p=this.addPlayer(id,profile);if(p)this.assignTeam(p,admission);return p;
 }
 setProfile(id,profile){const p=this.players.get(id),kit=p?.inventory;const ok=Simulation.prototype.setProfile.call(this,id,profile);if(p&&kit)p.inventory=kit;return ok;}
 configure(options){if(this.phase==='playing')return false;const next=matchOptions({...options,mode:this.options.mode});if([...this.players.values()].filter(p=>!p.bot&&!p.friendSpectator).length>next.capacity)return false;this.options=next;this.maxPlayers=next.capacity;this.map=this.battleMap();resetBuilding(this);this.setBarrier(true);return true;}
 // Retain the shared lifecycle hook only to discard legacy checkpoint bots.
 addBots(){for(const p of this.players.values())if(p.bot)Simulation.prototype.removePlayer.call(this,p.id);}
 eligiblePlayers(){return [...this.players.values()].filter(p=>!p.bot&&p.contestant&&!p.friendSpectator&&p.connected!==false&&!p.afkRemoved&&(p.boxPlayed||!p.partyId||(p.partySize||1)<=1||[...this.players.values()].filter(o=>o.partyId===p.partyId&&o.connected!==false&&!o.bot&&!o.friendSpectator&&!o.afkRemoved).length>=p.partySize));}
 waitForOpponents(){
  this.boxStage='waiting';this.queueEnds=0;this.remaining=0;this.boxStarted=0;this.projectiles=[];this.storm=this.initialStorm();this.setBarrier(true);
  const seats=this.eligiblePlayers();for(const p of this.players.values()){if(seats.includes(p))this.equip(p);else {p.health=0;p.spectating=true;}}this.alive=seats.length;
  return true;
 }
 setBarrier(enabled){this.map.boxPrep=enabled;this.worldDamage['box-divider']={destroyed:!enabled||this.options.boxFormat==='ffa'};this.buildVersion++;rebuildMap(this);}
 startRound(){
  if(this.phase==='playing')return false;
  this.matchId=globalThis.crypto.randomUUID();this.roundWins={};this.roundHistory=[];this.scores=[0,0];this.boxDraws=0;this.seriesWinner=null;this.forfeitedBy=null;this.winner='';this.boxRound=0;this.boxStage='waiting';this.phase='playing';this.stage='active';this.publicRestartAt=null;this.queueEnds=0;
  for(const p of this.players.values()){p.kills=p.deaths=p.assists=p.points=p.boxWins=p.boxDamage=0;resetFieldRecord(p);p.connected=p.connected!==false;}
  this.addBots();if(!this.options.recurring)return this.beginBoxRound();this.emit('box-cue',{cue:'waiting'});return true;
 }
 beginBoxRound(){
  this.addBots();const seats=this.eligiblePlayers();
  if(new Set(seats.map(p=>boxTeam(this.options,p))).size<2)return this.waitForOpponents();
  this.boxRound++;this.round++;this.roundEventFloor=this.eventId;this.boxStage='prepare';this.boxEnd=this.time+this.rules.prepare;this.boxStarted=0;this.boxStormCue=false;this.roundWinner=null;this.roundReason='';this.queueEnds=0;this.elapsed=0;
  this.map=this.roundMap();this.options.map=this.map.id;resetBuilding(this);this.setBarrier(true);this.projectiles=[];this.loot=[];this.lootVersion++;this.chests=[];this.pads=[];this.markers=[];this.poseHistory=null;this.inputs.clear();this.remoteInputs.clear();
  this.storm=this.initialStorm();
  seats.forEach((p,i)=>{p.boxPlayed=true;p.boxSpawn=this.roundSpawn(p,i,seats.length);this.equip(p);});
  for(const p of this.players.values())if(!seats.includes(p)){p.health=0;p.spectating=true;}
  this.alive=seats.length;this.emit('box-cue',{cue:'prepare',round:this.boxRound});return true;
 }
 equip(p){
  if(p.friendSpectator)return;
  resetStance(p);resetAirborne(p);const load=BOX_LOADOUTS[this.options.boxLoadout]||BOX_LOADOUTS.classic;
  Object.assign(p,p.boxSpawn||boxSpawn(this.map,0,this.options.teamSize,p.team||0,p.teamSlot||0,1),{health:100,shield:100,stamina:100,vy:0,pitch:0,grounded:true,flight:'ground',spectating:false,eliminated:false,lateSpectator:false,awaitingEntry:false,waitingRound:false,spawnRequested:false,downed:false,lifeState:'ALIVE',use:null,slot:1,inventory:inventory(),materials:{wood:this.rules.wood,brick:0,metal:0},bank:{light:300,medium:300,shells:60,heavy:0,rockets:0},ammo:Array(6).fill(0),reserve:Array(6).fill(0),accuracyState:Array.from({length:6},()=>({})),building:false,editing:false,buildMaterial:'wood',buildRequested:'wood',buildRotation:0,buildFireHeld:false,awaitFireRelease:false,buildBufferedUntil:0,nextBuild:0,nextHarvest:0,phasedBuilds:[],poppers:0,shieldUntil:0,reloadEnd:0,nextShot:0,weaponCooldowns:{},shotgunReadyAt:0,pendingFireUntil:0,burstLeft:0,burstWeapon:null,lastFirePress:0,fireLatch:false,useLatch:false,interactLatch:false,dropLatch:false,lastDamage:-100,respawnAt:0,killerId:null,recap:null,damageLedger:{},combatHistory:[],boxRoundKills:0,boxFFA:this.options.boxFormat==='ffa',emote:null,crown:false,activity:newActivity(this.time),afkRemoved:false});
  p.inventory[1]={id:load.rifle,weapon:true,count:1,rarity:2,ammo:weapon(load.rifle).magazine};p.inventory[2]={id:load.shotgun,weapon:true,count:1,rarity:3,ammo:weapon(load.shotgun).magazine};p.inventory[3]={id:'mini',count:2,rarity:1};p.inventory[4]={id:'splash',count:2,rarity:2};this.syncInventory(p);beginEquip(p,this.time);this.emit('spawn',{player:p.id,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:0,round:this.round});
 }
 moveWithCommands(p,input,dt,commands){super.moveWithCommands(p,input,dt,commands);constrainBoxMovement(p,this.map,this.boxStage==='prepare'||this.boxStage==='waiting');}
 playerAction(id,action){
  const p=this.players.get(id);if(!p||typeof action!=='string')return;
  if(/^box-team-[01]$/.test(action)&&this.phase==='lobby'&&this.options.boxFormat!=='ffa'){
   const team=Number(action.at(-1)),group=p.partyId&&(p.partySize||1)<=this.options.teamSize?[...this.players.values()].filter(o=>o.partyId===p.partyId&&o.contestant):[p],others=[...this.players.values()].filter(o=>o.contestant&&!o.bot&&!group.includes(o));
   if(others.filter(o=>o.team===team).length+group.length>this.options.teamSize)return;
   const used=new Set(others.filter(o=>o.team===team).map(o=>o.teamSlot));for(const mate of group){mate.team=team;mate.teamSlot=Array.from({length:this.options.teamSize},(_,i)=>i).find(i=>!used.has(i));used.add(mate.teamSlot);}return;
  }
  if(['respawn','rejoin'].includes(action))return;
  if(action==='spectate'&&p.health>0){if(this.boxStage==='fight')this.damage(p,null,10000,'Left round');return;}
  if(!['prepare','fight'].includes(this.boxStage)&&!action.startsWith('watch'))return;
  super.playerAction(id,action);
 }
 damage(victim,attacker,amount,source,precision=false,shotId=null){
  if(this.boxStage!=='fight'||this.phase!=='playing'||teammates(this.options,victim,attacker))return;
  const hp=victim.health,total=hp+(victim.shield||0);super.damage(victim,attacker,amount,source,precision,shotId);
  if(attacker&&attacker!==victim){attacker.boxDamage=(attacker.boxDamage||0)+Math.max(0,total-victim.health-(victim.shield||0));if(hp>0&&victim.health<=0&&attacker.health>0){attacker.boxRoundKills++;const heal=Math.min(this.rules.siphon,100-attacker.health);attacker.health+=heal;attacker.shield=Math.min(100,attacker.shield+this.rules.siphon-heal);attacker.materials.wood=Math.min(this.rules.woodCap,attacker.materials.wood+this.rules.woodReward);this.emit('box-cue',{cue:'siphon',player:attacker.id});}}
 }
 eliminate(p){if(p.eliminated)return;p.eliminated=true;p.spectating=true;p.eliminatedAt=this.time;p.flight='out';p.building=false;p.editing=false;p.use=null;p.reloadEnd=0;p.burstLeft=0;this.inputs.delete(p.id);this.remoteInputs.delete(p.id);this.alive=Math.max(0,this.alive-1);this.emit('box-eliminated',{player:p.id,round:this.boxRound});}
 takeLoot(p,item,options){const ok=super.takeLoot(p,item,options);p.materials.wood=Math.min(this.rules.woodCap,p.materials.wood);return ok;}
 damageWorld(box,amount){if(this.boxStage==='fight')super.damageWorld(box,amount);}
 fire(p,burst=false){return this.boxStage==='fight'&&super.fire(p,burst);}
 leavePlayer(id){
  const leaving=this.players.get(id),rival=[...this.players.values()].find(p=>p.id!==id&&p.contestant&&p.boxPlayed&&p.connected!==false&&!p.friendSpectator&&p.team!==leaving?.team);
  if(this.options.mode==='boxfight'&&this.options.boxFormat!=='ffa'&&this.options.teamSize===1&&this.phase==='playing'&&this.boxRound>0&&leaving?.boxPlayed&&!leaving.friendSpectator&&rival){
   if(['prepare','fight'].includes(this.boxStage)){this.boxStage='fight';this.endBoxRound(rival.team,'forfeit');}
   this.roundReason='forfeit';this.forfeitedBy=leaving.id;
   if(this.phase!=='results')this.completeBoxSeries(rival.team);
  }
  Simulation.prototype.removePlayer.call(this,id);
 }
 completeBoxSeries(winner){
  if(this.phase==='results')return;
  this.seriesWinner=winner;this.phase='results';this.finishedAt=this.time;this.winner=winner==null?'Series drawn':this.options.boxFormat==='ffa'?(this.players.get(winner)?.name||'Operator')+' wins the series':(winner===0?'Blue':'Orange')+' team wins the series';this.publicRestartAt=this.options.recurring?this.time+this.rules.restart:null;this.emit('finish',{winner:this.winner});this.emit('box-cue',{cue:'series-win',winner});
 }
 advanceWarmupClock(){}
 finish(){} // Series victory is decided below; no Royale placement or rewards.
 endBoxRound(winner,reason='elimination'){
  if(this.boxStage!=='fight')return;
  this.roundWinner=winner;this.roundReason=reason;this.boxStage='intermission';this.boxEnd=this.time+this.rules.between;this.remaining=this.rules.between;this.projectiles=[];
  if(winner!=null){this.roundWins[winner]=(this.roundWins[winner]||0)+1;for(const p of this.players.values())if(boxTeam(this.options,p)===winner)p.boxWins=this.roundWins[winner];}else this.boxDraws++;
  this.scores=[this.roundWins[0]||0,this.roundWins[1]||0];this.roundHistory.push({round:this.boxRound,winner,reason});this.roundHistory=this.roundHistory.slice(-20);
  this.emit('box-cue',{cue:winner==null?'draw':'round-win',winner,round:this.boxRound});
  if(winner!=null&&this.roundWins[winner]>=this.options.scoreLimit||this.boxRound>=this.options.scoreLimit*4+10){
   const ranking=Object.entries(this.roundWins).sort((a,b)=>b[1]-a[1]);this.seriesWinner=winner!=null&&this.roundWins[winner]>=this.options.scoreLimit?winner:ranking.length&&(!ranking[1]||ranking[0][1]>ranking[1][1])?(this.options.boxFormat==='ffa'?ranking[0][0]:Number(ranking[0][0])):null;
   this.completeBoxSeries(this.seriesWinner);
  }
 }
 tick(dt){
  dt=clamp(dt,0,1/30);if(this.recoveringHumans())return;this.time+=dt;
  if(this.phase==='results'){if(this.options.recurring&&this.time>=this.publicRestartAt)this.startRound();return;}if(this.phase!=='playing')return;
  if(this.boxStage==='intermission'){this.remaining=Math.max(0,this.boxEnd-this.time);if(this.time>=this.boxEnd)this.beginBoxRound();return;}
  if(this.boxStage==='waiting'){
   const people=this.eligiblePlayers(),teams=new Set(people.map(p=>boxTeam(this.options,p)));
   if(teams.size<2){this.queueEnds=0;this.remaining=0;}
   else {
    if(!this.queueEnds)this.queueEnds=this.time+this.rules.queue;
    this.remaining=Math.max(0,this.queueEnds-this.time);
    if(this.time>=this.queueEnds||people.length===this.options.capacity){this.beginBoxRound();return;}
   }
  }
  if(this.boxStage==='prepare'&&new Set(this.eligiblePlayers().map(p=>boxTeam(this.options,p))).size<2){this.waitForOpponents();return;}
  if(this.boxStage==='prepare'&&this.time>=this.boxEnd){this.boxStage='fight';this.boxStarted=this.time;this.setBarrier(false);this.emit('box-cue',{cue:'fight',round:this.boxRound});}
  const fight=this.boxStage==='fight';this.remaining=fight?Math.max(0,this.rules.roundLimit-(this.time-this.boxStarted)):this.boxStage==='prepare'?Math.max(0,this.boxEnd-this.time):this.remaining;
  if(fight){this.updateRoundStorm();if(this.storm.active&&!this.boxStormCue){this.boxStormCue=true;this.emit('box-cue',{cue:'storm'});}}
  this.recordPoses();if(fight)this.tickActivity(dt);
  for(const p of this.players.values()){
   if(p.health<=0||p.spectating)continue;
   const commands=this.movementInput(p,dt);let input=commands?.input||this.inputs.get(p.id);if(!input||this.time-p.lastInput>.4)input={yaw:p.yaw,pitch:p.pitch,slot:p.slot};input=emoteInput(this,p,gateBuildFire(p,input));p.executedShotTime=input.shotTime;
   const slot=clamp(Math.floor(input.slot??p.slot),0,5);if(slot!==p.slot){this.cancelUse(p,'swap');p.slot=slot;p.reloadEnd=0;p.burstLeft=0;beginEquip(p,this.time,true);}
   const before={x:p.x,y:p.y,z:p.z};this.moveWithCommands(p,input,dt,commands);if(p.health<=0)continue;p.vx=(p.x-before.x)/dt;p.vz=(p.z-before.z)/dt;p.moving=Math.hypot(p.vx,p.vz)>.01;p.aim=!!input.aim&&!p.use&&!!p.inventory[p.slot]?.weapon;p.landing=null;
   this.syncInventory(p);this.updateAccuracy(p,before,dt);if(p.reloadEnd&&this.time>=p.reloadEnd){const item=p.inventory[p.slot];if(item?.weapon){const type=ammoType(item.id),add=Math.min(gun(p).magazine-item.ammo,p.bank[type]);item.ammo+=add;p.bank[type]-=add;}p.reloadEnd=0;this.syncInventory(p);}
   if(input.sprint&&p.use)this.cancelUse(p,'sprint');
   if(input.drop&&!p.dropLatch)this.dropSlot(p);p.dropLatch=!!input.drop;this.interact(p,input,dt);
   const used=buildingTick(this,p,fight?input:{...input,fire:input.buildMode&&input.fire});
   if(fight&&!used){if(p.inventory[p.slot]?.weapon)this.combatInput(p,input);else if(input.fire&&!p.useLatch)this.beginUse(p);}
   p.fireLatch=!!input.fire&&this.time>=(p.equipUntil||0);p.useLatch=!!input.fire;tickHealing(this,p);if(p.use&&this.time>=p.use.end)this.finishUse(p);
  }
  constructionTick(this);tickLootMotion(this);if(!fight)return;this.updateProjectiles(dt);
  // Damage everybody first, then decide the round once (simultaneous deaths draw).
  if(this.storm.active)for(const p of this.players.values())if(p.health>0&&!p.spectating&&Math.hypot(p.x-this.storm.x,p.z-this.storm.z)>=this.storm.radius)this.damage(p,null,this.storm.dps*dt,'Storm');
  const alive=[...this.players.values()].filter(p=>p.contestant&&p.health>0&&!p.spectating);this.alive=alive.length;const teams=[...new Set(alive.map(p=>boxTeam(this.options,p)))];
  if(teams.length<=1)this.endBoxRound(teams[0]??null);else if(this.remaining<=0)this.endBoxRound(null,'time');
 }
 restore(checkpoint){const hadBots=checkpoint.players.some(p=>p.bot);Simulation.prototype.restore.call(this,checkpoint);this.options=matchOptions(this.options);this.maxPlayers=this.options.capacity;this.addBots();this.map=this.battleMap();this.worldBoxes=this.map.authored.map(b=>({...b}));this.map.boxPrep=['waiting','prepare'].includes(this.boxStage);rebuildMap(this);this.nav={path:()=>[]};if(hadBots&&this.phase==='playing')this.waitForOpponents();return this;}
 snapshot(options){
  const s=super.snapshot(options);s.boxfight={stage:this.boxStage,round:this.boxRound,ends:this.boxEnd,queueEnds:this.queueEnds,waitingForOpponents:this.boxStage==='waiting'&&!this.queueEnds,wins:{...this.roundWins},history:this.roundHistory.map(h=>({...h})),winner:this.roundWinner,seriesWinner:this.seriesWinner,reason:this.roundReason,target:this.options.scoreLimit,format:this.options.boxFormat,arena:this.map.name,loadout:this.options.boxLoadout,stormIn:Math.max(0,this.rules.stormWait-(this.time-(this.boxStarted||this.time)))};
  s.royale.queueEnds=this.queueEnds;s.royale.boxfightStage=this.boxStage;s.royale.accepting=this.boxStage==='waiting';s.royale.practice=false;s.royale.stage='active';s.royale.route={duration:0};s.royale.winnerTeam=-1;s.royale.winnerId=null;s.royale.matchEnd=this.rules.roundLimit;s.royale.elapsed=this.boxStarted?this.time-this.boxStarted:0;
  for(const p of s.players){const source=this.players.get(p.id);Object.assign(p,{boxSpawn:source.boxSpawn?{...source.boxSpawn}:null,boxFFA:source.boxFFA,boxWins:source.boxWins||0,boxRoundKills:source.boxRoundKills||0,boxDamage:Math.round(source.boxDamage||0),waitingRound:!!source.waitingRound});}return s;
 }
}
