import {randomUUID,randomInt} from 'node:crypto';
import {VERSION} from '../../src/data.js';
import {matchOptions} from '../../src/match-options.js';
import {acceptsContestants} from '../../src/royale-phases.js';
const address=code=>`yolk-yard-v${VERSION}-${code}`;
const newCode=()=>Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');

export function queueMatch(service,u,m){
 const p=service.parties.get(u.party),authority=service.relay.authority,capacity=authority?.capacity;
 if(service.relay.deployment?.snapshot().updating)throw Error('Ravelfront is updating. Matchmaking will reopen when publishing finishes.');
 if(p.members.some(id=>!service.connected(service.users.get(id))))throw Error('Wait for your party members to reconnect.');
 if(p.members.some(id=>id!==u.id&&!service.users.get(id).ready))throw Error('Every party member must ready up.');
 let options=matchOptions({...p.selection,...m.options,...(!m.custom?p.selection:{}),session:'online'}),room;
 const rooms=[...service.relay.peers.values()].filter(peer=>(peer.ws||peer.virtualRoom)&&peer.listing&&Date.now()-peer.listedAt<15000).map(peer=>({...peer.listing,players:authority?.rooms.has(peer.id)?capacity.humans(authority.rooms.get(peer.id)):peer.listing.players,hostRun:!authority?.rooms.has(peer.id)}));
 const pending=code=>{const key=address(code),room=authority?.rooms.get(key);return [...service.tickets.values()].filter(t=>!t.spectator&&t.code===code&&t.expires>Date.now()&&(room?!room.members.has(t.peer===key?'host':t.peer):!t.peer||t.claimedAt>(service.relay.peers.get(key)?.listedAt||0))).length;};
 // A not-yet-connected host already owns its public reservation. A concurrent
 // queue joins that launch instead of creating another room for the same mode.
 for(const other of service.parties.values())if(other.launch?.creating&&other.launch.visibility==='public'&&other.state==='queueing'&&!rooms.some(r=>r.code===other.launch.code)){
  const l=other.launch;rooms.push({code:l.code,version:VERSION,mode:l.options.mode,teamSize:l.options.teamSize,capacity:l.options.mode==='royale'?Math.min(16,l.options.capacity):8,contestantCapacity:l.options.capacity,players:0,phase:'lobby',public:true,pendingHost:true});
 }
 if(m.code){room=rooms.find(r=>r.code===m.code&&r.version===VERSION);if(!room)throw Error('That room is unavailable. Check the code with its host.');options=matchOptions({...options,mode:room.mode,teamSize:room.teamSize,capacity:room.contestantCapacity});}
 else if(!m.custom&&options.mode!=='royale'){
  const compatible=rooms.filter(r=>r.public!==false&&!r.hostRun&&r.version===VERSION&&r.mode===options.mode&&(r.teamSize||1)===options.teamSize&&(r.phase==='lobby'||options.mode!=='royale'&&['playing','results'].includes(r.phase))).sort((a,b)=>b.players+pending(b.code)-a.players-pending(a.code));
  room=compatible.find(r=>r.capacity-r.players-pending(r.code)>=p.members.length);
  if(!room&&options.mode!=='royale'&&compatible.some(r=>r.players<r.capacity))throw Error('The public arena is waiting for enough seats for your party. A second arena opens only when the first is full of real players.');
 }
 if(options.mode==='royale'&&p.members.length>options.teamSize)throw Error('Choose Duos or Squads to fit your party.');
 if(room)options=matchOptions({...options,mode:room.mode,capacity:room.contestantCapacity||room.capacity,teamSize:room.teamSize});
 if(!room&&options.mode==='royale'&&options.capacity<options.teamSize*2)throw Error('Team Royale needs positions for at least two full teams.');
 const roomCode=room?.code||newCode(),key=address(roomCode),existing=authority?.rooms.get(key),hostRun=room?!!room.hostRun:!!m.custom||options.mode==='royale';
 const spectator=existing?.sim.options.mode==='royale'&&!acceptsContestants(existing.sim.stage);
 if(room&&!spectator&&room.capacity-room.players-pending(roomCode)<p.members.length)throw Error('That match cannot fit your party.');
 const planOptions=existing?.sim.options||options;
 const plan=hostRun?{ok:true}:capacity?.plan(planOptions,{key,humans:(existing?capacity.humans(existing):0)+(capacity?.pending(key)||0)+(spectator?0:p.members.length),spectators:(existing?capacity.spectators(existing):0)+(capacity?.pending(key,true)||0)+(spectator?p.members.length:0),botLimit:existing?.sim.botLimit,reduceBots:!existing&&!m.custom&&!m.code})||{ok:true};
 if(!plan.ok)throw Error(plan.reason);
 if(!hostRun)capacity?.reserve(p.id,key,planOptions,p.members.length,plan.botLimit,spectator);
 const launch={id:randomUUID(),code:roomCode,options,creating:!room,hostRun,rewardPublic:!hostRun&&!m.code,visibility:hostRun?'private':'public',botLimit:plan.botLimit,capacityNotice:plan.adjusted?'Bot fill was reduced to protect smooth gameplay. Human seats remain available.':null,created:Date.now()};
 p.selection={mode:options.mode,teamSize:options.teamSize,teamFill:options.teamFill!==false,duoFill:options.teamFill!==false};p.launch=launch;p.state='queueing';
 for(const id of p.members){const token=randomUUID(),t={party:p.id,member:id,code:roomCode,teamSize:options.teamSize,teamFill:options.teamFill!==false,partySize:p.members.length,hostRun,expires:Date.now()+90000,token};service.tickets.set(token,t);service.users.get(id).ticket=token;}
 service.sync(p);
 if(!room)service.send(u,{type:'launch',launch:{...launch,host:true,ticket:u.ticket,admission:service.publicAdmission(service.tickets.get(u.ticket))}});
 else if(!room.pendingHost)service.dispatch(p);
 return launch.id;
}

export function spectateFriend(service,u,m){
 if(service.relay.deployment?.snapshot().updating)throw Error('Ravelfront is updating. Please wait for publishing to finish.');
 if(!service.store.friends.get(u.id)?.has(m.id)||service.store.blocked(u.id,m.id))throw Error('Only friends can be spectated.');
 const friend=service.users.get(m.id),location=service.matchLocation(friend);
 if(!location||friend.spectateLaunch)throw Error('Your friend is no longer in a match.');
 const room=location.room,capacity=service.relay.authority?.capacity,key=location.key;
 if(room&&capacity){const plan=capacity.plan(room.sim.options,{key,humans:capacity.humans(room)+capacity.pending(key),spectators:capacity.spectators(room)+capacity.pending(key,true)+1,botLimit:room.sim.botLimit});if(!plan.ok)throw Error(plan.reason);}
 const id=randomUUID(),token=randomUUID(),launch={id,code:location.listing.code,host:false,hostRun:!room,spectator:true,watchId:location.watchId,ticket:token};
 const t={token,party:u.party,reservationId:id,member:u.id,friend:m.id,code:launch.code,spectator:true,watchId:launch.watchId,hostRun:!room,teamSize:location.listing.teamSize||1,partySize:1,expires:Date.now()+90000};
 service.tickets.set(token,t);u.ticket=token;u.spectateLaunch=launch;
 if(room)capacity.reserve(id,key,room.sim.options,1,room.sim.botLimit,true,true);
 service.send(u,{type:'launch',launch});return id;
}
