import './blackout-briefing.css';
import './winter-briefing.css';

const base=import.meta.env?.BASE_URL||'/';
const seenKey='ravelfront-winter-signal-briefing-v1';
const winter={
 title:'WINTER SIGNAL',image:'winter-signal.webp',alt:'Winter Signal poster with the Hollyburst Carbine, the relief freighter and a beacon above Aster',
 lead:'The distress call escaped the hold. Winter has cut off the coast, so Rook has turned the wreck into a relief port. Aster is repeating the call, and Northstar has picked up a second signal.',
 panels:[
  ['THE COAST HAS FROZEN OVER','Follow Nyx’s amber lights through Silentpine Woods, find the relief crews at Breakwater, and trace the signal to the new transmitters.'],
  ['HOLLYBURST CARBINE','Find this two-shot burst rifle in Royale loot or at the winter relief stations. Available in Rare, Epic and Legendary.'],
  ['MOBILITY MYTHICS RETURN','Defeat Voss for the Kestrel Jump Rig, Rook for the Mythic Grappler, or Nyx for Mythic Shadowstep.'],
 ],
};
const seasonTwo={
 title:'AFTER THE SIGNAL',image:'after-the-signal.webp',alt:'The fortified Breakwater freighter in Season 2',
 lead:'Season 2 began after the Breakwater blackout. The freighter lodged in the seawall carried a signal that survived the loss of power.',
 panels:[
  ['BREAKWATER FREIGHTER','Explore the bridge, engineering room and radio balcony. Restore the two harbor breakers to search the hold.'],
  ['A FRACTURED COAST','The battle left Scarline Cut, wreckage at the Conservatory, and contested approaches through the northern passes.'],
  ['THE THREE COMMANDERS','Voss carries the Bastion Burst, Rook the Breakwater Repeater, and Nyx the Rimeglass DMR.'],
 ],
};
let pending=null;

export function showWinterBriefing({force=false,previousSeason=false}={}){
 if(pending)return pending;
 try{if(!force&&localStorage.getItem(seenKey)==='yes')return Promise.resolve();}catch{}
 const promo=previousSeason?seasonTwo:winter;
 pending=new Promise(resolve=>{
  const previous=document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.className='blackout-briefing winter-briefing';
  dialog.setAttribute('aria-labelledby','winter-briefing-title');
  dialog.innerHTML=`<div class="winter-poster">
   <img src="${base}season/${promo.image}" alt="${promo.alt}">
   <h1 id="winter-briefing-title" class="${previousSeason?'winter-previous-title':'sr-only'}">${promo.title}</h1>
  </div>
  <button type="button" class="blackout-close" aria-label="Close ${previousSeason?'Season 2':'Winter Signal'} briefing">×</button>
  <div class="blackout-body">
   <p class="blackout-lead">${promo.lead}</p>
   <div class="blackout-steps">${promo.panels.map(([heading,body])=>`<article><b>${heading}</b><p>${body}</p></article>`).join('')}</div>
   <footer>${previousSeason?'':'<label><input type="checkbox" data-winter-dismiss> Don’t show again on startup</label>'}<button type="button" class="primary" data-winter-close>RETURN TO LOBBY</button></footer>
  </div>`;
  document.body.append(dialog);
  const close=()=>{
   if(!dialog.isConnected)return;
   try{if(dialog.querySelector('[data-winter-dismiss]')?.checked)localStorage.setItem(seenKey,'yes');}catch{}
   dialog.close();
   dialog.remove();
   if(previous?.isConnected)previous.focus();
   pending=null;
   resolve();
  };
  dialog.querySelector('.blackout-close').onclick=close;
  dialog.querySelector('[data-winter-close]').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.showModal();
  dialog.querySelector('.blackout-close').focus();
 });
 return pending;
}
