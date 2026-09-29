import {rng} from './data.js';
import {nearbyItems} from './nearby-items.js';
import {markerAction} from './team-markers.js';
import {newActivity,meaningfulActivity} from './activity.js';
import {resetStance,canFight,eyeHeight} from './stance.js';
import {REVIVE_RULES,mayDown,downPlayer,prepareRevive,tickRevives,resolveDownedTeams,rescueBotInput} from './team-survival.js';
import {SPAWN_ISLAND,distributedSpawn} from './spawn-island.js';
import {isDuos,teammates,livingTeams,teamKey} from './teams.js';
import {ROYALE_PHASES as RP,isWarmup,acceptsContestants,MAX_SPECTATORS,MAX_HUMANS,WARMUP_SECONDS,OFFLINE_WARMUP_SECONDS} from './royale-phases.js';
import {launchPlayer,resetAirborne,fallDamage} from './airborne.js';
import {startLootFall,tickLootMotion} from './loot-motion.js';
import {seedIslandLootSteps,rollChest,rollItem,placeLoot,supportBelow} from './royale-loot.js';
import {inventory,resetBuilding,rebuildMap,buildingTick,editBuilding,damageObject,constructionTick,toggleDoor} from './building.js';
import {ROYALE_MAP} from './royale-map.js';
import {botInput as tacticalBotInput} from './bots.js';
import {beginEquip} from './equip.js';
import {Simulation} from './simulation.js';
import {gun,weapon,clamp,safeProfile,randomAppearance,nameKey} from './data.js';
import {movePlayer,dist,direction,wallDistance,EYE,canStand} from './physics.js';
import {surfaceAt,navigation} from './maps.js';
import {groundAt} from './terrain.js';
import {ITEMS,ammoType,AMMO_CAPS,makeStorm,stormAt,makeFlight,transportAt} from './royale-data.js';

const battlePreparation=new WeakMap();

