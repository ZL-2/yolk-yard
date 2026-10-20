import './voice-briefing.css';
export const VOICE_BRIEFING_KEY='ravelfront-voice-192-dismissed';
let pending;
export function showVoiceBriefing({storage=globalThis.localStorage,force=false}={}){
 if(pending)return pending;
 try{if(!force&&storage?.getItem(VOICE_BRIEFING_KEY)==='yes')return Promise.resolve();}catch{}
 pending=new Promise(resolve=>{
  const previous=document.activeElement,d=document.createElement('dialog');d.className='voice-briefing';d.setAttribute('aria-labelledby','voice-briefing-title');
  d.innerHTML=`<h1 id="voice-briefing-title" class="sr-only">Voice chat is here</h1><img width="1672" height="941" src="${import.meta.env.BASE_URL}season/voice-192.webp" alt="Ravel Front. Voice chat is here. Squad up. Speak up. Three operators coordinate through their headsets above a coastal town."><button class="voice-briefing-close" aria-label="Close voice chat announcement">×</button><section class="voice-briefing-details" aria-label="Voice chat features"><div><strong>YOUR CREW. YOUR CHANNEL.</strong><p>Party voice across every mode. Team voice with your assigned teammates.</p></div><div><strong>CALL THE NEXT PUSH.</strong><p>Game voice in Box Fights, Zone Wars and Free For All.</p></div><div><strong>YOU CONTROL THE MIC.</strong><p>Open VOICE beside CHAT. Enable voice to listen, then enable your mic. Choose push to talk or open mic.</p></div></section><footer><label><input type="checkbox" class="voice-briefing-hide"> Do not show again on this browser</label><span>REPLAY ANYTIME FROM LOBBY NEWS</span><button class="primary voice-briefing-done">LET’S PLAY →</button></footer>`;
  document.body.append(d);let closed=false;
  const done=()=>{if(closed)return;closed=true;try{if(d.querySelector('.voice-briefing-hide').checked)storage?.setItem(VOICE_BRIEFING_KEY,'yes');}catch{}d.close();d.remove();previous?.focus?.();pending=null;resolve();};
  d.querySelector('.voice-briefing-close').onclick=done;d.querySelector('.voice-briefing-done').onclick=done;d.addEventListener('cancel',e=>{e.preventDefault();done();});d.showModal();d.querySelector('.voice-briefing-done').focus();
 });
 return pending;
}
