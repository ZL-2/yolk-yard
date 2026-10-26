import './owner-match.css';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={warn:'Warn',kick:'Kick',ban:'Suspend',mute:'Mute text',teaming:'Teaming penalty',cheating:'Cheating penalty',unmute:'Unmute',unban:'Lift suspension',announce:'Announce', 'end-match':'End match','reverse-teaming':'Reverse teaming penalty'};
const descriptions={cheating:'Remove players now, suspend all modes for 1 hour and deny match rewards. Only a Cup violation also prohibits the next scheduled Cup.',warn:'Privately notify the selected players.',kick:'Remove the selected players from this match.',ban:'Remove players and suspend every mode for the selected duration.',mute:'Restrict match and lobby text chat. Voice is unchanged.',teaming:'Remove players now, suspend every mode for 1 hour and deny final rewards from this match. Cup removals also prohibit the next scheduled Cup.',unmute:'Lift this owner text-chat restriction.',unban:'Lift this owner suspension. Separate teaming penalties remain.',announce:'Show this announcement privately in the match HUD to everyone in this room.', 'end-match':'End this room for everyone. An active Cup is cancelled without Cup rewards.', 'reverse-teaming':'Lift this case’s one-hour suspension and Cup exclusion. This does not restore players to an ongoing match.'};
export class OwnerMatchPanel{
 constructor({api,context,onFocus=()=>{},onPlay=()=>{},notify=()=>{}}){
  Object.assign(this,{api,context,onFocus,onPlay,notify,selected:new Set(),interacting:false,busy:false,serial:0});
  this.root=document.createElement('section');this.root.className='owner-match';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','false');this.root.setAttribute('aria-label','Owner match operations');
  this.root.innerHTML=`<header class="om-head" tabindex="0" aria-label="Move owner window with arrow keys"><div><span class="om-eyebrow">RAVELFRONT / OWNER</span><b>Match operations</b></div><span class="om-live">LIVE</span><button data-om-min title="Minimize and return to play" aria-label="Minimize owner panel">−</button><button data-om-lock title="Lock owner access" aria-label="Lock owner access">×</button></header><div class="om-body"><div class="om-context"></div><p class="om-status" role="status" aria-live="polite"></p><div class="om-roster-head"><label>Find a player<input class="om-search" type="search" placeholder="Name or player ID" autocomplete="off"></label><button data-om-refresh title="Refresh roster">↻</button></div><div class="om-roster" role="group" aria-label="Match players"></div><div class="om-selection">Choose players below their names.</div><div class="om-actions">${Object.entries(labels).filter(([k])=>k!=='reverse-teaming').map(([k,v])=>`<button data-om-action="${k}" title="${esc(descriptions[k])}" ${['teaming','cheating','end-match'].includes(k)?'class="om-danger"':''}>${v}</button>`).join('')}</div><label class="om-reason-label">Reason / message<textarea class="om-reason" rows="2" maxlength="300" placeholder="Explain what happened. Affected players receive this message."></textarea></label><label class="om-duration-label">Restriction duration<select class="om-duration"><option value="1">1 hour</option><option value="24">24 hours</option><option value="168">7 days</option></select></label><div class="om-confirm" hidden></div><details class="om-cases"><summary>Active teaming penalties</summary><div></div></details><details class="om-history"><summary>Action history</summary><div></div></details><footer>Private, authenticated, and audited. Your player remains vulnerable.<button data-om-play>RETURN TO PLAY</button></footer></div>`;
  this.root.querySelector('.om-duration-label').after(this.root.querySelector('.om-actions'));
  document.body.append(this.root);this.header=this.root.querySelector('.om-head');this.status=this.root.querySelector('.om-status');
  for(const event of ['pointerdown','mousedown','wheel','keyup'])this.root.addEventListener(event,e=>e.stopPropagation());
  this.root.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();this.minimize();}});
  this.root.querySelector('[data-om-min]').onclick=()=>this.interacting?this.minimize():this.expand();this.root.querySelector('[data-om-lock]').onclick=()=>void this.lock();this.root.querySelector('[data-om-play]').onclick=()=>this.minimize();this.root.querySelector('[data-om-refresh]').onclick=()=>void this.refresh();
  this.root.querySelector('.om-search').oninput=()=>this.renderRoster();
  this.root.querySelector('.om-roster').onclick=e=>{const b=e.target.closest('[data-player]');if(!b||this.busy)return;this.selected.has(b.dataset.player)?this.selected.delete(b.dataset.player):this.selected.size<8&&this.selected.add(b.dataset.player);this.cancel();this.renderRoster();};
  this.root.querySelector('.om-actions').onclick=e=>{const b=e.target.closest('[data-om-action]');if(b&&!this.busy)this.prepare(b.dataset.omAction);};
  for(const n of this.root.querySelectorAll('.om-reason,.om-duration'))n.addEventListener('input',()=>{if(!this.busy)this.cancel();});
  this.root.querySelector('.om-cases').onclick=e=>{const watch=e.target.closest('[data-match-replay]');if(watch){void this.api.replay?.open(watch.dataset.matchReplay);return;}const b=e.target.closest('[data-case]');if(b&&!this.busy)this.prepare('reverse-teaming',b.dataset.case);};
  this.header.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.button!==0)return;e.preventDefault();const r=this.root.getBoundingClientRect();this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};this.header.setPointerCapture(e.pointerId);});
  this.header.addEventListener('pointermove',e=>{if(this.drag?.id===e.pointerId)this.position(this.drag.left+e.clientX-this.drag.x,this.drag.top+e.clientY-this.drag.y);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])this.header.addEventListener(event,()=>{this.drag=null;});
  this.header.addEventListener('keydown',e=>{if(e.target!==this.header||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const r=this.root.getBoundingClientRect();this.position(r.left+(e.key==='ArrowLeft'?-20:e.key==='ArrowRight'?20:0),r.top+(e.key==='ArrowUp'?-20:e.key==='ArrowDown'?20:0));});
  window.addEventListener('resize',()=>this.clamp());window.visualViewport?.addEventListener('resize',()=>this.clamp());
  this.timer=setInterval(()=>{if(this.root.hidden)return;const c=this.context();if(!c||c.code!==this.match?.code||c.matchId!==this.match?.matchId){this.reset();return;}if(this.interacting&&!this.busy)void this.refresh(true);},4000);
 }
 position(x,y){const r=this.root.getBoundingClientRect(),v=window.visualViewport;this.root.style.left=Math.max(8,Math.min((v?.width||innerWidth)-r.width-8,x))+'px';this.root.style.top=Math.max(8,Math.min((v?.height||innerHeight)-r.height-8,y))+'px';this.root.style.right='auto';}
 clamp(){this.root.style.setProperty('--om-vh',(window.visualViewport?.height||innerHeight)+'px');if(!this.root.hidden){const r=this.root.getBoundingClientRect();this.position(r.left,r.top);}}
 async command(text){
  const command=text.trim();text='';if(!this.context()){this.notify('Owner match commands are available while playing.');return;}
  if(command==='/lock'){await this.lock();return;}
  if(command==='/owner'){if(this.api.token){await this.open();}else this.notify('Unlock with / immediately followed by your owner key.');return;}
  if(!/^\/\d{12,32}$/.test(command)){this.notify('Unknown private command. Nothing was sent to chat.');return;}
  this.match={...this.context()};this.expand();this.setStatus('Verifying owner access…');this.setBusy(true);
  const serial=++this.serial;let code=command.slice(1);
  try{const r=await this.api.post('/login',{code});if(serial!==this.serial)return;this.api.token=r.token;this.api.expires=r.expires;await this.open();}
  catch(error){this.setStatus(error.message,true);this.locked=true;}
  finally{code='';if(serial===this.serial)this.setBusy(false);}
 }
 async open(){this.match={...this.context()};this.locked=false;this.expand();await this.refresh();}
 expand(){this.root.hidden=false;this.root.classList.remove('om-minimized');this.interacting=true;this.root.querySelector('[data-om-min]').textContent='−';this.onFocus();this.clamp();(matchMedia('(pointer:coarse)').matches?this.header:this.root.querySelector('.om-search')).focus({preventScroll:true});}
 minimize(){this.interacting=false;this.root.classList.add('om-minimized');this.root.querySelector('[data-om-min]').textContent='+';this.root.querySelector(':focus')?.blur();this.onPlay();this.clamp();}
 reset(){this.serial++;this.root.hidden=true;this.interacting=false;this.match=null;this.data=null;this.selected.clear();this.cancel();}
 async lock(){const token=this.api.token;this.reset();if(token)try{await this.api.post('/logout');}catch{}this.api.token=null;this.api.expires=0;this.onPlay();}
 setStatus(text,error=false){this.status.textContent=text;this.status.dataset.error=String(error);}
 setBusy(value){this.busy=value;for(const b of this.root.querySelectorAll('.om-actions button,.om-confirm button,.om-roster button,.om-cases button'))b.disabled=value;}
 cancel(){this.pending=null;const region=this.root.querySelector('.om-confirm');region.replaceChildren();region.hidden=true;}
 async refresh(quiet=false){
  if(this.refreshing||!this.match||!this.api.token)return;const match={...this.match},serial=this.serial;this.refreshing=true;
  try{const data=await this.api.post('/match',match);if(serial!==this.serial||this.context()?.matchId!==match.matchId)return;this.data=data;this.root.querySelector('.om-context').textContent=`${data.cup?'FRONTIER CUP':data.mode.toUpperCase()} · ${data.code} · ${data.roster.filter(p=>p.present).length} players`;this.renderRoster();this.renderHistory();this.clamp();if(!quiet)this.setStatus('Live roster verified. Select players and an action.');}
  catch(error){if(serial!==this.serial)return;this.setStatus(error.message,true);if(error.status===401){this.locked=true;this.api.token=null;this.data=null;this.selected.clear();this.cancel();this.renderRoster();}}
  finally{this.refreshing=false;}
 }
 renderRoster(){
  const query=this.root.querySelector('.om-search').value.toLowerCase(),list=this.root.querySelector('.om-roster'),focus=document.activeElement?.dataset.player,scroll=list.scrollTop;
  const rows=(this.data?.roster||[]).filter(p=>(p.name+' '+p.id).toLowerCase().includes(query));const html=rows.map(p=>`<button data-player="${esc(p.id)}" aria-pressed="${this.selected.has(p.id)}" ${this.busy?'disabled':''}><span class="om-check">${this.selected.has(p.id)?'✓':'○'}</span><span><b>${esc(p.name)}</b><small>${p.host?'HOST · ':''}${p.present?p.spectating?'Spectating':'In match':'Left match'}${p.mute?' · Text muted':''}${p.ban?' · Suspended':''}</small></span><code>${esc(p.id.slice(-6))}</code></button>`).join('')||'<p class="om-empty">No matching players.</p>';
  if(list.innerHTML!==html){list.innerHTML=html;list.scrollTop=scroll;if(focus)list.querySelector(`[data-player="${CSS.escape(focus)}"]`)?.focus({preventScroll:true});}
  this.root.querySelector('.om-selection').textContent=this.selected.size?`${this.selected.size} selected · ${[...this.selected].map(id=>this.data?.roster.find(p=>p.id===id)?.name||'Player left').join(', ')}`:'Select one or more players. Up to 8 per action.';
 }
 renderHistory(){
  this.root.querySelector('.om-history div').innerHTML=(this.data?.history||[]).map(h=>`<p><b>${esc(labels[h.action]||h.action)}</b> · ${esc(new Date(h.at).toLocaleTimeString())}<br>${esc(h.targets.map(p=>p.name).join(', '))}<br>${esc(h.reason)}</p>`).join('')||'<p>No owner actions in this match.</p>';
  this.root.querySelector('.om-cases div').innerHTML=(this.data?.cases||[]).map(c=>`<p><b>${esc(c.players.map(p=>p.name).join(', '))}</b><br>${esc(c.evidence.note)}${c.replay?`<button data-match-replay="${esc(c.replay.id)}">WATCH MATCH REPLAY</button>`:''}<button data-case="${esc(c.id)}">REVERSE THIS PENALTY</button></p>`).join('')||'<p>No active teaming penalties.</p>';
 }
 prepare(action,caseId){
  if(!this.data||this.locked)return this.setStatus('Unlock owner access and refresh the match first.',true);
  const reason=this.root.querySelector('.om-reason').value.trim();if(reason.length<5){this.setStatus('Enter a clear reason or message first.',true);this.root.querySelector('.om-reason').focus();return;}
  const players=[...this.selected];if(!['announce','end-match','reverse-teaming'].includes(action)&&!players.length)return this.setStatus('Select at least one player.',true);
  this.pending={...this.match,action,players,reason,hours:Number(this.root.querySelector('.om-duration').value),caseId,requestId:crypto.randomUUID()};
  const region=this.root.querySelector('.om-confirm');region.hidden=false;const names=['announce','end-match'].includes(action)?'Everyone in this match':action==='reverse-teaming'?this.data.cases.find(c=>c.id===caseId)?.players.map(p=>p.name).join(', '):players.map(id=>this.data.roster.find(p=>p.id===id)?.name||'Player left').join(', ');
  region.innerHTML=`<b>${esc(labels[action])} · ${esc(names)}</b><p>${esc(descriptions[action])}</p><blockquote>${esc(reason)}</blockquote><button class="om-apply">CONFIRM ${esc(labels[action].toUpperCase())}</button><button class="om-cancel">Cancel</button>`;
  region.querySelector('.om-apply').onclick=()=>void this.apply();region.querySelector('.om-cancel').onclick=()=>this.cancel();region.scrollIntoView({block:'nearest'});region.querySelector('.om-apply').focus({preventScroll:true});
 }
 async apply(){
  if(this.busy||!this.pending)return;const request={...this.pending},serial=this.serial;this.setBusy(true);this.setStatus('Applying action and notifying affected players…');
  try{await this.api.post('/match',request);if(serial!==this.serial)return;this.cancel();this.setStatus(labels[request.action]+' applied. Player notices have been sent.');await this.refresh(true);}
  catch(error){if(serial!==this.serial)return;this.setStatus(error.message+(error.connectionError?' The result is uncertain; retry this same request safely.':''),true);if(error.status===401){this.api.token=null;this.cancel();this.locked=true;}else if(error.status===409)this.cancel();}
  finally{if(serial===this.serial)this.setBusy(false);}
 }
}
