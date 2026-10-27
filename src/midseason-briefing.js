import './midseason-briefing.css';
export const MIDSEASON_BRIEFING_KEY='ravelfront-jim-icon-227-dismissed';
const base=import.meta.env?.BASE_URL||'/';
export function midseasonArt(){return `<div class="jim-promo-art"><img src="${base}season/jim-icon.webp" alt="Jim in his sweatshirt and golf styles on a sunset coastal golf course"><div class="jim-promo-title"><span>RAVELFRONT / ICON SERIES 01</span><h2>JIM<br>McLAUGHLIN.</h2><p>OFF DUTY. ALL IN.</p></div><strong class="jim-promo-badge">SWEATSHIRT INCLUDED<br>GOLF EARNED WITH A WIN</strong></div>`;}
let pending;
export function showMidseasonBriefing({storage=globalThis.localStorage,force=false}={}){
 if(pending)return pending;
 try{if(!force&&storage?.getItem(MIDSEASON_BRIEFING_KEY)==='yes')return Promise.resolve();}catch{}
 pending=new Promise(resolve=>{
  const previous=document.activeElement,d=document.createElement('dialog');d.className='midseason-briefing';d.setAttribute('aria-labelledby','midseason-title');
  d.innerHTML=`<h1 id="midseason-title" class="sr-only">Jim McLaughlin — Icon Series</h1>${midseasonArt()}<button class="midseason-close" aria-label="Close update announcement">×</button><section class="midseason-details"><div><strong>YOUR FIRST ICON HAS ARRIVED</strong><p>Jim’s sweatshirt outfit plus a 60° wedge, weapon wrap, back accessory, sleeping-bag glider and White Goo dive trail. Get the complete set for 3,000 Marks or choose individual items in the Item Shop. Items already owned reduce the bundle price.</p></div><div><strong>WIN IT. WEAR IT.</strong><p>Own Jim and win a completed online match while wearing his outfit to permanently unlock the special Golf style. Golf cannot be bought. Practice and spectating do not count. All items are cosmetic.</p></div></section><footer><label><input type="checkbox" class="midseason-hide"> Don’t show again</label><span>REPLAY FROM LOBBY NEWS</span><button class="midseason-done">CONTINUE</button><button class="primary midseason-shop">VIEW BUNDLE →</button></footer>`;
  document.body.append(d);let closed=false;
  const done=()=>{if(closed)return;closed=true;try{if(d.querySelector('.midseason-hide').checked)storage?.setItem(MIDSEASON_BRIEFING_KEY,'yes');}catch{}d.close();d.remove();previous?.focus?.();pending=null;resolve();};
  d.querySelector('.midseason-shop').onclick=()=>{done();document.dispatchEvent(new Event('jim-shop'));};d.querySelector('.midseason-close').onclick=done;d.querySelector('.midseason-done').onclick=done;d.addEventListener('cancel',e=>{e.preventDefault();done();});d.showModal();d.querySelector('.midseason-done').focus();
 });return pending;
}
