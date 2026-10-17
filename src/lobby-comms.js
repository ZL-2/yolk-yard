import './lobby-comms.css';
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
export class LobbyComms {
 constructor({party,ready}){
  this.party=party;this.ready=ready;this.messages=[];this.updates=[];this.scopeKey='';this.partyKey='';this.readIds=new Set();
  this.root=node('section','lobby-comms');this.root.hidden=true;this.root.setAttribute('aria-label','Lobby chat');
  this.toggle=node('button','lobby-chat-toggle','CHAT');this.toggle.setAttribute('aria-expanded','false');this.root.append(this.toggle);
  this.panel=node('div','lobby-chat-panel');this.panel.hidden=true;this.root.append(this.panel);
  this.select=node('select');this.select.setAttribute('aria-label','Chat channel');this.panel.append(this.select);
  this.log=node('div','lobby-chat-log');this.log.setAttribute('role','log');this.log.setAttribute('aria-live','polite');this.panel.append(this.log);
  this.form=node('form','lobby-chat-form');this.input=node('input');this.input.maxLength=180;this.input.placeholder='Message your lobby…';this.input.setAttribute('aria-label','Chat message');
  this.send=node('button',null,'SEND');this.send.type='submit';this.form.append(this.input,this.send);this.panel.append(this.form);this.status=node('p','lobby-chat-status');this.status.setAttribute('role','status');this.panel.append(this.status);
  this.banner=node('aside','feature-update');this.banner.hidden=true;this.banner.setAttribute('aria-live','polite');this.bannerTitle=node('strong');this.bannerRequest=node('small');this.bannerBody=node('p');this.dismiss=node('button',null,'GOT IT');this.banner.append(this.bannerTitle,this.bannerRequest,this.bannerBody,this.dismiss);
  document.body.append(this.root,this.banner);
  this.toggle.onclick=()=>{this.panel.hidden=!this.panel.hidden;this.toggle.setAttribute('aria-expanded',String(!this.panel.hidden));if(!this.panel.hidden){this.toggle.textContent='CHAT';void this.history();this.input.focus();}};
  this.select.onchange=()=>{this.scopeKey=this.select.value;void this.history();};
  this.form.onsubmit=async e=>{e.preventDefault();const text=this.input.value.trim();if(!text)return;this.send.disabled=true;this.status.textContent='';try{const m=await this.party().request('lobby-chat',{...this.scope(),text});this.receive(m);this.input.value='';}catch(e){this.status.textContent=e.message;}finally{this.send.disabled=false;}};
  this.dismiss.onclick=async()=>{const update=this.updates[0];if(!update)return;this.dismiss.disabled=true;try{const next=await this.party().request('feature-ack',{ids:[update.id]});this.readIds.add(update.id);this.setUpdates(next);}catch(e){this.bannerBody.textContent=e.message;}finally{this.dismiss.disabled=false;}};
 }
 scope(){const value=this.select.value||'universal';return value.startsWith('private:')?{channel:'private',to:value.slice(8)}:{channel:value};}
 async history(){const party=this.party(),key=party?.party?.id+':'+this.select.value;this.scopeKey=key;this.messages=[];this.renderMessages();if(!party?.ready)return;try{const result=await party.request('lobby-history',this.scope());if(key!==this.scopeKey)return;const live=this.messages;this.messages=[];for(const m of [...result.messages,...live])this.receive(m,false);this.renderMessages();this.status.textContent='';}catch(e){this.status.textContent=e.message;}}
 accepts(m){const p=this.party(),scope=this.scope();return m.channel===scope.channel&&(m.channel==='universal'||m.party===p?.party?.id)&&(m.channel!=='private'||m.sender===p.id&&m.to===scope.to||m.sender===scope.to&&m.to===p.id);}
 receive(m,render=true){if(!m||!this.accepts(m)||this.messages.some(x=>x.id===m.id))return;this.messages.push(m);this.messages=this.messages.slice(-50);if(render){this.renderMessages();if(this.panel.hidden)this.toggle.textContent='CHAT •';}}
 renderMessages(){this.log.replaceChildren();for(const m of this.messages){const row=node('div','lobby-chat-row');row.append(node('b',null,m.name),node('span',null,m.text));this.log.append(row);}if(!this.messages.length)this.log.append(node('p','lobby-chat-empty','Start a conversation. Keep it friendly.'));this.log.scrollTop=this.log.scrollHeight;}
 setUpdates(updates){this.updates=(updates||[]).filter(x=>!this.readIds.has(x.id));const u=this.updates[0];if(u){this.bannerTitle.textContent=u.kind==='completed'?'YOUR REQUEST IS COMPLETE':'A RESPONSE TO YOUR REQUEST';this.bannerRequest.textContent=u.request;this.bannerBody.textContent=u.body;this.dismiss.textContent=this.updates.length>1?'GOT IT · NEXT':'GOT IT';}}
 async connected(){try{this.setUpdates(await this.party().request('feature-updates'));if(!this.panel.hidden)await this.history();}catch{}}
 update(){const p=this.party(),show=!!p?.ready&&this.ready();this.root.hidden=!show;this.banner.hidden=!show||!this.updates.length||!!document.querySelector('.referral-reward:not([hidden])');
  if(!show||performance.now()<(this.nextRosterAt||0))return;this.nextRosterAt=performance.now()+250;const key=JSON.stringify([p.id,p.party?.id,p.party?.members?.map(m=>[m.id,m.profile.name])]);if(key!==this.partyKey){this.partyKey=key;const old=this.select.value;this.select.replaceChildren();for(const [value,label]of [['universal','UNIVERSAL LOBBY'],['party','YOUR PARTY'],...(p.party?.members||[]).filter(m=>m.id!==p.id).map(m=>['private:'+m.id,'PRIVATE · '+m.profile.name])]){const opt=node('option',null,label);opt.value=value;this.select.append(opt);}if([...this.select.options].some(x=>x.value===old))this.select.value=old;void this.history();}
 }
}
