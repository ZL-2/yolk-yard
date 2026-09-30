import {randomUUID,randomBytes,randomInt,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
export const normalizeFriendCode=value=>String(value||'').toUpperCase().replace(/[\s-]/g,'');
const digest=value=>createHash('sha256').update(value).digest('hex');
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Durable identity/relationships, separate from WebSocket sessions and parties.
export class SocialStore{
 constructor(path=process.env.RAVEL_SOCIAL_DATA_PATH||(process.env.YOLK_OWNER_DATA_PATH?dirname(process.env.YOLK_OWNER_DATA_PATH)+'/ravelfront-social.json':'/tmp/ravelfront-social.json')){
  this.path=path;this.tempPath=path+'.'+randomUUID()+'.tmp';this.identities=new Map();this.tokens=new Map();this.codes=new Map();this.requests=new Map();this.friends=new Map();this.blocks=new Map();this.chain=Promise.resolve();
  if(path)try{const data=JSON.parse(readFileSync(path,'utf8'));for(const u of data.identities||[])this.install(u);for(const r of data.requests||[])this.requests.set(r.id,r);for(const [id,list]of data.friends||[])this.friends.set(id,new Set(list));for(const [id,list]of data.blocks||[])this.blocks.set(id,new Set(list));}catch{}
 }
 install(u){this.identities.set(u.id,u);this.tokens.set(u.tokenHash,u.id);this.codes.set(u.code,u.id);}
 identify(token,profile){
  if(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)){const u=this.identities.get(this.tokens.get(digest(token)));if(u){u.profile=profile;this.save();return {identity:u,token};}}
  let code;do{code=Array.from({length:10},()=>alphabet[randomInt(32)]).join('');}while(this.codes.has(code));
  token=randomBytes(32).toString('hex');const u={id:randomUUID(),code,tokenHash:digest(token),profile,created:Date.now()};this.install(u);this.save();return {identity:u,token};
 }
 set(map,id){if(!map.has(id))map.set(id,new Set());return map.get(id);}
 blocked(a,b){return !!(this.blocks.get(a)?.has(b)||this.blocks.get(b)?.has(a));}
 status(a,b){if(a===b)return 'self';if(this.blocked(a,b))return 'blocked';if(this.friends.get(a)?.has(b))return 'friends';return [...this.requests.values()].some(r=>r.from===a&&r.to===b)?'outgoing':[...this.requests.values()].some(r=>r.from===b&&r.to===a)?'incoming':'none';}
 friendAction(a,type,b){
  const other=this.identities.get(b);if(!other||a===b)throw Error(a===b?'You cannot add yourself.':'Player identity is no longer valid.');
  const status=this.status(a,b),pending=[...this.requests.values()].find(r=>r.from===a&&r.to===b||r.from===b&&r.to===a);
  if(type==='block'){this.set(this.blocks,a).add(b);this.friends.get(a)?.delete(b);this.friends.get(b)?.delete(a);for(const [id,r]of this.requests)if(r.from===a&&r.to===b||r.from===b&&r.to===a)this.requests.delete(id);}
  else if(type==='unblock')this.blocks.get(a)?.delete(b);
  else if(type==='friend-remove'){this.friends.get(a)?.delete(b);this.friends.get(b)?.delete(a);}
  else if(type==='friend-decline'||type==='friend-cancel'){if(!pending||(type==='friend-decline'?pending.to!==a:pending.from!==a))throw Error('This request has already changed.');this.requests.delete(pending.id);}
  else{
   if(status==='blocked')throw Error('This player is unavailable.');if(status==='friends')throw Error('You are already friends.');
   if(type==='friend-accept'||type==='friend-send'&&status==='incoming'){if(!pending||pending.to!==a)throw Error('No incoming request.');this.requests.delete(pending.id);this.set(this.friends,a).add(b);this.set(this.friends,b).add(a);}
   else if(type==='friend-send'){if(status==='outgoing')throw Error('A friend request is already pending.');if([...this.requests.values()].filter(r=>r.from===a||r.to===b).length>=100)throw Error('Too many pending requests.');const r={id:randomUUID(),from:a,to:b,created:Date.now()};this.requests.set(r.id,r);}
   else throw Error('Unknown friend action.');
  }
  this.save();return {status:this.status(a,b)};
 }
 save(){if(!this.path)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),100);this.timer.unref?.();}
 flush(){clearTimeout(this.timer);if(!this.path)return this.chain;const json=JSON.stringify({identities:[...this.identities.values()],requests:[...this.requests.values()],friends:[...this.friends].map(([id,s])=>[id,[...s]]),blocks:[...this.blocks].map(([id,s])=>[id,[...s]])});this.chain=this.chain.catch(()=>{}).then(async()=>{await mkdir(dirname(this.path),{recursive:true});await writeFile(this.tempPath,json,{mode:0o600});await rename(this.tempPath,this.path);}).catch(e=>console.error('Social persistence failed:',e.message));return this.chain;}
}
