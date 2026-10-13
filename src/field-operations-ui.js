import {MEDALS} from './field-record.js';
import {OPERATIONS,ORDER_DEFS} from './field-operations.js';
import {teamKey} from './teams.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const set=(node,value)=>{if(node.textContent!==String(value))node.textContent=value;};
export function fieldStatsHTML(p) {
  const f=p?.field;if(!f)return '';
  const accuracy=f.shots?Math.min(100,Math.round(f.hits/f.shots*100)):0;
  return `<section class="field-report"><span class="eyebrow">YOUR FIELD REPORT</span><div class="field-report-grid">${[['DAMAGE',f.damage],['TRIGGER ACCURACY',accuracy+'%'],['ASSISTS',p.assists||0],['RECOVERED',f.healing],['CHESTS',f.chests],['UPLINKS',f.uplinks],['FIELD ORDERS',f.orders+'/3'],['SERVICE XP',f.xp]].map(([label,n])=>`<div><strong>${n}</strong><small>${label}</small></div>`).join('')}</div>${f.medals.length?'<div class="field-report-medals">'+f.medals.map(m=>`<span>${escape(MEDALS[m.id]?.name||m.id)}${m.count>1?' ×'+m.count:''}</span>`).join('')+'</div>':''}<p class="hint">Service XP records your accomplishments on this browser. Marks are settled separately.</p></section>`;
}
export function fieldOrdersHTML(p,ops) {
  return `<section class="field-order-details"><span class="eyebrow">FRONTLINE OPERATIONS</span><h3>${ops?.hotspot?'Hot drop: '+escape(ops.hotspot.name):'Make your next move'}</h3><p>Gold district: two Epic Chests with extra shields. Cyan uplink: hold the marked area for 14 seconds to unlock a supply cache. Enemies contesting the area stop progress.</p><div class="field-order-list">${(p?.fieldOrders||[]).map(o=>`<article class="${o.complete?'complete':''}"><strong>${o.complete?'✓ ':''}${ORDER_DEFS[o.id]?.title}</strong><span>${ORDER_DEFS[o.id]?.description}</span><progress max="${o.target}" value="${o.value}"></progress><small>${Math.floor(o.value)} / ${o.target} · 150 Service XP + supplies</small></article>`).join('')}</div><p>Complete all three for a guaranteed Epic-or-Legendary weapon and the Mission Complete medal. Orders reset each match.</p></section>`;
}
export class FieldOperationsUI {
  constructor() {
    this.root=document.createElement('aside');this.root.id='field-operations';this.root.hidden=true;
    this.root.innerHTML='<span class="field-eyebrow">FRONTLINE OPERATIONS</span><strong class="field-title"></strong><span class="field-detail"></span><progress class="field-capture" max="14" value="0" hidden></progress><button data-action="field-orders" aria-label="View field orders and match report"><span class="field-order-title"></span><b class="field-order-count"></b><progress class="field-order-progress" max="100" value="0"></progress></button>';
    document.querySelector('#hud').append(this.root);this.nodes={};for(const k of ['title','detail','capture','order-title','order-count','order-progress'])this.nodes[k]=this.root.querySelector('.field-'+k);
    this.medal=document.createElement('div');this.medal.id='field-medal';this.medal.hidden=true;this.medal.setAttribute('role','status');
    this.medal.innerHTML='<i></i><div><small></small><strong></strong><span></span></div>';document.querySelector('#hud').append(this.medal);
    this.marker=document.createElement('div');this.marker.id='field-uplink-marker';this.marker.hidden=true;document.querySelector('#hud').append(this.marker);
    this.queue=[];this.at=0;
  }
  event(e,id) {
    if(e.player!==id)return;
    if(e.type==='field-medal'&&MEDALS[e.medal])this.queue.push({...MEDALS[e.medal],xp:e.xp});
    if(e.type==='field-order')this.queue.push({name:'ORDER COMPLETE',detail:ORDER_DEFS[e.order]?.title+' · Supplies delivered',xp:e.xp,icon:'✓'});
    if(this.queue.length>4)this.queue.splice(0,this.queue.length-4);
  }
  update(state,p,playing,paused,project,now=performance.now()) {
    const key=state?.royale?.matchId||state?.round;
    if(key!==this.key){this.key=key;this.queue=[];this.until=0;this.medal.hidden=true;this.at=0;}
    if(!playing){this.root.hidden=this.medal.hidden=this.marker.hidden=true;this.queue=[];return;}
    if(now>=(this.until||0)){
      const m=this.queue.shift();this.medal.hidden=!m;
      if(m){this.until=now+2500;if(!document.documentElement.classList.contains('reduced-motion'))this.medal.animate?.([{opacity:0,translate:'0 -10px'},{opacity:1,translate:'0 0'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});set(this.medal.querySelector('i'),m.icon);set(this.medal.querySelector('small'),'+'+m.xp+' SERVICE XP');set(this.medal.querySelector('strong'),m.name);set(this.medal.querySelector('span'),m.detail);}
    }
    if(paused||state?.phase!=='playing'||p?.health<=0)this.medal.hidden=true;
    if(now<this.at)return;this.at=now+100;
    const r=state?.royale,ops=r?.operations,u=ops?.uplink;
    this.root.hidden=!ops||r.practice||p?.spectating||p?.health<=0||paused;
    this.marker.hidden=true;if(this.root.hidden)return;
    // Keep clear of minimap standings at every viewport and HUD scale. Read
    // layout only when those settings change, not on every HUD refresh.
    const layout=window.innerWidth+':'+window.innerHeight+':'+document.documentElement.className+':'+document.documentElement.style.getPropertyValue('--hud-scale');
    if(layout!==this.layout){this.layout=layout;const map=document.querySelector('.royale-map-stack'),box=map?.getBoundingClientRect();this.root.style.top=(box?.height?box.bottom+12:83)+'px';}
    const n=this.nodes,d=u?Math.round(Math.hypot(p.x-u.x,p.z-u.z)):0;
    this.root.dataset.state=u?.contested?'contested':u?.status||'waiting';
    if(u){
      set(n.title,u.status==='secured'?'UPLINK SECURED':u.contested?'UPLINK CONTESTED':u.progress>0?'CAPTURING UPLINK':'UPLINK LIVE');
      set(n.detail,u.status==='secured'?'Supply cache unlocked':u.name+' · '+d+'m · '+Math.max(0,Math.ceil(u.expiresAt-state.time))+'s');
      n.capture.hidden=u.status!=='active';n.capture.value=u.progress;
      if(u.status==='active'&&u.team!==null&&u.team!==teamKey(state.options,p)&&u.progress>0&&!u.contested)set(n.title,'ENEMY CAPTURING');
      const pos=project?.({x:u.x,y:u.y+4,z:u.z});
      if(pos&&!pos.offscreen&&d>10){this.marker.hidden=false;this.marker.style.left=pos.x+'%';this.marker.style.top=pos.y+'%';set(this.marker,'◎ UPLINK · '+d+'m');}
    }else{
      n.capture.hidden=true;set(n.title,r.elapsed<65?'HOT DROP':ops.sequence>=OPERATIONS.max?'FINAL PUSH':'NEXT UPLINK');
      set(n.detail,r.elapsed<65?(ops.hotspot?.name||'Ravel Coast')+' · Bonus Epic Chests':ops.sequence>=OPERATIONS.max?'Stay ahead of the storm':Math.max(0,Math.ceil(ops.nextAt-r.elapsed))+' seconds · Watch the map');
    }
    const order=p.fieldOrders?.find(o=>!o.complete),done=p.fieldOrders?.filter(o=>o.complete).length||0;
    set(n['order-title'],order?ORDER_DEFS[order.id]?.title:'Mission complete');set(n['order-count'],order?Math.floor(order.value)+' / '+order.target:done+' / 3');
    n['order-progress'].value=order?order.value/order.target*100:100;
  }
}
export function drawOperationMap(c,state,point,scale,full) {
  const ops=state.royale?.operations;if(!ops||state.royale.practice)return;c.save();
  if(ops.hotspot&&state.royale.elapsed<150){const h=ops.hotspot,[x,z]=point(h.x,h.z);c.strokeStyle='#ffd166';c.fillStyle='#ffd16620';c.lineWidth=2;c.beginPath();c.arc(x,z,42*scale,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#ffe095';c.font='900 '+(full?12:9)+'px system-ui';c.textAlign='center';c.fillText('HOT DROP',x,z+24*scale);}
  const u=ops.uplink;if(u){const [x,z]=point(u.x,u.z);c.strokeStyle=u.contested?'#ff876b':'#74f5db';c.fillStyle=u.status==='secured'?'#ffd166':'#74f5db';c.lineWidth=2;c.beginPath();c.arc(x,z,full?10:6,0,Math.PI*2);c.stroke();c.fillRect(x-2,z-2,4,4);if(full){c.font='bold 11px system-ui';c.textAlign='center';c.fillText(u.status==='secured'?'SUPPLY CACHE':'UPLINK',x,z+23);}}c.restore();
}
