import {startEmote,cancelEmote,emoteInput} from './emotes.js';
import {watcherAction} from './spectator-status.js';
import {COMBAT_LIMITS,UTILITY_WEAPONS} from './weapon-balance.js';
import {arenaSpawnPoints} from './arena-spawns.js';
import {activityEvent,newActivity,observeInput,observeMotion,meaningfulActivity,activityRemaining} from './activity.js';
import {RemoteInputBuffer} from './remote-input.js';
import {resetStance,eyeHeight,canFight} from './stance.js';
import {updateCombatAccuracy,firedAccuracy,pelletOffsets,falloffAt,structureDamage,weaponReadyAt,rememberShot,triggerRequested} from './combat.js';
import {arenaBonuses,resetBonuses,updateBonuses,awardBonus} from './streaks.js';
import {botInput as tacticalBotInput} from './bots.js';
import {scheduledBotInput} from './bot-runtime.js';
import {beginEquip} from './equip.js';
import {matchOptions} from "./match-options.js";
import {
  VERSION, randomAppearance, nameKey,
  WEAPONS,
  weapon,
  gun,
  mode,
  safeProfile,
  clamp,
  rng,
} from "./data.js";
import { getMap, navigation, surfaceAt,captureMapLayouts,mapBundleKey,validateLayoutBundle } from "./maps.js";
import {MAX_SPECTATORS} from './royale-phases.js';
import {
  muzzleOrigin, canStand,
  worldHit,
  movePlayer,
  sanitizeInput,
  direction,
  wallDistance,
  rayEgg, humanHit,
  dist,
  EYE,
} from "./physics.js";
const BOT_NAMES = [
  "Relay",
  "Sunny",
  "Scout",
  "Drift",
  "Vanguard",
  "Sable",
  "Rook",
];
export class Simulation {
  constructor(options = {}) {
    this.options = matchOptions(options);
    this.mapLayouts=options.mapLayouts?validateLayoutBundle(options.mapLayouts):captureMapLayouts();
    this.mapLayoutKey=mapBundleKey(this.mapLayouts);
    this.map = getMap(this.options.map,this.mapLayouts);
    this.nav = options.deferNavigation?null:navigation(this.map);
    this.random = rng(options.seed || Date.now());
    this.players = new Map();
    this.inputs = new Map();
    this.remoteInputs = new Map();
    this.events = [];
    this.eventId = 0;
    this.time = 0;
    this.round = 0;
    this.phase = "lobby";
    this.remaining = this.options.minutes * 60;
    this.scores = [0, 0];
    this.projectiles = [];
    this.projectileId = 0;
    this.shotId = 0;
    this.joinOrder = 0;
    this.pickups = [];
    this.winner = "";
  }
  emit(type, data = {}) {
    const activity=activityEvent({type,...data}),actor=this.players.get(data.player);
    if(activity&&actor?.activity&&!actor.bot&&meaningfulActivity(actor.activity,'action',activity.signature+':'+Math.round(actor.x/3)+','+Math.round(actor.z/3),this.time)&&activity.contribution)actor.activity.contributions++;
    if(type==='hit'&&data.player&&this.players.get(data.player)?.activity){this.players.get(data.player).activity.damage+=Math.max(0,Math.min(100,data.amount||0));meaningfulActivity(this.players.get(data.player).activity,'damage',data.target,this.time);}
    const e = { id: ++this.eventId, time: this.time, type, ...data };
    this.events.push(e);
    if (this.events.length > 120) this.events.shift();
    return e;
  }
  addPlayer(id, profile, bot = false, spectator = false) {
    if (this.players.has(id)) return this.players.get(id);
    if (spectator ? [...this.players.values()].filter(p=>p.lateSpectator).length>=MAX_SPECTATORS : [...this.players.values()].filter(p=>!p.lateSpectator).length >= (this.maxPlayers || 8)) return null;
    const count = [0, 0];
    for (const p of this.players.values()) if(!p.lateSpectator&&p.team>=0)count[p.team]++;
    const p = {
      id,
      ...safeProfile(profile),
      bot,
      joinedOrder: ++this.joinOrder,
      botSeed:this.random()*100,
      team: count[0] <= count[1] ? 0 : 1,
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      yaw: 0,
      pitch: 0,
      grounded: true,
      jumpLatch: false,
      health: COMBAT_LIMITS.arenaHealth,
      kills: 0,
      deaths: 0,
      assists: 0,
      points: 0,
      streak: 0,
      slot: 0,
      ammo: [0, weapon("pip").magazine],
      reserve: [0, weapon("pip").reserve],
      reloadEnd: 0,
      nextShot: 0,
      burstLeft: 0,
      fireLatch: false,
      accuracyState: [{}, {}],
      burstTime: 0,
      poppers: 2,
      nextPopper: 0,
      shieldUntil: 0,
      lastDamage: -100,
      respawnAt: 0,
      killerId: null,
      crown: null,emote:null,
      ack: 0,
      lastInput: 0,
    };
    p.activity=newActivity(this.time);
    this.players.set(id, p);
    this.spawn(p);
    if (!p.bot) this.waitForEntry(p);
    if(spectator)Object.assign(p,{friendSpectator:true,lateSpectator:true,contestant:false,spectating:true,health:0,awaitingEntry:false,team:-1});
    this.emit("join", { player: id, name: p.name });
    return p;
  }
  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.inputs.delete(id);this.remoteInputs.delete(id);
    this.emit("leave", { name: p.name });
  }
  setProfile(id, profile) {
    const p = this.players.get(id);
    if (!p) return;
    const safe = safeProfile(profile);if(this.options.weaponPool==='precision'&&!['anchor','peeper','needle'].includes(safe.weapon))safe.weapon='anchor';if(this.options.weaponPool==='close'&&!['scatter','doubleyolk','zipper','pip'].includes(safe.weapon))safe.weapon='zipper';
    if([...this.players.values()].some(other=>other.id!==id&&!other.bot&&nameKey(other.name)===nameKey(safe.name)))return false;
    for(const other of this.players.values())if(other.id!==id&&other.bot&&nameKey(other.name)===nameKey(safe.name))other.name=this.uniqueBotName(other.name+' Bot');
    p.nextProfile = safe;
    p.name=safe.name;
    if (this.phase === "lobby" || p.health <= 0) Object.assign(p, safe);
    this.teamAppearance(p);
    return true;
  }
  setInput(id, input, remote = false) {
    const p = this.players.get(id);
    if (!p || !input || typeof input !== "object") return;
    const safe = sanitizeInput(input),
      previous = this.inputs.get(id);
    if (safe.seq <= Math.max(p.ack, previous?.seq || 0)) return;
    // Track the raw edge before coalescing. A release followed by another tap
    // can share one host tick; OR-ing the buttons alone would erase that edge.
    if(p.activity&&!p.afkRemoved)observeInput(p.activity,safe,this.time);
    safe.fireHeld=safe.fire;safe.firePress=safe.fire&&!previous?.fireHeld?safe.seq:previous?.firePress||0;
    safe.jumpHeld = safe.jump;
    safe.jumpPress = safe.jump && !previous?.jumpHeld ? safe.seq : previous?.jumpPress || 0;
    if(remote) {
      if(p.health<=0||p.spectating)return;
      let buffer=this.remoteInputs.get(id);
      if(!buffer){buffer=new RemoteInputBuffer();this.remoteInputs.set(id,buffer);}
      if(!buffer.push(safe))return;
      this.inputs.set(id,safe);p.lastInput=this.time;return;
    }
    // Preserve brief button presses when several packets arrive before a simulation tick.
    if (previous && previous.seq > p.ack)
      for (const key of ["reload", "popper", "jump", "fire"])
        safe[key] ||= previous[key];
    this.inputs.set(id, safe);
    p.lastInput = this.time;
  }
  movementInput(p, dt) {
    const buffer=this.remoteInputs.get(p.id);
    if(!buffer)return null;
    const steps=buffer.take(dt,!!this.recoveringTick);
    let input={...(steps.at(-1)||buffer.last||{yaw:p.yaw,pitch:p.pitch,slot:p.slot})};
    input.firePress=Math.max(input.firePress||0,...steps.map(step=>step.firePress||0));
    for(const key of ['fire','reload','popper','interact','drop'])
      if(steps.some(step=>step[key]))input[key]=true;
    if(this.time-p.lastInput>.4)input={yaw:p.yaw,pitch:p.pitch,slot:p.slot};
    return {steps,input};
  }
  moveWithCommands(p,input,dt,commands) {
    if(!commands){movePlayer(p,input,this.map,dt);p.ack=Math.max(p.ack,input.seq||0);return;}
    p.motionFresh=this.time-(p.motionAt??-100)<.4;
    for(const step of commands.steps){
      const x=p.x,z=p.z;movePlayer(p,step,this.map,1/60);
      p.motionVX=(p.x-x)*60;p.motionVZ=(p.z-z)*60;p.motionAt=this.time;p.motionFresh=true;
      p.ack=Math.max(p.ack,step.seq);
    }
    // After an actual interruption, keep gravity running without inventing input acknowledgements.
    if(!commands.steps.length&&this.time-p.lastInput>.4)movePlayer(p,input,this.map,dt);
  }
  addBots() {
    let i = 0;
    while (
      [...this.players.values()].filter((p) => p.bot).length <
        Math.min(this.options.fill ? (this.options.capacity||8) : this.options.bots,this.botLimit??Infinity) &&
      [...this.players.values()].filter(p=>!p.lateSpectator).length < (this.maxPlayers || 8)
    ) {
      const id = "bot-" + i++;
      if (this.players.has(id)) continue;
      this.addPlayer(
        id,
        {
          name: this.uniqueBotName(BOT_NAMES[(i - 1) % BOT_NAMES.length]),
          weapon: WEAPONS[(i + this.round) % 7].id,
          ...randomAppearance(this.random),
        },
        true,
      );
    }
  }
  configure(options) {
    if (this.phase === "playing") return false;
    const next = matchOptions(options);
    for (const p of [...this.players.values()]) if (p.bot) this.removePlayer(p.id);
    this.options = next;
    this.map = getMap(next.map,this.mapLayouts);
    this.nav = navigation(this.map);
    this.remaining = next.minutes * 60;
    return true;
  }
  startRound() {
    this.phase = "playing";
    this.round++;
    this.remaining = this.options.minutes * 60;
    this.scores = [0, 0];
    this.projectiles = [];
    this.winner = "";
    this.pickups = this.map.pickups.map(([x, z, type], id) => ({
      id,
      x,
      z,
      y: surfaceAt(this.map, x, z),
      type,
      availableAt: 0,
    }));
    this.addBots();
    for (const p of this.players.values()) {
      p.activity=newActivity(this.time);p.afkRemoved=false;
      if(p.friendSpectator){Object.assign(p,{health:0,spectating:true,lateSpectator:true,awaitingEntry:false});continue;}
      p.eggs = 0;
      p.kills = 0;
      p.deaths = 0;
      p.points = 0;
      p.assists = 0;
      p.streak = 0;
      this.spawn(p);
      if (!p.bot) this.waitForEntry(p);
    }
    this.emit("round", { round: this.round });
  }
  waitForEntry(p) {
    p.health = 0;
    p.awaitingEntry = true;
    p.spawnRequested = false;
    p.respawnAt = 0;
    p.killerId = null;
    p.nextPlayerAction = 0;
    this.inputs.delete(p.id);this.remoteInputs.delete(p.id);
  }
  teamAppearance(p) {
    if(this.options.mode==='teams') Object.assign(p,{color:p.team===0?'#3d8ce8':'#d94949',accent:p.team===0?'#3d8ce8':'#d94949',pattern:0});
  }
  playerAction(id, action) {
    const p = this.players.get(id);
    if(p&&action==='emote-cancel'){cancelEmote(p);return;}
    if(p&&action.startsWith('emote-')&&['playing','results'].includes(this.phase)){startEmote(this,p,action.slice(6));return;}
    if(watcherAction(this,p,action))return;
    if(p?.friendSpectator)return;
    if (!p || p.bot || this.phase !== "playing" ||
        this.time < (p.nextPlayerAction || 0)) return;
    if(/^team-entry-[01]$/.test(action)) {
      if(this.options.mode!=='teams'||(!p.awaitingEntry&&!p.spectating))return;
      const counts=[0,0];
      for(const other of this.players.values())if(other.id!==id&&!other.spectating)counts[other.team]++;
      const mate=p.partyId&&[...this.players.values()].find(o=>o!==p&&o.partyId===p.partyId&&!o.spectating);
      const requested=mate?.team??Number(action.slice(-1));
      p.team=mate?mate.team:counts[requested]-counts[1-requested]>=2?1-requested:requested;
      this.teamAppearance(p);
      action='rejoin';
    }
    if (!["respawn", "spectate", "rejoin"].includes(action)) return;
    if (action === "rejoin" && !p.spectating && !p.awaitingEntry) return;
    if (action === "respawn" && p.spectating) return;
    p.nextPlayerAction = this.time + 1;
    const wasAlive = p.health > 0;
    const wasSpectating = p.spectating;
    this.inputs.delete(id);this.remoteInputs.delete(id);
    this.projectiles = this.projectiles.filter(b => b.owner !== id);
    p.reloadEnd = 0;
    p.burstLeft = 0;
    p.moving = false;
    resetBonuses(p);
    p.health = 0;
    p.spectating = action === "spectate";
    p.spawnRequested = !p.spectating;
    if (p.spectating) p.killerId = null;
    if (wasAlive || wasSpectating) p.respawnAt = this.time + 3;
    this.emit("player-action", {player: id, action});
  }
  spawn(p) {
    if(this.options.weaponPool==='precision'&&!['anchor','peeper','needle'].includes((p.nextProfile||p).weapon)){p.weapon='anchor';if(p.nextProfile)p.nextProfile.weapon='anchor';}if(this.options.weaponPool==='close'&&!['scatter','doubleyolk','zipper','pip'].includes((p.nextProfile||p).weapon)){p.weapon='zipper';if(p.nextProfile)p.nextProfile.weapon='zipper';}
    resetStance(p);
    resetBonuses(p);
    if (p.spectating) { p.health = 0; return; }
    if (p.nextProfile) {
      Object.assign(p, p.nextProfile);
      delete p.nextProfile;
    }
    this.teamAppearance(p);
    const spot=this.safeSpawn(p);
    if(!spot){p.health=0;p.spawnRequested=true;p.respawnAt=this.time+.5;return;}
    Object.assign(p, spot, {
      vy: 0,
      yaw: spot.yaw,
      pitch: 0,
      grounded: true,
      jumpLatch: false,
      health: COMBAT_LIMITS.arenaHealth,
      awaitingEntry: false,
      spawnRequested: false,
      slot: 0,
      ammo: [weapon(p.weapon).magazine, weapon("pip").magazine],
      reserve: [weapon(p.weapon).reserve, weapon("pip").reserve],
      reloadEnd: 0,
      nextShot: 0,weaponCooldowns:{},shotgunReadyAt:0,pendingFireUntil:0,lastFirePress:0,burstWeapon:null,
      burstLeft: 0,
      fireLatch: false,
      accuracyState: [{}, {}],
      poppers: 2,
      nextPopper: 0,
      shieldUntil: this.time + 2.3,
      lastDamage: this.time,
      respawnAt: 0,
      killerId: null,
      crown: null,emote:null,
    });
    beginEquip(p,this.time);
    this.inputs.delete(p.id);this.remoteInputs.delete(p.id);
    p.brain = null;
    p.botPath = [];
    p.botThink = 0;
    p.arenaIntent = null;
    p.botTarget = null;
    this.emit("spawn", { player: p.id, x: p.x, y: p.y, z: p.z });
  }
  tickActivity(dt){
    if(this.phase!=='playing')return;
    for(const p of this.players.values()){
      if(p.bot||p.afkRemoved)continue;
      const a=p.activity??=newActivity(this.time);
      // Reconnects, loading/entry, the transport and eliminated spectators are
      // controlled by the game. They never accrue participation or idle debt.
      if(p.loading||p.connected===false||p.awaitingEntry||p.spectating||p.health<=0||p.flight==='transport'||this.recovering){a.last=this.time;p.afkRemaining=59;continue;}
      observeMotion(a,p,dt,this.time);p.afkRemaining=Math.ceil(activityRemaining(a,this.time));
      if(p.afkRemaining<=0){p.afkRemoved=true;p.spectating=true;p.contestant=false;p.health=0;p.activity.active=0;this.inputs.delete(p.id);this.remoteInputs.delete(p.id);this.emit('afk-removed',{player:p.id});}
    }
  }
  tick(dt) {
    dt = clamp(dt, 0, 1 / 30);
    this.time += dt;
    this.recordPoses();this.tickActivity(dt);
    if (this.phase !== "playing") {for(const p of this.players.values())if(p.emote)emoteInput(this,p,this.inputs.get(p.id)||{});return;}
    this.remaining = Math.max(0, this.remaining - dt);
    for (const p of this.players.values()) {
      if (p.spectating) continue;
      if (p.health <= 0) {
        if ((p.bot || p.spawnRequested) && this.time >= p.respawnAt) this.spawn(p);
        continue;
      }
      if(arenaBonuses(this.options.mode))updateBonuses(p,this.time,dt);
      const commands = p.bot ? null : this.movementInput(p,dt);
      let input = commands?.input || (p.bot ? this.botInput(p) : this.inputs.get(p.id));
      if (!input || (!p.bot && this.time - p.lastInput > 0.4))
        input = { yaw: p.yaw, pitch: p.pitch, slot: p.slot };
      input=emoteInput(this,p,input);p.executedShotTime=input.shotTime;
      if (input.slot !== undefined && input.slot !== p.slot) {
        p.slot = input.slot === 1 ? 1 : 0;
        p.reloadEnd = 0;
        p.burstLeft = 0;
        beginEquip(p,this.time,true);
      }
      const previousPosition = { x: p.x, y: p.y, z: p.z };
      this.moveWithCommands(p,input,dt,p.emote&&commands?{...commands,steps:commands.steps.map(step=>({...step,yaw:p.emote.yaw,pitch:0,forward:0,strafe:0}))}:commands);
      p.vx=(p.x-previousPosition.x)/dt;p.vz=(p.z-previousPosition.z)/dt;
      p.moving = Math.hypot(p.x - previousPosition.x, p.z - previousPosition.z) > 0.001;

      p.aim = !!input.aim;
      this.updateAccuracy(p, previousPosition, dt);
      if (this.time - p.lastDamage > 6 && p.health < 100)
        p.health = Math.min(100, p.health + 8 * dt);
      if (p.reloadEnd && this.time >= p.reloadEnd) {
        const add = Math.min(
          gun(p).magazine - p.ammo[p.slot],
          p.reserve[p.slot],
        );
        p.ammo[p.slot] += add;
        p.reserve[p.slot] -= add;
        p.reloadEnd = 0;
      }
      this.combatInput(p,input);
      p.fireLatch = !!input.fire && this.time >= (p.equipUntil || 0);
      if (
        input.popper &&
        !p.popperLatch &&
        p.poppers > 0 &&
        this.time >= p.nextPopper
      ) {
        p.poppers--;
        p.nextPopper = this.time + UTILITY_WEAPONS.popper.interval;
        this.launch(p, true);
        p.shieldUntil = 0;
      }
      p.popperLatch = !!input.popper;
      this.collect(p);
    }
    this.updateProjectiles(dt);

    if (this.remaining <= 0) this.finish();
    const m = mode(this.options.mode);
    if (
      (m.teams && Math.max(...this.scores) >= this.options.scoreLimit) ||
      (!m.teams && [...this.players.values()].some((p) => p.kills >= this.options.scoreLimit))
    )
      this.finish();
  }
  combatInput(p,input){
    const w=gun(p),requested=triggerRequested(p,w,input,this.time);
    if(input.reload||input.fire&&p.ammo[p.slot]===0)this.reload(p);
    if(p.burstLeft&&this.time+1e-9>=p.burstTime){
      if(this.fire(p,true)){p.burstLeft--;p.burstTime=this.time+w.burstInterval;}
      else if(p.reloadEnd||p.ammo[p.slot]<=0)p.burstLeft=0;
    }
    if(requested&&!p.burstLeft)this.fire(p);
  }
  reload(p){
    const w=gun(p);
    if(!canFight(p)||this.time<(p.equipUntil||0)||p.reloadEnd||p.reserve[p.slot]<=0||p.ammo[p.slot]>=w.magazine)return false;
    p.reloadStarted=this.time;p.reloadDuration=p.ammo[p.slot]===0?w.reloadEmpty:w.reload;
    p.reloadEnd=this.time+p.reloadDuration;p.burstLeft=0;p.burstWeapon=null;
    this.emit('reload',{player:p.id,weapon:w.id,duration:p.reloadDuration});return true;
  }
  recordPoses(){
    this.poseHistory??=new Map();
    for(const p of this.players.values()){let h=this.poseHistory.get(p.id);if(!h){h=[];this.poseHistory.set(p.id,h);}if(h.at(-1)?.time>this.time-1/30)continue;h.push({time:this.time,x:p.x,y:p.y,z:p.z,yaw:p.yaw,flight:p.flight,vx:p.vx,vz:p.vz,sprinting:p.sprinting,crouching:p.crouching,lowCrouch:p.lowCrouch,sliding:p.sliding,downed:p.downed});while(h.length>10)h.shift();}
    for(const id of this.poseHistory.keys())if(!this.players.has(id))this.poseHistory.delete(id);
  }
  shotPose(target,shooter,w){
    const requested=shooter.executedShotTime??this.inputs.get(shooter.id)?.shotTime;
    if(!w.hitscan||shooter.bot||!this.remoteInputs.has(shooter.id)||!Number.isFinite(requested))return target;
    const time=clamp(requested,this.time-COMBAT_LIMITS.lagCompensation,this.time),history=this.poseHistory?.get(target.id);
    if(!history?.length)return target;
    const after=history.find(v=>v.time>=time)||history.at(-1),before=history.findLast(v=>v.time<=time)||history[0],f=clamp((time-before.time)/(after.time-before.time||1),0,1);
    if(Math.hypot(target.x-before.x,target.y-before.y,target.z-before.z)>5)return target;
    return {...target,yaw:before.yaw??target.yaw,flight:before.flight??target.flight,vx:before.vx??target.vx,vz:before.vz??target.vz,sprinting:before.sprinting??target.sprinting,crouching:before.crouching??target.crouching,lowCrouch:before.lowCrouch??target.lowCrouch,sliding:before.sliding??target.sliding,downed:before.downed??target.downed,x:before.x+(after.x-before.x)*f,y:before.y+(after.y-before.y)*f,z:before.z+(after.z-before.z)*f};
  }
  updateAccuracy(p, previous, dt) {
    const w=gun(p),a=p.accuracyState[p.slot]??={};
    updateCombatAccuracy(p,w,a,dt,this.time,p.motionFresh?Math.hypot(p.motionVX||0,p.motionVZ||0):Math.hypot(p.x-previous.x,p.z-previous.z)/Math.max(dt,1e-9));
    p.recoilPitch=a.recoilPitch;p.recoilYaw=a.recoilYaw;
  }
  shotPath(p, w, directionOverride = null) {
    const eye = { x: p.x, y: p.y + eyeHeight(p), z: p.z },
      aim = directionOverride || direction(p.yaw, p.pitch);
    let distance = wallDistance(this.map, eye, aim, (w.flightRange??w.range));
    for (const target of this.players.values())
      if (
        target !== p &&
        target.health > 0 &&
        !teammates(this.options,p,target)
      )
        distance = Math.min(distance, rayEgg(eye, aim, this.shotPose(target,p,w)));
    const target = {
      x: eye.x + aim.x * distance,
      y: eye.y + aim.y * distance,
      z: eye.z + aim.z * distance,
    };
    let origin = muzzleOrigin(p, w);
    const offset = {
        x: origin.x - eye.x,
        y: origin.y - eye.y,
        z: origin.z - eye.z,
      },
      length = Math.hypot(offset.x, offset.y, offset.z);
    const blocked = worldHit(
      this.map,
      eye,
      { x: offset.x / length, y: offset.y / length, z: offset.z / length },
      length,
    );
    // Retract to the eye when a ledge obstructs the muzzle or the target is
    // closer than the barrel. The eye ray still collides with actual cover.
    if (blocked || distance <= length) origin = eye;
    const delta = {
        x: target.x - origin.x,
        y: target.y - origin.y,
        z: target.z - origin.z,
      },
      len = Math.hypot(delta.x, delta.y, delta.z);
    return {
      origin,
      d: len > 1e-8 ? { x: delta.x / len, y: delta.y / len, z: delta.z / len } : aim,
      blocked: null,
    };
  }
  fire(p, burst = false) {
    const w=gun(p);
    if(!canFight(p)||p.sprinting||p.sprintRecovery>0||p.traversal||p.ammo[p.slot]<=0||p.reloadEnd||this.time+1e-9<(p.equipUntil||0))return false;
    if(burst){if(!w.burst||p.burstWeapon!==w.id||!p.burstLeft||this.time+1e-9<p.burstTime||this.time-(p.lastBurstShotAt??-100)+1e-9<w.burstInterval)return false;}
    else {if(p.burstLeft||this.time+1e-9<Math.max(p.nextShot||0,weaponReadyAt(p,w)))return false;
      p.shotGroup=++this.shotId;rememberShot(p,w,this.time);p.pendingFireUntil=0;
      if(w.burst){p.burstWeapon=w.id;p.burstLeft=w.burst-1;p.burstTime=this.time+w.burstInterval;}}
    p.lastBurstShotAt=this.time;p.ammo[p.slot]--;p.shieldUntil=0;
    const accuracy=p.accuracyState[p.slot]??={},spread=accuracy.spread??(p.aim?w.adsSpread:w.spread);
    const pitch=accuracy.recoilPitch||0,yaw=accuracy.recoilYaw||0,serial=firedAccuracy(p,w,accuracy,this.time);
    p.recoilPitch=accuracy.recoilPitch;p.recoilYaw=accuracy.recoilYaw;
    if(w.projectile){this.launch(p,false,spread,{pitch,yaw});return true;}
    const shots=[],offsets=pelletOffsets(w.pellets,spread,serial*7919+(p.joinedOrder||0)*31,w.patternFixed);
    let origin=muzzleOrigin(p,w),blocked=false;
    for(const offset of offsets){
      const aim=direction(p.yaw+yaw+offset.yaw,p.pitch+pitch+offset.pitch),path=this.shotPath(p,w,aim);
      origin=path.origin;
      if(path.blocked){blocked=true;if(path.blocked.box)this.damageWorld?.(path.blocked.box,structureDamage(w,path.blocked.distance||0));this.emit('impact',{...path.blocked.point,normal:path.blocked.normal,surface:path.blocked.box?.material||'stone',weapon:w.id});continue;}
      if(w.hitscan){
        const hit=worldHit(this.map,origin,path.d,w.range);
        let distance=hit?.distance??w.range,victim=null,pose=null,region=null;
        for(const target of this.players.values()){
          if(target===p||target.health<=0||target.spectating||target.flight==='transport'||teammates(this.options,p,target))continue;
          const candidate=this.shotPose(target,p,w),contact=humanHit(origin,path.d,candidate),d=contact.distance;
          if(d<distance){distance=d;victim=target;pose=candidate;region=contact.region;}
        }
        const point={x:origin.x+path.d.x*distance,y:origin.y+path.d.y*distance,z:origin.z+path.d.z*distance};
        if(victim){const critical=w.critical>1&&region==='head';this.damage(victim,p,w.damage*falloffAt(w,distance)*(critical?w.critical:1),w.name,critical,p.shotGroup);}
        else if(hit?.box)this.damageWorld?.(hit.box,structureDamage(w,distance));
        shots.push({id:++this.projectileId,vx:path.d.x*w.tracerSpeed,vy:path.d.y*w.tracerSpeed,vz:path.d.z*w.tracerSpeed,end:point});
        if(victim||hit)this.emit('impact',{...point,normal:victim?{x:-path.d.x,y:-path.d.y,z:-path.d.z}:hit.normal,weapon:w.id,surface:hit?.box?.material||'stone',tag:!!victim});
      }else{
        const b={id:++this.projectileId,owner:p.id,shotId:p.shotGroup,weapon:w.id,kind:'bolt',...origin,vx:path.d.x*w.boltSpeed,vy:path.d.y*w.boltSpeed,vz:path.d.z*w.boltSpeed,gravity:w.gravity,hitRadius:w.hitRadius,buildFalloff:w.buildFalloff,damage:w.damage,critical:w.critical,buildDamage:w.buildDamage,range:w.flightRange,born:this.time,fuse:w.flightRange/w.boltSpeed,travelled:0,popper:false};
        this.projectiles.push(b);shots.push({id:b.id,vx:b.vx,vy:b.vy,vz:b.vz});
      }
    }
    this.emit('shot',{player:p.id,weapon:w.id,origin,shots,blocked});return true;
  }
  launch(p, popper, spread = 0, recoil = {}) {
    const w = gun(p),
      aim = direction(p.yaw + (recoil.yaw||0) + (this.random() - 0.5) * spread, p.pitch + (recoil.pitch||0) + (this.random() - 0.5) * spread),
      path = this.shotPath(p, w, aim),
      d = popper ? direction(p.yaw, p.pitch) : path.d;
    const origin = popper
      ? { x: p.x, y: p.y + eyeHeight(p) - 0.15, z: p.z }
      : path.origin;
    if (!popper && path.blocked) {
      this.emit("impact", {
        ...path.blocked.point,
        normal: path.blocked.normal,
        weapon: w.id,
      });
      this.emit("launch", {
        player: p.id,
        popper,
        weapon: w.id,
        origin,
        blocked: true,
      });
      return;
    }
    const config=popper?UTILITY_WEAPONS.popper:w,speed=popper?config.speed:w.boltSpeed;
    this.projectiles.push({
      id: ++this.projectileId,
      owner: p.id,
      shotId:popper?++this.shotId:p.shotGroup,
      weapon: popper ? "popper" : w.id,
      kind: "shell",
      ...origin,
      vx: d.x * speed,
      vy: d.y * speed + (popper ? config.lift : 0),
      vz: d.z * speed,
      gravity:config.gravity,hitRadius:config.hitRadius,
      damage:config.damage,buildDamage:config.buildDamage,
      range: config.flightRange??config.range,
      born: this.time,
      fuse: popper ? config.fuse : (w.flightRange??w.range) / speed,
      travelled: 0,
      popper,
      bounces: 0,
      resting: false,
    });
    this.emit("launch", { player: p.id, popper, weapon: w.id, origin });
  }
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      if (b.popper ? this.time - b.born >= b.fuse : this.time - b.born > b.fuse + dt + 1e-9) {
        if (b.kind !== "bolt") this.explode(b);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (b.resting) continue;
      const dy = b.vy * dt - 0.5 * b.gravity * dt * dt;
      b.vy -= b.gravity * dt;
      const remaining = b.popper ? Infinity : Math.max(0, (b.range ?? weapon(b.weapon).range) - (b.travelled || 0)),
        fraction = Math.min(1, remaining / (Math.hypot(b.vx * dt, dy, b.vz * dt) || 1)),
        delta = { x: b.vx * dt * fraction, y: dy * fraction, z: b.vz * dt * fraction },
        length = Math.hypot(delta.x, delta.y, delta.z);
      if (length < 1e-8) {
        if (!b.popper && b.kind !== "bolt") this.explode(b);
        if (!b.popper) this.projectiles.splice(i, 1);
        continue;
      }
      const d = {
        x: delta.x / length,
        y: delta.y / length,
        z: delta.z / length,
      };
      const hit = worldHit(
        this.map,
        b,
        d,
        length,
        b.hitRadius??(b.popper?UTILITY_WEAPONS.popper.hitRadius:weapon(b.weapon).hitRadius),
      );
      let distance = hit?.distance ?? length,
        victim = null,region=null;
      const attacker = this.players.get(b.owner);
      if (!b.popper)
        for (const p of this.players.values()) {
          if (
            p.id === b.owner ||
            p.health <= 0 ||p.spectating||p.flight==='transport'||
            teammates(this.options,p,attacker)
          )
            continue;
          const contact=humanHit(b,d,p,b.hitRadius??weapon(b.weapon).hitRadius),t=contact.distance;
          if (Number.isFinite(t) && t <= distance + 1e-9 && t <= length + 1e-9) {
            distance = t;
            victim = p;region=contact.region;
          }
        }
      b.x += d.x * distance;
      b.y += d.y * distance;
      b.z += d.z * distance;
      b.travelled = (b.travelled || 0) + distance;
      if (victim || hit) {
        if (b.kind === "bolt") {
          if (victim) {
            const w=weapon(b.weapon),precision=(b.critical??w.critical)>1&&region==='head',hitFactor=falloffAt(w,b.travelled)*(precision?(b.critical??w.critical):1);
            this.damage(
              victim,
              attacker,
              b.damage * hitFactor,
              w.name,
              precision, b.shotId,
            );
          }
          if(!victim&&hit?.box)this.damageWorld?.(hit.box,(b.buildDamage??weapon(b.weapon).buildDamage)*((b.buildFalloff??weapon(b.weapon).buildFalloff)?falloffAt(weapon(b.weapon),b.travelled):1));
          this.emit("impact", {
            x: b.x,
            y: b.y,
            z: b.z,
            normal: victim ? { x: -d.x, y: -d.y, z: -d.z } : hit.normal,
            weapon: b.weapon,
            surface:hit?.box?.material||'stone',
            tag: !!victim,
          });
          this.projectiles.splice(i, 1);
        } else if (b.popper) {
          const n = hit.normal,
            dot = b.vx * n.x + b.vy * n.y + b.vz * n.z;
          b.vx = (b.vx - 1.58 * dot * n.x) * 0.82;
          b.vy = (b.vy - 1.58 * dot * n.y) * 0.82;
          b.vz = (b.vz - 1.58 * dot * n.z) * 0.82;
          b.x += n.x * 0.012;
          b.y += n.y * 0.012;
          b.z += n.z * 0.012;
          b.bounces++;
          if (n.y > 0.5 && Math.hypot(b.vx, b.vy, b.vz) < 1.5) {
            b.resting = true;
            b.vx = b.vy = b.vz = 0;
          }
          this.emit("bounce", { x: b.x, y: b.y, z: b.z, normal: n });
        } else {
          this.explode(b);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }
  explode(b) {
    const attacker = this.players.get(b.owner),
      config=b.popper?UTILITY_WEAPONS.popper:weapon(b.weapon),radius=config.splashRadius;
    if (!b.popper && (b.travelled || 0) < config.minRange) return;
    this.emit("explosion", { x: b.x, y: b.y, z: b.z, popper: b.popper });
    for (const p of this.players.values()) {
      if (
        p.health <= 0 ||p.spectating||p.flight==='transport'||
        teammates(this.options,p,attacker)
      )
        continue;
      const to = { x: p.x - b.x, y: p.y + 0.85 - b.y, z: p.z - b.z },
        distance = Math.hypot(to.x, to.y, to.z);
      if (distance > radius) continue;
      const d = {
        x: to.x / (distance || 1),
        y: to.y / (distance || 1),
        z: to.z / (distance || 1),
      };
      if (wallDistance(this.map, b, d, distance) < distance - 0.2) continue;
      this.damage(
        p,
        attacker,
        (b.damage??config.damage)*Math.max(0,1-distance/(radius*config.splashFalloff))*(p===attacker?config.selfDamage:1),
        b.popper ? "Frag Grenade" : weapon(b.weapon||"thumper").name, false, b.shotId,
      );
    }
  }
  damage(victim, attacker, amount, source, precision = false, shotId = null) {
    if (victim.health <= 0 || this.time < victim.shieldUntil) return;
    if(teammates(this.options,attacker,victim))return;
    let absorbed=0;
    if(arenaBonuses(this.options.mode)) {
      if(attacker?.damageUntil>this.time && attacker!==victim)amount*=2;
      if(victim.health<=100){absorbed=Math.min(victim.streakArmor||0,amount);victim.streakArmor-=absorbed;amount-=absorbed;}
    }
    const applied = absorbed + Math.min(victim.health, amount);
    if(attacker&&attacker!==victim){victim.damageLedger??={};victim.damageLedger[attacker.id]=this.time;}
    victim.health = Math.max(0, victim.health - amount);
    victim.lastDamage = this.time;
    if(source!=='Storm'||this.time>=(victim.stormFeedbackAt||0)){
    if(source==='Storm')victim.stormFeedbackAt=this.time+.5;
    this.emit("hit", {
      player: attacker?.id,
      target: victim.id,
      amount: applied, shotId, weapon:source,
      sourceX:attacker?.x, sourceY:attacker?.y, sourceZ:attacker?.z,
      x: victim.x, y: victim.y + 1.28, z: victim.z,
      precision,
    });
    }
    if (victim.health > 0) return;
    attacker=this.eliminationCredit?.(victim,attacker)||attacker;
    victim.recap={weapon:source,damage:Math.round(applied),distance:attacker?Math.round(dist(victim,attacker)):0,critical:!!precision,name:attacker?.name||source};
    victim.killerId = attacker && attacker !== victim ? attacker.id : null;
    for(const [id,time] of Object.entries(victim.damageLedger||{})){const helper=this.players.get(id);if(helper&&id!==victim.killerId&&this.time-time<12)helper.assists=(helper.assists||0)+1;}victim.damageLedger={};
    victim.deaths++;
    resetBonuses(victim);
    victim.respawnAt = this.time + 3;
    victim.spawnRequested = false;
    victim.reloadEnd = 0;
    victim.burstLeft = 0;

    if (attacker && attacker !== victim) {
      attacker.kills++;
      attacker.streak++;
      attacker.points += 100;
      awardBonus(this,attacker);
      if (this.options.mode === "teams") this.scores[attacker.team]++;
    }
    this.emit("elimination", {
      player: attacker?.id,
      target: victim.id,
      name: attacker?.name || "Arena",
      targetName: victim.name,
      weapon: source,
      x: victim.x,
      y: victim.y,
      z: victim.z,
      streak: attacker?.streak || 0,
    });
  }
  collect(p) {
    for (const item of this.pickups) {
      if (this.time < item.availableAt || dist(p, item) > 1.65) continue;
      if (item.type === "health") {
        if (p.health >= 100) continue;
        p.health = Math.min(100, p.health + 45);
      }
      if (item.type === "ammo") {
        const loadout = [weapon(p.weapon), weapon("pip")];
        if (loadout.every((w, slot) => p.reserve[slot] >= w.reserve)) continue;
        p.reserve = loadout.map((w, slot) => Math.min(w.reserve, p.reserve[slot] + w.ammoPickup));

      }
      if (item.type === "popper") {
        if (p.poppers >= 3) continue;
        p.poppers++;
      }
      item.availableAt = this.time + 15;
      this.emit("pickup", { player: p.id, kind: item.type });
    }
  }
  finish() {
    if (this.phase !== "playing") return;
    this.phase = "results";
    if (mode(this.options.mode).teams)
      this.winner =
        this.scores[0] === this.scores[1]
          ? "A perfect tie"
          : this.scores[0] > this.scores[1]
            ? "Blue team wins"
            : "Red team wins";
    else {
      const sorted = [...this.players.values()].sort(
        (a, b) => b.kills - a.kills,
      );
      this.winner =
        !sorted[0] || sorted[0].kills === sorted[1]?.kills
          ? "A perfect tie"
          : sorted[0].name + " wins";
    }
    this.emit("finish", { winner: this.winner });
  }
  botInput(p) {
    return scheduledBotInput(this,p,()=>tacticalBotInput(this,p));
  }
  uniqueBotName(base) {
    let name=base,i=2;while([...this.players.values()].some(p=>nameKey(p.name)===nameKey(name)))name=base+' '+i++;
    return name;
  }
  assignTeam(p,admission){
    if(!admission)return;p.partyId=admission.partyId;p.partySize=admission.partySize;
    if(this.options.mode==='teams'){const mate=[...this.players.values()].find(o=>o!==p&&o.partyId===p.partyId);if(mate)p.team=mate.team;this.teamAppearance(p);}
  }
  admitPlayer(id,profile,admission=null) {
    if(this.players.has(id))return this.players.get(id);
    if([...this.players.values()].some(p=>!p.bot&&nameKey(p.name)===nameKey(profile.name)))return null;
    if(admission?.spectator){const p=this.addPlayer(id,profile,false,true);if(p)Object.assign(p,{watchId:admission.watchId,partyId:admission.partyId,memberId:admission.memberId});return p;}
    for(const p of this.players.values())if(p.bot&&nameKey(p.name)===nameKey(profile.name))p.name=this.uniqueBotName(p.name+' Bot');
    const capacity=this.options.capacity||8;
    if([...this.players.values()].filter(p=>!p.lateSpectator).length>=capacity){const bot=[...this.players.values()].find(p=>p.bot);if(!bot)return null;this.players.delete(bot.id);this.inputs.delete(bot.id);}
    const p=this.addPlayer(id,profile);if(p)this.assignTeam(p,admission);return p;
  }
  leavePlayer(id) { this.removePlayer(id); if(this.phase==='playing')this.addBots(); }
  safeSpawn(p) {
    const living=[...this.players.values()].filter(e=>e!==p&&e.health>0&&!e.spectating);
    const teams=mode(this.options.mode).teams;
    let best=null,score=-Infinity;
    for(const q of arenaSpawnPoints(this.map)){
      if(living.some(e=>dist(q,e)<7))continue;
      const {clear,yaw}=q;
      const nearest=Math.min(45,...living.map(e=>dist(q,e)));
      const value=nearest+clear+(teams&&((q.x<0)===(p.team===0))?8:0)+this.random()*3;
      if(value>score){score=value;best={x:q.x,y:q.y,z:q.z,yaw};}
    }
    return best;
  }
  checkpoint(exclude=[]) {
    const skip=new Set(['map','nav','random','players','inputs','remoteInputs','events','poseHistory',...exclude]);
    const data=Object.fromEntries(Object.entries(this).filter(([key,value])=>!skip.has(key)&&typeof value!=='function'));
    return structuredClone({...data,players:[...this.players.values()],events:this.events,randomState:this.random.state()});
  }
  restore(checkpoint) {
    const {players,randomState,...fields}=structuredClone(checkpoint);
    Object.assign(this,fields);this.players=new Map(players.map(p=>[p.id,p]));this.inputs=new Map();this.remoteInputs=new Map();
    this.mapLayouts=validateLayoutBundle(this.mapLayouts||{});this.mapLayoutKey=mapBundleKey(this.mapLayouts);
    this.map=getMap(this.options.map,this.mapLayouts);this.nav=navigation(this.map);this.random=rng(1);this.random.restore(randomState);
    for(const p of this.players.values()){p.fireLatch=false;p.popperLatch=false;p.lastInput=this.time;}
    return this;
  }
  snapshot() {
    const keys = [
      'friendSpectator','lateSpectator','watchId','sprinting','tacticalSprint','sprintBlend','sprintRecovery','stamina','sprintRest','exhausted',
      'crouching','lowCrouch','sliding','crouchLatch','slideVX','slideVZ','slideAge','slideCooldown','downed','lifeState','downedAt','revivedAt','downCount','reviving','reviverId','reviveProgress','revives','connected','teamSlot',
      "afkRemaining", "afkRemoved", "lastDamage", "assists", "quickstep", "focus",
      "id", "joinedOrder", "vx", "vz", "place",
      "name",
      "weapon",
      "color",
      "hat",
      "pattern",
      "finish",
      "eyewear",
      "accent",
      "outfit", "wrap", "pickaxe", "backbling", "glider", "trail",
      "bot",
      "team",
      "x",
      "y",
      "z",
      "vy",
      "yaw",
      "pitch",
      "grounded",
      "jumpLatch",
      "lastJumpPress", "nextShot", "fireLatch", "weaponCooldowns", "shotgunReadyAt", "pendingFireUntil", "lastFirePress", "burstWeapon", "burstLeft", "burstTime",
      "health",
      "kills",
      "deaths",
      "points",
      "streak", "eggs", "streakArmor", "damageUntil", "eggsUntil", "miniUntil", "restockUntil", "bodyScale",
      "slot",
      "ammo",
      "reserve",
      "reloadEnd", "reloadStarted", "reloadDuration",
      "equipStarted",
      "equipHolster",
      "equipUntil",
      "poppers",
      "shieldUntil",
      "respawnAt",
      "killerId", "watchingId", "recap", "boss", "maxHealth", "maxShield",
      "spectating",
      "awaitingEntry",
      "spawnRequested",
      "moving",
      "crown", "emote", "crownWins", "crownEmoteUnlocked", "crownedVictory",
      "ack",
      "aim",
    ];
    return {
      version: VERSION,
      mapLayouts:this.mapLayouts,mapLayoutKey:this.mapLayoutKey,
      time: this.time,
      round: this.round,
      phase: this.phase,
      options: this.options,
      remaining: this.remaining,
      scores: this.scores.map((v) => Math.floor(v)),
      winner: this.winner,
      players: [...this.players.values()].map((p) => {
        const row={inputQueue:this.remoteInputs.get(p.id)?.queue.length||0};
        for(const key of keys){const value=p[key];row[key]=Array.isArray(value)?value.slice():key==='weaponCooldowns'?{...value}:value;}
        return Object.assign(row,{
        shotSpread: p.accuracyState[p.slot]?.spread ?? gun(p).spread * (p.aim ? gun(p).aimSpread : 1),
        recoilPitch:p.recoilPitch||0,recoilYaw:p.recoilYaw||0,firstShot:!!p.accuracyState[p.slot]?.firstShot,shotSerial:p.shotSerial||0,combatState:{...p.accuracyState[p.slot]},
      });}),
      projectiles: this.projectiles.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        z: b.z,
        popper: b.popper,
        kind: b.kind,
        weapon: b.weapon,
        owner: b.owner,
        vx: b.vx,
        vy: b.vy,
        vz: b.vz,gravity:b.gravity,hitRadius:b.hitRadius,
      })),
      pickups: this.pickups.map((p) => ({ ...p })),
      events: this.events.slice(-60),
    };
  }
}
import {teammates} from './teams.js';
