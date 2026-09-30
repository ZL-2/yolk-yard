import './welcome-back.css';
const STORAGE_KEY='ravelfront-welcome-back-2026-09';
const art={
 squad:'<path d="M0 112 70 72 150 115 220 60 320 112V160H0Z" fill="#112e3d"/><path d="m52 128 14-59h20l14 59m25 0 14-75h23l18 75m25 0 14-59h20l14 59m25 0 14-45h20l14 45" fill="#92c9c5"/><path d="m129 38 9-13 9 13-9 14Z" fill="#ffe1a4"/><path d="M66 58h20m-20 0v-17m20 17V41m44 78 6-54 18 0 8 54" stroke="#ffe1a4" stroke-width="5" fill="none"/>',
 social:'<path d="M48 45h145v55H95l-30 24v-24H48Zm85 32h139v56h-18v20l-27-20h-94Z" fill="#8abdc2"/><path d="M67 63h105m-105 18h72m85 16h31m-55 18h55" stroke="#173b49" stroke-width="6"/><circle cx="65" cy="135" r="13" fill="#f1cd83"/><circle cx="295" cy="48" r="13" fill="#f1cd83"/><path d="M82 141h36m147-104h-40" stroke="#f1cd83" stroke-width="3" stroke-dasharray="4 5"/>',
 smooth:'<path d="M0 131 84 77 150 107 220 68 320 115v45H0Z" fill="#123340"/><path d="M-5 92h61l30-42 25 65 30-50 25 30h35l28-45 32 38h64" stroke="#9fe4c3" stroke-width="5" fill="none"/><path d="M50 145h213" stroke="#f5d697" stroke-width="3"/><path d="m96 139 10 6-10 6m71-12 10 6-10 6m65-12 10 6-10 6" stroke="#f5d697" stroke-width="3" fill="none"/>',
 coast:'<circle cx="240" cy="51" r="31" fill="#e7c586"/><path d="M0 108 90 70 177 117 252 88 320 104v56H0Z" fill="#133440"/><path d="m112 160 33-65h17l38 65" fill="#446876"/><path d="m148 156 5-15m2-15 2-12" stroke="#f1ce8c" stroke-width="4"/><path d="m54 130 7-38h13l8 38m-17-42v-19m-9 23h24" stroke="#b4caca" stroke-width="6"/><path d="M257 132V91l21-5v40" stroke="#e7c586" stroke-width="4" fill="none"/><ellipse cx="251" cy="133" rx="7" ry="5" fill="#e7c586"/><ellipse cx="272" cy="127" rx="7" ry="5" fill="#e7c586"/>',
 loading:'<path d="M0 115 74 80 168 116 241 62 320 112v48H0Z" fill="#153744"/><path d="m120 160 48-67 44 67" fill="#36515c"/><path d="M47 38h126m-126 12h85" stroke="#e9d49f" stroke-width="6"/><path d="M47 130h231" stroke="#4e737d" stroke-width="4"/><path d="M47 130h157" stroke="#e9d49f" stroke-width="4"/><path d="m253 112 8-47h17l11 47m-19-51V46m-8-6h17" stroke="#93b8bc" stroke-width="5"/>',
 stats:'<path d="M42 36h236v100H42Z" fill="#123441" stroke="#83aeb7" stroke-width="2"/><path d="M58 108h26l19-20 23 8 20-33 25 31 29-17 21 12h40" stroke="#9ce3c6" stroke-width="4" fill="none"/><path d="M59 55h50m-50 11h32m151-12h19" stroke="#e9d39c" stroke-width="4"/><path d="M143 150v-14m34 14v-14m-46 14h58" stroke="#83aeb7" stroke-width="4"/>'
};
const features=[
 ['squad','01 / TEAM UP','Squads on the frontier','Solo, Duos and four-player Squads. Choose Human Fill or No Fill, revive teammates, share pings and spectate your squad.'],
 ['social','02 / FIND YOUR PEOPLE','Friends. Parties. Together.','Share Friend Codes, find and add friends, see who’s online, and invite up to three others into your party.'],
 ['smooth','03 / KEEP MOVING','A smoother deployment','Better input recovery, lighter server updates and collision work, and island preparation ahead of departure. Built to reduce stalls.'],
 ['coast','04 / HOLD THE FRONT','A lobby that feels alive','Operators patrol an original coastal scene with natural strides, weapon scans and a new lobby soundtrack.'],
 ['loading','05 / ARRIVE IN STYLE','Cinematic loading screens','New Ravel Coast artwork welcomes you into the game and covers match preparation, with clear connection progress and cancellation.'],
 ['stats','06 / KNOW YOUR CONNECTION','Live performance intel','Smaller ping, FPS and traffic stats. Yellow/red connection warnings, plus lobby notices with a running clock for sustained problems.']
];
export function showWelcomeBack({storage=globalThis.localStorage}={}){
 try{if(storage?.getItem(STORAGE_KEY)==='dismissed')return Promise.resolve();}catch{}
 return new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='welcome-back';dialog.setAttribute('aria-labelledby','welcome-back-title');
  dialog.innerHTML=`<div class="welcome-shell"><header class="welcome-hero"><div class="welcome-brand">RAVELFRONT <span>FIELD OPERATIONS / REOPENED</span></div><button type="button" class="welcome-x" aria-label="Close welcome screen">✕</button><div class="welcome-intro"><p class="welcome-eyebrow">THE FRONTIER IS OPEN</p><h1 id="welcome-back-title">WELCOME<br><em>BACK.</em></h1><p>Rally your squad. Rediscover the coast.<br>Here’s what changed while we were away.</p></div><span class="welcome-badge">PUBLIC MATCHMAKING<br><b>BACK IN ACTION</b></span></header><section class="welcome-features" aria-label="Updates since maintenance">${features.map(([key,tag,title,body])=>`<article class="welcome-feature"><div class="welcome-art"><svg viewBox="0 0 320 160" aria-hidden="true" focusable="false">${art[key]}</svg></div><div class="welcome-feature-copy"><small>${tag}</small><h2>${title}</h2><p>${body}</p></div></article>`).join('')}</section><footer class="welcome-footer"><span>Same frontier. More ways to play.</span><button type="button" class="welcome-close">CLOSE & ENTER LOBBY <b>↗</b></button><section class="welcome-dismiss" hidden aria-label="Welcome screen preference"><strong>See you on the frontier.</strong><p>Show this welcome screen next time?</p><div><button type="button" data-dismiss="once">CLOSE FOR NOW</button><button type="button" data-dismiss="forever">DON’T SHOW AGAIN</button><button type="button" class="welcome-read">KEEP READING</button></div><small>“Don’t show again” is saved on this browser.</small></section></footer></div>`;
  document.body.append(dialog);
  const ask=()=>{const section=dialog.querySelector('.welcome-dismiss');section.hidden=false;dialog.querySelector('[data-dismiss="once"]').focus();};
  const finish=remember=>{if(remember)try{storage?.setItem(STORAGE_KEY,'dismissed');}catch{}dialog.close();dialog.remove();previous?.focus?.();resolve();};
  dialog.querySelector('.welcome-x').onclick=ask;dialog.querySelector('.welcome-close').onclick=ask;
  dialog.querySelector('.welcome-read').onclick=()=>{dialog.querySelector('.welcome-dismiss').hidden=true;dialog.querySelector('.welcome-close').focus();};
  dialog.querySelectorAll('[data-dismiss]').forEach(b=>b.onclick=()=>finish(b.dataset.dismiss==='forever'));
  dialog.addEventListener('cancel',e=>{e.preventDefault();ask();});dialog.showModal();dialog.querySelector('.welcome-x').focus();
 });
}