export class RoyaleSimulation extends Simulation {
 constructor(options={}){
  super({...options,mode:'royale'});this.map={...ROYALE_MAP,boxes:(ROYALE_MAP.authored||ROYALE_MAP.boxes).map(b=>({...b}))};resetBuilding(this);this.nav=navigation(ROYALE_MAP);this.markers=[];this.markerId=0;for(const p of this.players.values()){p.pingTimes=[];p.lastPingAt=-100;}this.matchId=globalThis.crypto.randomUUID();this.maxPlayers=this.options.capacity;
  this.loot=[];this.chests=[];this.pads=[];this.lootId=0;this.lootVersion=0;this.startedAt=0;this.elapsed=0;this.alive=0;this.placements=[];this.supplyAt=135;this.queueEnds=0;this.stage=RP.WAITING;this.route=makeFlight(this.random);this.stormSteps=makeStorm(this.random,this.options.storm);this.storm=stormAt(this.stormSteps,0);
 }
 addPlayer(id,profile,bot=false){
  if(this.players.has(id))return this.players.get(id);
  const spectator=!acceptsContestants(this.stage),capacity=this.options.capacity;
  if(!bot&&!spectator&&[...this.players.values()].filter(p=>!p.bot&&p.contestant).length>=Math.min(capacity,MAX_HUMANS))return null;
  if(spectator? [...this.players.values()].filter(p=>p.lateSpectator).length>=MAX_SPECTATORS : [...this.players.values()].filter(p=>p.contestant).length>=capacity)return null;
  this.maxPlayers=capacity+MAX_SPECTATORS;
  const p=super.addPlayer(id,profile,bot);if(!p)return null;
  p.materials={wood:0,brick:0,metal:0};p.slot=0;p.inventory=inventory();p.ammo=Array(6).fill(0);p.reserve=Array(6).fill(0);p.accuracyState=Array.from({length:6},()=>({}));
  p.bank={light:0,medium:0,shells:0,heavy:0,rockets:0};p.shield=0;p.stamina=100;p.flight=spectator?'out':'ground';p.use=null;p.place=0;p.eliminated=false;p.spectating=spectator;p.lateSpectator=spectator;p.contestant=!spectator;p.awaitingEntry=false;p.health=spectator?0:100;
  if(!spectator&&this.map.id===SPAWN_ISLAND.id)this.spawnWarmup(p);
  p.connected=!bot;
  this.assignTeam(p);
  return p;
 }
 assignTeam(p,admission=null){
  if(admission){p.partyId=admission.partyId;p.partySize=admission.partySize;p.duoFill=admission.duoFill;p.memberId=admission.memberId;}
  if(!isDuos(this.options)||!p.contestant){p.team=-1;return;}
  p.duoFill??=this.options.duoFill;
  const others=[...this.players.values()].filter(o=>o!==p&&o.contestant),mates=t=>others.filter(o=>o.team===t);
  let partner=p.partyId&&others.find(o=>o.partyId===p.partyId&&!o.bot&&mates(o.team).length<2);
  if(!partner&&(p.bot||p.duoFill)&&!(p.partySize>1))partner=others.find(o=>mates(o.team).length===1&&(o.bot||o.duoFill&&!(o.partySize>1)));
  p.team=partner?partner.team:Math.max(-1,...others.map(o=>o.team))+1;
 }
 teamPlace(p,place){for(const mate of this.players.values())if(mate.contestant&&teamKey(this.options,mate)===teamKey(this.options,p)){mate.place=place;const result=this.placements.find(r=>r.id===mate.id);if(result)result.place=place;else this.placements.push({id:mate.id,name:mate.name,team:mate.team,place,kills:mate.kills});}}
 humanContestants(){return [...this.players.values()].filter(p=>!p.bot&&p.connected!==false&&p.contestant&&!p.spectating&&!p.lateSpectator);}
 setConnectedHumans(ids){
  const connected=new Set(ids);
  for(const p of this.players.values())if(!p.bot)p.connected=connected.has(p.id);
  this.advanceWarmupClock();
 }
 spawn(p){if(!p.inventory){p.health=100;p.grounded=true;return;}if(isWarmup(this.stage))this.spawnWarmup(p);}
 spawnWarmup(p){
  resetStance(p);
  const {point,region}=distributedSpawn([...this.players.values()].filter(o=>o!==p),this.random);p.activity=newActivity(this.time);p.afkRemoved=false;p.spawnRegion=region;p.spawnHome={x:point[0],z:point[1]};p.warmupBrain=null;
  Object.assign(p,{x:point[0],z:point[1],y:groundAt(SPAWN_ISLAND,...point),vy:0,grounded:true,flight:'ground',health:100,shield:0,stamina:100,slot:0,spectating:false,contestant:true,lateSpectator:false,awaitingEntry:false,kills:0,points:0,streak:0,materials:{wood:500,brick:500,metal:500},inventory:inventory(),use:null,brain:null});
  p.inventory[1]={id:'sprinter',weapon:true,count:1,rarity:0,ammo:weapon('sprinter').magazine};
  p.inventory[2]={id:'scatter',weapon:true,count:1,rarity:0,ammo:weapon('scatter').magazine};
  p.bank={light:0,medium:180,shells:40,heavy:0,rockets:0};resetAirborne(p);this.syncInventory(p);
 }
 addBots(){
  const humans=[...this.players.values()].filter(p=>!p.bot&&p.contestant).length,target=Math.max(0,Math.min(this.options.capacity-humans,this.options.fill?this.options.capacity:this.options.bots));
  let count=[...this.players.values()].filter(p=>p.bot).length,index=0;
  while(count<target){const id='bot-'+index++;if(this.players.has(id))continue;const p=this.addPlayer(id,{name:this.uniqueBotName(['Relay','Sunny','Scout','Drift','Sable'][count%5]),...randomAppearance(this.random)},true);if(!p)break;count++;}
 }
 setProfile(id,profile){
  return super.setProfile(id,profile);
 }
 configure(options){
  if(!super.configure({...options,mode:'royale'}))return false;
  this.map={...ROYALE_MAP,boxes:(ROYALE_MAP.authored||ROYALE_MAP.boxes).map(b=>({...b}))};resetBuilding(this);this.maxPlayers=this.options.capacity;this.queueEnds=0;
  return true;
 }
 startRound(){
  if(this.phase==='playing')return false;
  for(const p of [...this.players.values()])if(p.bot||p.connected===false)this.players.delete(p.id);
  const humans=[...this.players.values()];
  this.stage=RP.WAITING;
  const humanSeats=Math.min(this.options.capacity,MAX_HUMANS);
  humans.forEach((p,index)=>Object.assign(p,{contestant:index<humanSeats,lateSpectator:index>=humanSeats,spectating:index>=humanSeats}));
  this.startReason=null;this.maxPlayers=this.options.capacity+MAX_SPECTATORS;this.addBots();
  this.markers=[];this.markerId=0;for(const p of this.players.values()){p.pingTimes=[];p.lastPingAt=-100;}this.matchId=globalThis.crypto.randomUUID();this.round++;this.phase='playing';this.stage=RP.ISLAND;this.queueEnds=this.time+(this.options.session==='offline'?OFFLINE_WARMUP_SECONDS:WARMUP_SECONDS);this.startedAt=0;this.elapsed=0;this.winner='';this.winnerId=null;this.winnerTeam=-1;this.placements=[];this.projectiles=[];this.events=[];this.inputs.clear();this.remoteInputs.clear();this.loot=[];this.chests=[];this.lootId=0;this.lootVersion++;this.pads=[];this.alive=0;this.remaining=0;
  this.map={...SPAWN_ISLAND,boxes:SPAWN_ISLAND.boxes.map(b=>({...b}))};resetBuilding(this);this.nav=navigation(SPAWN_ISLAND);this.route=makeFlight(this.random);this.stormSteps=makeStorm(this.random,this.options.storm);this.storm=stormAt(this.stormSteps,0);
  for(const p of this.players.values()){if(p.contestant)this.spawnWarmup(p);else Object.assign(p,{health:0,contestant:false,lateSpectator:true,spectating:true,flight:'out'});}
  this.battleLootSeed=Math.floor(this.random()*2147483647);battlePreparation.delete(this);
  this.emit('warmup',{round:this.round});return true;
 }
 prepareBattleWorld(limit=4){
  let job=battlePreparation.get(this);
  if(!job){
   // A separate saved seed keeps results independent of frame timing and bot RNG.
   const world={map:{...ROYALE_MAP,boxes:(ROYALE_MAP.authored||ROYALE_MAP.boxes).map(b=>({...b}))},random:rng(this.battleLootSeed??this.options.seed??1),loot:[],chests:[],lootId:0,lootVersion:0,time:0,dropLoot:this.dropLoot};
   resetBuilding(world);job={world,steps:seedIslandLootSteps(world),done:false};battlePreparation.set(this,job);
  }
  const deadline=performance.now()+1;
  for(let i=0;i<limit&&!job.done;i++){job.done=job.steps.next().done;if(limit!==Infinity&&performance.now()>=deadline)break;}
  return job;
 }
 beginBattle(reason='manual'){
  if(!isWarmup(this.stage)||this.phase!=='playing')return false;
  for(const p of [...this.players.values()])if(!p.bot&&p.connected===false)this.removePlayer(p.id);
  // Commit only complete invited groups. An invitation arriving at the cutoff
  // never sends one party member into combat and the other into spectating.
  for(const p of this.players.values())if(p.contestant&&p.partyId&&p.partySize>1&&[...this.players.values()].filter(o=>!o.bot&&o.connected!==false&&o.partyId===p.partyId).length<p.partySize)Object.assign(p,{contestant:false,spectating:true,lateSpectator:true,health:0,flight:'out'});
  this.addBots();
  const seats=[...this.players.values()].filter(p=>p.contestant);
  if(seats.length<2||isDuos(this.options)&&livingTeams(this.options,seats).size<2){this.queueEnds=this.time+10;this.stage=RP.ISLAND;return false;}
  this.stage=RP.BUS;
  this.startReason=reason;
  const prepared=this.prepareBattleWorld(Infinity).world;
  for(const key of ['map','worldBoxes','worldDamage','builds','buildId','buildVersion','lootSupportDirty','navigationRevision'])this[key]=prepared[key];
  battlePreparation.delete(this);
  this.phase='playing';this.startedAt=this.time;this.elapsed=0;this.winner='';this.winnerId=null;this.winnerTeam=-1;this.placements=[];this.projectiles=[];this.events=[];this.inputs.clear();this.remoteInputs.clear();this.loot=[];this.lootId=0;this.lootVersion++;this.pads=[];this.supplyAt=135;this.queueEnds=0;
  this.route=makeFlight(this.random);this.stormSteps=makeStorm(this.random,this.options.storm);this.storm=stormAt(this.stormSteps,0);this.remaining=0;
  // Three landings per major POI, remaining seats rotate through quiet landmarks.
  const groups=[...this.map.districts,...this.map.landmarks.filter(p=>p.kind!=='bridge')];
  const landingSpots=groups.map(g=>this.map.floorLoot.filter(p=>p.poi===g.id&&!p.roof&&p.floor===0&&p.role==='weapon'));
  const landingOrder=[...Array.from({length:3},()=>groups.slice(0,9)).flat(),...groups.slice(9)];
  const landingOffset=Math.floor(this.random()*landingOrder.length);
  for(const [index,p] of seats.entries()){
   resetStance(p);
   const contestant=p.contestant;
   Object.assign(p,{health:contestant?100:0,shield:0,stamina:100,sprintRest:0,exhausted:false,sprinting:false,flight:contestant?'transport':'out',flightLatch:false,grounded:false,eliminated:!contestant,spectating:!contestant,awaitingEntry:false,spawnRequested:false,place:0,eliminatedAt:null,kills:0,deaths:0,points:0,streak:0,slot:0,materials:{wood:0,brick:0,metal:0},building:false,editing:false,swingAt:-100,nextBuild:0,nextHarvest:0,poppers:0,reloadEnd:0,burstLeft:0,nextShot:0,fireLatch:false,shieldUntil:0,lastDamage:-100,respawnAt:0,killerId:null,crown:null,inventory:inventory(),ammo:Array(6).fill(0),reserve:Array(6).fill(0),accuracyState:Array.from({length:6},()=>({})),bank:{light:0,medium:0,shells:0,heavy:0,rockets:0},use:null,chestId:null,chestProgress:0,interactLatch:false,dropLatch:false,useLatch:false,botThink:0,botPath:[],botIntent:null,botIntentAt:0,brain:null,warmupBrain:null,botDrop:4+this.random()*27,botLand:(()=>{const group=landingOrder[(index+landingOffset)%landingOrder.length],choices=landingSpots[groups.indexOf(group)];return choices[index%choices.length]||this.map.floorLoot[0];})()});
   const routeDx=this.route.toX-this.route.fromX,routeDz=this.route.toZ-this.route.fromZ;
   p.botDrop=clamp(((p.botLand.x-this.route.fromX)*routeDx+(p.botLand.z-this.route.fromZ)*routeDz)/(routeDx*routeDx+routeDz*routeDz)*this.route.duration+this.random()*1.4-.7,3.2,32);
   p.activity=newActivity(this.time);p.afkRemoved=false;resetAirborne(p);Object.assign(p,{damageUntil:0,eggsUntil:0,miniUntil:0,streakArmor:0,restockUntil:0,bodyScale:1,nextLaunch:0,swapLatch:false,jumpLatch:false,botStuck:null});p.contestant=contestant;p.lateSpectator=false;Object.assign(p,transportAt(this.route,0));p.pitch=0;p.vy=0;
  }
  if(isDuos(this.options))for(const p of seats.filter(p=>p.bot)){const mate=seats.find(o=>teammates(this.options,p,o)&&(!o.bot||seats.indexOf(o)<seats.indexOf(p)));if(mate){p.botLand={...mate.botLand,x:mate.botLand.x+3};p.botDrop=mate.botDrop+.25;}}
  this.alive=seats.filter(p=>p.health>0).length;
  this.nav=navigation(ROYALE_MAP);this.loot=prepared.loot;this.chests=prepared.chests;this.lootId=prepared.lootId;this.lootVersion++;
  this.emit('round',{round:this.round});this.emit('royale-cue',{cue:'transport-horn'});return true;
 }
 randomGun(){return rollItem(this.random,'ground','weapon').id;}
 dropLoot(point,item,avoid=[]){
  if(this.loot.length>=2400)return null;
  const supported={...point,y:supportBelow(this.map,point.x,point.z,point.y??groundAt(this.map,point.x,point.z))};
  const spot=placeLoot(this.map,supported,avoid.length?[...this.loot,...avoid]:this.loot);if(!spot)return null;
  const drop={...item,uid:++this.lootId,...spot};delete drop.motion;delete drop.spawnFrom;drop.y=(Number.isInteger(point.floor)||point.role!==undefined)?spot.y:Math.max(spot.y,point.y??spot.y);this.loot.push(drop);startLootFall(this,drop);this.lootVersion++;return drop;
 }
 dropWeapon(point,id,rarity=0,ammo=weapon(id).magazine){return this.dropLoot(point,{id,weapon:true,rarity,count:1,ammo});}
 dropAmmo(point,type,count){return this.dropLoot(point,{id:type,ammoType:type,count,rarity:0});}
 removeLoot(item){const i=this.loot.indexOf(item);if(i>=0){this.loot.splice(i,1);this.lootVersion++;}}
 accessible(p,item,range=3){
  if((p.x-item.x)**2+(p.y-item.y)**2+(p.z-item.z)**2>range*range || item.landAt>this.time)return false;
  const from={x:p.x,y:p.y+.9,z:p.z},to={x:item.x-from.x,y:item.y+.6-from.y,z:item.z-from.z},len=Math.hypot(to.x,to.y,to.z)||1;
  return wallDistance(this.map,from,{x:to.x/len,y:to.y/len,z:to.z/len},len)>=len-.15;
 }
 syncInventory(p){
  p.ammo=p.inventory.map(i=>i?.weapon?i.ammo:0);
  p.reserve=p.inventory.map(i=>i?.weapon?p.bank[ammoType(i.id)]:0);
 }
 dropSlot(p,index=p.slot){
  if(p.downed)return false;
  const item=p.inventory[index];if(!item||index===0)return;
  // Drop at the feet: this always remains on the same reachable collision surface.
  if(!this.dropLoot(p,item))return false;p.inventory[index]=null;p.reloadEnd=0;p.burstLeft=0;p.use=null;this.syncInventory(p);
  this.emit('royale-cue',{player:p.id,cue:'item-drop',x:p.x,y:p.y,z:p.z});
 }
 takeLoot(p,item){
  if(!item||!this.loot.includes(item)||!this.accessible(p,item)||!canFight(p)||p.flight!=='ground')return false;
  if(item.resource){const add=Math.min(item.count,999-p.materials[item.resource]);if(add<=0)return false;p.materials[item.resource]+=add;item.count-=add;if(!item.count)this.removeLoot(item);else this.lootVersion++;return true;}
  if(item.ammoType){const add=Math.min(item.count,AMMO_CAPS[item.ammoType]-p.bank[item.ammoType]);if(add<=0)return false;p.bank[item.ammoType]+=add;item.count-=add;if(!item.count)this.removeLoot(item);else this.lootVersion++;this.syncInventory(p);this.emit('royale-cue',{player:p.id,cue:'ammo-pickup'});return true;}
  let slot=!item.weapon?p.inventory.findIndex(i=>i?.id===item.id&&i.count<(ITEMS[i.id]?.stack||1)):-1;
  if(slot>=0){const add=Math.min(item.count,ITEMS[item.id].stack-p.inventory[slot].count);p.inventory[slot].count+=add;item.count-=add;if(!item.count)this.removeLoot(item);else this.lootVersion++;}
  else {
   slot=p.inventory.findIndex(i=>!i);if(slot<0){slot=p.slot===0?1:p.slot;if(this.dropSlot(p,slot)===false)return false;}
   const {uid,x,y,z,motion,spawnFrom,spawnAt,...entry}=item;p.inventory[slot]={...entry};this.removeLoot(item);
   if(!p.inventory[p.slot] || p.inventory.filter(i=>i&&!i.pickaxe).length===1)p.slot=slot;
   beginEquip(p,this.time,true);
  }
  p.use=null;p.reloadEnd=0;this.syncInventory(p);this.emit('royale-cue',{player:p.id,cue:'pickup-'+(item.rarity||0),item:item.id});return true;
 }
 openChest(p,chest){
  if(!this.chests.includes(chest)||!canFight(p)||p.flight!=='ground'||chest.opened||!this.accessible(p,chest,3.3))return false;
  chest.opened=true;this.lootVersion++;
  const contents=chest.contents||rollChest(this.random,chest.supply?'supply':chest.source||'chest');
  for(const item of contents){const drop=this.dropLoot({...chest,y:chest.y+.7},item,[chest]);if(drop){drop.spawnAt=this.time;drop.spawnFrom={x:chest.x,y:chest.y+.65,z:chest.z};}}
  delete chest.contents;
  this.emit('royale-cue',{cue:'chest-open',player:p.id,x:chest.x,y:chest.y,z:chest.z});return true;
 }
 interact(p,input,dt){
  if(!canFight(p))return;
  if(input.editing)return;
  if(input.interact&&!p.interactLatch&&toggleDoor(this,p)){p.interactLatch=true;return;}
  for(const item of nearbyItems(this,'loot',p,1.6))if((item.ammoType||item.resource)&&this.accessible(p,item,1.6))this.takeLoot(p,item);
  const chest=input.interact?nearbyItems(this,'chests',p,3.3).filter(c=>!c.opened&&this.accessible(p,c,3.3)).sort((a,b)=>dist(p,a)-dist(p,b))[0]:null;
  if(input.interact&&chest){
   if(p.chestId!==chest.id){p.chestId=chest.id;p.chestProgress=0;this.emit('royale-cue',{player:p.id,cue:'chest-search'});}
   p.chestProgress+=dt;
   if(p.chestProgress>=.8){this.openChest(p,chest);p.chestProgress=0;p.chestId=null;}
  }else{p.chestProgress=0;p.chestId=null;}
  if(input.interact&&!p.interactLatch&&!chest){
   const item=nearbyItems(this,'loot',p,3).filter(i=>!i.ammoType&&this.accessible(p,i,3)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
   if(item)this.takeLoot(p,item);
  }
  p.interactLatch=!!input.interact;
 }
 beginUse(p){
  if(!canFight(p))return;
  const item=p.inventory[p.slot],def=ITEMS[item?.id];if(!def||p.use||p.flight!=='ground')return;
  if(def.kind==='heal'&&p.health>=def.cap||def.kind==='shield'&&p.shield>=def.cap)return;
  p.reloadEnd=0;p.burstLeft=0;p.use={id:item.id,slot:p.slot,start:this.time,end:this.time+def.duration};
  this.emit('royale-cue',{player:p.id,cue:'use-'+item.id,x:p.x,y:p.y,z:p.z});
 }
 finishUse(p){
  if(!canFight(p)){p.use=null;return;}
  const use=p.use,item=p.inventory[use?.slot];if(!item||item.id!==use.id){p.use=null;return;}
  const def=ITEMS[item.id];
  if(def.kind==='heal')p.health=Math.min(def.cap,p.health+def.amount);
  else if(def.kind==='shield')p.shield=Math.min(def.cap,p.shield+def.amount);
  else if(def.kind==='splash'){
   for(const other of this.players.values())if(other.health>0&&!other.downed&&this.accessible(p,other,5)){const heal=Math.min(100-other.health,30);other.health+=heal;other.shield=Math.min(100,other.shield+30-heal);}
   this.emit('royale-fx',{kind:'splash',x:p.x,y:p.y,z:p.z});
  }else if(def.kind==='popper'){this.launch(p,true);}
  else if(def.kind==='impulse'){
   const d=direction(p.yaw);launchPlayer(p,{source:'shockwave',vy:28,vx:d.x*16,vz:d.z*16});
   this.emit('royale-fx',{kind:'impulse',x:p.x,y:p.y,z:p.z});
  }else if(def.kind==='launchpad'){
   this.pads.push({id:'pad-'+this.lootId++,x:p.x,y:p.y,z:p.z,until:this.time+180});
  }
  item.count--;if(item.count<=0)p.inventory[use.slot]=null;p.use=null;this.syncInventory(p);
  this.emit('royale-cue',{player:p.id,cue:'complete-'+use.id,x:p.x,y:p.y,z:p.z});
 }
 cancelUse(p){if(p.use)this.emit('royale-cue',{player:p.id,cue:'use-cancel'});p.use=null;}
 reload(p){if(!canFight(p)||!p.inventory[p.slot]?.weapon)return;this.syncInventory(p);super.reload(p);}
 fire(p,burst=false){
  const item=p.inventory[p.slot];if(!canFight(p)||!item?.weapon||p.flight!=='ground'||p.use)return;
  super.fire(p,burst);item.ammo=p.ammo[p.slot];
 }
 damage(victim,attacker,amount,source,precision=false,shotId=null){
  if(teammates(this.options,victim,attacker))return;
  if(victim.health<=0||victim.spectating||this.time<(victim.shieldUntil||0)||isWarmup(this.stage)||victim.flight==='transport')return;
  amount=Math.max(0,amount);const old=victim.health;let absorbed=0;
  if(source!=='Storm'&&source!=='Fall'&&victim.shield>0){absorbed=Math.min(victim.shield,amount);victim.shield-=absorbed;amount-=absorbed;
   this.emit('royale-cue',{cue:victim.shield===0?'shield-break':'shield-hit',player:victim.id,x:victim.x,y:victim.y,z:victim.z});
  }
  victim.botIntentAt=0;this.cancelUse(victim);victim.chestProgress=0;victim.lastDamage=this.time;
  if(source!=='Storm'&&source!=='Bleed out'){victim.reviveBlockedUntil=this.time+REVIVE_RULES.damageDelay;victim.reviving=null;}
  if(amount>=victim.health&&mayDown(this,victim,source))downPlayer(this,victim,attacker,source,precision,shotId);
  else if(amount>0)super.damage(victim,attacker,amount,source,precision,shotId);
  if(absorbed>0)this.emit('hit',{player:attacker?.id,target:victim.id,amount:absorbed,shotId,sourceX:attacker?.x,sourceY:attacker?.y,sourceZ:attacker?.z,x:victim.x,y:victim.y+1.45,z:victim.z,precision,shield:true});
  if(old>0&&victim.health<=0)this.eliminate(victim);
 }
 eliminate(p){
  if(p.eliminated)return;
  p.downed=false;p.lifeState='ELIMINATED';p.reviving=null;p.reviverId=null;p.reviveProgress=0;p.eliminated=true;p.eliminatedAt=this.time;p.place=0;p.flight='out';p.spectating=true;p.use=null;p.reloadEnd=0;p.burstLeft=0;
  for(let i=1;i<6;i++)if(p.inventory[i])this.dropSlot(p,i);
  for(const [type,count] of Object.entries(p.bank))if(count>0)this.dropAmmo(p,type,count);
  for(const [material,count] of Object.entries(p.materials))if(count>0)this.dropLoot(p,{id:material,resource:material,count});p.materials={wood:0,brick:0,metal:0};
  p.bank={light:0,medium:0,shells:0,heavy:0,rockets:0};this.syncInventory(p);this.inputs.delete(p.id);
  if(![...this.players.values()].some(o=>teammates(this.options,p,o)&&o.health>0&&!o.spectating))this.teamPlace(p,livingTeams(this.options,this.players.values()).size+1);
  this.alive=Math.max(0,this.alive-1);
  this.emit('royale-eliminated',{player:p.id,place:p.place});
 }
 eliminationCredit(victim,attacker){return victim.downed&&this.players.get(victim.knockedBy)||attacker;}
 admitPlayer(id,profile,admission=null){
  if(this.players.has(id))return this.players.get(id);
  if([...this.players.values()].some(p=>!p.bot&&nameKey(p.name)===nameKey(profile.name)))return null;
  if(acceptsContestants(this.stage)){
   const humans=[...this.players.values()].filter(p=>!p.bot&&p.contestant),groups=new Map();
   for(const p of humans)if(p.partySize>1&&p.partyId!==admission?.partyId)groups.set(p.partyId,p.partySize-humans.filter(o=>o.partyId===p.partyId).length);
   const needed=Math.max(1,(admission?.partySize||1)-humans.filter(p=>p.partyId===admission?.partyId).length);
   if(humans.length+[...groups.values()].reduce((a,b)=>a+b,0)+needed>Math.min(this.options.capacity,MAX_HUMANS))return null;
   if([...this.players.values()].filter(p=>!p.bot&&p.contestant).length>=Math.min(this.options.capacity,MAX_HUMANS))return null;
   const partyMate=admission&&[...this.players.values()].find(p=>!p.bot&&p.partyId===admission.partyId&&p.contestant);
   const preferred=partyMate||isDuos(this.options)&&admission?.duoFill!==false&&admission?.partySize!==2&&[...this.players.values()].find(p=>!p.bot&&p.contestant&&p.duoFill&&!(p.partySize>1)&&[...this.players.values()].filter(o=>o.team===p.team&&o.contestant&&!o.bot).length===1);
   const mateBot=preferred&&[...this.players.values()].find(p=>p.bot&&p.team===preferred.team);
   if(mateBot)this.removePlayer(mateBot.id);
   else if([...this.players.values()].filter(p=>p.contestant).length>=this.options.capacity){const bots=[...this.players.values()].filter(p=>p.bot&&p.contestant),bot=bots.find(b=>![...this.players.values()].some(o=>teammates(this.options,b,o)&&o.contestant))||bots[0];if(!bot)return null;this.removePlayer(bot.id);}
  }
  // Admission is decided solely by authoritative phase. No client join flag can
  // replace a bot, add a contestant or resurrect a spectator after the cutoff.
  const p=this.addPlayer(id,profile);
  if(p){this.assignTeam(p,admission);this.advanceWarmupClock();}
  return p;
 }

 leavePlayer(id){
  const p=this.players.get(id);if(!p)return;
  if(this.phase==='playing'&&!isWarmup(this.stage)&&p.contestant&&p.health>0&&!p.spectating&&(this.options.fill||this.options.bots>0)){
   this.players.delete(id);this.inputs.delete(id);
   let botId='bot-fill-'+this.joinOrder++;while(this.players.has(botId))botId+='x';
   Object.assign(p,randomAppearance(this.random),{id:botId,bot:true,name:this.uniqueBotName('Sunny'),brain:null,ack:0,botThink:0,botPath:[],botLand:p.botLand||this.map.floorLoot[0],botDrop:this.elapsed+2});
   for(const b of this.projectiles)if(b.owner===id)b.owner=botId;for(const b of this.builds)if(b.owner===id)b.owner=botId;
   this.players.set(botId,p);this.emit('leave',{name:p.name});
  }else this.removePlayer(id);
 }
 removePlayer(id){const p=this.players.get(id);if(p&&this.phase==='playing'&&!isWarmup(this.stage)&&p.contestant&&p.health>0){p.health=0;this.eliminate(p);}super.removePlayer(id);}
 playerAction(id,action){
  const p=this.players.get(id);if(!p||this.phase!=='playing')return;
  if(markerAction(this,p,action))return;
  if((p.downed||p.reviving)&&action!=='spectate'&&!action.startsWith('ping-'))return;
  if(p.health>0&&!p.spectating&&p.flight==='ground'&&action.startsWith('build-')){editBuilding(this,p,action);return;}
  if(action==='inventory-select-0'&&p.health>0&&!p.spectating){p.slot=0;p.use=null;p.reloadEnd=0;p.burstLeft=0;beginEquip(p,this.time,true);return;}
  const change=/^inventory-(select|drop|drop-one|split|swap)-([1-5])(?:-([1-5]))?$/.exec(action);
  if(change&&p.health>0&&!p.spectating&&p.flight==='ground'){
   const from=Number(change[2]),to=Number(change[3]),beforeInventory=JSON.stringify(p.inventory);
   if(change[1]==='select'){p.slot=from;beginEquip(p,this.time,true);}
   else if(change[1]==='drop')this.dropSlot(p,from);
   else if(change[1]==='drop-one'){const item=p.inventory[from];if(item&&!item.weapon&&item.count>1){if(this.dropLoot(p,{...item,count:1}))item.count--;}else this.dropSlot(p,from);}
   else if(change[1]==='split'){const item=p.inventory[from],empty=p.inventory.findIndex(i=>!i);if(item&&!item.weapon&&item.count>1&&empty>=0){const count=Math.floor(item.count/2);item.count-=count;p.inventory[empty]={...item,count};}}
   else if(Number.isInteger(to)&&to>=1&&to<6){[p.inventory[from],p.inventory[to]]=[p.inventory[to],p.inventory[from]];if(p.slot===from)p.slot=to;else if(p.slot===to)p.slot=from;beginEquip(p,this.time,true);}
   if(beforeInventory!==JSON.stringify(p.inventory))this.emit('inventory-change',{player:p.id});
   this.cancelUse(p);p.reloadEnd=0;p.burstLeft=0;this.syncInventory(p);this.emit('royale-cue',{player:p.id,cue:'weapon-swap'});return;
  }
  if(action==='spectate'&&p.health>0){this.damage(p,null,p.health+p.shield+1,'Left round');if(p.flight==='transport'){p.health=0;this.eliminate(p);}}
 }
 advanceWarmupClock(unsteppedSeconds=0){
  if(this.phase!=='playing'||!isWarmup(this.stage))return;
  // The host's physics loop intentionally drops long frame gaps. Translate
  // those elapsed seconds into the existing replicated deadline, so warmup
  // uses elapsed host time and checkpoints preserve the remaining wait.
  if(Number.isFinite(unsteppedSeconds))this.queueEnds-=Math.max(0,unsteppedSeconds);
   const count=Math.ceil(this.queueEnds-this.time);this.stage=count<=5?RP.STARTING:RP.ISLAND;
   if(count>0&&count<=5&&this.lastCountdown!==count){this.lastCountdown=count;this.emit('royale-cue',{cue:'countdown'});}
   const full=this.options.session!=='offline'&&this.humanContestants().length>=this.options.capacity;
   if(full||this.time>=this.queueEnds)this.beginBattle(full?'human-full':'timer');
 }
 tick(dt){
  dt=clamp(dt,0,1/30);this.time+=dt;
  if(this.phase!=='playing')return;
  if(isWarmup(this.stage))this.prepareBattleWorld();
  this.advanceWarmupClock();
  const warmup=isWarmup(this.stage);
  if(!warmup){
  this.elapsed=this.time-this.startedAt;this.remaining=0;
  const oldIndex=this.storm.index,oldClosing=this.storm.closing;
  this.storm=stormAt(this.stormSteps,this.elapsed);
  if(oldIndex!==this.storm.index||oldClosing!==this.storm.closing)this.emit('royale-cue',{cue:this.storm.closing?'storm-closing':'storm-reveal'});
  if(this.elapsed>this.supplyAt){this.supplyAt+=130;const angle=this.random()*Math.PI*2,r=Math.max(0,this.storm.radius-20)*this.random();const x=clamp(this.storm.x+Math.cos(angle)*r,-210,210),z=clamp(this.storm.z+Math.sin(angle)*r,-210,210);const spot=placeLoot(this.map,{x,z,y:surfaceAt(this.map,x,z)})||placeLoot(this.map,{x,z,y:groundAt(this.map,x,z)});if(spot)this.chests.push({id:'supply-'+this.lootId++,...spot,opened:false,supply:true,landAt:this.time+18,contents:rollChest(this.random,'supply')});this.lootVersion++;this.emit('royale-cue',{cue:'supply-incoming'});}
  if(this.elapsed>=this.route.duration)this.stage=[...this.players.values()].some(p=>p.health>0&&['dive','glide'].includes(p.flight))?RP.DROP:RP.ACTIVE;
  }
  this.recordPoses();this.tickActivity(dt);
  for(const p of this.players.values()){
   if(p.health<=0||p.spectating)continue;
   const commands=p.bot?null:this.movementInput(p,dt);
   let input=commands?.input||(p.bot?this.botInput(p):this.inputs.get(p.id));
   if(!input||!p.bot&&this.time-p.lastInput>.4)input={yaw:p.yaw,pitch:p.pitch,slot:p.slot};
   p.executedShotTime=input.shotTime;
   if(p.lifeState==='REVIVED'&&this.time-p.revivedAt>2)p.lifeState='ALIVE';
   if(p.downed){
    const before={x:p.x,y:p.y,z:p.z};const crawl={...input,fire:false,aim:false,reload:false,interact:false,drop:false,buildMode:false,jump:false,sprint:false,crouch:false};
    this.moveWithCommands(p,crawl,dt,commands?{...commands,steps:commands.steps.map(s=>({...s,fire:false,aim:false,jump:false,sprint:false,crouch:false}))}:null);p.vx=(p.x-before.x)/dt;p.vz=(p.z-before.z)/dt;p.moving=Math.hypot(p.vx,p.vz)>.1;p.aim=false;
    if(this.time-p.downedAt>1){const drain=(REVIVE_RULES.bleed+Math.min(4,p.downCount-1))*dt;if(p.health<=drain)this.damage(p,null,drain,'Bleed out');else p.health-=drain;}
    if(!warmup&&this.storm.active&&(this.storm.radius<=.01||Math.hypot(p.x-this.storm.x,p.z-this.storm.z)>this.storm.radius))this.damage(p,null,this.storm.dps*dt,'Storm');
    continue;
   }

   if(p.flight==='transport'){
    p.ack=Math.max(p.ack,...(commands?commands.steps.map(i=>i.seq):[input.seq||0]));
    Object.assign(p,transportAt(this.route,this.elapsed));
    if(this.elapsed>=3&&(input.jump||this.elapsed>=this.route.duration)){
     p.lastJumpPress=Math.max(p.lastJumpPress||0,input.jumpPress||0);
     launchPlayer(p,{source:'bus'});p.yaw=input.yaw||p.yaw;p.pitch=0;this.emit('royale-cue',{player:p.id,cue:'transport-exit'});
    }
    continue;
   }
   const wasFlight=p.flight,oldGrounded=p.grounded,previous={x:p.x,y:p.y,z:p.z};
   const reviving=prepareRevive(this,p,input);
   const slot=clamp(Math.floor(input.slot??p.slot),0,5);
   if(slot!==p.slot){p.slot=slot;p.reloadEnd=0;p.burstLeft=0;beginEquip(p,this.time,true);this.cancelUse(p);p.nextShot=Math.max(p.nextShot,this.time+.22);this.emit('royale-cue',{player:p.id,cue:'weapon-swap'});}
   if(p.slot>0&&input.swapSlot>0&&input.swapSlot<6&&input.swapSlot!==p.slot&&!p.swapLatch){const j=input.swapSlot;[p.inventory[p.slot],p.inventory[j]]=[p.inventory[j],p.inventory[p.slot]];p.reloadEnd=0;this.cancelUse(p);this.syncInventory(p);}
   p.swapLatch=input.swapSlot>=0;
   if(input.sprint)this.cancelUse(p);
   this.moveWithCommands(p,input,dt,commands);p.moving=Math.hypot(p.x-previous.x,p.z-previous.z)>.001;p.aim=!!input.aim&&!reviving&&p.flight==='ground'&&!p.use&&!!p.inventory[p.slot]?.weapon;p.vx=(p.x-previous.x)/dt;p.vz=(p.z-previous.z)/dt;
   if(p.landing){const amount=warmup?0:fallDamage(p.landing);p.landing=null;if(amount)this.damage(p,null,amount,'Fall');if(p.health<=0)continue;}
   if(wasFlight!==p.flight)this.emit('royale-cue',{player:p.id,cue:p.flight==='ground'?'land':p.flight==='dive'?'glider-cut':'glider-deploy',x:p.x,y:p.y,z:p.z});
   else if(!oldGrounded&&p.grounded)this.emit('royale-cue',{player:p.id,cue:'land',x:p.x,y:p.y,z:p.z});
   else if(oldGrounded&&!p.grounded&&p.vy>0)this.emit('royale-cue',{player:p.id,cue:'jump',x:p.x,y:p.y,z:p.z});
   if(p.flight==='ground'&&!reviving&&!p.downed){
    this.syncInventory(p);this.updateAccuracy(p,previous,dt);
    if(input.drop&&!p.dropLatch)this.dropSlot(p);p.dropLatch=!!input.drop;
    this.interact(p,input,dt);
    if(p.reloadEnd&&this.time>=p.reloadEnd){const item=p.inventory[p.slot];if(item?.weapon){const type=ammoType(item.id),add=Math.min(gun(p).magazine-item.ammo,p.bank[type]);item.ammo+=add;p.bank[type]-=add;}p.reloadEnd=0;this.syncInventory(p);this.emit('royale-cue',{player:p.id,cue:'reload-bolt'});}
    const buildingAction=buildingTick(this,p,input);
    if(!buildingAction&&p.inventory[p.slot]?.weapon){
     if(input.reload||input.fire&&p.ammo[p.slot]===0)this.reload(p);
     if(p.burstLeft&&this.time>=p.burstTime){this.fire(p,true);p.burstLeft--;p.burstTime+=gun(p).burstInterval;}
     if(input.fire&&this.time>=p.nextShot&&(gun(p).automatic||!p.fireLatch||p.bot)&&!p.burstLeft&&!p.reloadEnd&&p.ammo[p.slot]>0){this.fire(p);p.nextShot=this.time+gun(p).interval;if(gun(p).burst){p.burstLeft=gun(p).burst-1;p.burstTime=this.time+gun(p).burstInterval;}}
     if(input.fire&&!p.fireLatch&&p.ammo[p.slot]===0&&p.reserve[p.slot]===0)this.emit('royale-cue',{player:p.id,cue:'weapon-empty'});
    }else if(!buildingAction&&input.fire&&!p.useLatch)this.beginUse(p);
    p.fireLatch=!!input.fire&&this.time>=(p.equipUntil||0);p.useLatch=!!input.fire;
    if(p.use&&this.time>=p.use.end)this.finishUse(p);
    for(const pad of this.pads)if(this.time>=(p.nextLaunch||0)&&dist(p,pad)<2){launchPlayer(p,{source:'launchpad',vy:38});p.nextLaunch=this.time+3;this.emit('royale-cue',{player:p.id,cue:'launch',x:pad.x,y:pad.y,z:pad.z});}
   }
   if(!warmup&&this.storm.active&&(this.storm.radius<=.01||Math.hypot(p.x-this.storm.x,p.z-this.storm.z)>this.storm.radius)){if(this.alive>1)this.damage(p,null,this.storm.dps*dt,'Storm');}

  }
  for(const chest of this.chests)if(chest.landAt&&this.time>=chest.landAt&&!chest.landed){chest.landed=true;this.emit('royale-cue',{cue:'supply-land',x:chest.x,y:chest.y,z:chest.z});}
  this.pads=this.pads.filter(p=>p.until>this.time);
  constructionTick(this);
  this.updateProjectiles(dt);
  tickRevives(this,dt);resolveDownedTeams(this);
  tickLootMotion(this);if(warmup)return;
  const living=[...this.players.values()].filter(p=>p.contestant&&p.health>0&&!p.spectating);this.alive=living.length;
  if(livingTeams(this.options,living).size<=1)this.finish();
 }
 finish(){
  if(this.phase!=='playing'||isWarmup(this.stage))return;
  const living=[...this.players.values()].filter(p=>p.health>0&&!p.spectating);
  if(livingTeams(this.options,living).size>1)return;
  this.stage=RP.ENDING;
  this.phase='results';this.stage=RP.FINISHED;this.winnerId=living[0]?.id||null;this.winnerTeam=living[0]?.team??-1;this.winner=living[0]?(isDuos(this.options)?'Duo victory!':living[0].name+' wins'):'No surviving operators — draw';
  if(living[0])this.teamPlace(living[0],1);
  // If the final pair fell in the same simulation tick, both share the final place.
  if(!living.length){const final=this.placements.filter(x=>x.place<=2);for(const p of final){p.place=1;const player=this.players.get(p.id);if(player)player.place=1;}}
  this.emit('finish',{winner:this.winner});this.emit('royale-cue',{cue:'victory'});
 }
 botInput(p){
  if(p.flight==='ground'&&p.botIntent&&this.time<(p.botIntentAt||0))return {...p.botIntent};
  const intent=this.thinkBot(p);if(p.flight==='ground'){p.botIntent={...intent};const engaged=[...this.players.values()].some(o=>o!==p&&o.health>0&&dist(p,o)<55),using=p.use||p.brain?.utility||p.brain?.task?.kind==='heal';p.botIntentAt=this.time+(using?.04:engaged?.11:.23)+this.random()*.025;}return intent;
 }
 thinkBot(p){
  const rescue=rescueBotInput(this,p);if(rescue)return rescue;
  const input={yaw:p.yaw,pitch:0,forward:0,strafe:0,slot:p.slot,swapSlot:-1};
  if(p.flight==='transport'){const mate=isDuos(this.options)&&[...this.players.values()].find(o=>teammates(this.options,p,o)&&!o.bot&&o.health>0);input.jump=mate?mate.flight!=='transport':this.elapsed>=p.botDrop;if(mate&&mate.flight!=='transport')p.botLand={x:mate.x,y:mate.y,z:mate.z};return input;}
  let goal=p.botLand||{x:0,y:0,z:0};
  if(p.flight!=='ground'){
   const dx=goal.x-p.x,dz=goal.z-p.z;input.yaw=Math.atan2(-dx,-dz);input.forward=Math.hypot(dx,dz)>4?1:0;
   input.jump=p.flight==='dive'&&p.y<95;return input;
  }
  return tacticalBotInput(this,p);
 }

 damageWorld(box,amount){damageObject(this,box,amount);}
 explode(b){if(!b.popper&&(b.travelled||0)<weapon(b.weapon).minRange)return;super.explode(b);const radius=b.popper?3:weapon(b.weapon).splashRadius;const seen=new Set();for(const box of [...this.map.boxes]){const id=box.buildId||box.objectId;if(seen.has(id))continue;const d=Math.hypot(Math.max(0,Math.abs(b.x-box.x)-box.w/2),Math.max(0,box.y-b.y,b.y-box.y-box.h),Math.max(0,Math.abs(b.z-box.z)-box.d/2));if(d<radius){seen.add(id);damageObject(this,box,(b.buildDamage??(b.popper?100:weapon(b.weapon).buildDamage))*(1-d/(radius*1.2)));}}}
 checkpoint(){const data=super.checkpoint(['worldBoxes']);
  // Tactical caches can be reacquired after transfer; do not replicate every scan,
  // visited room and navigation node for every bot on every recovery update.
  for(const p of data.players)if(p.bot){delete p.brain;delete p.warmupBrain;delete p.botPath;delete p.botIntent;delete p.botStuck;p.botIntentAt=0;}
  return data;
 }
 restore(checkpoint){battlePreparation.delete(this);super.restore(checkpoint);const base=isWarmup(this.stage)?SPAWN_ISLAND:ROYALE_MAP;this.worldBoxes=(base.authored||base.boxes).filter(b=>!b.buildId).map(b=>({...b}));this.map={...base,boxes:[]};rebuildMap(this);this.nav=navigation(base);return this;}
 snapshot(){
  const state=super.snapshot();state.options={...state.options,map:this.map.id};
  state.players=state.players.map(p=>{const source=this.players.get(p.id);return {...p,contestant:source.contestant,lateSpectator:source.lateSpectator,fall:source.fall?{...source.fall}:null,redeploy:source.redeploy,forceGlider:source.forceGlider,launchVelocity:source.launchVelocity?{...source.launchVelocity}:null,lastHarvest:source.lastHarvest,materials:{...source.materials},building:source.building,editing:source.editing,buildType:source.buildType,buildMaterial:source.buildMaterial,buildRotation:source.buildRotation,buildFacing:source.buildFacing,swingAt:source.swingAt,inventory:source.inventory?.map(i=>i?{...i}:null),bank:{...source.bank},shield:source.shield,stamina:source.stamina,sprinting:source.sprinting,exhausted:source.exhausted,sprintRest:source.sprintRest,flight:source.flight,flightLatch:source.flightLatch,eliminated:source.eliminated,eliminatedAt:source.eliminatedAt,place:source.place,use:source.use?{...source.use}:null,chestProgress:source.chestProgress||0};});
  state.royale={markers:(this.markers||[]).filter(m=>m.until>this.time).map(m=>({...m})),stage:this.stage,accepting:acceptsContestants(this.stage),practice:isWarmup(this.stage),contestants:[...this.players.values()].filter(p=>p.contestant).length,round:this.round,builds:this.builds.map(b=>({...b})),worldDamage:structuredClone(this.worldDamage),buildVersion:this.buildVersion,matchId:this.matchId,elapsed:this.elapsed,alive:this.alive,route:this.route,storm:this.storm,lootVersion:this.lootVersion,loot:this.loot.map(i=>({...i})),chests:this.chests.map(({contents,...c})=>({...c})),pads:this.pads.map(p=>({...p})),winnerId:this.winnerId,placements:this.placements.map(p=>({...p})),queueEnds:this.queueEnds,humanContestants:this.humanContestants().length,botContestants:[...this.players.values()].filter(p=>p.bot&&p.contestant).length,humanLimit:Math.min(this.options.capacity,MAX_HUMANS),startReason:this.startReason};
  state.royale.winnerTeam=this.winnerTeam??-1;state.royale.teamsAlive=livingTeams(this.options,this.players.values()).size;
  return state;
 }
}
