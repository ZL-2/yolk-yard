import {arenaBonuses,BONUS_NAMES} from './streaks.js';
const clock=seconds=>Math.floor(Math.ceil(seconds)/60)+':'+String(Math.ceil(seconds)%60).padStart(2,'0');
export class StreakUI{
 constructor(root){this.root=document.createElement('div');this.root.id='streak-announcement';this.root.hidden=true;this.root.setAttribute('aria-live','polite');root.append(this.root);this.message=null;}
 announce(event,mode){if(!arenaBonuses(mode))return;this.message={...event};this.key='';this.root.classList.remove('streak-arrive');void this.root.offsetWidth;this.root.classList.add('streak-arrive');}
 update(state,p){
  if(!arenaBonuses(state.options.mode)||p.health<=0||p.spectating){this.root.hidden=true;this.message=null;return;}
  const active=[];
  for(const [key,name]of [['damageUntil','Overdrive'],['eggsUntil','Focus'],['miniUntil','Quickstep']])if(p[key]>state.time)active.push({name,text:clock(p[key]-state.time)});
  if(p.streakArmor>0)active.push({name:'Barrier',text:Math.ceil(p.streakArmor)+' shield'});
  if(p.health>100)active.push({name:'Second Wind',text:Math.ceil(p.health)+' HP'});
  if(this.activeCount&&!active.length)this.fadeAt=state.time;
  this.activeCount=active.length;
  const age=this.message?state.time-this.message.time:100,large=age>=0&&age<3.6,fade=!large&&!active.length&&(age>=3.6&&age<4.1||state.time-(this.fadeAt??-100)<.4);
  this.root.hidden=!large&&!fade&&!active.length;
  this.root.classList.toggle('compact',!large);this.root.classList.toggle('leaving',fade);
  const key=JSON.stringify([large,active,large?this.message.id:null]);if(key===this.key)return;this.key=key;
  this.root.innerHTML=(large?`<div class="streak-celebrate"><span>${this.message.streak} ELIMINATION STREAK</span><strong>${BONUS_NAMES[this.message.kind]||'Upgrade earned'}</strong><small>UPGRADE EARNED</small></div>`:'')+(active.length?`<div class="streak-active">${active.map(a=>`<span><b>${a.name}</b> <time>${a.text}</time></span>`).join('')}</div>`:'');
 }
}
