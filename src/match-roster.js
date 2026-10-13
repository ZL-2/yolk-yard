// Only connected human contestants count as real players. Admission tickets,
// spectators, bot fills and encounter NPCs never inflate the departure roster.
export function realMatchPlayers(state){
 return (state?.players||[]).filter(p=>!p.bot&&p.connected!==false&&p.contestant&&!p.lateSpectator&&!p.friendSpectator&&!p.spectating);
}
export function departureFeed(event){
 return event?.type==='leave'&&event.human&&event.name?{name:event.name,text:'checked out'}:null;
}
export function eliminationNotice(event,royale){
 return !royale&&event.streak>=3?`${event.streak} in a row!`:`Eliminated ${event.targetName}`;
}
