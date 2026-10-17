import {RoyaleSimulation} from './royale.js';
import {Simulation} from './simulation.js';
import {BOX_RULES as R,BOX_ARENAS,BOX_LOADOUTS,boxSpawn,boxTeam,constrainBoxMovement} from './box-fight-rules.js';
import {boxMap} from './box-fight-map.js';
import {matchOptions} from './match-options.js';
import {weapon,gun,clamp,randomAppearance,nameKey} from './data.js';
import {inventory,resetBuilding,rebuildMap,buildingTick,constructionTick,editBuilding} from './building.js';
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
import {worldHit,direction} from './physics.js';
import {emoteInput} from './emotes.js';

export class BoxFightSimulation extends RoyaleSimulation {
 constructor(options={}){
  super({...options,mode:'boxfight'});this.maxPlayers=this.options.capacity;this.boxStage='waiting';this.stage='active';this.boxRound=0;this.roundWins={};this.roundHistory=[];this.boxEnd=0;this.queueEnds=0;this.boxDraws=0;this.seriesWinner=null;this.map=this.battleMap();resetBuilding(this);this.setBarrier(true);this.storm={active:false,x:0,z:0,radius:40,index:0,seconds:R.stormWait,nextX:0,nextZ:0,nextRadius:0};this.nav={path:()=>[]};
 }
 battleMap(){return boxMap(this?.options?.map);}
 spawn(p){p.health=100;p.grounded=true;p.awaitingEntry=false;}
 waitForEntry(){}
 addPlayer(id,profile,bot=false,spectator=false){
  const p=Simulation.prototype.addPlayer.call(this,id,profile,bot,spectator);if(!p)return null;
  Object.assign(p,{inventory:inventory(),materials:{wood:0,brick:0,metal:0},bank:{light:0,medium:0,shells:0,heavy:0,rockets:0},ammo:Array(6).fill(0),reserve:Array(6).fill(0),accuracyState:Array.from({length:6},()=>({})),shield:100,stamina:100,flight:'ground',contestant:!spectator,spectating:spectator,lateSpectator:spectator,friendSpectator:spectator,awaitingEntry:false,connected:true,waitingRound:this.phase==='playing'&&this.boxStage!=='waiting',boxWins:0,boxRoundKills:0,boxDamage:0});
  this.assignTeam(p);if(p.waitingRound||spectator){p.health=0;p.spectating=true;}else this.equip(p);
  return p;
 }
 assignTeam(p,admission){
  if(admission)Object.assign(p,{partyId:admission.partyId,partySize:admission.partySize||1,memberId:admission.memberId});
  if(!p.contestant){p.team=-1;return;}
  if(this.options.boxFormat==='ffa'){p.team=-1;p.teamSlot=0;return;}
  const others=[...this.players.values()].filter(o=>o!==p&&o.contestant&&!o.boxReplacement),size=this.options.teamSize;
  const counts=[0,1].map(t=>others.filter(o=>o.team===t).length);
  const mate=p.partyId&&(p.partySize||1)<=size&&others.find(o=>o.partyId===p.partyId);
  let team=mate?mate.team:counts[0]<=counts[1]?0:1;
  if(counts[team]>=size){const bot=others.find(o=>o.team===team&&o.bot);if(bot&&!p.bot){Simulation.prototype.removePlayer.call(this,bot.id);counts[team]--;}else team=1-team;}
  p.team=team;p.teamSlot=Array.from({length:size},(_,i)=>i).find(i=>!others.some(o=>this.players.has(o.id)&&o.team===team&&o.teamSlot===i))??0;
 }
 admitPlayer(id,profile,admission=null){
  if(this.players.has(id)){const p=this.players.get(id);p.connected=true;return p;}
  if([...this.players.values()].some(p=>!p.bot&&nameKey(p.name)===nameKey(profile.name)))return null;
  if(admission?.spectator&&admission.friendSpectator!==false){const p=this.addPlayer(id,profile,false,true);if(p)p.watchId=admission.watchId;return p;}
  const seats=[...this.players.values()].filter(p=>p.contestant);
  if(seats.filter(p=>!p.bot).length>=this.options.capacity)return null;
  const mate=admission?.partyId&&admission.partySize<=this.options.teamSize&&seats.find(p=>!p.bot&&p.partyId===admission.partyId);
  const bot=seats.find(p=>p.bot&&!p.boxReplacement&&(!mate||p.team===mate.team))||seats.find(p=>p.bot&&!p.boxReplacement);
  if(seats.filter(p=>!p.boxReplacement).length>=this.options.capacity&&!bot)return null;
  if(bot){if(this.phase==='playing'&&this.boxStage!=='waiting')bot.boxReplacement=id;else Simulation.prototype.removePlayer.call(this,bot.id);}
  // Keep the active bot alive until the boundary; a late arrival must not
  // remove the last opponent and award an unearned round to the other side.
  this.maxPlayers=this.options.capacity*2;const p=this.addPlayer(id,profile);this.maxPlayers=this.options.capacity;if(p)this.assignTeam(p,admission);return p;
 }
 setProfile(id,profile){const p=this.players.get(id),kit=p?.inventory;const ok=Simulation.prototype.setProfile.call(this,id,profile);if(p&&kit)p.inventory=kit;return ok;}
 configure(options){if(this.phase==='playing')return false;const next=matchOptions({...options,mode:'boxfight'});if([...this.players.values()].filter(p=>!p.bot&&!p.friendSpectator).length>next.capacity)return false;this.options=next;this.maxPlayers=next.capacity;this.map=this.battleMap();resetBuilding(this);this.setBarrier(true);return true;}
 addBots(){
  for(const p of this.players.values())if(p.bot&&p.boxReplacement)Simulation.prototype.removePlayer.call(this,p.id);
  const people=[...this.players.values()].filter(p=>p.contestant&&!p.bot).length,target=Math.min(this.options.capacity-people,this.options.fill?this.options.capacity:this.options.bots);
  let bots=[...this.players.values()].filter(p=>p.bot);while(bots.length>target){Simulation.prototype.removePlayer.call(this,bots.pop().id);}
  let i=0;while(bots.length<target){const id='box-bot-'+i++;if(this.players.has(id))continue;const p=this.addPlayer(id,{name:this.uniqueBotName(id),...randomAppearance(this.random)},true);if(!p)break;bots.push(p);}
 }
 setBarrier(enabled){this.map.boxPrep=enabled;this.worldDamage['box-divider']={destroyed:!enabled||this.options.boxFormat==='ffa'};this.buildVersion++;rebuildMap(this);}
 startRound(){
  if(this.phase==='playing')return false;
  this.matchId=globalThis.crypto.randomUUID();this.roundWins={};this.roundHistory=[];this.boxDraws=0;this.seriesWinner=null;this.winner='';this.boxRound=0;this.boxStage='waiting';this.phase='playing';this.stage='active';this.publicRestartAt=null;this.queueEnds=this.time+(this.options.recurring?R.queue:0);
  for(const p of this.players.values()){p.kills=p.deaths=p.assists=p.points=p.boxWins=p.boxDamage=0;resetFieldRecord(p);p.connected=p.bot||p.connected!==false;}
  this.addBots();if(!this.options.recurring)return this.beginBoxRound();this.emit('box-cue',{cue:'waiting'});return true;
 }
 beginBoxRound(){
  this.addBots();const seats=[...this.players.values()].filter(p=>p.contestant&&!p.friendSpectator&&p.connected!==false&&!p.afkRemoved&&(!p.partyId||(p.partySize||1)<=1||[...this.players.values()].filter(o=>o.partyId===p.partyId&&o.connected!==false&&!o.bot).length>=p.partySize));
  if(new Set(seats.map(p=>boxTeam(this.options,p))).size<2){this.boxStage='waiting';this.queueEnds=this.time+R.queue;return true;}
  this.boxRound++;this.round++;this.boxStage='prepare';this.boxEnd=this.time+R.prepare;this.boxStarted=0;this.boxStormCue=false;this.roundWinner=null;this.roundReason='';this.queueEnds=0;this.elapsed=0;
  const arena=this.options.boxArena==='rotate'?BOX_ARENAS[Math.floor((this.boxRound-1)/2)%BOX_ARENAS.length].id:this.options.boxArena;
  this.map=boxMap(arena);this.options.map=this.map.id;resetBuilding(this);this.setBarrier(true);this.projectiles=[];this.loot=[];this.lootVersion++;this.chests=[];this.pads=[];this.markers=[];this.poseHistory=null;this.inputs.clear();this.remoteInputs.clear();
  this.storm={active:false,x:0,z:0,radius:Math.hypot(this.map.boxArena.width,this.map.boxArena.depth)/2+1,index:0,seconds:R.stormWait,nextX:0,nextZ:0,nextRadius:0,closing:false};
  seats.forEach((p,i)=>{p.boxSpawn=boxSpawn(this.map,i,this.options.boxFormat==='ffa'?seats.length:this.options.teamSize,p.team,p.teamSlot||0,this.boxRound,this.options.boxFormat==='ffa');this.equip(p);});
  for(const p of this.players.values())if(!seats.includes(p)){p.health=0;p.spectating=true;}
  this.alive=seats.length;this.emit('box-cue',{cue:'prepare',round:this.boxRound});return true;
 }
 equip(p){
  if(p.friendSpectator)return;
  resetStance(p);resetAirborne(p);const load=BOX_LOADOUTS[this.options.boxLoadout]||BOX_LOADOUTS.classic;
  Object.assign(p,p.boxSpawn||boxSpawn(this.map,0,this.options.teamSize,p.team||0,p.teamSlot||0,1),{health:100,shield:100,stamina:100,vy:0,pitch:0,grounded:true,flight:'ground',spectating:false,eliminated:false,lateSpectator:false,awaitingEntry:false,waitingRound:false,spawnRequested:false,downed:false,lifeState:'ALIVE',use:null,slot:1,inventory:inventory(),materials:{wood:R.wood,brick:0,metal:0},bank:{light:300,medium:300,shells:60,heavy:0,rockets:0},ammo:Array(6).fill(0),reserve:Array(6).fill(0),accuracyState:Array.from({length:6},()=>({})),building:false,editing:false,buildMaterial:'wood',buildRequested:'wood',buildRotation:0,buildFireHeld:false,awaitFireRelease:false,buildBufferedUntil:0,nextBuild:0,nextHarvest:0,phasedBuilds:[],poppers:0,shieldUntil:0,reloadEnd:0,nextShot:0,weaponCooldowns:{},shotgunReadyAt:0,pendingFireUntil:0,burstLeft:0,burstWeapon:null,lastFirePress:0,fireLatch:false,useLatch:false,interactLatch:false,dropLatch:false,lastDamage:-100,respawnAt:0,killerId:null,recap:null,damageLedger:{},combatHistory:[],boxRoundKills:0,boxFFA:this.options.boxFormat==='ffa',boxBrain:null,emote:null,crown:false,activity:newActivity(this.time),afkRemoved:false});
  p.inventory[1]={id:load.shotgun,weapon:true,count:1,rarity:3,ammo:weapon(load.shotgun).magazine};p.inventory[2]={id:load.rifle,weapon:true,count:1,rarity:2,ammo:weapon(load.rifle).magazine};p.inventory[3]={id:'mini',count:2,rarity:1};p.inventory[4]={id:'splash',count:2,rarity:2};this.syncInventory(p);beginEquip(p,this.time);this.emit('spawn',{player:p.id,x:p.x,y:p.y,z:p.z});
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
  if(attacker&&attacker!==victim){attacker.boxDamage=(attacker.boxDamage||0)+Math.max(0,total-victim.health-(victim.shield||0));if(hp>0&&victim.health<=0&&attacker.health>0){attacker.boxRoundKills++;const heal=Math.min(R.siphon,100-attacker.health);attacker.health+=heal;attacker.shield=Math.min(100,attacker.shield+R.siphon-heal);attacker.materials.wood=Math.min(R.woodCap,attacker.materials.wood+R.woodReward);this.emit('box-cue',{cue:'siphon',player:attacker.id});}}
 }
 eliminate(p){if(p.eliminated)return;p.eliminated=true;p.spectating=true;p.eliminatedAt=this.time;p.flight='out';p.building=false;p.editing=false;p.use=null;p.reloadEnd=0;p.burstLeft=0;this.inputs.delete(p.id);this.remoteInputs.delete(p.id);this.alive=Math.max(0,this.alive-1);this.emit('box-eliminated',{player:p.id,round:this.boxRound});}
 takeLoot(p,item,options){const ok=super.takeLoot(p,item,options);p.materials.wood=Math.min(R.woodCap,p.materials.wood);return ok;}
 damageWorld(box,amount){if(this.boxStage==='fight')super.damageWorld(box,amount);}
 fire(p,burst=false){return this.boxStage==='fight'&&super.fire(p,burst);}
 leavePlayer(id){for(const p of this.players.values())if(p.boxReplacement===id)delete p.boxReplacement;Simulation.prototype.removePlayer.call(this,id);}
 advanceWarmupClock(){}
 finish(){} // Series victory is decided below; no Royale placement or rewards.
 endBoxRound(winner,reason='elimination'){
  if(this.boxStage!=='fight')return;
  this.roundWinner=winner;this.roundReason=reason;this.boxStage='intermission';this.boxEnd=this.time+R.between;this.remaining=R.between;this.projectiles=[];
  if(winner!=null){this.roundWins[winner]=(this.roundWins[winner]||0)+1;for(const p of this.players.values())if(boxTeam(this.options,p)===winner)p.boxWins=this.roundWins[winner];}else this.boxDraws++;
  this.scores=[this.roundWins[0]||0,this.roundWins[1]||0];this.roundHistory.push({round:this.boxRound,winner,reason});this.roundHistory=this.roundHistory.slice(-20);
  this.emit('box-cue',{cue:winner==null?'draw':'round-win',winner,round:this.boxRound});
  if(winner!=null&&this.roundWins[winner]>=this.options.scoreLimit||this.boxRound>=this.options.scoreLimit*4+10){
   const ranking=Object.entries(this.roundWins).sort((a,b)=>b[1]-a[1]);this.seriesWinner=winner!=null&&this.roundWins[winner]>=this.options.scoreLimit?winner:ranking[0]?.[1]>ranking[1]?.[1]?(this.options.boxFormat==='ffa'?ranking[0][0]:Number(ranking[0][0])):null;
   this.phase='results';this.finishedAt=this.time;this.winner=this.seriesWinner==null?'Series drawn':this.options.boxFormat==='ffa'?(this.players.get(this.seriesWinner)?.name||'Operator')+' wins the series':(this.seriesWinner===0?'Blue':'Orange')+' team wins the series';this.publicRestartAt=this.options.recurring?this.time+R.restart:null;this.emit('finish',{winner:this.winner});this.emit('box-cue',{cue:'series-win',winner:this.seriesWinner});
  }
 }
 tick(dt){
  dt=clamp(dt,0,1/30);if(this.recoveringHumans())return;this.time+=dt;
  if(this.phase==='results'){if(this.options.recurring&&this.time>=this.publicRestartAt)this.startRound();return;}if(this.phase!=='playing')return;
  if(this.boxStage==='intermission'){this.remaining=Math.max(0,this.boxEnd-this.time);if(this.time>=this.boxEnd)this.beginBoxRound();return;}
  if(this.boxStage==='waiting'){
   const people=[...this.players.values()].filter(p=>!p.bot&&p.connected!==false&&p.contestant);if(!people.length){this.queueEnds=this.time+R.queue;return;}
   const teams=new Set([...this.players.values()].filter(p=>p.contestant&&p.connected!==false).map(p=>boxTeam(this.options,p)));this.remaining=Math.max(0,this.queueEnds-this.time);
   if(teams.size>=2&&(this.time>=this.queueEnds||people.length===this.options.capacity)){this.beginBoxRound();return;}
  }
  if(this.boxStage==='prepare'&&this.time>=this.boxEnd){this.boxStage='fight';this.boxStarted=this.time;this.setBarrier(false);this.emit('box-cue',{cue:'fight',round:this.boxRound});}
  const fight=this.boxStage==='fight';this.remaining=fight?Math.max(0,R.roundLimit-(this.time-this.boxStarted)):this.boxStage==='prepare'?Math.max(0,this.boxEnd-this.time):this.remaining;
  if(fight){const age=this.time-this.boxStarted,start=Math.hypot(this.map.boxArena.width,this.map.boxArena.depth)/2+1,t=clamp((age-R.stormWait)/R.stormClose,0,1);this.storm={active:age>=R.stormWait,x:0,z:0,radius:start*(1-t),index:0,seconds:Math.max(0,(age<R.stormWait?R.stormWait:R.stormWait+R.stormClose)-age),dps:t>=1?25:10,nextX:0,nextZ:0,nextRadius:0,closing:age>=R.stormWait};if(this.storm.active&&!this.boxStormCue){this.boxStormCue=true;this.emit('box-cue',{cue:'storm'});}}
  this.recordPoses();if(fight)this.tickActivity(dt);
  for(const p of this.players.values()){
   if(p.health<=0||p.spectating)continue;
   const commands=p.bot?null:this.movementInput(p,dt);let input=commands?.input||(p.bot?this.botInput(p):this.inputs.get(p.id));if(!input||!p.bot&&this.time-p.lastInput>.4)input={yaw:p.yaw,pitch:p.pitch,slot:p.slot};input=emoteInput(this,p,gateBuildFire(p,input));p.executedShotTime=input.shotTime;
   const slot=clamp(Math.floor(input.slot??p.slot),0,5);if(slot!==p.slot){this.cancelUse(p,'swap');p.slot=slot;p.reloadEnd=0;p.burstLeft=0;beginEquip(p,this.time,true);}
   const before={x:p.x,y:p.y,z:p.z};this.moveWithCommands(p,input,dt,commands);p.vx=(p.x-before.x)/dt;p.vz=(p.z-before.z)/dt;p.moving=Math.hypot(p.vx,p.vz)>.01;p.aim=!!input.aim&&!p.use&&!!p.inventory[p.slot]?.weapon;p.landing=null;
   this.syncInventory(p);this.updateAccuracy(p,before,dt);if(p.reloadEnd&&this.time>=p.reloadEnd){const item=p.inventory[p.slot];if(item?.weapon){const type=ammoType(item.id),add=Math.min(gun(p).magazine-item.ammo,p.bank[type]);item.ammo+=add;p.bank[type]-=add;}p.reloadEnd=0;this.syncInventory(p);}
   if(input.sprint&&p.use)this.cancelUse(p,'sprint');
   if(input.drop&&!p.dropLatch)this.dropSlot(p);p.dropLatch=!!input.drop;this.interact(p,input,dt);
   const used=buildingTick(this,p,fight?input:{...input,fire:input.buildMode&&input.fire});
   if(fight&&!used){if(p.inventory[p.slot]?.weapon)this.combatInput(p,input);else if(input.fire&&!p.useLatch)this.beginUse(p);}
   p.fireLatch=!!input.fire&&this.time>=(p.equipUntil||0);p.useLatch=!!input.fire;tickHealing(this,p);if(p.use&&this.time>=p.use.end)this.finishUse(p);
  }
  constructionTick(this);tickLootMotion(this);if(!fight)return;this.updateProjectiles(dt);
  // Damage everybody first, then decide the round once (simultaneous deaths draw).
  if(this.storm.active)for(const p of this.players.values())if(p.health>0&&!p.spectating&&Math.hypot(p.x,p.z)>=this.storm.radius)this.damage(p,null,this.storm.dps*dt,'Storm');
  const alive=[...this.players.values()].filter(p=>p.contestant&&p.health>0&&!p.spectating);this.alive=alive.length;const teams=[...new Set(alive.map(p=>boxTeam(this.options,p)))];
  if(teams.length<=1)this.endBoxRound(teams[0]??null);else if(this.remaining<=0)this.endBoxRound(null,'time');
 }
 botInput(p){
  const brain=p.boxBrain??={next:0,buildAt:this.time+1+p.botSeed%3,editAt:0},targets=[...this.players.values()].filter(o=>o!==p&&o.health>0&&!o.spectating&&!teammates(this.options,p,o));
  const target=targets.sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0];if(!target)return {yaw:p.yaw,pitch:0,slot:1};
  const distance=Math.hypot(target.x-p.x,target.z-p.z),yaw=Math.atan2(p.x-target.x,p.z-target.z),pitch=Math.atan2(target.y+.95-p.y-1.5,distance),noise=(5-this.options.difficulty)*.011;
  const eye={x:p.x,y:p.y+1.5,z:p.z},hit=worldHit(this.map,eye,direction(yaw,pitch),distance),piece=this.builds.find(b=>b.id===hit?.box?.buildId),owned=piece&&(piece.owner===p.id||piece.teamMode&&piece.team===p.team);
  if(owned&&this.time>brain.editAt&&distance>3){brain.editAt=this.time+1.2;editBuilding(this,{...p,yaw,pitch},'build-change:'+JSON.stringify({id:piece.id,mask:piece.type==='wall'?18:0,path:[],revision:piece.revision||0,yaw,pitch}));}
  if(this.boxStage==='prepare'&&this.time>brain.buildAt&&p.materials.wood>=10){brain.buildAt=this.time+2;return {yaw:p.boxSpawn.z<0?Math.PI:0,pitch:0,slot:1,buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true};}
  if(this.boxStage!=='fight')return {yaw:p.yaw,pitch:0,slot:1};
  if(!hit&&this.time-p.lastDamage<.8&&this.time>brain.buildAt&&p.materials.wood>=10){brain.buildAt=this.time+5;return {yaw,pitch:0,slot:1,buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true};}
  if(!hit&&p.health<65&&this.time-p.lastDamage>2&&p.inventory[4])return {yaw,pitch:0,slot:4,fire:!p.useLatch};
  const turn=clamp(Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw)),-.13,.13),look=p.yaw+turn,error=Math.sin(this.time*2.7+p.botSeed)*noise,blocked=!!hit&&hit.distance<distance-.3;
  const slot=blocked&&piece&&hit.distance<3?0:distance>13||blocked?2:1,ready=Math.abs(turn)<.12&&this.time%1.3>.15+(4-this.options.difficulty)*.06;
  return {yaw:look+error,pitch:pitch+Math.cos(this.time*2+p.botSeed)*noise,slot,forward:blocked&&hit.distance<2?0:distance>6? .7:0,strafe:blocked?.45*Math.sin(this.time+p.botSeed):distance<12?.35*Math.sin(this.time*.8+p.botSeed):0,fire:ready&&(!blocked||!!piece),reload:p.ammo[slot]===0,aim:slot===2,jump:blocked&&hit.distance<1.5&&this.time%2<.06,swapSlot:-1};
 }
 restore(checkpoint){Simulation.prototype.restore.call(this,checkpoint);this.map=boxMap(this.options.map);this.worldBoxes=this.map.authored.map(b=>({...b}));this.map.boxPrep=['waiting','prepare'].includes(this.boxStage);rebuildMap(this);this.nav={path:()=>[]};return this;}
 snapshot(options){
  const s=super.snapshot(options);s.boxfight={stage:this.boxStage,round:this.boxRound,ends:this.boxEnd,queueEnds:this.queueEnds,wins:{...this.roundWins},history:this.roundHistory.map(h=>({...h})),winner:this.roundWinner,seriesWinner:this.seriesWinner,reason:this.roundReason,target:this.options.scoreLimit,format:this.options.boxFormat,arena:this.map.name,loadout:this.options.boxLoadout,stormIn:Math.max(0,R.stormWait-(this.time-(this.boxStarted||this.time)))};
  s.royale.boxfightStage=this.boxStage;s.royale.accepting=this.boxStage==='waiting';s.royale.practice=false;s.royale.stage='active';s.royale.route={duration:0};s.royale.winnerTeam=-1;s.royale.winnerId=null;s.royale.matchEnd=R.roundLimit;s.royale.elapsed=this.boxStarted?this.time-this.boxStarted:0;
  for(const p of s.players){const source=this.players.get(p.id);Object.assign(p,{boxSpawn:source.boxSpawn?{...source.boxSpawn}:null,boxFFA:source.boxFFA,boxWins:source.boxWins||0,boxRoundKills:source.boxRoundKills||0,boxDamage:Math.round(source.boxDamage||0),waitingRound:!!source.waitingRound});}return s;
 }
}
