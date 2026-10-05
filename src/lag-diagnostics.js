const ms=n=>Number.isFinite(n)?`${n.toFixed(1)} ms`:'n/a';
export const publicDiagnosticsActive=(screen,state)=>screen==='game'&&state?.options?.recurring===true;
export function summarize(values){
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
 return sorted.length?{mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p95:sorted[Math.floor((sorted.length-1)*.95)],max:sorted.at(-1)}:{mean:0,p95:0,max:0};
}
export class LagDiagnostics{
 constructor(parent){
  this.root=document.createElement('section');this.root.className='lag-diagnostics';this.root.hidden=true;
  this.root.innerHTML='<h2>PUBLIC MATCH · LIVE LAG DIAGNOSTICS</h2><div class="lag-context"></div><div class="lag-columns"><pre class="lag-client"></pre><pre class="lag-server"></pre></div><p>F8: hide/show · Record through a spike and keep recording 10 seconds afterward.<br>Elapsed times are not CPU utilization. GPU time / exact GC cause unavailable. No player identities shown.</p>';
  parent.append(this.root);this.samples=[];this.longTasks=[];this.lastRender=-Infinity;this.enabled=true;
  window.addEventListener('keydown',e=>{if(e.code==='F8'&&!e.repeat&&this.active){e.preventDefault();this.enabled=!this.enabled;this.root.hidden=!this.enabled;}});
  try{this.observer=new PerformanceObserver(list=>{if(!this.active)return;for(const entry of list.getEntries())this.longTasks.push({at:entry.startTime,ms:entry.duration});this.longTasks=this.longTasks.slice(-60);});this.observer.observe({type:'longtask',buffered:false});}catch{this.observer=null;}
 }
 update(now,frame,work,render,state,net,view,report,screen){
  const active=publicDiagnosticsActive(screen,state)&&!document.hidden;
  if(active&&!this.active){this.samples=[];this.longTasks=[];this.lastRender=-Infinity;}
  this.active=active;this.root.hidden=!active||!this.enabled;if(!active)return;
  this.samples.push({at:now,frame,work,render});while(this.samples.length>600||this.samples[0]?.at<now-10000)this.samples.shift();
  if(now-this.lastRender<500)return;this.lastRender=now;
  const frames=summarize(this.samples.map(s=>s.frame)),works=summarize(this.samples.map(s=>s.work)),renders=summarize(this.samples.map(s=>s.render));
  const info=view?.renderer?.info,samples=report.network.samples,last=samples.at(-1),gaps=samples.slice(1).map((s,i)=>s.now-samples[i].now),gap=summarize(gaps),timing=state?.network?.timing||last?.serverTiming,quota=timing?.cpuQuota;
  const tasks=this.longTasks.filter(t=>t.at>=now-10000),heap=performance.memory;
  this.root.querySelector('.lag-context').textContent=`${state.royale?.stage||state.phase||'unknown'} · ${state.players?.length||0} actors · ${state.royale?.loot?.length??'n/a'} loot · shader preparation ${view?.mapCompile?'ACTIVE':'idle'} · rolling 10-second client window`;
  this.root.querySelector('.lag-client').textContent=`CLIENT / RENDERING\nFPS ${frames.mean?Math.round(1000/frames.mean):'n/a'} · frame p95 ${ms(frames.p95)}\nWorst frame ${ms(frames.max)}\nGame-loop JS mean / max\n  ${ms(works.mean)} / ${ms(works.max)}\nScene + render submission mean / max\n  ${ms(renders.mean)} / ${ms(renders.max)}\nState processing max ${ms(summarize(report.performance.updates).max)}\nLong tasks ≥50 ms: ${this.observer?tasks.length:'unsupported'} · max ${ms(summarize(tasks.map(t=>t.ms)).max)}\nDraw calls ${info?.render?.calls??'n/a'} · triangles ${info?.render?.triangles??'n/a'}\nGeometries ${info?.memory?.geometries??'n/a'} · textures ${info?.memory?.textures??'n/a'}\nJS heap ${heap?`${Math.round(heap.usedJSHeapSize/1048576)} / ${Math.round(heap.jsHeapSizeLimit/1048576)} MB`:'unavailable'}\n\nNETWORK (recent snapshots)\nRelay RTT ${ms(net?.peer?.relayLatency)} · state age ${net?.lastState?ms(now-net.lastState):'n/a'}\nUpdate gap p95 / max ${ms(gap.p95)} / ${ms(gap.max)}\nSend queue ${Math.round((net?.peer?.bufferedAmount||0)/1024)} KB · pending inputs ${report.performance.pending}\nAcknowledgement p95 ${ms(summarize(report.network.acks).p95)}`;
  const phases=Object.entries(timing?.phases||{}).map(([phase,t])=>`${phase.toUpperCase()} peaks (wall / process CPU)\n  Simulation ${ms(t.stepMaxMs)} / ${ms(t.stepCpuAtMaxMs)}\n  Broadcast ${ms(t.broadcastMaxMs)} / ${ms(t.broadcastCpuAtMaxMs)}\n  Callback gap ${ms(t.gapMaxMs)}`).join('\n');
  this.root.querySelector('.lag-server').textContent=`SERVER (match peaks, not current FPS)\n${phases||'Awaiting server timing sample…'}\n\nHOST CPU QUOTA\n${quota?.available?`Visible cap: ${quota.quotaCores===null?'no explicit cap':quota.quotaCores+' cores'}\nThrottled periods: ${quota.throttledPeriods} / ${quota.periods}\nAggregate throttled time: ${ms(quota.throttledMs)}\nCounter window: ${((quota.observedMs||0)/1000).toFixed(1)} s\nCounters since monitor start; not CPU %.`:'Quota / throttle counters unavailable'}\n\nREADING A SPIKE\nHigh render submission: scene/render CPU work.\nHigh state processing: snapshot/prediction work.\nServer peaks + update gaps: server/network delay.\nLow JS + long frame: investigate GPU / scheduling.\nThese are clues, not a confirmed root cause.`;
 }
}
