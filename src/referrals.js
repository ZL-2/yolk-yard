const PENDING='ravelfront-pending-referral';
export function pendingReferral(){try{const code=new URL(location.href).searchParams.get('ref');if(code&&/^[a-hj-np-z2-9-]{10,11}$/i.test(code)&&!localStorage.getItem(PENDING))localStorage.setItem(PENDING,code);return localStorage.getItem(PENDING)||'';}catch{return '';}}
export function clearReferral(){try{localStorage.removeItem(PENDING);}catch{}}
export function referralLink(code){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('ref',code);return u.href;}
// Called only after hello has consumed the incoming referral and returned the
// player's own public code. Preserve room invites, navigation and other options.
export function setOwnReferralURL(code,{location=globalThis.location,history=globalThis.history}={}){
 if(!/^[a-hj-np-z2-9-]{10,11}$/i.test(code||''))return false;
 try{const u=new URL(location.href);if(u.searchParams.get('ref')===code)return true;u.searchParams.set('ref',code);history.replaceState(history.state,'',u.href);return true;}catch{return false;}
}
export class ReferralRewards {
 constructor({wallet,ready,identity}){Object.assign(this,{wallet,ready,identity});this.nextAt=0;}
 update(now){
  if(now<this.nextAt)return;this.nextAt=now+400;
  const award=this.wallet.pendingReferralReward(this.identity());
  if(!award){this.root?.remove();this.root=null;return;}
  if(!this.root){
   this.root=document.createElement('aside');this.root.className='referral-reward';this.root.setAttribute('role','status');this.root.setAttribute('aria-live','polite');
   this.root.innerHTML='<span class="referral-reward-seal" aria-hidden="true">✓</span><div><small>CREW RECRUITED</small><strong></strong><p></p></div><button aria-label="Dismiss referral reward">GOT IT</button>';
   this.root.querySelector('button').onclick=async()=>{const button=this.root.querySelector('button');button.disabled=true;try{await this.wallet.acknowledgeReferralReward(this.award.id,this.award.through);this.nextAt=0;this.update(performance.now());if(this.root)this.root.querySelector('button').disabled=false;}catch{button.disabled=false;}};
   document.body.append(this.root);
  }
  this.award=award;this.root.hidden=!this.ready()||document.hidden;
  this.root.querySelector('strong').textContent='Congratulations! +'+award.amount.toLocaleString()+' Marks';
  const count=award.amount/1000;this.root.querySelector('p').textContent=(count===1?'A new player joined':count.toLocaleString()+' new players joined')+' through your invite. Your reward is in your wallet.';
 }
}
export function showReferrals({party}={}){
 if(document.querySelector('.referral-screen'))return Promise.resolve();
 return new Promise(resolve=>{
  const previous=document.activeElement,d=document.createElement('dialog');d.className='referral-screen';d.setAttribute('aria-labelledby','referral-title');
  d.innerHTML=`<button class="referral-close" aria-label="Close invite briefing">×</button><div class="referral-art" aria-hidden="true"><span>RAVEL FRONT / RECRUITMENT DIVISION</span><div class="referral-signal">◎<i></i><i></i><i></i></div><b>BRING YOUR CREW.</b><strong>1,000 <small>MARKS</small></strong><p>ONE NEW OPERATOR. ONE BIG REWARD.</p></div><section><small class="eyebrow">THE FRONTIER IS BETTER TOGETHER</small><h1 id="referral-title">Invite them in.<br>Gear up for more.</h1><ol><li><b>Copy your personal link</b><span>Send it to someone new to Ravelfront.</span></li><li><b>They open the game</b><span>Once they choose their player name, their first visit counts.</span></li><li><b>You get 1,000 Marks</b><span>For each new player. Spend them in the Item Shop.</span></li></ol><div class="referral-stats" aria-live="polite">Connecting to your referral record…</div><label class="referral-link-label">YOUR INVITE LINK<input readonly aria-label="Your referral link" placeholder="Connecting…"></label><button class="primary referral-copy" disabled>COPY INVITE LINK</button><p class="referral-status" role="status">Each new player counts once. Returning visits and your own browser do not count.</p><footer><button class="referral-done">LET’S PLAY →</button></footer></section>`;
  document.body.append(d);let timer;
  const refresh=()=>{if(!party?.ready||!party.code)return;const data=party.referrals||{count:0,marks:0};d.querySelector('.referral-stats').textContent=`${data.count} OPERATORS RECRUITED · ${data.marks.toLocaleString()} MARKS EARNED`;d.querySelector('.referral-link-label input').value=referralLink(party.code);d.querySelector('.referral-copy').disabled=false;};
  const done=()=>{clearInterval(timer);d.close();d.remove();previous?.focus?.();resolve();};
  d.querySelector('.referral-close').onclick=done;d.querySelector('.referral-done').onclick=done;d.addEventListener('cancel',e=>{e.preventDefault();done();});
  d.querySelector('.referral-copy').onclick=async()=>{const input=d.querySelector('.referral-link-label input'),status=d.querySelector('.referral-status');try{await navigator.clipboard.writeText(input.value);status.textContent='Link copied. Send it to your next squadmate.';}catch{input.focus();input.select();status.textContent='Select and copy your link above.';}};
  d.showModal();refresh();timer=setInterval(refresh,1000);d.querySelector('.referral-done').focus();
 });
}
