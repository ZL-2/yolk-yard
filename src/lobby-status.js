import {relayURL} from './relay-peer.js';
import {prepareFrontMessage,updateFrontMessage} from './front-message.js';
export function elapsedClock(start,now=Date.now()){
 const total=Math.max(0,Math.floor((now-start)/1000));return [Math.floor(total/3600),Math.floor(total/60)%60,total%60].map(n=>String(n).padStart(2,'0')).join(':');
}
export class LobbyStatus{
 constructor({url,fetcher=fetch,now=Date.now,monotonic=()=>performance.now(),storage=globalThis.localStorage}={}){
  this.now=now;this.monotonic=monotonic;this.fetcher=(...args)=>fetcher(...args);this.url=url;this.notice=null;this.frames=[];this.lastObserve=0;this.syncedAt=null;
  if(!this.url){try{const u=new URL(relayURL());u.protocol=u.protocol==='wss:'?'https:':'http:';u.pathname='/status';u.search='';this.url=u.href;}catch{}}
  // Retire the old per-browser incident timer. Shared incidents come only from the server.
  try{storage?.removeItem('ravelfront-local-incident');}catch{}
  this.root=document.createElement('aside');this.root.className='lobby-service-status';this.root.hidden=true;this.root.setAttribute('role','status');this.root.innerHTML='<strong>WIDESPREAD PERFORMANCE NOTICE</strong><p class="service-issue"></p><p class="service-work">We’re working to restore smooth gameplay.</p><div class="service-elapsed">ONGOING FOR <time>00:00:00</time></div>';
  prepareFrontMessage(this.root);this.pollTimer=setInterval(()=>void this.poll(),5000);this.pollTimer.unref?.();void this.poll();
 }
 async poll(){
  if(!this.url||this.polling||document.hidden)return;this.polling=true;
  try{
   const before=this.monotonic();
   const response=await this.fetcher(this.url,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('unavailable');
   const data=await response.json(),after=this.monotonic();if(!Number.isFinite(data.serverTime))throw Error('invalid');
   this.notice=data.notice?.scope==='widespread'&&Number.isFinite(data.notice.startedAt)&&typeof data.notice.message==='string'?data.notice:null;
   this.serverAtSync=data.serverTime+(after-before)/2;this.syncedAt=after;
  }catch{/* An individual fetch failure is not evidence of a widespread incident. */}
  finally{this.polling=false;}
 }
 update(now,frameMs,net,screen){
  this.root.hidden=!['menu','lobby'].includes(screen)||document.hidden;
  if(screen==='game'&&!document.hidden&&frameMs>0){this.windowGap=Math.max(this.windowGap||0,net?.lastState?now-net.lastState:0);this.frames.push(frameMs);if(this.frames.length>120)this.frames.shift();}else this.frames=[];
  if(now-this.lastObserve>=5000){
   this.lastObserve=now;
   if(screen==='game'&&!document.hidden&&this.frames.length>30){
    const fps=1000*this.frames.length/this.frames.reduce((a,b)=>a+b,0);
    const rtt=net?.serverAuthority?net.peer?.relayLatency:net?.latency;
    const gap=Math.max(this.windowGap||0,net?.lastState?now-net.lastState:0);this.windowGap=0;
    if(net?.ready&&!net.closed)net.peer?.control?.({type:'performance-report',metrics:{fps:Math.min(1000,fps),rtt:Math.min(60000,Number.isFinite(rtt)?rtt:0),gap:Math.min(60000,gap)}});
   }
  }
  const clock=this.monotonic();
  if(!this.notice||this.syncedAt===null||clock-this.syncedAt>45000){this.root.hidden=true;updateFrontMessage(this.root,false);return;}
  this.root.querySelector('.service-issue').textContent=this.notice.message;
  this.root.querySelector('time').textContent=elapsedClock(this.notice.startedAt,this.serverAtSync+clock-this.syncedAt);
  updateFrontMessage(this.root,!this.root.hidden);
 }
 close(){clearInterval(this.pollTimer);this.root.remove();}
}
