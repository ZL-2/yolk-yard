import {bindCrownStore,attachCrown} from '../../src/crowns.js';
import {settleZombiesPlayer} from './zombies-service.js';
import {timingPhase,roomTiming,recordTiming,startTiming,finishTiming} from './timing.js';
import {SnapshotInterest} from '../../src/snapshot-interest.js';
import {randomInt,randomUUID} from 'node:crypto';
import {Simulation} from '../../src/simulation.js';
import {RoyaleSimulation} from '../../src/royale.js';
import {VERSION,safeProfile,nameKey} from '../../src/data.js';
import {matchOptions} from '../../src/match-options.js';
import {modeAvailable,PAUSED_MODES} from '../../src/mode-availability.js';
import {SnapshotEncoder,SnapshotBatch} from '../../src/snapshot-codec.js';
import {ChatRoom} from '../../src/chat.js';
import {rewardFrame} from '../../src/rewards.js';
import {visibleMarkers} from '../../src/team-markers.js';
import {isTeamRoyale} from '../../src/teams.js';
import {acceptsContestants,isWarmup,MAX_HUMANS,MAX_SPECTATORS} from '../../src/royale-phases.js';
import {publicWindow} from '../../src/season-one.js';
import {PUBLIC_ROYALE,publicRoyaleOptions} from '../../src/public-royale.js';
import {MatchCapacity,busyMessage} from './capacity.js';
const address=new RegExp('^yolk-yard-v'+VERSION+'-([A-Z2-9]{8})$');
// The relay owns simulation and persistent room lifetime. Browsers submit bounded
// input/interaction intent only; even the room leader cannot submit game state.
export class MatchAuthority{
 constructor(relay){this.relay=relay;this.rooms=new Map();this.capacity=new MatchCapacity(this);this.last=performance.now();this.accumulator=0;this.timer=setInterval(()=>this.tick(),16);this.timer.unref?.();}
 roomFor(peer){return this.rooms.get(peer.authorityRoom);}
 connection(peer,connected){const room=this.roomFor(peer),p=room?.sim.players.get(peer.authorityId);if(p){p.connected=connected;if(p.activity)p.activity.last=room.sim.time;room.sim.advanceWarmupClock();}}
 send(peer,message,serialized){if(peer&&this.relay.peers.has(peer.id))this.relay.send(peer,message,serialized);}
 ensurePublicRoyale(){return this.relay.publicHost.enable();}

