import './midseason-briefing.css';
export const MIDSEASON_BRIEFING_KEY='ravelfront-stormspike-kestrel-199-dismissed';
const base=import.meta.env?.BASE_URL||'/';
export function midseasonArt(){return `<div class="midseason-art" role="img" aria-label="Stormspike Rifle and Kestrel H-05. A diagonal split between an electric-blue weapons bay and the golden coastal flight deck."><div class="midseason-edition">RAVEL FRONT <span>FIELD UPDATE / 199</span></div><section class="midseason-feature midseason-rifle"><span class="midseason-kicker">NEW WEAPON / HEAVY AMMO</span><h2>STORM<span>SPIKE.</span></h2><img src="${base}season/stormspike-model.webp" width="1400" height="800" alt=""><div class="midseason-tagline"><b>STICK. CHARGE. SHATTER.</b><p>Four electric spikes. One way through.</p><div class="midseason-rarities"><span>RARE</span><span>EPIC</span><span>LEGENDARY</span></div></div></section><section class="midseason-feature midseason-kestrel"><span class="midseason-kicker">NEW VEHICLE / FIVE SEATS</span><h2>OWN<br>THE SKY.</h2><img src="${base}season/kestrel-model.webp" width="1600" height="900" alt=""><div class="midseason-tagline"><b>KESTREL H–05</b><p>Your crew. A whole new approach.</p><span class="midseason-location">KESTREL FORWARD STATION ↗</span></div></section><span class="midseason-seam" aria-hidden="true"></span></div>`;}
let pending;
export function showMidseasonBriefing({storage=globalThis.localStorage,force=false}={}){
 if(pending)return pending;
 try{if(!force&&storage?.getItem(MIDSEASON_BRIEFING_KEY)==='yes')return Promise.resolve();}catch{}
 pending=new Promise(resolve=>{
  const previous=document.activeElement,d=document.createElement('dialog');d.className='midseason-briefing';d.setAttribute('aria-labelledby','midseason-title');
  d.innerHTML=`<h1 id="midseason-title" class="sr-only">Stormspike and Kestrel — Field Update 199</h1>${midseasonArt()}<button class="midseason-close" aria-label="Close update announcement">×</button><section class="midseason-details"><div><strong>BREACH WITH STORMSPIKE</strong><p>Four-round magazine. Spikes stick to players, vehicles and scenery, then burst after 1.15 seconds for extra damage. Structural bursts also fracture touching pieces. Defeat Nyx for the Mythic.</p></div><div><strong>TAKE YOUR SQUAD AIRBORNE</strong><p>Find the Kestrel and its new flight station in the field between Rook and Voss. Pilot, boost, switch seats and fight from four passenger platforms.</p></div></section><footer><label><input type="checkbox" class="midseason-hide"> Don’t show again</label><span>REPLAY FROM LOBBY NEWS</span><button class="primary midseason-done">DEPLOY →</button></footer>`;
  document.body.append(d);let closed=false;
  const done=()=>{if(closed)return;closed=true;try{if(d.querySelector('.midseason-hide').checked)storage?.setItem(MIDSEASON_BRIEFING_KEY,'yes');}catch{}d.close();d.remove();previous?.focus?.();pending=null;resolve();};
  d.querySelector('.midseason-close').onclick=done;d.querySelector('.midseason-done').onclick=done;d.addEventListener('cancel',e=>{e.preventDefault();done();});d.showModal();d.querySelector('.midseason-done').focus();
 });return pending;
}
