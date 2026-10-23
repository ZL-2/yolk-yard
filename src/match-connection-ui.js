import {HOST_WAIT_NOTICE_MS,HOST_WAIT_TRANSFER_MS} from './host-timeout.js';
export class MatchConnectionUI{
 constructor(){this.root=document.createElement('aside');this.root.id='match-connection';this.root.hidden=true;this.root.setAttribute('role','status');this.root.setAttribute('aria-live','polite');this.root.innerHTML='<i aria-hidden="true"></i><div><strong></strong><span></span><button data-action="report-connection">F8 · REPORT PROBLEM</button></div>';document.querySelector('#hud').append(this.root);}
 update(net,playing,now=performance.now()){
  const stale=!!net&&!net.isHost&&net.ready&&now-net.lastState>HOST_WAIT_NOTICE_MS;
  const recovering=!!net?.migrating||!!net?.peer?.reconnecting;
  const shown=playing&&(recovering||stale);this.root.hidden=!shown;if(!shown)return;
  const title=net.migrating?'RECONNECTING MATCH':net.peer?.reconnecting?'RESTORING CONNECTION':net.serverAuthority?'WAITING FOR MATCH SERVER':'WAITING FOR MATCH HOST';
  const detail=net.migrating?'Transferring to a connected player. Your match is being preserved.':net.peer?.reconnecting?`Your match is preserved. Reconnecting${net.peer.retryAttempt>1?' · attempt '+net.peer.retryAttempt:''}…`:`No match update for ${Math.max(1,Math.floor((now-net.lastState)/1000))}s. ${net.serverAuthority?'Waiting for the server…':`Host transfer in ${Math.max(0,Math.ceil((HOST_WAIT_TRANSFER_MS-(now-net.lastState-HOST_WAIT_NOTICE_MS))/1000))}s if updates do not resume.`}`;
  for(const [selector,text]of [['strong',title],['span',detail]]){const node=this.root.querySelector(selector);if(node.textContent!==text)node.textContent=text;}
 }
}
