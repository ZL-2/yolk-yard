import {VERSION} from './data.js';
import {relayURL} from './relay-peer.js';
// A separate authenticated lobby session remains connected across room changes.
export class PartyClient {
 constructor(profile,handlers={}){this.profile=profile;this.handlers=handlers;this.pending=new Map();this.serial=0;this.ready=false;this.closed=false;this.connect();}
 connect(){const endpoint=relayURL();if(!endpoint){this.handlers.status?.('Party service unavailable');return;}const url=new URL(endpoint);url.pathname='/social';this.ws=new WebSocket(url,globalThis.window?.RAVEL_OWNER_SESSION?['ravelfront',`owner.${window.RAVEL_OWNER_SESSION}`]:[]);const ws=this.ws;
  ws.onopen=()=>{let token;try{token=sessionStorage.getItem('yolk-party-token');}catch{}ws.send(JSON.stringify({type:'hello',version:VERSION,token,profile:this.profile}));};
  ws.onmessage=e=>{if(ws!==this.ws)return;const m=JSON.parse(e.data);if(m.type==='hello'){this.id=m.id;this.ready=true;try{sessionStorage.setItem('yolk-party-token',m.token);}catch{}this.handlers.status?.('Connected');}
   else if(m.type==='reply'){const pending=this.pending.get(m.request);if(pending){clearTimeout(pending.timer);this.pending.delete(m.request);m.error?pending.reject(Error(m.error)):pending.resolve(m.result);}}
   else if(m.type==='party'){this.party=m.party;this.handlers.change?.(m.party);}
   else this.handlers[m.type]?.(m[m.type]??m);
  };
  ws.onerror=()=>{};ws.onclose=()=>{if(ws!==this.ws||this.closed)return;this.ready=false;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Party connection interrupted.'));}this.pending.clear();this.handlers.status?.('Reconnecting…');this.retry=setTimeout(()=>this.connect(),2000);};
 }
 request(type,data={}){if(!this.ready)return Promise.reject(Error('The party service is connecting. Try again in a moment.'));const request=++this.serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(request);reject(Error('The party service did not respond.'));},10000);this.pending.set(request,{resolve,reject,timer});this.ws.send(JSON.stringify({...data,type,request}));});}
 updateProfile(profile){this.profile={...profile};if(this.ready)this.request('profile',{profile}).catch(()=>{});}
 close(){this.closed=true;clearTimeout(this.retry);this.ws?.close();}
}
