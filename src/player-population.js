// A connected contestant playing this round. Brief lobby and spectator states
// are part of a match session but are not active players.
export function activeContestant(player){
 return !!player&&!player.bot&&!player.boss&&!player.henchman&&player.connected!==false&&
  !player.spectating&&!player.lateSpectator&&!player.friendSpectator&&!player.afkRemoved&&
  !player.zExtracted&&!player.awaitingEntry&&player.contestant!==false&&player.health>0;
}
