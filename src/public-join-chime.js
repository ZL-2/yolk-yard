export class PublicJoinChime{
 constructor(){this.previous=null;}
 update(match,inLobby){
  const count=match?.joinSerial;if(!Number.isFinite(count))return false;
  const changed=this.previous!==null&&count>this.previous;this.previous=count;
  return changed&&inLobby;
 }
}
