export const PERFORMANCE_DEFAULTS={showFps:true,netDebugStats:true,connectionWarnings:true};
// Connection health, not a measurement of Wi-Fi signal strength or TCP packet loss.
export function connectionHealth(net,now){
 if(!net)return 'healthy';
 const peer=net.peer,age=net.lastState?Math.max(0,now-net.lastState):0;
 const rtt=net.serverAuthority?peer?.relayLatency:net.latency;
 if(net.closed||peer?.destroyed||peer?.disconnected||peer?.reconnecting||net.migrating||age>1500||rtt>500)return 'critical';
 if(age>250||rtt>150||(peer?.bufferedAmount||0)>65536)return 'degraded';
 return 'healthy';
}
const signal=`<svg viewBox="0 0 64 54" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="5"><path d="M6 18Q32-4 58 18M15 28Q32 12 49 28M24 38Q32 30 40 38"/></g><circle cx="32" cy="46" r="3"/><path class="signal-arrow" d="M8 27v17H2l10 10 10-10h-6V27z"/><path class="signal-cross" d="m47 29 12 23m0-23L47 52" fill="none" stroke-width="6"/></svg>`;
export class PerformanceHUD{
 constructor(parent){
  this.root=document.createElement('div');this.root.className='performance-hud';this.root.hidden=true;
  this.root.innerHTML=`<div class="performance-network"><div class="connection-signal" hidden role="img">${signal}</div><div class="net-details"><div class="net-ping">Ping: —</div><div class="net-columns"><div class="net-down"></div><div class="net-up"></div></div><div class="net-loss" title="WebSockets deliver reliable ordered messages. The browser does not expose underlying packet loss.">Packet loss: —</div><svg class="net-graph" viewBox="0 0 180 22" preserveAspectRatio="none" aria-label="Recent connection latency"><polyline fill="none" stroke="currentColor" stroke-width="1.5"/></svg></div></div><div class="performance-fps"></div>`;
  parent.append(this.root);this.network=this.root.querySelector('.performance-network');this.details=this.root.querySelector('.net-details');this.signal=this.root.querySelector('.connection-signal');this.fpsNode=this.root.querySelector('.performance-fps');this.frames=[];this.history=[];this.lastRender=-Infinity;this.net=null;
 }
 update(now,frameMs,net,settings,active){
  this.root.hidden=!active;
  if(!active){this.frames=[];this.lastRender=-Infinity;this.net=null;return;}
  if(frameMs>0&&Number.isFinite(frameMs)){this.frames.push(frameMs);if(this.frames.length>120)this.frames.shift();}
  if(net!==this.net){this.net=net;this.history=[];this.rateAt=now;this.previous=null;this.rates=null;this.warning='healthy';this.warningUntil=0;}
  if(now-this.lastRender<200)return;this.lastRender=now;
  this.fpsNode.hidden=!settings.showFps;this.details.hidden=!settings.netDebugStats;
  this.fpsNode.textContent=this.frames.length?`${Math.round(1000*this.frames.length/this.frames.reduce((a,b)=>a+b,0))} FPS`:'— FPS';
  const peer=net?.peer,counts=peer&&[peer.receivedBytes,peer.sentBytes,peer.receivedPackets,peer.sentPackets].every(Number.isFinite)?{down:peer.receivedBytes,up:peer.sentBytes,in:peer.receivedPackets,out:peer.sentPackets}:null;
  if(counts){
   if(!this.previous){this.previous=counts;this.rateAt=now;}
   else if(now-this.rateAt>=1000){const seconds=(now-this.rateAt)/1000;this.rates=Object.fromEntries(Object.keys(counts).map(k=>[k,Math.max(0,(counts[k]-this.previous[k])/seconds)]));this.previous=counts;this.rateAt=now;}
  }
  const rtt=net?(net.serverAuthority?peer?.relayLatency:net.latency||null):null;
  this.root.querySelector('.net-ping').textContent=net?`Ping: ${Number.isFinite(rtt)?Math.round(rtt)+' ms':'—'}`:'Ping: Local';
  for(const [selector,arrow,bytes,packets]of [['.net-down','↓','down','in'],['.net-up','↑','up','out']])this.root.querySelector(selector).textContent=this.rates?`${arrow} ${(this.rates[bytes]/1024).toFixed(2)} KB/s · ${Math.round(this.rates[packets])} msg/s`:`${arrow} — KB/s · — msg/s`;
  const health=connectionHealth(net,now);
  if(health!=='healthy'){this.warning=health;this.warningUntil=now+(health==='critical'?2000:1000);}
  else if(now>=this.warningUntil)this.warning='healthy';
  this.signal.hidden=!settings.connectionWarnings||this.warning==='healthy';
  this.signal.dataset.health=this.warning;this.signal.setAttribute('aria-label',this.warning==='critical'?'Connection interrupted or severely delayed':'Connection delayed');
  this.network.hidden=this.details.hidden&&this.signal.hidden;
  this.history.push({rtt:Number.isFinite(rtt)?rtt:0,health});if(this.history.length>60)this.history.shift();
  this.root.querySelector('polyline').setAttribute('points',this.history.map((s,i)=>`${i*3},${21-Math.min(20,s.rtt/25)}`).join(' '));
  this.root.querySelector('.net-graph').dataset.health=health;
 }
}