 get publicRoom(){return this.rooms.get(`yolk-yard-v${VERSION}-${PUBLIC_ROYALE.code}`);}
 publicSummary(){
  if(this.relay.publicHost?.enabled)return this.relay.publicHost.summary();
  const room=this.publicRoom;if(!room)return null;
  const sim=room.sim,players=[...sim.players.values()],warmup=sim.phase==='playing'&&acceptsContestants(sim.stage),results=sim.phase==='results';
  const humanPlayers=players.filter(p=>!p.bot&&!p.lateSpectator&&p.connected!==false).length;
  const spectators=players.filter(p=>!p.bot&&p.lateSpectator&&p.connected!==false).length;
  const countdownSeconds=warmup&&sim.queueEnds>0?Math.max(0,Math.ceil(sim.queueEnds-sim.time)):0;
  const estimatedSeconds=results?Math.max(0,Math.ceil((room.restartAt??room.age+PUBLIC_ROYALE.restartSeconds)-room.age)):Math.max(0,Math.ceil((sim.stormSteps.at(-1)?.end||600)+20-(warmup?0:sim.elapsed)))+countdownSeconds;
  const availability=publicWindow(this.now?.()??Date.now());
  return {availability,code:room.code,version:VERSION,joinSerial:room.joinSerial||0,round:sim.round,matchId:sim.matchId,stage:sim.stage,phase:sim.phase,capacity:sim.options.capacity,difficulty:sim.options.difficulty,humanPlayers,spectators,botPlayers:players.filter(p=>p.bot&&p.contestant).length,alive:warmup?sim.options.capacity:sim.alive,joinable:availability.open&&warmup,countdownStarted:!!(warmup&&sim.queueEnds),countdownSeconds,estimatedSeconds,restartSeconds:results?estimatedSeconds:0,availableSeats:Math.max(0,sim.options.capacity-this.capacity.humans(room)-this.capacity.pending(room.key)),availableSpectators:Math.max(0,MAX_SPECTATORS-this.capacity.spectators(room)-this.capacity.pending(room.key,true))};
 }
 create(peer,m){
  this.send(peer,{type:'authority-error',reason:'Custom matches run on the player host. The public Royale also runs on its elected player host; join it from Play.'});
 }
 connect(peer,other,channel){const room=this.rooms.get(other.id);if(!room)return false;this.send(peer,{type:'opened',channel});return true;}
 data(peer,other,entry){
  const room=this.rooms.get(other.id)||this.roomFor(peer);if(!room)return false;
  const m=entry.data;if(!m||typeof m!=='object')return true;
  if(m.type==='hello'){
   const reject=reason=>this.send(peer,{type:'data',channel:entry.channel,data:{type:'reject',reason}});
   if(!modeAvailable(room.sim.options.mode))return reject(PAUSED_MODES[room.sim.options.mode]),true;
   if(m.version!==VERSION||room.kicked.has(peer.progressId))return reject('Refresh the game or choose another room.'),true;
   const profile=safeProfile(m.profile);
   const admission=m.ticket?this.relay.parties.claim(m.ticket,peer.id,room.key):null;if(m.ticket&&!admission||(room.recurring||room.zombies||room.tournament)&&!admission)return reject('Party reservation expired. Join the match from Play.'),true;
   if([...room.sim.players.values()].some(p=>!p.bot&&p.id!==peer.id&&p.id!==admission?.reconnect&&nameKey(p.name)===nameKey(profile.name))){this.send(peer,{type:'data',channel:entry.channel,data:{type:'name-required',joining:true}});return true;}
   if(room.tournament&&!admission?.tournament)return reject('Use the tournament box in the lobby.'),true;
   Object.assign(profile,this.relay.progression.rankRewards.sanitizePeer(profile,peer,admission?.memberId));
   if(room.zombies&&!room.sim.players.has(peer.id)&&!admission?.spectator&&!room.sim.acceptsJoining())return reject('This deployment is closed to new operators.'),true;
   room.sim.advanceWarmupClock?.();
   const reserved=admission&&this.capacity.reservations.has(admission.partyId);
   const spectator=!!admission?.spectator||room.sim.options.mode==='royale'&&!acceptsContestants(room.sim.stage),added=room.sim.players.has(peer.id)?0:1;
   // Joining this fixed roster replaces a bot; it never allocates another room
   // or trims the promised 48 contestants through generic workload admission.
   const plan=room.recurring||room.tournament?{ok:!spectator||this.capacity.spectators(room)<MAX_SPECTATORS,reason:'The public spectator seats are full. Try again shortly.'}:this.capacity.plan(room.sim.options,{key:room.key,humans:this.capacity.humans(room)+this.capacity.pending(room.key)+(!spectator&&!reserved?added:0),spectators:this.capacity.spectators(room)+this.capacity.pending(room.key,true)+(spectator&&!reserved?added:0),botLimit:room.sim.botLimit});if(!plan.ok)return reject(plan.reason),true;
   if([...room.members.values()].some(o=>o!==peer&&o.ws&&o.progressId===peer.progressId))return reject('This saved player is already in the public match in another tab.'),true;
   const playerId=room.tournament&&admission?.reconnect||peer.id;
   if(playerId!==peer.id){const old=room.members.get(playerId);if(old){delete old.authorityRoom;delete old.authorityId;}room.encoders.delete(playerId);room.eventCursors.delete(playerId);}
   const p=room.sim.admitPlayer(playerId,profile,admission);if(!p)return reject('This room is full.'),true;
   if(room.tournament)this.relay.tournament.admitted(peer,p,admission);
   if(room.zombies){this.relay.progression.bindPublicPlayer(peer,admission.memberId,{participant:room.visibility!=='private',mode:'zombies'});if(!room.owner||admission.memberId===room.leaderSocial)room.owner=p.id;room.startedWaitingAt??=room.age;if(peer.progressId&&!p.zAccount)room.sim.bindAccount(p,this.relay.progression.account(peer.progressId));}
   if(room.recurring)attachCrown(room.sim,p,peer.progressId);
   if(room.recurring&&!room.members.has(p.id))room.joinSerial=(room.joinSerial||0)+1;
   peer.authorityRoom=room.key;peer.authorityId=p.id;peer.controlReady=false;p.loading=true;room.members.set(p.id,peer);room.sim.setConnectedHumans?.([...room.members].filter(([,p])=>p.ws).map(([id])=>id));
   this.send(peer,{type:'data',channel:entry.channel,data:{type:'welcome',id:p.id,hostId:room.owner,members:this.members(room),code:room.code,version:VERSION,serverAuthority:true}});this.broadcast(room);return true;
  }
  if(m.type==='ping'){this.send(peer,{type:'data',channel:entry.channel,data:{type:'pong',time:m.time}});return true;}
  if(this.roomFor(peer)===room)this.command(peer,{type:'authority-command',command:m});return true;
 }
 members(room){return [...room.members].map(([id,peer],order)=>({id,peerId:peer.id,order}));}
 command(peer,message){
  if(message.type==='authority-create'){this.create(peer,message);return;}
  const room=this.roomFor(peer),id=peer.authorityId;if(!room||room.members.get(id)!==peer)return;
  const sim=room.sim,m=message.command||{},leader=id===room.owner;
  if(m.type==='snapshot-reset'){room.encoders.delete(id);return;}
  if(m.type==='inputs'){
   if(!Array.isArray(m.inputs)||m.inputs.length>30)return;
   for(const input of m.inputs)this.command(peer,{command:{type:'input',input}});
   return;
  }
  if(m.type==='input'){sim.setInput(id,m.input,true);if(!peer.controlReady&&sim.inputs.has(id)){peer.controlReady=true;sim.players.get(id).loading=false;this.connection(peer,true);}this.relay.progression.input(peer,m.input);return;}
  if(m.type==='player-action'&&typeof m.action==='string'&&m.action.length<350){sim.playerAction(id,m.action);return;}
  if(m.type==='profile'){const ok=sim.setProfile(id,this.relay.progression.rankRewards.sanitizePeer(safeProfile(m.profile),peer));this.send(peer,{type:'authority-notice',event:ok===false?'name-required':'name-accepted'});return;}
  if(m.type==='chat-send'){const result=room.chat.submit(id,m,sim.snapshot());if(!result.ok)this.send(peer,{type:'authority-notice',event:'chat-status',data:result});else for(const recipient of result.recipients){const target=room.members.get(recipient);if(target)this.send(target,{type:'authority-notice',event:'chat-message',data:result.message});}return;}
  if(m.type==='chat-report'){const report=room.chat.report(id,m.target,m.reason,sim.snapshot());if(report)this.send(room.members.get(room.owner),{type:'authority-notice',event:'chat-report',data:report});return;}
  if(room.zombies&&m.type==='configure')return;
  if(room.recurring||room.tournament||!leader)return;
  if(m.type==='start'&&sim.phase!=='playing'){if(peer.authorityConfigRejected){peer.authorityConfigRejected=false;return;}const plan=this.capacity.roundPlan(room);if(!plan.ok){this.send(peer,{type:'authority-notice',event:'match-capacity',data:{message:plan.reason}});return;}this.capacity.rematch(room.key);sim.startRound();this.broadcast(room);}
  if(m.type==='configure'&&sim.phase!=='playing'){
   if(m.options?.mode==='royale'){peer.authorityConfigRejected=true;this.send(peer,{type:'authority-notice',event:'match-capacity',data:{message:'Battle Royale runs on the player host. Return to Play to open a Royale match.'}});return;}
   const options=matchOptions({...m.options,session:'online',seed:randomInt(1,2147483647)});
   if([...sim.players.values()].filter(p=>!p.bot&&!p.friendSpectator).length>options.capacity)return;
   const plan=this.capacity.roundPlan(room,options);if(!plan.ok){peer.authorityConfigRejected=true;this.send(peer,{type:'authority-notice',event:'match-capacity',data:{message:plan.reason}});this.broadcast(room);return;}peer.authorityConfigRejected=false;
   if((options.mode==='royale')!==(sim.options.mode==='royale')){room.sim=options.mode==='royale'?new RoyaleSimulation(options):new Simulation(options);for(const [pid]of room.members){const p=sim.players.get(pid);room.sim.admitPlayer(pid,p,p.friendSpectator?{...p,spectator:true}:null);}room.sim.round=sim.round;}
   else sim.configure(options);room.sim.botLimit=plan.botLimit;this.broadcast(room);
  }
  if(m.type==='visibility'){room.visibility=m.value==='private'?'private':'public';this.publish(room);}
  if(m.type==='chat-enabled')room.chat.enabled=!!m.enabled;
  if(m.type==='chat-muted'&&room.members.has(m.id)&&m.id!==id){if(m.muted)room.chat.muted.add(m.id);else room.chat.muted.delete(m.id);}
  if(m.type==='kick'&&m.id!==id){const target=room.members.get(m.id);if(target){room.kicked.add(target.progressId);this.send(target,{type:'authority-notice',event:'kicked'});this.disconnect(target);}}
 }
 publish(room){const s=room.sim,p=room.hostPeer;const humans=[...s.players.values()].filter(p=>!p.bot&&!p.lateSpectator&&p.connected!==false);p.listedAt=Date.now();p.listing={code:room.code,version:VERSION,host:room.tournament?'Frontier Cup':room.recurring?'Recurring Frontier Royale':s.players.get(room.owner)?.name||'Operator',map:s.options.map,mode:s.options.mode,teamSize:s.options.teamSize,players:humans.length,capacity:Math.min(MAX_HUMANS,s.options.capacity),contestantCapacity:s.options.capacity,public:room.visibility==='public',recurring:!!room.recurring,phase:isWarmup(s.stage)?'lobby':s.phase};}
 broadcast(room){
  const broadcastStarted=startTiming();roomTiming(room);room.timing.cpuQuota=this.relay.cpuQuota?.snapshot();
  if(!room.members.size){this.publish(room);return;}
  // Avoid cloning sleeping world collections only to discard them below.
  const sim=room.sim,worldKey=sim.options.mode==='royale'?`${sim.matchId}:${sim.map.id}:${sim.round}`:null;
  const lootKey=worldKey?`${worldKey}:${sim.lootVersion}`:null,buildKey=worldKey?`${worldKey}:${sim.buildVersion}`:null;
  let includeLoot=false,includeBuilds=false;
  for(const [id,peer]of room.members){
   if(!peer.ws||peer.ws.bufferedAmount>65536||peer.pendingBytes>0||peer.historyBytes>65536)continue;
   const encoder=room.encoders.get(id);includeLoot ||= !encoder||encoder.lootKey!==lootKey;includeBuilds ||= !encoder||encoder.buildKey!==buildKey;
  }
  const state=sim.snapshot({includeLoot,includeBuilds});if(room.tournament)state.tournament={id:this.relay.tournament.id};state.visibility=room.visibility;state.chatEnabled=room.chat.enabled;state.chatMuted=[...room.chat.muted];state.network={hostId:room.owner,members:this.members(room),chatSequence:room.chat.sequence,authority:'server',timing:room.timing};
  const groups=new Map(),batch=new SnapshotBatch();
  for(const [id,peer]of room.members){
   // Do not encode dependent deltas faster than a socket can deliver them.
   if(!peer.ws||peer.ws.bufferedAmount>65536||peer.pendingBytes>0||peer.historyBytes>65536)continue;
   let encoder=room.encoders.get(id);const p=state.players.find(p=>p.id===id);if(!p)continue;
   // Spectators interpolate a 10 Hz feed; live competitors retain the full 20 Hz
   // snapshots and 60 Hz authority. Slow viewers cannot consume match CPU.
   if(room.tournament&&p.spectating&&encoder&&room.age-(peer.tournamentFrameAt??-1)<.1-1e-8)continue;
   peer.tournamentFrameAt=room.age;if(!encoder){encoder=new SnapshotEncoder();room.encoders.set(id,encoder);}
   const r=state.royale,worldKey=r?`${r.matchId}:${state.options.map}:${state.round}`:null;
   const lootKey=r?`${worldKey}:${r.lootVersion}`:null,buildKey=r?`${worldKey}:${r.buildVersion}`:null;
   const cursor=room.eventCursors.get(id)||0,privateMarkers=r?.markers?.length||state.events.some(e=>e.id>cursor&&e.type==='duo-marker');
   const key=JSON.stringify([cursor,encoder.lootKey===lootKey,encoder.buildKey===buildKey,privateMarkers?(isTeamRoyale(state.options)?p.team:id):'public']);
   let outgoing=groups.get(key);
   if(!outgoing){
    outgoing={...state,events:state.events.filter(e=>e.id>(room.eventCursors.get(id)||0)&&(e.type!=='duo-marker'||e.player===id||isTeamRoyale(state.options)&&e.team===p.team))};
    if(r){outgoing.royale={...r,markers:visibleMarkers(state,p)};
     if(encoder.lootKey===lootKey){delete outgoing.royale.loot;delete outgoing.royale.chests;}
     if(encoder.buildKey===buildKey){delete outgoing.royale.builds;delete outgoing.royale.worldDamage;}
    }
    groups.set(key,outgoing);
   }
   encoder.lootKey=lootKey;encoder.buildKey=buildKey;
   room.eventCursors.set(id,state.events.at(-1)?.id||room.eventCursors.get(id)||0);
   room.interest??=new SnapshotInterest();const presentation={...outgoing,players:room.interest.players(outgoing,p)};
   const message=encoder.encode({type:'authority-state',state:presentation},batch);this.send(peer,{type:'authority-frame',frame:message.frame},batch.serialize(message.frame));
  }
  if(!room.publishedAt||room.age-room.publishedAt>=2){this.publish(room);room.publishedAt=room.age;}
  if(room.zombies){for(const [id,peer]of room.members){const p=sim.players.get(id);if(sim.phase==='results'||p?.zExtracted)settleZombiesPlayer(this.relay,room,p,peer);}if(sim.zAccountDirty){this.relay.progression.dirty=true;sim.zAccountDirty=false;void this.relay.progression.save();}}
  else if(!room.tournament&&room.age-room.progressAt>=.5){room.progressAt=room.age;this.relay.progression.frame(room.hostPeer,rewardFrame(state,room.owner,room.sim.inputs.get(room.owner)||{}));}
  const broadcastCost=finishTiming(broadcastStarted);recordTiming(room,timingPhase(room.sim),'broadcastMaxMs',broadcastCost.wallMs,broadcastCost.cpuMs);
 }
 restartPublicRoom(room){
  this.capacity.rematch(room.key);room.sim.phase='results';room.sim.startRound();delete room.restartAt;room.encoders.clear();room.eventCursors.clear();this.publish(room);
 }
 resetEmptyPublicRound(room){
  if(!room.recurring||isWarmup(room.sim.stage)||[...room.members.values()].some(p=>p.ws?.readyState===1))return false;
  room.sim.setConnectedHumans([]);
  this.restartPublicRoom(room);return true;
 }
 disconnect(peer){
  const room=this.roomFor(peer),id=peer.authorityId;if(!room||room.members.get(id)!==peer)return false;
  if(room.zombies)settleZombiesPlayer(this.relay,room,room.sim.players.get(id),peer);
  if(room.tournament)this.relay.tournament.disconnected(room,room.sim.players.get(id));
  if(!room.tournament||room.sim.stage==='spawn-island'||room.sim.stage==='starting')room.sim.leavePlayer(id);else {const p=room.sim.players.get(id);if(p){p.connected=false;room.sim.suspendPlayer(id);}}room.members.delete(id);room.encoders.delete(id);room.eventCursors.delete(id);delete peer.authorityRoom;delete peer.authorityId;
  if(room.tournament){this.broadcast(room);return false;}
  if(room.recurring){room.sim.setConnectedHumans([...room.members].filter(([,p])=>p.ws).map(([id])=>id));this.resetEmptyPublicRound(room);this.broadcast(room);return false;}
  if(!room.members.size){this.rooms.delete(room.key);this.capacity.releaseRoom(room.key);room.hostPeer.virtualRoom=false;room.hostPeer.listing=null;if(room.hostPeer!==peer)this.relay.remove(room.hostPeer);return false;}
  if(id===room.owner){room.owner=[...room.members.keys()].find(pid=>!room.sim.players.get(pid)?.friendSpectator);for(const member of room.members.values())this.send(member,{type:'authority-owner',id:room.owner});}
  if(peer===room.hostPeer){peer.virtualRoom=true;peer.detachedAt=0;peer.ws?.close(1000,'Session ended');peer.ws=null;}
  room.sim.setConnectedHumans?.([...room.members].filter(([,p])=>p.ws).map(([id])=>id));this.broadcast(room);return peer===room.hostPeer;
 }
 tick(now=performance.now()){
  if(!this.rooms.size){this.last=now;this.accumulator=0;return;}
  this.capacity.sample(now);
  if(this.catchup){clearImmediate(this.catchup);this.catchup=null;}
  const sliceStarted=performance.now();
  const elapsed=Math.max(0,(now-this.last)/1000);this.last=now;this.accumulator=Math.min(.75,this.accumulator+elapsed);let steps=0;
  for(const room of this.rooms.values()){
   if(room.zombies){if(!room.members.size&&Date.now()-room.created>90000){this.rooms.delete(room.key);this.capacity.releaseRoom(room.key);this.relay.remove(room.hostPeer);continue;}if(room.autoStart&&room.sim.phase==='lobby'&&room.startedWaitingAt!=null&&room.age-room.startedWaitingAt>=12&&[...room.sim.players.values()].some(p=>p.connected!==false))room.sim.startRound();}
   this.resetEmptyPublicRound(room);
   if(room.recurring&&room.sim.phase==='results'){room.restartAt??=room.age+PUBLIC_ROYALE.restartSeconds;if(room.age>=room.restartAt)this.restartPublicRoom(room);}
   recordTiming(room,timingPhase(room.sim),'gapMaxMs',elapsed*1000);
  }
  while(this.accumulator+1e-8>=1/60&&steps++<6){this.accumulator=Math.max(0,this.accumulator-1/60);for(const room of this.rooms.values()){room.age+=1/60;room.sim.recoveringTick=this.accumulator>=1/60;const phase=timingPhase(room.sim),start=startTiming();if(room.recurring&&isWarmup(room.sim.stage)&&![...room.members.values()].some(p=>p.ws)){room.sim.time+=1/60;room.sim.advanceWarmupClock();if(publicWindow(this.now?.()??Date.now()).open)room.sim.prepareBattleWorld();}else room.sim.tick(1/60);const cost=finishTiming(start);recordTiming(room,phase==='spawn'&&timingPhase(room.sim)==='bus'?'departure':phase,'stepMaxMs',cost.wallMs,cost.cpuMs);}
   if(performance.now()-sliceStarted>=4)break;
  }
  // One fresh broadcast after catch-up, never several obsolete broadcasts in a burst.
  // Three 60 Hz steps can sum just below 50 ms; use the same tolerance as catch-up.
  for(const room of this.rooms.values())if(room.age-room.frameAt+1e-8>=(room.tournament&&room.members.size>32?1/15:.05)){room.frameAt=room.age;this.broadcast(room);}
  if(!this.publicStatusAt||now-this.publicStatusAt>=1000){this.publicStatusAt=now;this.relay.parties.publishPublicMatch(this.publicSummary());}
  // A throttled tick must not be followed by five more ticks before socket IO.
  // Yield between catch-up slices while retaining earned simulation time.
  if(this.accumulator+1e-8>=1/60&&this.rooms.size){this.catchup=setImmediate(()=>{this.catchup=null;this.tick();});this.catchup.unref?.();}
 }
 close(){clearInterval(this.timer);clearImmediate(this.catchup);this.rooms.clear();}
}
