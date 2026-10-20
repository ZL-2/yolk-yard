// Serialize saves and coalesce edits made while the previous request is in flight.
export class OptionsAutosave {
 constructor(send,onStatus=()=>{}){this.send=send;this.onStatus=onStatus;this.pending=null;this.running=null;this.failed=false;}
 save(selection){this.pending={...selection};this.failed=false;return this.flush();}
 flush(){
  if(this.running)return this.running;
  if(!this.pending)return Promise.resolve(!this.failed);
  this.running=this.drain().finally(()=>{this.running=null;});return this.running;
 }
 async drain(){
  while(this.pending){
   const next=this.pending;this.pending=null;this.onStatus('Saving…');
   try{await this.send(next);this.failed=false;}catch(error){this.failed=true;this.onStatus(error.message||'Could not save. Change an option to retry.',true);}
  }
  if(!this.failed)this.onStatus('Changes saved');return !this.failed;
 }
}

const fields=['access','teamSize','boxFormat','boxArena','boxLoadout','building','teamFill','capacity','storm','map','weaponPool','minutes','scoreLimit','fill','bots','difficulty'];
const numbers=new Set(['teamSize','capacity','minutes','scoreLimit','bots','difficulty']);
const booleans=new Set(['building','teamFill','fill']);
export function bindLobbyOptions(root,{selection,markup,normalize,send,canEdit,onError}){
 let draft={...selection},last=JSON.stringify(draft),timer;
 const status=(message,error=false)=>{const el=root.querySelector('[data-options-status]');if(el){el.textContent=message;el.setAttribute('role',error?'alert':'status');}if(error)onError?.(message);};
 const saver=new OptionsAutosave(async next=>{if(!canEdit())throw Error('Only the party leader can change options while the party is idle.');await send(next);},status);
 const changed=()=>{
  clearTimeout(timer);if(!root.isConnected)return;
  const form=root.querySelector('#lobby-options-form');if(!form||!canEdit()||!form.reportValidity())return;
  const next={...draft};for(const key of fields){const field=form.querySelector('#lobby-'+key);if(!field||field.matches(':disabled'))continue;next[key]=booleans.has(key)?field.value==='true':numbers.has(key)?Number(field.value):field.value;}
  const normalized=normalize(next),key=JSON.stringify(normalized);if(key===last)return;
  const structural=['access','teamSize','boxFormat'].some(k=>draft[k]!==normalized[k]);draft=normalized;last=key;
  if(structural){const focus=document.activeElement?.id;root.innerHTML=markup(draft);if(focus)root.querySelector('#'+focus)?.focus();}
  void saver.save(draft);
 };
 root.addEventListener('change',changed);
 root.addEventListener('input',event=>{if(event.target.matches('input[type=number]')){clearTimeout(timer);timer=setTimeout(changed,350);}});
 root.addEventListener('submit',event=>{if(event.target.id==='lobby-options-form'){event.preventDefault();changed();}});
 return {flush(){changed();return saver.flush();},get saving(){return !!saver.running;}};
}
