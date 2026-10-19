import {readFileSync,writeFileSync,renameSync,mkdirSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
import {serialize,deserialize} from 'node:v8';
import {VERSION} from '../../src/data.js';
import {PublicRoom} from './public-host.js';
import {DATA_MOUNT,persistentMount} from './data-path.js';
import {RELAY_SESSION_GRACE_MS} from '../../src/relay-recovery.js';

const select=(value,keys)=>Object.fromEntries(keys.split(' ').filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
// Only authenticated transport/room metadata lives here. The browser retains
// its simulation, inventory and snapshot codecs throughout a relay restart.
// Never expose resume secrets through HTTP, logs, or the public map directory.
export class RelayRecovery {
 constructor(relay,{path=persistentMount(DATA_MOUNT)?DATA_MOUNT+'/relay-sessions.bin':null}={}){this.relay=relay;this.path=path;}
 save(){
  if(!this.path)return false;
  const r=this.relay,at=Date.now(),peers=[...r.peers.values()].filter(p=>!p.virtualRoom&&!p.authorityRoom),ids=new Set(peers.map(p=>p.id));
  const snapshot={format:1,version:VERSION,at,
   peers:peers.map(p=>({...select(p,'id token progressId publicHostOwner rewardPublic publicMember listing listedAt seq acked clientSeq history historyBytes pending pendingBytes'),detachedAt:p.ws?at:p.detachedAt,links:[...p.links].filter(([,other])=>ids.has(other.id)).map(([channel,other])=>[channel,other.id])})),
   rooms:[...r.publicHost.rooms.values()].map(room=>select(room,'code options enabled key host pending state members order joinSerial lastJoin')),
   users:[...r.parties.users.values()].map(u=>({...select(u,'id profile ready party ticket inMatch matchPeer matchCode joined spectateLaunch'),inMatch:!!u.inMatch&&ids.has(u.matchPeer)})),
   parties:r.parties.parties,tickets:r.parties.tickets,invites:r.parties.invites,
   matches:[...r.progression.matches].filter(([,m])=>ids.has(m.room)).map(([key,m])=>[key,{...m,players:new Map([...m.players].map(([id,p])=>[id,{...p,peer:p.peer?.id}]))}])
  };
  const bytes=serialize(snapshot);mkdirSync(dirname(this.path),{recursive:true});writeFileSync(this.path+'.tmp',bytes,{mode:0o600});renameSync(this.path+'.tmp',this.path);
  console.info(JSON.stringify({event:'relay-recovery-saved',peers:peers.length,rooms:snapshot.rooms.length}));return true;
 }
 restore(){
  if(!this.path)return false;
  let s;try{s=deserialize(readFileSync(this.path));unlinkSync(this.path);}catch(error){if(error.code!=='ENOENT')console.error('Relay recovery file could not be read');return false;}
  const now=Date.now();if(s.format!==1||s.version!==VERSION||now-s.at>RELAY_SESSION_GRACE_MS||s.at>now)return false;
  const r=this.relay;
  for(const p of s.peers){p.links=new Map(p.links);p.ws=null;p.lastSeen=now;p.detachedAt=now-Math.max(0,s.at-p.detachedAt);p.rateAt=now;p.frames=0;p.bytes=0;r.peers.set(p.id,p);r.sessions.add(p);}
  for(const p of r.peers.values())for(const [channel,id]of p.links){const other=r.peers.get(id);if(other)p.links.set(channel,other);else p.links.delete(channel);}
  r.publicHost.rooms.clear();
  for(const data of s.rooms){const room=Object.assign(new PublicRoom(r,data.code,data.options),data);if(room.host){room.host.at=now;room.host.advancedAt=now;}r.publicHost.rooms.set(room.code,room);if(room.code===r.publicHost.legacy.code)r.publicHost.legacy=room;}
  for(const data of s.users){if(!r.parties.store.identities.has(data.id))continue;r.parties.users.set(data.id,{...data,sessions:new Map(),seen:now,disconnectedAt:now});}
  r.parties.parties=s.parties;r.parties.tickets=s.tickets;r.parties.invites=s.invites;
  for(const p of r.parties.parties.values())if(p.state==='queueing'&&p.launch)p.launch.created+=now-s.at;
  for(const t of r.parties.tickets.values())t.expires+=now-s.at;
  for(const room of r.publicHost.rooms.values())if(room.pending)room.pending.expires+=now-s.at;
  r.progression.matches=new Map(s.matches);
  for(const m of r.progression.matches.values())for(const p of m.players.values()){p.peer=r.peers.get(p.peer);if(p.activity)p.activity.last=now/1000;if(p.peer&&!m.finished)r.progression.bindInput(m,p,p.peer);}
  console.info(JSON.stringify({event:'relay-recovery-restored',peers:s.peers.length,rooms:s.rooms.length}));return true;
 }
}
