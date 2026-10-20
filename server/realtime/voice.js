import {randomUUID} from 'node:crypto';
const GAME_MODES=new Set(['boxfight','zonewars','ffa']);
const OPEN=1,MAX_BUFFER=16384;
// Audio has its own socket, bounded queues, no replay and no persistence.
export class VoiceService {
 constructor(relay){this.relay=relay;this.sessions=new Map();this.tickets=new Map();this.contexts=new Map();this.rosters=new Map();this.groups=new Map();this.serial=0;this.timer=setInterval(()=>this.sweep(),1000);this.timer.unref?.();}
 command(user,m,ws){
  if(m.type==='voice-ticket'){
   this.relay.parties.limit(user,'voice-ticket',15,60000);
   for(const [token,t]of this.tickets)if(t.user===user)this.tickets.delete(token);
   const token=randomUUID();this.tickets.set(token,{user,ws,until:Date.now()+15000});return {token};
  }
  if(m.type!=='voice-context')throw Error('Unknown voice action');
  this.relay.parties.limit(user,'voice-context',120,60000);
  const peer=this.relay.peers.get(m.peer),valid=peer?.ws?.readyState===OPEN&&peer.token===m.proof;
  if(!valid){this.contexts.delete(ws);this.scheduleSync();return true;}
  this.contexts.set(ws,{peer,user,at:Date.now()});
  const host=this.relay.peers.get(m.host),publicRoom=this.relay.publicHost.roomFor(peer);
  const owns=host===peer&&!!host?.listing||publicRoom?.host?.peer===peer.id&&publicRoom.host.address===host?.id;
  if(owns&&Array.isArray(m.roster)&&m.roster.length<=64){
   const rows=new Map();for(const row of m.roster){if(typeof row.id!=='string'||row.id.length>100)continue;rows.set(row.id,{team:Number.isInteger(row.team)&&row.team>=0&&row.team<64?row.team:null,squad:typeof row.squad==='string'?row.squad.slice(0,80):null,spectator:!!row.spectator});}
   this.rosters.set(host.id,{host,owner:peer,hostId:m.hostId,rows,at:Date.now()});
  }
  this.scheduleSync();return true;
 }
 location(session){
  const context=this.contexts.get(session.social),peer=context?.peer;
  if(!peer||Date.now()-context.at>5000||this.relay.peers.get(peer.id)!==peer||peer.ws?.readyState!==OPEN)return null;
  const authority=this.relay.authority.roomFor(peer),publicRoom=this.relay.publicHost.roomFor(peer);
  const host=authority?.hostPeer||this.relay.peers.get(publicRoom?.key)||[peer,...peer.links.values()].find(p=>p.listing);
  if(!host?.listing)return null;
  const roster=this.rosters.get(host.id),id=authority?peer.authorityId:publicRoom?.members.get(peer.id)?.id||(peer===host?roster?.hostId:peer.id);
  const row=authority?.sim.players.get(id)||(roster&&Date.now()-roster.at<5000?roster.rows.get(id):null);
  // Both ends must be admitted by the authoritative host, including code joins.
  if(!row)return null;
  const mode=host.listing.mode,teamMode=mode==='zombies'||mode==='royale'&&host.listing.teamSize>1||mode==='boxfight'&&host.listing.boxFormat!=='ffa';
  const team=row.spectator||row.friendSpectator?null:mode==='zombies'?row.zSquad||row.squad:teamMode&&row.team>=0?row.team:null;
  return {room:host.id,mode,team};
 }
 keys(s){const l=this.location(s),party=s.user.party;return {party:party?'party:'+party:null,team:l&&l.team!=null?'team:'+l.room+':'+l.team:null,game:l&&GAME_MODES.has(l.mode)?'game:'+l.room:null};}
 permitted(a,b){
  if(a.user.id===b.user.id||this.relay.parties.store.blocked(a.user.id,b.user.id))return false;
  const friends=this.relay.parties.store.friends.get(a.user.id)?.has(b.user.id),mates=a.user.party&&a.user.party===b.user.party||a.keys.team&&a.keys.team===b.keys.team;
  return [a,b].every(s=>s.access==='everybody'||s.access==='friends'&&friends||s.access==='team'&&(friends||mates));
 }
 live(s){return s.ws.readyState===OPEN&&s.social.readyState===OPEN&&s.user.sessions.has(s.social);}
 scheduleSync(){if(!this.syncTimer){this.syncTimer=setTimeout(()=>{this.syncTimer=null;this.sync();},100);this.syncTimer.unref?.();}}
 sync(){
  const sessions=[...this.sessions.values()].filter(s=>this.live(s));this.groups.clear();
  for(const s of sessions){const previous=s.syncKeys;s.keys=this.keys(s);if(previous&&s.keys[s.preferred]&&s.keys[s.preferred]!==previous[s.preferred])s.channel=s.preferred;s.channel=s.keys[s.channel]?s.channel:s.keys[s.preferred]?s.preferred:s.keys.party?'party':null;s.syncKeys=s.keys;for(const key of Object.values(s.keys)){if(!key)continue;let group=this.groups.get(key);if(!group)this.groups.set(key,group=[]);group.push(s);}}
  for(const s of sessions){
   const channels=['party','team','game'].map(id=>({id,available:!!s.keys[id],members:(this.groups.get(s.keys[id])||[]).filter(o=>o===s||this.permitted(s,o)).map(o=>({id:o.user.id,wire:o.wire,name:o.user.profile.name,channel:o.channel,muted:o.micMuted,deafened:o.deafened,self:o===s,codec:o.codec}))}));
   const message={type:'state',channel:s.channel,scope:s.keys[s.channel]||null,channels,wire:s.wire};const json=JSON.stringify(message);
   if(json!==s.last&&s.ws.bufferedAmount<MAX_BUFFER){s.last=json;s.ws.send(json);}
  }
 }
 attach(ws){
  let s,controls=0,controlAt=Date.now();const timeout=setTimeout(()=>{if(!s)ws.close(1008,'Join voice first');},10000);timeout.unref?.();
  ws.on('message',(raw,binary)=>{try{
   if(binary){if(!s)return ws.close(1008,'Join voice first');this.audio(s,raw);return;}
   if(raw.length>8192)throw Error('Invalid voice message');if(Date.now()-controlAt>1000){controlAt=Date.now();controls=0;}if(++controls>20)throw Error('Voice controls too fast');
   const m=JSON.parse(raw);
   if(!s){const t=this.tickets.get(m.token);this.tickets.delete(m.token);if(m.type!=='join'||!t||t.until<Date.now()||!t.user.sessions.has(t.ws)||t.ws.readyState!==OPEN)throw Error('Voice session expired');
    this.relay.owner?.assertPlayer(t.user.id);this.sessions.get(t.user.id)?.ws.close(4001,'Voice moved to another tab');
    s={ws,social:t.ws,user:t.user,wire:++this.serial,channel:'party',preferred:'party',access:'everybody',micMuted:true,deafened:false,muted:new Set(),codec:'pcm',tokens:8,at:Date.now(),seen:Date.now()};this.sessions.set(s.user.id,s);clearTimeout(timeout);
   }
   s.seen=Date.now();if(m.type==='ping'){ws.send(JSON.stringify({type:'pong',at:m.at}));return;}
   if(['join','settings'].includes(m.type)){
    if(['party','team','game'].includes(m.channel))s.channel=m.channel;
    if(['party','team','game'].includes(m.preferred))s.preferred=m.preferred;
    if(['everybody','friends','team','off'].includes(m.access))s.access=m.access;
    s.micMuted=m.micMuted!==false;s.deafened=!!m.deafened;s.codec=m.codec==='opus'?'opus':'pcm';
    s.muted=new Set(Array.isArray(m.muted)?m.muted.filter(x=>typeof x==='string').slice(0,100):[]);this.sync();
   }
  }catch(error){ws.close(1008,String(error.message).slice(0,100));}});
  ws.on('pong',()=>{if(s)s.seen=Date.now();});
  ws.on('error',()=>{});ws.on('close',()=>{clearTimeout(timeout);if(s&&this.sessions.get(s.user.id)===s){this.sessions.delete(s.user.id);this.sync();}});
 }
 audio(s,raw){
  if(raw.length<7||raw.length>4096)return s.ws.close(1008,'Invalid audio frame');
  const now=Date.now();s.tokens=Math.min(8,s.tokens+(now-s.at)*.055);s.at=now;if(s.tokens<1)return;s.tokens--;
  if(!this.live(s)||s.micMuted||s.deafened||s.access==='off')return;
  const keys=this.keys(s),key=keys[s.channel];s.keys=keys;if(!key)return;
  const codec=raw[0],payload=raw.length-6;if(codec===0?(payload!==640*2):codec!==1||payload>1500)return;
  const packet=Buffer.allocUnsafe(raw.length+4);packet.writeUInt32LE(s.wire,0);raw.copy(packet,4);
  for(const dest of this.groups.get(key)||[]){
   dest.keys=this.keys(dest);
   if(dest===s||!this.live(dest)||dest.deafened||s.muted.has(dest.user.id)||dest.muted.has(s.user.id)||dest.ws.bufferedAmount>MAX_BUFFER||!this.permitted(s,dest)||codec===1&&dest.codec!=='opus')continue;
   // Re-evaluate membership at forwarding time: leaving/blocking never leaks audio.
   if(dest.keys[dest.channel]===key)dest.ws.send(packet,{binary:true});
  }
 }
 sweep(){const now=Date.now();for(const [key,t]of this.tickets)if(t.until<now)this.tickets.delete(key);for(const [key,c]of this.contexts)if(c.at<now-10000||key.readyState!==OPEN)this.contexts.delete(key);for(const [key,r]of this.rosters)if(r.at<now-10000)this.rosters.delete(key);for(const s of this.sessions.values()){if(!this.live(s)||now-s.seen>45000)s.ws.close(1001,'Voice reconnecting');else s.ws.ping();}this.sync();}
 close(){clearInterval(this.timer);clearTimeout(this.syncTimer);for(const s of this.sessions.values())s.ws.close(1001,'Server restarting');this.sessions.clear();this.contexts.clear();this.rosters.clear();this.groups.clear();this.tickets.clear();}
}
