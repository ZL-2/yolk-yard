import {randomUUID} from 'node:crypto';
import {moderateText,CHAT_LIMIT} from '../../src/moderation.js';
// Ephemeral, bounded histories. Party membership and authenticated identity,
// never a caller-provided recipient list, authorize both reads and sends.
export class LobbyChat {
 constructor(service){this.service=service;this.rooms=new Map();}
 scope(u,m){
  const s=this.service,p=s.parties.get(u.party),channel=m.channel;
  if(channel==='universal')return {key:'universal',channel,ids:null};
  if(!p?.members.includes(u.id))throw Error('Your party is unavailable.');
  if(channel==='party')return {key:p.id,channel,ids:p.members};
  if(channel==='private'&&m.to!==u.id&&p.members.includes(m.to)&&!s.store.blocked(u.id,m.to))return {key:p.id+':'+[u.id,m.to].sort().join(':'),channel,ids:[u.id,m.to],to:m.to};
  throw Error('Choose someone in your current party.');
 }
 history(u,m){const scope=this.scope(u,m),now=Date.now();return {channel:scope.channel,to:scope.to,messages:(this.rooms.get(scope.key)||[]).filter(x=>now-x.at<30*60000&&!this.service.store.blocked(u.id,x.sender))};}
 submit(u,m){
  const s=this.service;if(['in-match','spectating'].includes(s.presence(u.id)))throw Error('Return to the lobby to send lobby chat.');
  s.relay.owner?.assertChat(u.id);
  const slow=s.relay.owner?.controls.chatSlowSeconds||0;if(slow&&u.lastLobbyChat&&Date.now()-u.lastLobbyChat.at<slow*1000)throw Error('Chat slow mode: wait '+Math.ceil(slow-(Date.now()-u.lastLobbyChat.at)/1000)+' seconds.');
  s.limit(u,'lobby-chat',5,10000);const scope=this.scope(u,m);
  if(typeof m.text!=='string'||m.text.length>CHAT_LIMIT)throw Error('Write a shorter message.');
  const result=moderateText(m.text);if(!result.ok)throw Error('Please keep chat friendly and avoid personal information.');
  if(u.lastLobbyChat?.text===result.text&&Date.now()-u.lastLobbyChat.at<20000)throw Error('Please avoid repeating messages.');
  const message={id:randomUUID(),sender:u.id,name:u.profile.name,channel:scope.channel,to:scope.to,text:result.text,at:Date.now(),party:scope.channel==='universal'?null:u.party};
  u.lastLobbyChat=message;
  for(const [key,rows]of this.rooms)if(Date.now()-rows.at(-1).at>30*60000)this.rooms.delete(key);
  if(!this.rooms.has(scope.key)&&this.rooms.size>=512)this.rooms.delete(this.rooms.keys().next().value);
  this.rooms.set(scope.key,[...(this.rooms.get(scope.key)||[]),message].slice(-50));
  for(const v of s.users.values())if((scope.ids?scope.ids.includes(v.id):!['in-match','spectating'].includes(s.presence(v.id)))&&!s.store.blocked(u.id,v.id))s.send(v,{type:'lobby-chat',message});
  return message;
 }
}
