import {VERSION} from './data.js';
import {relayURL} from './relay-peer.js';
// A separate authenticated lobby session remains connected across room changes.
export class PartyClient {
 constructor(profile,handlers={}){this.profile=profile;this.handlers=handlers;this.pending=new Map();this.serial=0;this.ready=false;this.closed=false;this.connect();this.heartbeat=setInterval(()=>{if(this.ready)this.request('ping').catch(()=>{});},15000);}
 connect(){const endpoint=relayURL();if(!endpoint){this.handlers.status?.('Party service unavailable');return;}const url=new URL(endpoint);url.pathname='/social';this.ws=new WebSocket(url,globalThis.window?.RAVEL_OWNER_SESSION?['ravelfront',`owner.${window.RAVEL_OWNER_SESSION}`]:[]);const ws=this.ws;
  ws.onopen=()=>{let token;try{token=localStorage.getItem('ravelfront-social-identity')||sessionStorage.getItem('yolk-party-token');}catch{}this.helloToken=token;ws.send(JSON.stringify({type:'hello',version:VERSION,token,profile:this.profile}));};
  ws.onmessage=e=>{if(ws!==this.ws)return;const m=JSON.parse(e.data);if(m.type==='identity-unavailable'){this.blockIdentity(m.message);}
   else if(m.type==='hello'){if(m.identityReset||this.helloToken&&m.token!==this.helloToken){this.blockIdentity('Your saved Friend Code could not be restored. Your browser credential has been kept.');return;}this.id=m.id;this.code=m.code;this.ready=true;try{localStorage.setItem('ravelfront-social-identity',m.token);sessionStorage.removeItem('yolk-party-token');}catch{}this.handlers.status?.('Connected');}
   else if(m.type==='reply'){const pending=this.pending.get(m.request);if(pending){clearTimeout(pending.timer);this.pending.delete(m.request);m.error?pending.reject(Error(m.error)):pending.resolve(m.result);}}
   else if(m.type==='deployment')this.handlers.deployment?.(m.deployment);
   else if(m.type==='public-match'){this.publicMatch=m.match;this.publicMatchAt=performance.now();this.handlers['public-match']?.(m.match);}
   else if(m.type==='party'){this.party=m.party;this.handlers.change?.(m.party);}
   else this.handlers[m.type]?.(m[m.type]??m);
  };
  ws.onerror=()=>{};ws.onclose=event=>{if(ws!==this.ws||this.closed)return;if(event?.code===1008&&/Refresh Ravelfront/.test(event.reason||''))this.handlers.deployment?.({updating:true});this.ready=false;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Party connection interrupted.'));}this.pending.clear();if(this.identityBlocked)return;this.handlers.status?.('Reconnecting…');this.retry=setTimeout(()=>this.connect(),2000);};
 }
 blockIdentity(message){this.identityBlocked=message;this.ready=false;this.ws?.close();this.handlers.status?.('Friend identity needs restoration');this.handlers['party-notice']?.({message:message+' Open Social to retry.'});}
 retryIdentity(){this.identityBlocked=null;clearTimeout(this.retry);this.connect();}
 newIdentity(){try{const token=localStorage.getItem('ravelfront-social-identity')||sessionStorage.getItem('yolk-party-token');if(token&&!localStorage.getItem('ravelfront-social-identity-previous'))localStorage.setItem('ravelfront-social-identity-previous',token);localStorage.removeItem('ravelfront-social-identity');sessionStorage.removeItem('yolk-party-token');}catch{this.handlers['party-notice']?.({message:'Your browser could not save this identity change. Try again.'});return;}this.retryIdentity();}
 request(type,data={}){if(!this.ready)return Promise.reject(Error('The party service is connecting. Try again in a moment.'));const request=++this.serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(request);reject(Error('The party service did not respond.'));},10000);this.pending.set(request,{resolve,reject,timer});this.ws.send(JSON.stringify({...data,type,request}));});}
 updateProfile(profile){this.profile={...profile};if(this.ready)this.request('profile',{profile}).catch(()=>{});}
 close(){this.closed=true;clearTimeout(this.retry);clearInterval(this.heartbeat);this.ws?.close();}
}
