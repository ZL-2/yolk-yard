import {RELEASE} from './releases.js';
const base=import.meta.env?.BASE_URL||'/';
export const LOBBY_NEWS=[
 {title:'KEEP THE FRONT ALIVE',label:'SUPPORT RAVELFRONT · $100 COMMUNITY GOAL',image:'season/community-goal.svg',action:'midseason-briefing'},
 {title:'VOICE CHAT IS HERE',label:'NEW · SQUAD UP. SPEAK UP.',image:'season/voice-192.webp',action:'voice-briefing'},
 {title:'YOUR NEXT DEPLOYMENT',label:`QUALITY UPDATE ${RELEASE}`,image:'modes/choose.webp',action:'updates'},
 {title:'OPERATION BREAKWATER',label:'SEASON 1',image:'season/breakwater-150.webp',action:'season-guide'},
];
export function newsMarkup(index=0){const item=LOBBY_NEWS[index%LOBBY_NEWS.length];return `<button class="lobby-news-story" data-action="${item.action}" aria-label="Read ${item.title}"><img src="${base+item.image}" alt=""><span${['voice-briefing'].includes(item.action)?' class="sr-only"':''}><small>${item.label}</small><strong>${item.title}</strong></span></button><div class="lobby-news-controls"><button data-news-step="-1" aria-label="Previous news">‹</button><div>${LOBBY_NEWS.map((n,i)=>`<button class="news-dot" data-news-index="${i}" aria-label="${n.title}" aria-pressed="${i===index}"></button>`).join('')}</div><button data-news-pause aria-label="Pause news rotation" aria-pressed="false">Ⅱ</button><button data-news-step="1" aria-label="Next news">›</button></div>`;}
export class LobbyNews {
 constructor(){this.index=0;this.paused=false;this.changedAt=performance.now();}
 mount(root){this.root=root;if(root){root.innerHTML=newsMarkup(this.index);this.renderPause();}clearInterval(this.timer);this.timer=setInterval(()=>{if(!this.root?.isConnected||this.paused||document.hidden||document.querySelector('dialog[open]')||this.root.matches(':hover,:focus-within')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(performance.now()-this.changedAt>=6500)this.go(this.index+1);},1000);}
 go(index){this.index=(index+LOBBY_NEWS.length)%LOBBY_NEWS.length;this.changedAt=performance.now();if(this.root){const focus=this.root.contains(document.activeElement)?document.activeElement:null,key=focus?.hasAttribute('data-news-index')?'[data-news-index="'+this.index+'"]':focus?.hasAttribute('data-news-step')?'[data-news-step="'+focus.dataset.newsStep+'"]':null;this.root.innerHTML=newsMarkup(this.index);this.renderPause();if(key)this.root.querySelector(key)?.focus({preventScroll:true});}}
 toggle(){this.paused=!this.paused;this.renderPause();}
 renderPause(){const button=this.root?.querySelector('[data-news-pause]');if(button){button.textContent=this.paused?'▶':'Ⅱ';button.setAttribute('aria-pressed',String(this.paused));button.setAttribute('aria-label',this.paused?'Resume news rotation':'Pause news rotation');}}
}
