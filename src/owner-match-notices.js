import './owner-match.css';
const KEY='ravelfront-owner-match-status';
export class OwnerMatchNotices{
 constructor({poll=async()=>null,ack=async()=>null}={}){
  this.poll=poll;this.ack=ack;this.status=null;this.base=0;this.received=performance.now();
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
 admission(){const ban=this.active('ban');if(ban)throw Error('Owner suspension'+(ban.expires?' until '+new Date(ban.expires).toLocaleString():'')+'. '+ban.reason);}
 render(){
  const notice=this.status?.notices?.[0];this.notice.hidden=!notice;if(notice){this.notice.querySelector('strong').textContent=notice.title;this.notice.querySelector('p').textContent=notice.message+(notice.expires&&notice.expires<=this.now()?' This restriction has now ended.':'');}
  const lines=[];for(const kind of ['ban','mute']){const r=this.active(kind);if(!r)continue;const seconds=Math.max(0,Math.ceil((r.expires-this.now())/1000));lines.push((kind==='ban'?'ALL MODES SUSPENDED':'TEXT CHAT MUTED')+' · '+(r.expires?`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m ${seconds%60}s remaining · Ends ${new Date(r.expires).toLocaleString()}`:'Until lifted by the owner')+' · '+r.reason);}
  const text=lines.join(' | ');this.banner.textContent=text;this.banner.hidden=!text;
  const dialog=document.querySelector('#dialog[open]');let inline=dialog?.querySelector('[data-owner-match-notice]');if(dialog&&(notice||text)){if(!inline){inline=document.createElement('aside');inline.dataset.ownerMatchNotice='';inline.className='owner-notice-inline';dialog.prepend(inline);}const message=(notice?notice.title+' · '+this.notice.querySelector('p').textContent:'')+(text?' '+text:'');if(inline.dataset.message!==message){inline.dataset.message=message;inline.replaceChildren();const p=document.createElement('p');p.textContent=message;inline.append(p);if(notice){const b=document.createElement('button');b.textContent='ACKNOWLEDGE';b.onclick=this.acknowledge;inline.append(b);}}this.notice.hidden=true;this.banner.hidden=true;}else inline?.remove();
 }
}
