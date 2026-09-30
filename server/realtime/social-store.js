import {randomUUID,randomBytes,randomInt,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdir,open,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {socialDataPath,persistentMount} from './data-path.js';
export const normalizeFriendCode=value=>String(value||'').toUpperCase().replace(/[\s-]/g,'');
const digest=value=>createHash('sha256').update(value).digest('hex');
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const schema=1;
const identityUnavailable=()=>Object.assign(Error('Your saved Friend Code could not be restored. Your browser credential has been kept. Retry restoration before choosing a new identity.'),{code:'identity-missing'});
function validate(data){
 if(data&&![undefined,0,schema].includes(data.schema))throw Object.assign(Error('Social snapshot needs a newer server version'),{code:'social-schema'});
 if(!data||!['identities','requests','friends','blocks'].every(k=>Array.isArray(data[k])))throw Error('Unsupported or damaged social snapshot');
 const ids=new Set(),codes=new Set(),tokens=new Set();
 for(const u of data.identities){if(!u||typeof u.id!=='string'||!/^[a-f0-9-]{36}$/.test(u.id)||!/^[A-HJ-NP-Z2-9]{10}$/.test(u.code)||!/^[a-f0-9]{64}$/.test(u.tokenHash)||typeof u.profile?.name!=='string'||ids.has(u.id)||codes.has(u.code)||tokens.has(u.tokenHash))throw Error('Invalid social identity');ids.add(u.id);codes.add(u.code);tokens.add(u.tokenHash);}
 for(const r of data.requests)if(!r||typeof r.id!=='string'||!ids.has(r.from)||!ids.has(r.to)||r.from===r.to)throw Error('Invalid friend request');
 for(const key of ['friends','blocks']){const seen=new Set();for(const row of data[key]){if(!Array.isArray(row)||row.length!==2||!ids.has(row[0])||seen.has(row[0])||!Array.isArray(row[1])||row[1].some(id=>!ids.has(id)||id===row[0]))throw Error('Invalid social relationship');seen.add(row[0]);}}
 return data;
}
// Durable identity/relationships, separate from WebSocket sessions and parties.
export class SocialStore{
 constructor(path=socialDataPath()){
  this.path=path;this.tempPath=path+'.'+randomUUID()+'.tmp';this.identities=new Map();this.tokens=new Map();this.codes=new Map();this.requests=new Map();this.friends=new Map();this.blocks=new Map();this.chain=Promise.resolve();
  if(path){let data,failed=false;for(const file of [path,path+'.bak'])try{data=validate(JSON.parse(readFileSync(file,'utf8')));this.recoveredBackup=file!==path;break;}catch(e){if(e.code!=='ENOENT')failed=true;if(e.code==='social-schema'){this.loadError=e;break;}}
   if(data){for(const u of data.identities)this.install(u);for(const r of data.requests)this.requests.set(r.id,r);for(const [id,list]of data.friends)this.friends.set(id,new Set(list));for(const [id,list]of data.blocks)this.blocks.set(id,new Set(list));}
   else if(failed)this.loadError=Error('Social storage needs recovery. Existing data has not been replaced.');
  }
 }
 storage(){return {mode:!this.path?'memory':persistentMount(this.path)?'persistent-file':process.env.RENDER||this.path.startsWith('/tmp/')?'ephemeral-file':'configured-file',available:!this.loadError&&!this.writeError,recoveredBackup:!!this.recoveredBackup};}
 available(){if(this.loadError)throw this.loadError;}
 install(u){this.identities.set(u.id,u);this.tokens.set(u.tokenHash,u.id);this.codes.set(u.code,u.id);}
 identify(token,profile){
  this.available();
  if(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)){const u=this.identities.get(this.tokens.get(digest(token)));if(u){u.profile=profile;this.save();return {identity:u,token};}}
  if(token)throw identityUnavailable();
  let code;do{code=Array.from({length:10},()=>alphabet[randomInt(32)]).join('');}while(this.codes.has(code));
  token=randomBytes(32).toString('hex');const u={id:randomUUID(),code,tokenHash:digest(token),profile,created:Date.now()};this.install(u);this.save();return {identity:u,token};
 }
 set(map,id){if(!map.has(id))map.set(id,new Set());return map.get(id);}
 blocked(a,b){return !!(this.blocks.get(a)?.has(b)||this.blocks.get(b)?.has(a));}
 status(a,b){if(a===b)return 'self';if(this.blocked(a,b))return 'blocked';if(this.friends.get(a)?.has(b))return 'friends';return [...this.requests.values()].some(r=>r.from===a&&r.to===b)?'outgoing':[...this.requests.values()].some(r=>r.from===b&&r.to===a)?'incoming':'none';}
 friendAction(a,type,b){
  this.available();
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
 save(){if(!this.path)return;this.available();clearTimeout(this.timer);this.timer=setTimeout(()=>{this.flush().catch(()=>console.error('Social persistence failed; credentials and relationships were kept in memory.'));},100);this.timer.unref?.();}
 snapshot(){this.available();return {schema,identities:[...this.identities.values()],requests:[...this.requests.values()],friends:[...this.friends].map(([id,s])=>[id,[...s]]),blocks:[...this.blocks].map(([id,s])=>[id,[...s]])};}
 flush(){
  clearTimeout(this.timer);if(!this.path)return this.chain;if(this.loadError)return Promise.reject(this.loadError);
  const json=JSON.stringify(this.snapshot());
  this.chain=this.chain.catch(()=>{}).then(async()=>{try{
   await mkdir(dirname(this.path),{recursive:true});
   for(const path of [this.path,this.path+'.bak']){const file=await open(this.tempPath,'w',0o600);try{await file.writeFile(json);await file.sync();}finally{await file.close();}await rename(this.tempPath,path);}
   const dir=await open(dirname(this.path),'r');try{await dir.sync();}finally{await dir.close();}this.writeError=null;
  }catch(e){this.writeError=e;throw Error('Social changes could not be saved. Your existing browser identity has been kept. Please retry.');}});
  return this.chain;
 }
}
