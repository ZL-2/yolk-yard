import {timingPhase,roomTiming,recordTiming} from './timing.js';
import {randomInt} from 'node:crypto';
import {Simulation} from '../../src/simulation.js';
import {RoyaleSimulation} from '../../src/royale.js';
import {VERSION,safeProfile,nameKey} from '../../src/data.js';
import {matchOptions} from '../../src/match-options.js';
import {SnapshotEncoder} from '../../src/snapshot-codec.js';
import {ChatRoom} from '../../src/chat.js';
import {rewardFrame} from '../../src/rewards.js';
import {visibleMarkers} from '../../src/team-markers.js';
import {isDuos} from '../../src/teams.js';
const address=new RegExp('^yolk-yard-v'+VERSION+'-([A-Z2-9]{8})$');
// The relay owns simulation and persistent room lifetime. Browsers submit bounded
// input/interaction intent only; even the room leader cannot submit game state.
export class MatchAuthority{
 constructor(relay){this.relay=relay;this.rooms=new Map();this.last=performance.now();this.accumulator=0;this.timer=setInterval(()=>this.tick(),1000/60);this.timer.unref?.();}
 roomFor(peer){return this.rooms.get(peer.authorityRoom);}
 connection(peer,connected){const room=this.roomFor(peer),p=room?.sim.players.get(peer.authorityId);if(p){p.connected=connected;if(p.activity)p.activity.last=room.sim.time;}}
 send(peer,message){if(this.relay.peers.has(peer.id))this.relay.send(peer,message);}
 create(peer,m){
  const match=address.exec(peer.id);if(!match||this.rooms.has(peer.id)||this.rooms.size>=24)return;
  const options={...matchOptions({...m.options,session:'online'}),seed:randomInt(1,2147483647)},sim=options.mode==='royale'?new RoyaleSimulation(options):new Simulation(options);
  const p=sim.addPlayer('host',safeProfile(m.profile));p.loading=true;peer.controlReady=false;const admission=m.ticket?this.relay.parties.claim(m.ticket,peer.id,peer.id):null;
  if(m.ticket&&!admission)return;sim.assignTeam?.(p,admission);
  const room={key:peer.id,code:match[1],owner:'host',hostPeer:peer,sim,visibility:m.visibility==='private'?'private':'public',members:new Map([['host',peer]]),chat:new ChatRoom(),encoders:new Map(),eventCursors:new Map(),age:0,frameAt:0,progressAt:0,kicked:new Set()};
  this.rooms.set(peer.id,room);peer.authorityRoom=peer.id;peer.authorityId='host';
  if(options.mode==='royale')sim.startRound();this.publish(room);this.send(peer,{type:'authority-ready',id:'host',room:room.key});this.broadcast(room);
 }
 connect(peer,other,channel){const room=this.rooms.get(other.id);if(!room)return false;this.send(peer,{type:'opened',channel});return true;}
 data(peer,other,entry){
  const room=this.rooms.get(other.id)||this.roomFor(peer);if(!room)return false;
  const m=entry.data;if(!m||typeof m!=='object')return true;
  if(m.type==='hello'){
   const reject=reason=>this.send(peer,{type:'data',channel:entry.channel,data:{type:'reject',reason}});
   if(m.version!==VERSION||room.kicked.has(peer.progressId))return reject('Refresh the game or choose another room.'),true;
   const profile=safeProfile(m.profile);if([...room.sim.players.values()].some(p=>!p.bot&&p.id!==peer.id&&nameKey(p.name)===nameKey(profile.name))){this.send(peer,{type:'data',channel:entry.channel,data:{type:'name-required',joining:true}});return true;}
   const admission=m.ticket?this.relay.parties.claim(m.ticket,peer.id,room.key):null;if(m.ticket&&!admission)return reject('Party reservation expired.'),true;
   const p=room.sim.admitPlayer(peer.id,profile,admission);if(!p)return reject('This room is full.'),true;
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
  if(m.type==='inputs'){
   if(!Array.isArray(m.inputs)||m.inputs.length>30)return;
   for(const input of m.inputs)this.command(peer,{command:{type:'input',input}});
   return;
  }
  if(m.type==='input'){sim.setInput(id,m.input,true);if(!peer.controlReady&&sim.inputs.has(id)){peer.controlReady=true;sim.players.get(id).loading=false;this.connection(peer,true);}this.relay.progression.input(peer,m.input);return;}
  if(m.type==='player-action'&&typeof m.action==='string'&&m.action.length<350){sim.playerAction(id,m.action);return;}
  if(m.type==='profile'){const ok=sim.setProfile(id,safeProfile(m.profile));this.send(peer,{type:'authority-notice',event:ok===false?'name-required':'name-accepted'});return;}
  if(m.type==='chat-send'){const result=room.chat.submit(id,m,sim.snapshot());if(!result.ok)this.send(peer,{type:'authority-notice',event:'chat-status',data:result});else for(const recipient of result.recipients){const target=room.members.get(recipient);if(target)this.send(target,{type:'authority-notice',event:'chat-message',data:result.message});}return;}
  if(m.type==='chat-report'){const report=room.chat.report(id,m.target,m.reason,sim.snapshot());if(report)this.send(room.members.get(room.owner),{type:'authority-notice',event:'chat-report',data:report});return;}
  if(!leader)return;
  if(m.type==='start'&&sim.phase!=='playing'){sim.startRound();this.broadcast(room);}
  if(m.type==='configure'&&sim.phase!=='playing'){
   const options=matchOptions({...m.options,session:'online',seed:randomInt(1,2147483647)});
   if([...sim.players.values()].filter(p=>!p.bot).length>options.capacity)return;
   if((options.mode==='royale')!==(sim.options.mode==='royale')){room.sim=options.mode==='royale'?new RoyaleSimulation(options):new Simulation(options);for(const [pid]of room.members){const p=sim.players.get(pid);room.sim.addPlayer(pid,p);}room.sim.round=sim.round;}
   else sim.configure(options);this.broadcast(room);
  }
  if(m.type==='visibility'){room.visibility=m.value==='private'?'private':'public';this.publish(room);}
  if(m.type==='chat-enabled')room.chat.enabled=!!m.enabled;
  if(m.type==='chat-muted'&&room.members.has(m.id)&&m.id!==id){if(m.muted)room.chat.muted.add(m.id);else room.chat.muted.delete(m.id);}
  if(m.type==='kick'&&m.id!==id){const target=room.members.get(m.id);if(target){room.kicked.add(target.progressId);this.send(target,{type:'authority-notice',event:'kicked'});this.disconnect(target);}}
 }
 publish(room){const s=room.sim,p=room.hostPeer;const humans=[...s.players.values()].filter(p=>!p.bot&&!p.lateSpectator);p.listedAt=Date.now();p.listing={code:room.code,version:VERSION,host:s.players.get(room.owner)?.name||'Operator',map:s.options.map,mode:s.options.mode,teamSize:s.options.teamSize,players:humans.length,capacity:Math.min(16,s.options.capacity),contestantCapacity:s.options.capacity,public:room.visibility==='public',phase:s.stage&&['spawn-island','starting','waiting'].includes(s.stage)?'lobby':s.phase};}
 broadcast(room){
  const broadcastStarted=performance.now();roomTiming(room);
  const state=room.sim.snapshot();state.visibility=room.visibility;state.chatEnabled=room.chat.enabled;state.chatMuted=[...room.chat.muted];state.network={hostId:room.owner,members:this.members(room),chatSequence:room.chat.sequence,authority:'server',timing:room.timing};
  const groups=new Map();
  for(const [id,peer]of room.members){
   // Do not encode dependent deltas faster than a socket can deliver them.
   if(!peer.ws||peer.ws.bufferedAmount>65536||peer.pendingBytes>0||peer.historyBytes>65536)continue;
   let encoder=room.encoders.get(id);if(!encoder){encoder=new SnapshotEncoder();room.encoders.set(id,encoder);}const p=state.players.find(p=>p.id===id);if(!p)continue;
   const r=state.royale,worldKey=r?`${r.matchId}:${state.options.map}:${state.round}`:null;
   const lootKey=r?`${worldKey}:${r.lootVersion}`:null,buildKey=r?`${worldKey}:${r.buildVersion}`:null;
   const cursor=room.eventCursors.get(id)||0,privateMarkers=r?.markers?.length||state.events.some(e=>e.id>cursor&&e.type==='duo-marker');
   const key=JSON.stringify([cursor,encoder.lootKey===lootKey,encoder.buildKey===buildKey,privateMarkers?(isDuos(state.options)?p.team:id):'public']);
   let outgoing=groups.get(key);
   if(!outgoing){
    outgoing={...state,events:state.events.filter(e=>e.id>(room.eventCursors.get(id)||0)&&(e.type!=='duo-marker'||e.player===id||isDuos(state.options)&&e.team===p.team))};
    if(r){outgoing.royale={...r,markers:visibleMarkers(state,p)};
     if(encoder.lootKey===lootKey){delete outgoing.royale.loot;delete outgoing.royale.chests;}
     if(encoder.buildKey===buildKey){delete outgoing.royale.builds;delete outgoing.royale.worldDamage;}
    }
    groups.set(key,outgoing);
   }
   encoder.lootKey=lootKey;encoder.buildKey=buildKey;
   room.eventCursors.set(id,state.events.at(-1)?.id||room.eventCursors.get(id)||0);
   const message=encoder.encode({type:'authority-state',state:outgoing});this.send(peer,{type:'authority-frame',frame:message.frame});
  }
  if(!room.publishedAt||room.age-room.publishedAt>=2){this.publish(room);room.publishedAt=room.age;}
  if(room.age-room.progressAt>=.5){room.progressAt=room.age;this.relay.progression.frame(room.hostPeer,rewardFrame(state,'host',room.sim.inputs.get('host')||{}));}
  recordTiming(room,timingPhase(room.sim),'broadcastMaxMs',performance.now()-broadcastStarted);
 }
 disconnect(peer){
  const room=this.roomFor(peer),id=peer.authorityId;if(!room||room.members.get(id)!==peer)return false;
  room.sim.leavePlayer(id);room.members.delete(id);room.encoders.delete(id);room.eventCursors.delete(id);delete peer.authorityRoom;delete peer.authorityId;
  if(!room.members.size){this.rooms.delete(room.key);room.hostPeer.virtualRoom=false;room.hostPeer.listing=null;if(room.hostPeer!==peer)this.relay.remove(room.hostPeer);return false;}
  if(id===room.owner){room.owner=room.members.keys().next().value;for(const member of room.members.values())this.send(member,{type:'authority-owner',id:room.owner});}
  if(peer===room.hostPeer){peer.virtualRoom=true;peer.detachedAt=0;peer.ws?.close(1000,'Session ended');peer.ws=null;}
  room.sim.setConnectedHumans?.([...room.members].filter(([,p])=>p.ws).map(([id])=>id));this.broadcast(room);return peer===room.hostPeer;
 }
 tick(now=performance.now()){const elapsed=Math.max(0,(now-this.last)/1000);this.last=now;this.accumulator=Math.min(.75,this.accumulator+elapsed);let steps=0;
  for(const room of this.rooms.values()){
   recordTiming(room,timingPhase(room.sim),'gapMaxMs',elapsed*1000);
  }
  while(this.accumulator+1e-8>=1/60&&steps++<6){this.accumulator=Math.max(0,this.accumulator-1/60);for(const room of this.rooms.values()){room.age+=1/60;room.sim.recoveringTick=this.accumulator>=1/60;const phase=timingPhase(room.sim),start=performance.now();room.sim.tick(1/60);recordTiming(room,phase==='spawn'&&timingPhase(room.sim)==='bus'?'departure':phase,'stepMaxMs',performance.now()-start);}}
  // One fresh broadcast after catch-up, never several obsolete broadcasts in a burst.
  for(const room of this.rooms.values())if(room.age-room.frameAt>=.05){room.frameAt=room.age;this.broadcast(room);}
  // Retain bounded time debt for subsequent callbacks; never discard a short stall.
  // Six steps per callback leave room for sockets and prevent an unbounded catch-up loop.
 }
 close(){clearInterval(this.timer);this.rooms.clear();}
}
