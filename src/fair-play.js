import './fair-play.css';
const KEY='ravelfront-fair-play';
const time=t=>new Date(t).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
export function fairPlayText(status,now){
 if(!status)return '';
 const remaining=Math.max(0,Math.ceil(((status.until||0)-now)/1000)),parts=[];
 if(remaining)parts.push(`REMOVED FOR ${(status.kind||'teaming').toUpperCase()} · All game modes suspended for ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')} more. Play resumes ${time(status.until)}.`);
 for(const cup of status.cups||[])parts.push(cup.pending?'CUP RESTRICTION · You are prohibited from the next Cup added to the schedule.':`CUP RESTRICTION · You cannot enter ${cup.name} (${time(cup.opensAt)}), even after the one-hour suspension ends.`);
 if(parts.length)parts.push('You can request a review through Report a problem.');
 return parts.join(' ');
}
export class FairPlayRuntime{
 constructor({poll=async()=>null,onRemoval=()=>{}}={}){
  this.poll=poll;this.onRemoval=onRemoval;this.status=null;this.base=0;this.received=performance.now();
  this.banner=document.createElement('aside');this.banner.className='fair-play-notice';this.banner.hidden=true;this.banner.setAttribute('role','status');document.body.append(this.banner);
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.status){this.status=saved.status;this.base=saved.status.serverNow+Math.max(0,Date.now()-saved.savedAt);}}catch{}
  this.timer=setInterval(()=>this.render(),1000);this.refreshTimer=setInterval(()=>void this.refresh(),30000);
  this.observer=new MutationObserver(()=>this.render());const dialog=document.querySelector('#dialog');if(dialog)this.observer.observe(dialog,{attributes:true,attributeFilter:['open']});
  window.addEventListener('storage',e=>{if(e.key===KEY)void this.refresh();});this.render();
 }
 now(){return this.base+Math.max(0,performance.now()-this.received);}
 set(status){
  if(!status||!Number.isFinite(status.serverNow)||!Array.isArray(status.cups))return;
  if(this.status?.identity===status.identity&&status.serverNow<this.status.serverNow)return;
  const newBan=status.until>status.serverNow&&status.until!==(this.status?.until||0);
  this.status=status;this.base=status.serverNow;this.received=performance.now();try{localStorage.setItem(KEY,JSON.stringify({status,savedAt:Date.now()}));}catch{}
  this.render();if(newBan)this.onRemoval(status);
 }
 async refresh(){try{const status=await this.poll();if(status)this.set(status);}catch{} }
 admission(eventId){if(this.status?.until>this.now())throw Error('You were removed for '+(this.status.kind||'teaming')+'. All game modes are suspended until '+time(this.status.until)+'.');if(eventId&&this.status?.cups.some(c=>c.id===eventId))throw Error('You are prohibited from this Cup because of teaming.');}
 render(){
  const text=fairPlayText(this.status,this.now());if(this.banner.textContent!==text)this.banner.textContent=text;this.banner.hidden=!text;
  const dialog=document.querySelector('#dialog[open]');let notice=dialog?.querySelector('[data-fair-play-notice]');
  if(text&&dialog){if(!notice){notice=document.createElement('aside');notice.className='fair-play-dialog-notice';notice.dataset.fairPlayNotice='';notice.setAttribute('role','note');dialog.prepend(notice);}if(notice.textContent!==text)notice.textContent=text;}
  else notice?.remove();
 }
}
