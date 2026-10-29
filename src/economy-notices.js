export class EconomyNotices{
 constructor(wallet,ready){this.wallet=wallet;this.ready=ready;setInterval(()=>this.check(),1500);}
 check(){const records=this.wallet.serverValue?.notifications;if(this.open||!records?.length||!this.ready()||document.querySelector('dialog[open]'))return;
 this.open=true;const d=document.createElement('dialog');d.className='economy-notice';d.setAttribute('aria-labelledby','economy-notice-title');
 const title=document.createElement('h2');title.id='economy-notice-title';title.textContent='GIFTS & ICON EARNINGS';d.append(title);
 for(const r of records){const a=document.createElement('article'),h=document.createElement('strong'),p=document.createElement('p');h.textContent=r.kind==='icon-earnings'?`+${r.amount.toLocaleString()} Marks · Icon Series earnings`:'A GIFT FOR YOU';p.textContent=r.data.reason;a.append(h,p);d.append(a);}
 const button=document.createElement('button');button.textContent='GOT IT';d.append(button);document.body.append(d);d.showModal();button.focus();
 const close=async()=>{button.disabled=true;try{await this.wallet.acknowledgeNotices(records.map(r=>r.id));d.close();d.remove();this.open=false;}catch{button.disabled=false;button.textContent='RETRY';}};
 button.onclick=close;d.addEventListener('cancel',e=>{e.preventDefault();void close();});
 }
}
