const HIDE='ravelfront-referrals-dismissed',PENDING='ravelfront-pending-referral';
export function pendingReferral(){try{const code=new URL(location.href).searchParams.get('ref');if(code&&/^[a-hj-np-z2-9-]{10,11}$/i.test(code)&&!localStorage.getItem(PENDING))localStorage.setItem(PENDING,code);return localStorage.getItem(PENDING)||'';}catch{return '';}}
export function clearReferral(){try{localStorage.removeItem(PENDING);}catch{}}
export function referralLink(code){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('ref',code);return u.href;}
export function showReferrals({party,force=false}={}){
 try{if(!force&&localStorage.getItem(HIDE)==='yes')return Promise.resolve();}catch{}
 if(document.querySelector('.referral-screen'))return Promise.resolve();
 return new Promise(resolve=>{
  const previous=document.activeElement,d=document.createElement('dialog');d.className='referral-screen';d.setAttribute('aria-labelledby','referral-title');
  d.innerHTML=`<button class="referral-close" aria-label="Close invite briefing">×</button><div class="referral-art" aria-hidden="true"><span>RAVEL FRONT / RECRUITMENT DIVISION</span><div class="referral-signal">◎<i></i><i></i><i></i></div><b>BRING YOUR CREW.</b><strong>1,000 <small>MARKS</small></strong><p>ONE NEW OPERATOR. ONE BIG REWARD.</p></div><section><small class="eyebrow">THE FRONTIER IS BETTER TOGETHER</small><h1 id="referral-title">Invite them in.<br>Gear up for more.</h1><ol><li><b>Copy your personal link</b><span>Send it to someone new to Ravelfront.</span></li><li><b>They open the game</b><span>Once they choose their player name, their first visit counts.</span></li><li><b>You get 1,000 Marks</b><span>For each new player. Spend them in the Item Shop.</span></li></ol><div class="referral-stats" aria-live="polite">Connecting to your referral record…</div><label class="referral-link-label">YOUR INVITE LINK<input readonly aria-label="Your referral link" placeholder="Connecting…"></label><button class="primary referral-copy" disabled>COPY INVITE LINK</button><p class="referral-status" role="status">Each new player counts once. Returning visits and your own browser do not count.</p><footer><label><input type="checkbox" class="referral-hide"> Do not show again on this browser</label><button class="referral-done">LET’S PLAY →</button></footer></section>`;
  document.body.append(d);let timer;
  const refresh=()=>{if(!party?.ready||!party.code)return;const data=party.referrals||{count:0,marks:0};d.querySelector('.referral-stats').textContent=`${data.count} OPERATORS RECRUITED · ${data.marks.toLocaleString()} MARKS EARNED`;d.querySelector('.referral-link-label input').value=referralLink(party.code);d.querySelector('.referral-copy').disabled=false;};
  const done=()=>{try{if(d.querySelector('.referral-hide').checked)localStorage.setItem(HIDE,'yes');}catch{}clearInterval(timer);d.close();d.remove();previous?.focus?.();resolve();};
  d.querySelector('.referral-close').onclick=done;d.querySelector('.referral-done').onclick=done;d.addEventListener('cancel',e=>{e.preventDefault();done();});
  d.querySelector('.referral-copy').onclick=async()=>{const input=d.querySelector('.referral-link-label input'),status=d.querySelector('.referral-status');try{await navigator.clipboard.writeText(input.value);status.textContent='Link copied. Send it to your next squadmate.';}catch{input.focus();input.select();status.textContent='Select and copy your link above.';}};
  d.showModal();refresh();timer=setInterval(refresh,1000);d.querySelector('.referral-done').focus();
 });
}
