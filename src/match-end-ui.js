import {ELIMINATION_HOLD,VICTORY_REVEAL,matchOutcome} from './match-presentation.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export class MatchEndUI{
 constructor(){this.root=document.createElement('section');this.root.id='royale-end-screen';this.root.hidden=true;this.root.setAttribute('aria-label','Match outcome');document.body.append(this.root);this.reset();}
 reset(){this.worldKey=null;this.outcomeKey=null;this.started=0;this.resultStarted=0;this.watching=false;this.markupKey='';this.root.hidden=true;this.phase='none';}
 watch(){this.watching=true;this.markupKey='';}
 update(state,id,playing,now=performance.now()){
  if(!playing||!state?.royale||state.boxfight){if(!this.root.hidden)this.reset();return null;}
  const worldKey=(state.royale.matchId||'local')+':'+state.round;
  if(this.worldKey!==worldKey){this.reset();this.worldKey=worldKey;}
  const outcome=matchOutcome(state,id);
  if(!outcome){this.root.hidden=true;this.phase='none';return null;}
  const outcomeKey=(outcome.win?'victory':outcome.dead?'elimination':'spectator')+':'+id;
  if(this.outcomeKey!==outcomeKey){this.outcomeKey=outcomeKey;this.started=now;this.watching=false;this.markupKey='';}
  if(outcome.finished&&!this.resultStarted)this.resultStarted=now;
  const age=(now-this.started)/1000,hold=!outcome.win&&outcome.dead&&!this.watching&&age<ELIMINATION_HOLD;
  if(outcome.win&&outcome.canCelebrate&&age<VICTORY_REVEAL){this.root.hidden=true;this.phase='victory-slow';return {phase:this.phase,hold:false,victory:false,age,slowMotion:true};}
  this.phase=outcome.win?'victory':hold?'eliminating':this.watching&&!outcome.finished?'watching':'placement';
  const key=JSON.stringify([this.phase,outcome]);
  this.root.hidden=false;
  if(key!==this.markupKey){
   const focused=this.root.contains(document.activeElement)?document.activeElement.dataset.action:null;
   this.markupKey=key;this.root.className=this.phase+(outcome.crowned?' crowned':'');
   const title=outcome.win?'VICTORY ROYALE':outcome.place?'YOU PLACED <b>#'+outcome.place+'</b>':outcome.dead&&!outcome.finished?'YOUR TEAM IS STILL IN':'MATCH COMPLETE';
   this.root.innerHTML=`<div class="match-outcome-banner" role="status"><span class="outcome-number">${outcome.win?'#1':outcome.dead?'ELIMINATED':'FRONTIER ROYALE'}</span><h1>${title}</h1>${outcome.crowned?'<p>CROWNED VICTORY</p>':''}</div><div class="match-outcome-bottom" ${hold?'hidden':''}><div class="outcome-recap">${outcome.killer?'<small>ELIMINATED BY</small><strong>'+esc(outcome.killer)+'</strong><span>'+esc(outcome.weapon)+'</span>':outcome.win?'<strong>THE FRONTIER IS YOURS.</strong>':'<strong>'+esc(state.winner||'')+'</strong>'}<p>${outcome.kills} ELIMINATIONS${outcome.place?' · PLACEMENT #'+outcome.place:''}</p><div class="outcome-field-summary"><span>${outcome.damage} DAMAGE</span><span>${outcome.assists} ASSISTS</span><span>${outcome.orders}/3 ORDERS</span><span>+${outcome.serviceXP} SERVICE XP</span></div></div><div class="outcome-actions">${!outcome.finished?'<button data-action="end-spectate">SPECTATE</button>':outcome.canCelebrate?'<button data-action="emotes">CELEBRATE</button>':''}<button data-action="match-stats">MATCH STATS</button>${outcome.finished&&!state.options.recurring?'<button data-action="quick-rematch">PLAY AGAIN</button>':''}<button class="outcome-lobby" data-action="royale-queue">RETURN TO LOBBY</button></div>${outcome.finished&&state.options.recurring?'<p class="outcome-next-round">Next public round begins automatically.</p>':''}</div>`;
   if(focused)this.root.querySelector('[data-action="'+focused+'"]')?.focus({preventScroll:true});
  }
  return {phase:this.phase,hold,victory:outcome.win,age,slowMotion:outcome.win&&age<VICTORY_REVEAL};
 }
}
