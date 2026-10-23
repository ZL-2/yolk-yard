import {randomUUID,randomInt} from 'node:crypto';
import {queueZombies} from './zombies-service.js';
import {VERSION} from '../../src/data.js';
import {matchOptions} from '../../src/match-options.js';
import {assertModeAvailable} from '../../src/mode-availability.js';
import {MAX_SPECTATORS} from '../../src/royale-phases.js';
import {PUBLIC_ROYALE,publicMatchOptions,isPublicCode} from '../../src/public-royale.js';
const address=code=>`yolk-yard-v${VERSION}-${code}`;
const newCode=()=>Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');

export function queueMatch(service,u,m){
 service.relay.tournament?.assertNormal();
 const p=service.parties.get(u.party),authority=service.relay.authority,capacity=authority?.capacity;
 if(service.relay.deployment?.snapshot().updating)throw Error('Ravelfront is updating. Matchmaking will reopen when publishing finishes.');
 if(p.members.some(id=>!service.connected(service.users.get(id))))throw Error('Wait for your party members to reconnect.');
 if(p.members.some(id=>id!==u.id&&!service.users.get(id).ready))throw Error('Every party member must ready up.');
 if(m.targetPublic){
  const target=service.relay.publicHost?.rooms.get(m.targetPublic),server=authority?.rooms.get(address(m.targetPublic));
  if(!target&&(!server?.zombies||server.visibility!=='public'))throw Error('That public match has ended.');
  const mode=target?.options.mode||'zombies';for(const id of p.members)service.relay.owner?.assertAdmission(id,mode,'public');
  assertModeAvailable(mode);
  if(server?.zombies)return queueZombies(service,u,{...m,code:m.targetPublic,exactPublic:true});
  return queuePublicMatch(service,u,m);
 }
 const destination=m.code?service.relay.peers.get(address(m.code))?.listing:null;
 const selectedMode=destination?.mode||(!m.code&&m.custom?m.options?.mode:null)||p.selection.mode;
 assertModeAvailable(selectedMode);
 const access=destination?destination.public===false?'private':'public':m.code?'private':m.custom?'private':p.selection.access||'public';
 for(const id of p.members)service.relay.owner?.assertAdmission(id,selectedMode,access);
 if(p.selection.mode==='zombies'||m.code&&authority?.rooms.get(address(m.code))?.zombies)return queueZombies(service,u,m);
 if(m.publicRoyale||m.code===PUBLIC_ROYALE.code||!m.code&&!m.custom&&p.selection.access!=='private')return queuePublicMatch(service,u,m);
 if(m.code&&isPublicCode(m.code))throw Error('Use Play to join public matchmaking, or Spectate Friend to watch a friend.');
 if((m.options?.mode||p.selection.mode)==='teams')throw Error('Team Scramble has been retired. Choose Free For All or Frontier Royale.');
 let options=matchOptions({...p.selection,...m.options,...(!m.custom?p.selection:{}),session:'online',recurring:false}),room;
 const rooms=[...service.relay.peers.values()].filter(peer=>peer.ws&&peer.listing&&!authority?.rooms.has(peer.id)&&Date.now()-peer.listedAt<15000).map(peer=>peer.listing);
 const pending=code=>[...service.tickets.values()].filter(t=>!t.spectator&&t.code===code&&t.expires>Date.now()&&(!t.peer||t.claimedAt>(service.relay.peers.get(address(code))?.listedAt||0))).length;
 if(m.code){room=rooms.find(r=>r.code===m.code&&r.version===VERSION);if(!room)throw Error('That private room is unavailable. Check the code with its host.');options=matchOptions({...options,mode:room.mode,boxFormat:room.boxFormat,teamSize:room.teamSize,capacity:room.contestantCapacity,recurring:false});}
 if((options.mode==='royale'||options.mode==='boxfight'&&options.recurring)&&p.members.length>options.teamSize)throw Error('Choose Duos or Squads to fit your party.');
 if(room)options=matchOptions({...options,mode:room.mode,boxFormat:room.boxFormat,capacity:room.contestantCapacity||room.capacity,teamSize:room.teamSize});
 if(!room&&options.mode==='royale'&&options.capacity<options.teamSize*2)throw Error('Team Royale needs positions for at least two full teams.');
 let roomCode=room?.code||newCode();while(!room&&(isPublicCode(roomCode)||service.relay.peers.has(address(roomCode))))roomCode=newCode();
 const hostRun=true,spectator=room?.mode==='royale'&&room.phase!=='lobby';
 if(room&&!spectator&&room.capacity-room.players-pending(roomCode)<p.members.length)throw Error('That match cannot fit your party.');
 const launch={id:randomUUID(),code:roomCode,options,creating:!room,hostRun,rewardPublic:false,visibility:'private',created:Date.now()};
 p.selection={...options,access:'private'};p.launch=launch;p.state='queueing';u.ready=true;
 for(const id of p.members){const token=randomUUID(),t={party:p.id,member:id,code:roomCode,teamSize:options.teamSize,teamFill:options.teamFill!==false,partySize:p.members.length,hostRun,expires:Date.now()+90000,token};service.tickets.set(token,t);service.users.get(id).ticket=token;}
 service.sync(p);
 if(!room)service.send(u,{type:'launch',launch:{...launch,host:true,ticket:u.ticket,admission:service.publicAdmission(service.tickets.get(u.ticket))}});
 else service.dispatch(p);
 return launch.id;
}

