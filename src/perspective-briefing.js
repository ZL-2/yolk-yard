import './perspective-briefing.css';
export const PERSPECTIVE_BRIEFING_KEY='ravelfront-perspective-157-dismissed';
export function showPerspectiveBriefing({storage=globalThis.localStorage,force=false}={}){
 try{if(!force&&storage?.getItem(PERSPECTIVE_BRIEFING_KEY)==='yes')return Promise.resolve();}catch{}
 if(document.querySelector('.perspective-briefing'))return Promise.resolve();
 return new Promise(resolve=>{
  const previous=document.activeElement,d=document.createElement('dialog');d.className='perspective-briefing';d.setAttribute('aria-labelledby','perspective-title');
  d.innerHTML=`<h1 id="perspective-title" class="sr-only">A new perspective — Third person is here</h1><img src="${import.meta.env.BASE_URL}season/perspective-157.webp" alt="Ravel Front: third person is here. Over-the-shoulder aim. Build, edit, move. Your view, your choice. Switch in Settings; first person stays default."><button class="perspective-close" aria-label="Close third-person briefing">✕</button><footer><label><input type="checkbox" class="perspective-hide"> Do not show again on this browser</label><span>SETTINGS → GAMEPLAY → CAMERA PERSPECTIVE</span><button class="primary perspective-done">LET’S PLAY →</button></footer>`;
  document.body.append(d);let closed=false;
  const done=()=>{if(closed)return;closed=true;try{if(d.querySelector('.perspective-hide').checked)storage?.setItem(PERSPECTIVE_BRIEFING_KEY,'yes');}catch{}d.close();d.remove();previous?.focus?.();resolve();};
  d.querySelector('.perspective-close').onclick=done;d.querySelector('.perspective-done').onclick=done;d.addEventListener('cancel',e=>{e.preventDefault();done();});d.showModal();d.querySelector('.perspective-done').focus();
 });
}
