import {relayURL} from './relay-peer.js';
import './deployment-ui.css';
export class DeploymentUI{
 constructor({build,onStart,onReady}={}){Object.assign(this,{build,onStart,onReady});this.active=false;try{if(sessionStorage.getItem('ravelfront-update-pending')==='1')this.show();}catch{}this.timer=setInterval(()=>void this.check(),4000);void this.check();}
 accept(status){
  if(!status||typeof status.updating!=='boolean')return;
  if(status.updating){this.show();return;}
  if(!this.active)return;
  // Never reopen on an old server's successful probe or an incomplete Pages
  // deployment. The same build must be visible from both services.
  this.readyStatus=status;
 }
 show(){if(this.active)return;this.active=true;try{sessionStorage.setItem('ravelfront-update-pending','1');}catch{}
  if(document.pointerLockElement)document.exitPointerLock();
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  const node=document.createElement('section');node.id='deployment-screen';node.setAttribute('role','status');node.setAttribute('aria-live','polite');
  node.innerHTML='<div class="deployment-brand">RAVELFRONT <span>FIELD OPERATIONS</span></div><div class="deployment-copy"><span>UPLINK IN PROGRESS</span><h1>NEW ORDERS.<br>COMING ONLINE.</h1><p>Ravelfront is updating. We’re publishing the game and reconnecting the match service.</p><div class="deployment-track"></div><small>This screen will stay here until the full update is ready.</small></div>';document.body.append(node);this.onStart?.();
 }
 async check(){
  if(this.checking||!relayURL())return;this.checking=true;
  try{
   const url=new URL(relayURL());url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/deployment';url.searchParams.set('t',Date.now());
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)return;const status=await response.json();this.accept(status);
   if(!status.updating){
    const r=await fetch(new URL('version.json?t='+Date.now(),location.href),{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)return;const frontend=await r.json();
    if(status.build&&frontend.build!==status.build){this.show();return;}
    let pending=false;try{pending=sessionStorage.getItem('ravelfront-update-pending')==='1';}catch{}
    if(this.active||pending){
     if(status.build!==frontend.build||!status.build)return;
     if(frontend.build!==this.build){this.onReady?.(frontend.build);return;}
     this.active=false;document.querySelector('#deployment-screen')?.remove();try{sessionStorage.removeItem('ravelfront-update-pending');}catch{}this.onReady?.(null);
    }
   }
  }catch{ /* Keep the screen throughout server downtime and failed publish probes. */ }
  finally{this.checking=false;}
 }
}
