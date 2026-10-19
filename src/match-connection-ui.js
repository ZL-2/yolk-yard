export class MatchConnectionUI{
 constructor(){this.root=document.createElement('aside');this.root.id='match-connection';this.root.hidden=true;this.root.setAttribute('role','status');this.root.setAttribute('aria-live','polite');this.root.innerHTML='<i aria-hidden="true"></i><div><strong></strong><span></span><button data-action="report-connection">REPORT PROBLEM</button></div>';document.querySelector('#hud').append(this.root);}
 update(net,playing,now=performance.now()){
  const stale=!!net&&!net.isHost&&!net.serverAuthority&&net.ready&&now-net.lastState>1800;
  const recovering=!!net?.migrating||!!net?.peer?.reconnecting;
  const shown=playing&&(recovering||stale);this.root.hidden=!shown;if(!shown)return;
  const title=net.migrating?'RECONNECTING MATCH':net.peer?.reconnecting?'RESTORING CONNECTION':'WAITING FOR MATCH HOST';
  const detail=net.migrating?'Transferring to a connected player. Your match is being preserved.':net.peer?.reconnecting?'Restoring the game connection. Please stay in the match.':'The host is catching up. Your controls will resume with the next update.';
  for(const [selector,text]of [['strong',title],['span',detail]]){const node=this.root.querySelector(selector);if(node.textContent!==text)node.textContent=text;}
 }
}
