import {relayURL} from './relay-peer.js';
export function elapsedClock(start,now=Date.now()){
 const total=Math.max(0,Math.floor((now-start)/1000));return [Math.floor(total/3600),Math.floor(total/60)%60,total%60].map(n=>String(n).padStart(2,'0')).join(':');
}
export class LobbyStatus{
 constructor({url,fetcher=fetch,now=Date.now,storage=globalThis.localStorage}={}){
  this.now=now;this.fetcher=(...args)=>fetcher(...args);this.storage=storage;this.url=url;this.server=[];this.offset=0;this.frames=[];this.lastObserve=0;this.failedSince=null;this.candidate=null;this.local=null;
  if(!this.url){try{const u=new URL(relayURL());u.protocol=u.protocol==='wss:'?'https:':'http:';u.pathname='/status';u.search='';this.url=u.href;}catch{}}
  try{const saved=JSON.parse(storage?.getItem('ravelfront-local-incident'));if(saved&&Number.isFinite(saved.startedAt)&&now()-saved.seenAt<60000&&['rendering','connection','service'].includes(saved.kind))this.local=saved;}catch{}
  this.root=document.createElement('aside');this.root.className='lobby-service-status';this.root.hidden=true;this.root.setAttribute('role','status');this.root.innerHTML='<strong>PERFORMANCE NOTICE</strong><p class="service-issue"></p><p class="service-work">We’re working to restore smooth gameplay.</p><div class="service-elapsed">ONGOING FOR <time>00:00:00</time></div>';
  document.body.append(this.root);this.pollTimer=setInterval(()=>void this.poll(),15000);this.pollTimer.unref?.();void this.poll();
 }
 save(){try{if(this.local)this.storage?.setItem('ravelfront-local-incident',JSON.stringify(this.local));else this.storage?.removeItem('ravelfront-local-incident');}catch{}}
 async poll(){
  if(!this.url||this.polling||document.hidden)return;this.polling=true;
  try{
   const response=await this.fetcher(this.url,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('unavailable');
   const data=await response.json();if(!Array.isArray(data.active)||!Number.isFinite(data.serverTime))throw Error('invalid');
   this.server=data.active.filter(i=>Number.isFinite(i.startedAt)&&typeof i.message==='string').slice(0,4);this.offset=data.serverTime-this.now();this.failedSince=null;
   if(this.local?.kind==='service'){this.local=null;this.save();}
  }catch{this.failedSince??=this.now();if(this.now()-this.failedSince>=15000){this.local={kind:'service',startedAt:this.failedSince,seenAt:this.now()};this.save();}}
  finally{this.polling=false;}
 }
 update(now,frameMs,net,screen){
  const wall=this.now();this.root.hidden=!['menu','lobby'].includes(screen)||document.hidden;
  if(screen==='game'&&!document.hidden&&frameMs>0){this.windowGap=Math.max(this.windowGap||0,net?.lastState?now-net.lastState:0);this.frames.push(frameMs);if(this.frames.length>120)this.frames.shift();}else this.frames=[];
  if(now-this.lastObserve>=5000){
   this.lastObserve=now;
   if(screen==='game'&&!document.hidden&&this.frames.length>30){
    const fps=1000*this.frames.length/this.frames.reduce((a,b)=>a+b,0);
    const rtt=net?.serverAuthority?net.peer?.relayLatency:net?.latency;
    const gap=Math.max(this.windowGap||0,net?.lastState?now-net.lastState:0);this.windowGap=0;
    const connection=net&&(net.peer?.reconnecting||net.peer?.disconnected||net.closed||gap>400||rtt>180);
    const kind=connection?'connection':fps<30?'rendering':null;
    if(net?.ready&&!net.closed)net.peer?.control?.({type:'performance-report',metrics:{fps:Math.min(1000,fps),rtt:Math.min(60000,Number.isFinite(rtt)?rtt:0),gap:Math.min(60000,gap)}});
    if(kind){if(this.candidate?.kind!==kind)this.candidate={kind,at:wall};if(wall-this.candidate.at>=15000){if(this.local?.kind!==kind)this.local={kind,startedAt:this.candidate.at};this.local.seenAt=wall;this.goodSince=null;this.save();}}
    else{this.candidate=null;this.goodSince??=wall;if(this.local&&wall-this.goodSince>=60000){this.local=null;this.save();}}
   }
   if(this.local?.kind!=='service'&&this.local&&wall-this.local.seenAt>60000){this.local=null;this.save();}
  }
  const shared=this.server.reduce((a,i)=>!a||i.startedAt<a.startedAt?i:a,null);
  const issue=shared||this.local;
  if(!issue){this.root.hidden=true;return;}
  this.root.querySelector('.service-issue').textContent=shared?shared.message:this.local.kind==='service'?'This browser is having trouble reaching the match service.':this.local.kind==='rendering'?'Low frame rates were recently detected on this device.':'Delayed gameplay updates were recently detected in your session.';
  this.root.querySelector('time').textContent=elapsedClock(issue.startedAt,wall+(shared?this.offset:0));
 }
 close(){clearInterval(this.pollTimer);this.root.remove();}
}