function queuePublicMatch(service,u,m={}){
 const p=service.parties.get(u.party),pool=service.relay.publicHost;
 if(!pool?.enabled)throw Error('Public matchmaking is unavailable.');
 if(!m.targetPublic&&!['royale','ffa','zonewars','boxfight'].includes(p.selection.mode))throw Error('Choose an available game mode.');
 const target=m.targetPublic?pool.rooms.get(m.targetPublic):null;
 if(m.targetPublic&&(!target||typeof m.targetMatch!=='string'||target.state?.matchId!==m.targetMatch))throw Error('That public match has ended.');
 const options=target?target.options:publicMatchOptions(p.selection);
 if((options.mode==='royale'||options.mode==='boxfight'&&options.recurring)&&p.members.length>options.teamSize)throw Error('Choose Duos or Squads to fit your party.');
 const room=target||pool.findRoom(options,p.members.length),summary=room.summary();
 if(target&&(!summary.hostReady||!summary.joinable||summary.recovering))throw Error('This match has started or is transferring hosts.');
 if(target&&summary.availableSeats<p.members.length)throw Error('This match is full or cannot fit your entire party.');
 const creating=target||room.members.size&&!room.host?false:room.reserve(p,u);
 const launch={id:randomUUID(),code:room.code,options,creating,hostRun:true,recurring:true,rewardPublic:false,spectator:false,visibility:'public',created:Date.now()};
 p.selection={...options,access:'public'};p.launch=launch;p.state='queueing';u.ready=true;
 for(const id of p.members){const token=randomUUID(),t={...(target?{exactMatch:m.targetMatch}:{}),party:p.id,member:id,code:launch.code,teamSize:options.teamSize,teamFill:true,partySize:p.members.length,hostRun:true,recurring:true,spectator:false,expires:Date.now()+90000,token};service.tickets.set(token,t);service.users.get(id).ticket=token;}
 service.sync(p);
 if(creating)service.send(u,{type:'launch',launch:{...launch,host:true,ticket:u.ticket,admission:service.publicAdmission(service.tickets.get(u.ticket))}});else if(summary.hostReady&&!summary.recovering)service.dispatch(p);
 return launch.id;
}

export function spectateFriend(service,u,m){
 if(service.relay.deployment?.snapshot().updating)throw Error('Ravelfront is updating. Please wait for publishing to finish.');
 if(!service.store.friends.get(u.id)?.has(m.id)||service.store.blocked(u.id,m.id))throw Error('Only friends can be spectated.');
 const friend=service.users.get(m.id),location=service.matchLocation(friend);
 if(!location||friend.spectateLaunch)throw Error('Your friend is no longer in a match.');
 if(location.room?.tournament)return service.relay.tournament.queue(u,{spectate:true});
 service.relay.tournament?.assertNormal(location.key);
 const room=location.room,capacity=service.relay.authority?.capacity,key=location.key;
 assertModeAvailable(location.listing.mode);
 service.relay.owner?.assertAdmission(u.id,location.listing.mode,location.listing.public===false?'private':'public');
 if(room&&capacity){const plan=room.recurring?{ok:capacity.spectators(room)+capacity.pending(key,true)<MAX_SPECTATORS,reason:'The public spectator seats are full. Try again shortly.'}:capacity.plan(room.sim.options,{key,humans:capacity.humans(room)+capacity.pending(key),spectators:capacity.spectators(room)+capacity.pending(key,true)+1,botLimit:room.sim.botLimit});if(!plan.ok)throw Error(plan.reason);}
 const publicRoom=service.relay.publicHost?.roomByAddress(key);if(publicRoom&&publicRoom.summary().availableSpectators<1)throw Error('The public spectator seats are full.');
 const id=randomUUID(),token=randomUUID(),launch={id,code:location.listing.code,host:false,hostRun:!room,recurring:!!location.listing.recurring,spectator:true,watchId:location.watchId,ticket:token};
 const t={token,party:u.party,reservationId:id,member:u.id,friend:m.id,code:launch.code,spectator:true,watchId:launch.watchId,hostRun:!room,recurring:!!location.listing.recurring,teamSize:location.listing.teamSize||1,partySize:1,expires:Date.now()+90000};
 service.tickets.set(token,t);u.ticket=token;u.spectateLaunch=launch;
 if(room)capacity.reserve(id,key,room.sim.options,1,room.sim.botLimit,true,true);
 service.send(u,{type:'launch',launch});return id;
}
