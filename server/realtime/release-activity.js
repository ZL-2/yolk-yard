// Aggregate only: never expose player identities through a public status endpoint.
export function releaseActivity(relay){
 let lobby=0,active=0,unknown=0;const checked=new Set();
 // A game socket may still be connected while its separate Social socket reconnects.
 for(const peer of relay.peers?.values()||[]){
  if(peer.ws?.readyState!==1)continue;checked.add(peer.id);
  const room=relay.authority?.roomFor(peer),host=room?.hostPeer||[peer,...(peer.links?.values()||[])].find(p=>p.listing),phase=host?.listing?.phase;
  if(phase==='lobby')lobby++;else if(phase==='playing')active++;else unknown++;
 }
 for(const u of relay.parties.users.values()){
  if(!relay.parties.connected(u)||checked.has(u.matchPeer))continue;
  if(!u.inMatch){lobby++;continue;}const location=relay.parties.matchLocation(u);
  if(!location){unknown++;continue;}if(location.listing.phase==='lobby')lobby++;else active++;
 }
 return {safe:active===0&&unknown===0,activePlayers:active,lobbyPlayers:lobby,unknownPlayers:unknown,checkedAt:Date.now()};
}
