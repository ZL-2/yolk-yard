import './owner-match.css';
const KEY='ravelfront-owner-match-status';
export class OwnerMatchNotices{
 constructor({poll=async()=>null,ack=async()=>null}={}){
  this.poll=poll;this.ack=ack;this.status=null;this.base=0;this.received=performance.now();
  this.requiredDialog=document.createElement('dialog');this.requiredDialog.className='owner-required-notice';this.requiredDialog.addEventListener('cancel',e=>e.preventDefault());document.body.append(this.requiredDialog);
  this.notice=document.createElement('aside');this.notice.className='owner-player-notice';this.notice.hidden=true;this.notice.setAttribute('role','alert');this.notice.innerHTML='<strong></strong><p></p><button>ACKNOWLEDGE</button>';
  this.banner=document.createElement('aside');this.banner.className='owner-restriction';this.banner.hidden=true;this.banner.setAttribute('role','status');document.body.append(this.notice,this.banner);
  this.acknowledge=async()=>{const item=this.status?.notices?.[0];if(!item)return;const button=this.notice.querySelector('button');button.disabled=true;try{const next=await this.ack([item.id]);if(next)this.set(next);}catch{this.notice.querySelector('p').textContent=item.message+' Your acknowledgement could not be saved. Try again.';}finally{button.disabled=false;}};this.notice.querySelector('button').onclick=this.acknowledge;
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.status){this.status=saved.status;this.base=saved.status.serverNow+Math.max(0,Date.now()-saved.savedAt);}}catch{}
  this.observer=new MutationObserver(()=>this.render());const dialog=document.querySelector('#dialog');if(dialog)this.observer.observe(dialog,{attributes:true,attributeFilter:['open']});
  this.timer=setInterval(()=>this.render(),1000);this.pollTimer=setInterval(()=>void this.refresh(),30000);this.render();
 }
 now(){return this.base+Math.max(0,performance.now()-this.received);}
 set(status){if(!status||!Number.isFinite(status.serverNow)||!Array.isArray(status.notices))return;if(status.identity===this.status?.identity&&status.serverNow<this.status.serverNow)return;this.status=status;this.base=status.serverNow;this.received=performance.now();try{localStorage.setItem(KEY,JSON.stringify({status,savedAt:Date.now()}));}catch{}this.render();}
 async refresh(){try{const status=await this.poll();if(status)this.set(status);}catch{}}
 active(kind){const restriction=this.status?.[kind];return restriction&&(!restriction.expires||restriction.expires>this.now())?restriction:null;}
 admission(){if(this.status?.notices?.some(n=>n.requiredRead))throw Error('Read and acknowledge your official notice before playing.');const ban=this.active('ban');if(ban)throw Error('Owner suspension'+(ban.expires?' until '+new Date(ban.expires).toLocaleString():'')+'. '+ban.reason);}
 render(){
  const notice=this.status?.notices?.[0];if(notice?.requiredRead){this.renderRequired(notice);this.notice.hidden=true;this.banner.hidden=true;return;}if(this.requiredDialog.open)this.requiredDialog.close();this.notice.hidden=!notice;if(notice){this.notice.querySelector('strong').textContent=notice.title;this.notice.querySelector('p').textContent=notice.message+(notice.expires&&notice.expires<=this.now()?' This restriction has now ended.':'');}
  const lines=[];for(const kind of ['ban','mute']){const r=this.active(kind);if(!r)continue;const seconds=Math.max(0,Math.ceil((r.expires-this.now())/1000));lines.push((kind==='ban'?'ALL MODES SUSPENDED':'TEXT CHAT MUTED')+' · '+(r.expires?`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m ${seconds%60}s remaining · Ends ${new Date(r.expires).toLocaleString()}`:'Until lifted by the owner')+' · '+r.reason);}
  const text=lines.join(' | ');this.banner.textContent=text;this.banner.hidden=!text;
  const dialog=document.querySelector('#dialog[open]');let inline=dialog?.querySelector('[data-owner-match-notice]');if(dialog&&(notice||text)){if(!inline){inline=document.createElement('aside');inline.dataset.ownerMatchNotice='';inline.className='owner-notice-inline';dialog.prepend(inline);}const message=(notice?notice.title+' · '+this.notice.querySelector('p').textContent:'')+(text?' '+text:'');if(inline.dataset.message!==message){inline.dataset.message=message;inline.replaceChildren();const p=document.createElement('p');p.textContent=message;inline.append(p);if(notice){const b=document.createElement('button');b.textContent='ACKNOWLEDGE';b.onclick=this.acknowledge;inline.append(b);}}this.notice.hidden=true;this.banner.hidden=true;}else inline?.remove();
 }
 renderRequired(item){
  const d=this.requiredDialog;
  if(d.dataset.notice!==item.id){d.dataset.notice=item.id;this.requiredOpened=performance.now();this.scrolled=false;d.replaceChildren();const title=document.createElement('h2');title.textContent=item.title;d.append(title);const copy=document.createElement('div');copy.className='owner-required-copy';
   for(const text of item.sections||[item.message]){const p=document.createElement('p');p.textContent=text;copy.append(p);}d.append(copy);copy.addEventListener('scroll',()=>{if(copy.scrollTop+copy.clientHeight>=copy.scrollHeight-5)this.scrolled=true;});
   const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';label.append(check,document.createTextNode(' I have read and understood every section.'));d.append(label);const button=document.createElement('button');button.textContent='READ THE COMPLETE NOTICE';button.disabled=true;button.onclick=async()=>{if(button.disabled)return;button.disabled=true;try{const next=await this.ack([item.id]);if(next)this.set(next);}catch(error){button.textContent=error.message;}};d.append(button);document.exitPointerLock?.();
  }
  if(!d.open)d.showModal();const copy=d.querySelector('.owner-required-copy');if(copy.scrollHeight<=copy.clientHeight+5)this.scrolled=true;
  const wait=Math.max(0,Math.ceil(((item.minimumReadMs||15000)-(performance.now()-this.requiredOpened))/1000)),button=d.querySelector('button');button.disabled=!!wait||!this.scrolled||!d.querySelector('input').checked;button.textContent=wait?'READ THE NOTICE · '+wait+'s':!this.scrolled?'SCROLL THROUGH ALL SECTIONS':'I UNDERSTAND — CONTINUE';
 }

}
