// Lobby control facade only. No online combat simulation runs in a browser.
export class RemoteSimulation{
 constructor(net,read){this.remote=true;this.net=net;this.read=read;}
 get players(){return new Map((this.read()?.players||[]).map(p=>[p.id,p]));}
 get options(){return this.read()?.options;}
 get phase(){return this.read()?.phase;}
 get time(){return this.read()?.time||0;}
 get queueEnds(){return this.read()?.royale?.queueEnds||0;}
 snapshot(){return this.read();}
 startRound(){this.net.authorityCommand({type:'start'});return true;}
 configure(options){this.net.authorityCommand({type:'configure',options});return true;}
 setProfile(_id,profile){this.net.authorityCommand({type:'profile',profile});return true;}
 playerAction(_id,action){this.net.authorityCommand({type:'player-action',action});}
 checkpoint(){return null;}
}
