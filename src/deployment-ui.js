import {relayURL} from './relay-peer.js';
export class DeploymentUI{
 constructor({build,onStart,onReady,fetcher=fetch}={}){Object.assign(this,{build,onStart,onReady,fetcher});this.active=false;try{if(sessionStorage.getItem('ravelfront-update-pending')==='1')this.show();}catch{}this.timer=setInterval(()=>void this.check(),4000);this.wake=()=>void this.check();globalThis.window?.addEventListener('focus',this.wake);queueMicrotask(this.wake);}
 accept(status){
  if(!status||typeof status.updating!=='boolean')return;
  this.readyStatus=status;
  if(status.updating){this.show();return;}
  // A ready notification on the existing socket also verifies Pages. HTTP
  // polling must not be the only way to release a persisted update screen.
  if(this.active)void this.verify(status);

 }
 show(){if(this.active)return;this.active=true;try{sessionStorage.setItem('ravelfront-update-pending','1');}catch{}
  if(document.pointerLockElement)document.exitPointerLock();
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  const node=document.createElement('section');node.id='deployment-screen';node.setAttribute('role','status');node.setAttribute('aria-live','polite');
  node.innerHTML='<div class="deployment-brand">RAVELFRONT <span>FIELD OPERATIONS</span></div><div class="deployment-copy"><span>UPLINK IN PROGRESS</span><h1>NEW ORDERS.<br>COMING ONLINE.</h1><p>Ravelfront is updating. We’re publishing the game and reconnecting the match service.</p><div class="deployment-track"></div><small>This screen will stay here until the full update is ready.</small></div>';document.body.append(node);this.onStart?.();
 }
 async verify(status){
  if(status.updating||!status.build||this.verifying||this.refreshing)return;
  this.verifying=true;
  try{
   const r=await this.fetcher(new URL('version.json?t='+Date.now(),location.href),{cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!r.ok)return;const frontend=await r.json();
   // A newer socket notification supersedes an in-flight older probe.
   if(this.readyStatus!==status)return;
   if(frontend.build!==status.build){this.show();return;}
   if(frontend.build!==this.build){
    this.refreshing=true;
    // The destination build has been verified. Do not restore the old latch
    // on the new document if its status request is temporarily unavailable.
    try{sessionStorage.removeItem('ravelfront-update-pending');}catch{}
    this.onReady?.(frontend.build);return;
   }
   if(this.active){this.active=false;document.querySelector('#deployment-screen')?.remove();try{sessionStorage.removeItem('ravelfront-update-pending');}catch{}this.onReady?.(null);}
  }catch{}finally{this.verifying=false;}
 }
 async check(){
  if(this.checking||!relayURL()||this.refreshing)return;this.checking=true;
  try{
   const url=new URL(relayURL());url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/deployment';url.searchParams.set('t',Date.now());
   const response=await this.fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!response.ok)return;const status=await response.json();this.accept(status);
   if(!status.updating)await this.verify(status);
  }catch{ // Socket readiness remains usable if the standalone HTTP probe fails.
   if(this.readyStatus&&!this.readyStatus.updating)await this.verify(this.readyStatus);
  }finally{this.checking=false;}
 }
}
