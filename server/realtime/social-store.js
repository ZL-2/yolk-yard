import {randomUUID,randomBytes,randomInt,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdir,open,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {validatePlayerName} from '../../src/player-name.js';
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
 for(const r of data.featureRequests||[])if(r.replies!==undefined&&(!Array.isArray(r.replies)||r.replies.length>50||r.replies.some(x=>!x||typeof x.id!=='string'||!['reply','completed'].includes(x.kind)||typeof x.body!=='string'||x.body.length>1000||!Number.isFinite(x.created)||typeof x.read!=='boolean')))throw Error('Invalid feature responses');
 if(data.featureRequests!==undefined&&(!Array.isArray(data.featureRequests)||data.featureRequests.length>1000||data.featureRequests.some(r=>!r||typeof r.id!=='string'||!ids.has(r.player)||typeof r.text!=='string'||r.text.length>1000||!['open','read','completed','dismissed'].includes(r.status)||!Number.isFinite(r.created))))throw Error('Invalid feature inbox');
 for(const key of ['friends','blocks']){const seen=new Set();for(const row of data[key]){if(!Array.isArray(row)||row.length!==2||!ids.has(row[0])||seen.has(row[0])||!Array.isArray(row[1])||row[1].some(id=>!ids.has(id)||id===row[0]))throw Error('Invalid social relationship');seen.add(row[0]);}}
 if(data.nicknames!==undefined&&(!Array.isArray(data.nicknames)||data.nicknames.some(row=>!Array.isArray(row)||row.length!==2||!ids.has(row[0])||!Array.isArray(row[1])||row[1].some(entry=>!Array.isArray(entry)||entry.length!==2||!ids.has(entry[0])||typeof entry[1]!=='string'||!validatePlayerName(entry[1],{nickname:true}).ok))))throw Error('Invalid friend nicknames');
 return data;
}
// Durable identity/relationships, separate from WebSocket sessions and parties.
export class SocialStore{
 constructor(path=socialDataPath()){
  this.path=path;this.tempPath=path+'.'+randomUUID()+'.tmp';this.identities=new Map();this.tokens=new Map();this.codes=new Map();this.requests=new Map();this.featureRequests=[];this.friends=new Map();this.blocks=new Map();this.nicknames=new Map();this.chain=Promise.resolve();
  if(path){let data,failed=false;for(const file of [path,path+'.bak'])try{data=validate(JSON.parse(readFileSync(file,'utf8')));this.recoveredBackup=file!==path;break;}catch(e){if(e.code!=='ENOENT')failed=true;if(e.code==='social-schema'){this.loadError=e;break;}}
   if(data){for(const u of data.identities)this.install(u);for(const r of data.requests)this.requests.set(r.id,r);this.featureRequests=data.featureRequests||[];for(const [id,list]of data.friends)this.friends.set(id,new Set(list));for(const [id,list]of data.blocks)this.blocks.set(id,new Set(list));for(const [id,list]of data.nicknames||[])this.nicknames.set(id,new Map(list));}
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
  if(type==='friend-remove'||type==='block'){this.nicknames.get(a)?.delete(b);this.nicknames.get(b)?.delete(a);}
  this.save();return {status:this.status(a,b)};
 }
 nickname(viewer,id){return this.friends.get(viewer)?.has(id)?this.nicknames.get(viewer)?.get(id)||'':'';}
 setNickname(viewer,id,value){
  this.available();if(this.status(viewer,id)!=='friends')throw Error('Add this player as a friend first.');
  if(typeof value!=='string')throw Error('Enter a nickname.');
  const checked=value.trim()?validatePlayerName(value,{nickname:true}):{ok:true,name:''};if(!checked.ok)throw Error(checked.message);
  if(!this.nicknames.has(viewer))this.nicknames.set(viewer,new Map());
  if(checked.name)this.nicknames.get(viewer).set(id,checked.name);else this.nicknames.get(viewer).delete(id);
  this.save();return {nickname:checked.name};
 }
 save(){if(!this.path)return;this.available();clearTimeout(this.timer);this.timer=setTimeout(()=>{this.flush().catch(()=>console.error('Social persistence failed; credentials and relationships were kept in memory.'));},100);this.timer.unref?.();}
 snapshot(){this.available();return {schema,nicknames:[...this.nicknames].map(([id,names])=>[id,[...names]]),identities:[...this.identities.values()],requests:[...this.requests.values()],featureRequests:this.featureRequests,friends:[...this.friends].map(([id,s])=>[id,[...s]]),blocks:[...this.blocks].map(([id,s])=>[id,[...s]])};}
 featureRequest(player,text){
  this.available();text=typeof text==='string'?text.normalize('NFKC').trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,''):'';
  if(text.length<5||text.length>1000)throw Error('Describe your feature in 5 to 1,000 characters.');
  if(!this.identities.has(player))throw Error('Choose a player name first.');
  if(this.featureRequests.length>=1000){const old=this.featureRequests.findIndex(r=>['completed','dismissed'].includes(r.status)&&(r.replies||[]).every(x=>x.read));if(old<0)throw Error('The feature inbox is full. Please try again later.');this.featureRequests.splice(old,1);}
  const r={id:randomUUID(),player,name:this.identities.get(player).profile.name,text,created:Date.now(),status:'open'};this.featureRequests.push(r);this.save();return {id:r.id,created:r.created};
 }
 featureUpdates(player){return this.featureRequests.filter(r=>r.player===player).flatMap(r=>(r.replies||[]).filter(reply=>!reply.read).map(reply=>({...reply,requestId:r.id,request:r.text.slice(0,180),status:r.status}))).sort((a,b)=>a.created-b.created).slice(0,50);}
 acknowledgeFeatures(player,ids){
  if(!Array.isArray(ids)||ids.length>50||ids.some(id=>typeof id!=='string'))throw Error('Invalid notification selection');
  const selected=new Set(ids);for(const r of this.featureRequests)if(r.player===player)for(const reply of r.replies||[])if(selected.has(reply.id))reply.read=true;
  this.save();return this.featureUpdates(player);
 }
 featureInbox(action='list',id,showCleared=false,text=''){
  this.available();if(action!=='list'){
   if(!['read','completed','dismissed','open','clear','restore','reply'].includes(action))throw Error('Invalid inbox action');
   const r=this.featureRequests.find(r=>r.id===id);if(!r)throw Error('Request not found');
   if(action==='reply'||action==='completed'&&r.status!=='completed'){
    const message=action==='completed'?'Your feature request has been completed.':typeof text==='string'?text.normalize('NFKC').replace(/[\u0000-\u001f]/g,' ').trim():'';
    if(!message||message.length>1000)throw Error('Write a response of 1 to 1,000 characters.');
    r.replies??=[];if(r.replies.length>=50){const read=r.replies.findIndex(x=>x.read);if(read<0)throw Error('This player has 50 unread updates. Wait for them to read these before replying again.');r.replies.splice(read,1);}
    r.replies.push({id:randomUUID(),kind:action,body:message,created:Date.now(),read:false});
   }
   if(action==='clear'){r.clearedAt=Date.now();r.status='dismissed';}
   else if(action==='restore'){delete r.clearedAt;r.status='open';}
   else if(action!=='reply')r.status=action;r.updated=Date.now();this.save();
  }
  return {requests:this.featureRequests.filter(r=>showCleared?!!r.clearedAt:!r.clearedAt).slice().reverse(),open:this.featureRequests.filter(r=>!r.clearedAt&&r.status==='open').length,cleared:this.featureRequests.filter(r=>r.clearedAt).length};
 }
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
