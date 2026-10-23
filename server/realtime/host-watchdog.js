import {HOST_STALL_MS,HOST_TIMEOUT_REASON,MATCH_ENDED_REASON} from '../../src/host-timeout.js';

// The relay is the only arbiter. Native socket pongs cannot keep a frozen
// simulation alive, and a guest cannot evict a host by reporting it as stalled.
export class HostWatchdog{
 constructor(relay){this.relay=relay;this.rooms=new Map();this.owners=new Map();}
 publish(peer,room){
  if(!room||!['playing','results'].includes(room.watch?.phase)||!Number.isFinite(room.watch?.time)||typeof room.watch?.matchId!=='string') {const old=this.rooms.get(peer.id);if(old)this.owners.delete(old.owner);this.rooms.delete(peer.id);return;}
  const now=Date.now(),matchId=room.watch.matchId.slice(0,80),owner=peer.hostOwner||peer.publicHostOwner||peer.id;let watch=this.rooms.get(peer.id);
  if(!watch||watch.peer!==peer||watch.owner!==owner||watch.matchId!==matchId){if(watch)this.owners.delete(watch.owner);watch={peer,address:peer.id,owner,hostId:String(room.hostId||'host').slice(0,80),matchId,time:room.watch.time,advancedAt:now};this.rooms.set(peer.id,watch);this.owners.set(watch.owner,watch);}
  else if(room.watch.time>watch.time){watch.time=room.watch.time;watch.advancedAt=now;}
 }
 observe(peer,data){
  // Read only constant-size metadata; never decode world state in the relay.
  const state=data?.type==='state'?data.state:data?.type==='snapshot-v1'?(data.frame?.full||data.frame?.patch)?.state:null;
  const time=Array.isArray(state?.time)?state.time[0]:state?.time;if(!Number.isFinite(time))return;
  const watch=this.rooms.get(peer.id)||this.owners.get(peer.id);
  if(watch&&this.rooms.get(watch.address)===watch&&time>watch.time){watch.time=time;watch.advancedAt=Date.now();}
 }
 ready(peer,message){
  const watch=this.rooms.get(message.hostAddress);if(!watch||message.matchId!==watch.matchId)return;
  if(![...peer.links.values()].some(p=>p.id===watch.address||p.id===watch.owner))return;
  peer.hostReady={address:watch.address,matchId:watch.matchId,at:Date.now(),ready:message.ready===true};
 }
 sweep(){
  const now=Date.now();
  for(const [address,watch]of this.rooms){
   const host=this.relay.peers.get(address);if(!host){this.rooms.delete(address);this.owners.delete(watch.owner);continue;}
   if(now-watch.advancedAt<HOST_STALL_MS)continue;
   const room=this.relay.publicHost.roomByAddress(address),owner=this.relay.peers.get(watch.owner);
   const guests=room?[...room.members.values()].filter(m=>m.peer!==address&&m.peer!==watch.owner).map(m=>this.relay.peers.get(m.peer)).filter(Boolean):[...new Set([...host.links.values(),...(owner?.links.values()||[])])].filter(p=>p!==host&&p!==owner);
   const active=room?guests.filter(p=>{const m=room.members.get(p.id);return m.ready&&now-m.readyAt<8000&&m.readyMatch===watch.matchId&&!m.admission.friendSpectator&&p.ws?.readyState===1;}):guests.filter(p=>p.ws?.readyState===1&&p.hostReady?.ready&&p.hostReady.address===address&&p.hostReady.matchId===watch.matchId&&now-p.hostReady.at<8000);
   this.rooms.delete(address);this.owners.delete(watch.owner);
   if(active.length)for(const p of guests)this.relay.send(p,{type:'host-transfer',hostId:watch.hostId,candidates:active.map(p=>p.id),matchId:watch.matchId});
   if(room)room.transferReason=HOST_TIMEOUT_REASON;
   // Revoke both address and owner before anyone is authorized to take over.
   this.relay.remove(host,1008,HOST_TIMEOUT_REASON);
   if(owner&&owner!==host)this.relay.remove(owner,1008,HOST_TIMEOUT_REASON);
   if(!active.length){for(const p of guests)this.relay.remove(p,1008,MATCH_ENDED_REASON);if(room){room.host=null;room.pending=null;room.state=null;}continue;}
   if(room)delete room.transferReason;
  }
 }
}
