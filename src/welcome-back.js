import './season-one.css';
export const SEASON_BRIEFING_KEY='ravelfront-season-1-update-150-dismissed';
export function showWelcomeBack({storage=globalThis.localStorage,force=false}={}){
 try{if(!force&&storage?.getItem(SEASON_BRIEFING_KEY)==='yes')return Promise.resolve();}catch{}
 return new Promise(resolve=>{
  const previous=document.activeElement,d=document.createElement('dialog');
  d.className='season-launch season-poster-screen';d.setAttribute('aria-labelledby','season-title');
  const art=import.meta.env.BASE_URL+'season/breakwater-150.webp';
  d.innerHTML=`<div class="season-poster-frame"><div class="season-poster-stage" role="img" aria-label="Season 1 Operation Breakwater: six Frontier ATVs; three bosses and vaults; mythic mobility; hot drops and uplinks; crowns and emotes; orders, medals and Service XP; new Item Shop with boss outfits; owner map editor."><img class="season-poster-base" src="${art}" alt=""><img class="season-title-impact impact-brand" src="${art}" alt="" aria-hidden="true"><img class="season-title-impact impact-season" src="${art}" alt="" aria-hidden="true"><img class="season-title-impact impact-operation" src="${art}" alt="" aria-hidden="true"><h1 id="season-title" class="sr-only">Ravelfront · Season 1 · Operation Breakwater</h1></div></div><button class="season-close" aria-label="Close Season 1 briefing">✕</button><footer><label><input type="checkbox" id="season-hide"> Do not show again on this browser</label><small>SEASON 1 · THE FRONTIER HAS EVOLVED</small><button class="primary season-enter">ENTER THE FRONTIER →</button></footer>`;
  document.body.append(d);
  const done=()=>{try{if(d.querySelector('#season-hide').checked)storage?.setItem(SEASON_BRIEFING_KEY,'yes');}catch{}d.close();d.remove();previous?.focus?.();resolve();};
  d.querySelector('.season-close').onclick=done;d.querySelector('.season-enter').onclick=done;
  d.addEventListener('cancel',e=>{e.preventDefault();done();});d.showModal();d.querySelector('.season-enter').focus();
  const image=d.querySelector('.season-poster-base');
  void image.decode().catch(()=>{}).then(()=>{if(d.isConnected)d.classList.add('season-poster-ready');});
 });
}
