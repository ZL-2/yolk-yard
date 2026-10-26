import {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {OwnerStore,OWNER_MODES,ownerDefaults,ownerMode} from './owner-store.js';
import {rankPublicPlayers} from './leaderboards.js';
const WINDOW=30*60_000,DAY=86400000;
const json=(res,status,data,origin)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(data));};
const readBody=async(req,limit=8192)=>{const parts=[];let size=0;for await(const part of req){size+=part.length;if(size>limit)throw Object.assign(Error('Upload exceeds the size limit'),{status:413});parts.push(part);}return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');};
const clean=(s,max=500)=>String(s??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const reasonOf=body=>{const reason=clean(body.reason);if(reason.length<3)throw Error('Add a reason of at least three characters.');return reason;};
export class OwnerService {
 constructor({code=process.env.YOLK_OWNER_CODE,storePath,dbPath,now=Date.now}={}){
  this.now=now;this.salt=randomBytes(24);this.digest=/^\d{12,32}$/.test(code||'')?scryptSync(code,this.salt,64):null;
  this.tokens=new Map();this.attempts=new Map();this.openedAt=now();this.db=new OwnerStore({...(dbPath!==undefined?{path:dbPath}:storePath!==undefined?{path:storePath?storePath+'.sqlite':null}:{}),legacyPath:storePath??process.env.YOLK_OWNER_DATA_PATH,now});this.ready=Promise.resolve();this.errors=new Map();this.controls=this.db.db?this.db.policy():ownerDefaults();
 }
 attach(relay){
  this.relay=relay;relay.owner=this;relay.parties.store.ownerArchive=ticket=>this.recordTicket(ticket);
  if(this.db.db){this.db.event('deployment','Relay started','',{build:process.env.RENDER_GIT_COMMIT||'local',version:relay.deployment?.version||null});this.capture();this.timer=setInterval(()=>this.capture(),15000);this.timer.unref?.();}
 }
 recordReceipt(account,r){try{if(this.db.db)this.db.receipt(account,r);}catch{this.db.error=Error('A history write failed; existing records have been preserved.');}}
 recordTicket(r){try{if(this.db.db)this.db.ticket(r);}catch{this.db.error=Error('A support archive write failed.');}}
 systemEvent(kind,message,target='',data={}){if(!this.db.db)return;try{this.db.event(kind,clean(message),target,data);}catch{this.db.error=Error('An audit write failed.');}}
 authHash(){const configured=this.db.db?this.db.meta('accessHash'):null;return configured?{salt:Buffer.from(configured.salt,'hex'),digest:Buffer.from(configured.digest,'hex')}:{salt:this.salt,digest:this.digest};}
 checkCode(code){const {salt,digest}=this.authHash();const candidate=scryptSync(typeof code==='string'&&/^\d{12,32}$/.test(code)?code:'',salt,64);return !!digest&&timingSafeEqual(candidate,digest);}
 token(req,body){return /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'')?.[1]||body?.token;}
 authorized(req,body){const token=this.token(req,body),expiry=typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&this.tokens.get(token);return !!(expiry&&expiry>this.now());}
 actor(req,body){return createHash('sha256').update(this.token(req,body)).digest('hex').slice(0,12);}
 audit(req,body,kind,message,target='',data={}){this.db.event(kind,message,target,{...data,actor:this.actor(req,body)});}
 sweep(){if(this.db.db)this.db.sweep();for(const [token,expiry]of this.tokens)if(expiry<=this.now())this.tokens.delete(token);}
 activity(input){return this.db.visit(input);}
 get totals(){return {visits:this.db.analytics({range:'all'}).totalVisits};}
 get active(){return new Map(this.db.all('SELECT * FROM visits WHERE ended IS NULL').map(r=>[r.client,r]));}
 get past(){return this.db.all('SELECT * FROM visits WHERE ended IS NOT NULL ORDER BY started');}
 publicControls(){const p=this.controls,now=this.now(),a=p.announcement;return {revision:p.revision,maintenance:p.maintenance,maintenanceMessage:p.maintenanceMessage,chatEnabled:p.chatEnabled,chatSlowSeconds:p.chatSlowSeconds,modes:p.modes,announcement:a&&a.starts<=now&&a.ends>now?a:null};}
 publishControls(){const message={type:'owner-controls',controls:this.publicControls()};for(const u of this.relay?.parties.users.values()||[])this.relay.parties.send(u,message);this.publicKey=JSON.stringify(message);}
 sanction(id,kind){if(!id||!this.db.db)return null;return this.db.get('SELECT * FROM sanctions WHERE player=? AND kind=? AND revoked IS NULL AND (expires IS NULL OR expires>?) ORDER BY created DESC LIMIT 1',id,kind,this.now());}
 assertPlayer(id){const ban=this.sanction(id,'ban');if(ban)throw Error('This browser identity is suspended'+(ban.expires?' until '+new Date(ban.expires).toISOString():'')+'. '+ban.reason);}
 assertAdmission(id,mode,access='public'){
  this.assertPlayer(id);this.db.assert();this.relay?.fairPlay?.assertPlay(id);if(this.controls.maintenance)throw Error(this.controls.maintenanceMessage);
  if(this.controls.modes[mode]?.[access]===false)throw Error('This mode is temporarily closed to '+access+' matchmaking.');
 }
 assertChat(id){this.assertPlayer(id);const mute=this.sanction(id,'mute');if(mute)throw Error('Lobby chat is muted for this browser identity. '+mute.reason);if(!this.controls.chatEnabled)throw Error('Lobby chat is temporarily paused.');}
 grantSummary(id){return {id,marks:this.db.get('SELECT coalesce(sum(amount),0) n FROM grants WHERE player=?',id).n,notices:this.db.all('SELECT g.id,g.at,g.amount FROM grants g LEFT JOIN grant_reads r ON r.id=g.id WHERE g.player=? AND r.id IS NULL ORDER BY g.at,g.id LIMIT 100',id).map(g=>({...g,kind:'marks-grant',request:'Marks award',body:g.amount.toLocaleString('en-US')+' Marks were added to your balance.'}))};}
 acknowledgeGrants(id,ids){if(!Array.isArray(ids)||ids.length>100||ids.some(x=>typeof x!=='string'||x.length>200))throw Error('Invalid grant acknowledgement');this.db.transaction(()=>{for(const grant of ids)this.db.run('INSERT OR IGNORE INTO grant_reads SELECT id,player,? FROM grants WHERE id=? AND player=?',this.now(),grant,id);});return this.grantSummary(id).notices;}
 onIdentity(user){this.assertPlayer(user.id);if(!this.db.db)return;this.relay.fairPlay?.sync(user.id);if(user.sessions.size===1)this.systemEvent('player-connected',user.profile.name+' connected',user.id);this.relay.parties.send(user,{type:'owner-controls',controls:this.publicControls()});this.relay.parties.send(user,{type:'owner-grants',record:this.grantSummary(user.id)});}
 liveRooms(){
  const relay=this.relay;if(!relay)return [];
  return [...relay.peers.values()].filter(p=>p.listing&&(p.ws||p.virtualRoom)&&this.now()-p.listedAt<20000).map(p=>{
   const a=relay.authority.rooms.get(p.id),pub=relay.publicHost.roomByAddress(p.id),s=a?.sim||pub?.state,players=[...relay.parties.users.values()].filter(u=>u.matchCode===p.listing.code&&u.inMatch).map(u=>({id:u.id,name:u.profile.name,connected:relay.parties.connected(u)}));
   return {key:p.id,id:p.id+':'+(s?.matchId||'waiting')+':'+(s?.round||0),code:p.listing.code,mode:p.listing.mode,map:p.listing.map,players:p.listing.players,capacity:p.listing.capacity,public:p.listing.public!==false,phase:p.listing.phase,stage:s?.stage||'',round:s?.round||0,alive:s?.alive??null,hosting:a?'server':'player',host:p.listing.host,roster:players,recovering:!!pub?.summary().recovering};
  });
 }
 capture(){
  if(!this.db.db||!this.relay)return;try{
   this.sweep();const r=this.relay,rooms=this.liveRooms(),reports=[...(r.serviceStatus?.reports.values()||[])],mean=key=>reports.length?reports.reduce((n,p)=>n+p[key],0)/reports.length:null;
   this.db.transaction(()=>{
    for(const room of rooms)this.db.observeMatch(room);this.db.finishMissingMatches();
    const capacity=r.authority.capacity.snapshot();this.db.sample({online:this.db.get('SELECT count(*) n FROM visits WHERE ended IS NULL AND visible=1').n,players:[...r.parties.users.values()].filter(u=>r.parties.connected(u)).length,rooms:rooms.length,cpu:capacity.cpuMsPerSecond,memory:Math.round(process.memoryUsage().rss/1048576),fps:mean('fps'),rtt:mean('rtt'),modes:r.parties.modeCounts(),capacity});
    for(const i of r.serviceStatus?.history||[])this.db.event(i.endedAt?'incident-resolved':'incident-started',i.message,i.kind,i,i.id+(i.endedAt?':resolved':':started'),i.endedAt||i.detectedAt);
    if(!this.seededReceipts){for(const a of r.progression.accounts.values())for(const receipt of a.receipts||[])this.db.receipt(a,receipt);this.seededReceipts=true;}
    for(const ticket of r.parties.store.featureRequests)this.db.ticket(ticket);
   });
   this.db.error=null;const publicKey=JSON.stringify({type:'owner-controls',controls:this.publicControls()});if(publicKey!==this.publicKey)this.publishControls();
   if(this.db.path!==':memory:'&&this.now()-(this.db.meta('lastBackup')?.at||0)>DAY)void this.db.createBackup().then(()=>{this.backupError=null;}).catch(()=>{this.backupError='Automatic backup failed. Check storage.';});
  }catch(error){this.db.error=Error('Owner history could not be updated. Existing data has not been replaced.');console.error('Owner history capture failed:',error.code||error.message);}
 }
 players(input={}){
  const r=this.relay,q=clean(input.q,100).toLowerCase(),rankings=Object.fromEntries(OWNER_MODES.filter(m=>m!=='training').map(m=>[m,new Map(rankPublicPlayers(r.progression.accounts,r.parties.store.identities,m).kills.map(p=>[p.socialId,p]))]));
  let rows=[...r.parties.store.identities.values()].map(u=>{const live=r.parties.users.get(u.id),stats=Object.fromEntries(Object.entries(rankings).map(([m,rows])=>{const s=rows.get(u.id);return [m,{kills:s?.kills||0,wins:s?.wins||0}];}));return {id:u.id,name:u.profile.name,code:u.code,created:u.created,lastOnline:live&&r.parties.connected(live)?this.now():u.lastOnline||u.created,online:!!live&&r.parties.connected(live),presence:live?r.parties.presence(u.id):'offline',mode:live?r.parties.playingMode(live):null,partySize:r.parties.parties.get(live?.party)?.members.length||0,stats,ban:this.sanction(u.id,'ban'),mute:this.sanction(u.id,'mute')};});
  if(q)rows=rows.filter(p=>(p.name+' '+p.code+' '+p.id).toLowerCase().includes(q));if(input.status==='online')rows=rows.filter(p=>p.online);if(input.status==='restricted')rows=rows.filter(p=>p.ban||p.mute);rows.sort((a,b)=>Number(b.online)-Number(a.online)||b.lastOnline-a.lastOnline);
  const offset=Math.max(0,Math.floor(Number(input.offset)||0)),limit=50;return {rows:rows.slice(offset,offset+limit),total:rows.length,offset,limit};
 }
 summary(input={}){
  this.db.assert();this.sweep();const r=this.relay,activeRooms=this.liveRooms(),online=this.db.get('SELECT count(*) n FROM visits WHERE ended IS NULL AND visible=1').n;
  return {at:this.now(),expires:this.now()+WINDOW,online,visits:this.db.get('SELECT count(*) n FROM visits').n+this.db.meta('legacyVisitBaseline',0),relayConnections:[...(r?.peers.values()||[])].filter(p=>p.ws).length,activeRooms,active:this.db.all('SELECT * FROM visits WHERE ended IS NULL ORDER BY seen DESC LIMIT 100'),past:this.db.all('SELECT * FROM visits WHERE ended IS NOT NULL ORDER BY started DESC LIMIT 100'),historyPersistent:this.db.storage().persistent,storage:this.db.storage(),controls:this.controls,analytics:this.db.analytics(input),health:{build:process.env.RENDER_GIT_COMMIT||'local',version:r?.deployment?.version||'',uptimeSeconds:Math.floor((this.now()-this.openedAt)/1000),deployment:r?.deployment?.snapshot(),capacity:r?.authority?.capacity.snapshot(),social:r?.parties?.store.storage(),maps:r?.mapStore?.storage(),status:r?.serviceStatus?.snapshot(),backupError:this.backupError||null},counts:{players:r?.parties?.store.identities.size||0,onlinePlayers:r?[...r.parties.users.values()].filter(u=>r.parties.connected(u)).length:0,matches:this.db.get('SELECT count(*) n FROM matches').n,tickets:this.db.get("SELECT count(*) n FROM tickets WHERE status='open'").n,audit:this.db.get('SELECT count(*) n FROM events').n},modeCounts:r?.parties?.modeCounts()||{}};
 }
 disconnectPlayer(id,reason,ban=false){
  const r=this.relay,u=r.parties.users.get(id);if(u)r.parties.send(u,{type:'owner-session-ended',message:reason,blocked:ban});
  const peers=[...r.peers.values()].filter(p=>p.id===u?.matchPeer||r.progression.accounts.get(p.progressId)?.socialId===id);
  for(const peer of peers){r.authority.disconnect(peer);r.remove(peer,1008,'Owner ended this session');}
  for(const [token,t]of r.parties.tickets)if(t.member===id)r.parties.tickets.delete(token);
  if(u){u.inMatch=false;u.ready=false;delete u.matchPeer;const p=r.parties.parties.get(u.party);if(p){if(p.state==='queueing')r.parties.cancel(p,reason);else{if(!p.members.some(member=>r.parties.users.get(member)?.inMatch))p.state='idle';r.parties.sync(p);}}if(ban)for(const ws of u.sessions.keys())ws.close(1008,'Owner restricted this identity');}
 }
 async action(req,body){
  this.db.assert();if(!/^[a-f0-9-]{36}$/.test(body.requestId||''))throw Error('A unique action identifier is required');
  const fingerprint=createHash('sha256').update(JSON.stringify([body.action,body.player,body.room,body.amount,body.hours,body.reason,body.revision,body.controls,...(body.action?.startsWith('tournament-')?[body.eventId,body.event]:[]),...(body.action?.startsWith('teaming-')?[body.caseId,body.players]:[])])).digest('hex');
  const old=this.db.get('SELECT data FROM events WHERE id=?','action:'+body.requestId);if(old){const saved=JSON.parse(old.data);if(saved.fingerprint!==fingerprint)throw Object.assign(Error('Action identifier already used for different values'),{status:409});return saved.result;}
  const reason=reasonOf(body),r=this.relay;let result={ok:true};
  if(body.action?.startsWith('teaming-'))return r.fairPlay.manage(body,(result,data)=>{this.audit(req,body,body.action,reason,body.caseId,data);this.db.event('action',reason,body.caseId,{action:body.action,result,fingerprint,actor:this.actor(req,body)},'action:'+body.requestId);});
  if(body.action?.startsWith('tournament-'))return r.tournament.manage(body,(result,before,after)=>{this.audit(req,body,body.action,reason,after.id,{before,after});this.db.event('action',reason,after.id,{action:body.action,result,fingerprint,actor:this.actor(req,body)},'action:'+body.requestId);});
  if(body.action==='settings'){
   if(body.revision!==this.controls.revision)throw Object.assign(Error('Controls changed in another session. Refresh before saving.'),{status:409});
   const p=body.controls;if(!p||typeof p.maintenance!=='boolean'||typeof p.chatEnabled!=='boolean'||!Number.isInteger(p.chatSlowSeconds)||p.chatSlowSeconds<0||p.chatSlowSeconds>120)throw Error('Invalid service controls');
   const modes={};for(const mode of OWNER_MODES){if(typeof p.modes?.[mode]?.public!=='boolean'||typeof p.modes?.[mode]?.private!=='boolean')throw Error('Choose public and private availability for every mode');modes[mode]={public:p.modes[mode].public,private:p.modes[mode].private};}
   let announcement=null;if(p.announcement?.text){const a=p.announcement;if(!['info','warning','success'].includes(a.tone)||!Number.isFinite(a.starts)||!Number.isFinite(a.ends)||a.ends<=a.starts||a.ends-a.starts>7*DAY)throw Error('Announcements must have a valid window up to seven days');announcement={id:randomUUID(),text:clean(a.text,280),tone:a.tone,starts:a.starts,ends:a.ends};}
   const before=this.controls,next={revision:before.revision+1,maintenance:p.maintenance,maintenanceMessage:clean(p.maintenanceMessage,200)||ownerDefaults().maintenanceMessage,chatEnabled:p.chatEnabled,chatSlowSeconds:p.chatSlowSeconds,modes,announcement};
   this.db.transaction(()=>{this.db.setMeta('policy',next);this.audit(req,body,'settings',reason,'',{before,after:next});});this.controls=next;this.publishControls();result.controls=next;
  }else if(['ban','mute','unban','unmute','kick','note','grant'].includes(body.action)){
   const player=r.parties.store.identities.get(body.player);if(!player)throw Error('Player not found');
   if(body.action==='note')this.audit(req,body,'player-note',reason,player.id);
   else if(body.action==='grant'){
    if(!Number.isInteger(body.amount)||body.amount<1||body.amount>1000000)throw Error('Enter 1 to 1,000,000 Marks');
    const total=this.grantSummary(player.id).marks;if(total+body.amount>1e9)throw Error('Player grant limit reached');
    result.granted=body.amount;
    this.db.transaction(()=>{this.db.run('INSERT INTO grants VALUES(?,?,?,?,?)',body.requestId,player.id,this.now(),body.amount,reason);this.audit(req,body,'marks-granted',reason,player.id,{amount:body.amount});this.db.event('action',reason,player.id,{action:body.action,result,fingerprint,actor:this.actor(req,body)},'action:'+body.requestId);});r.parties.send(r.parties.users.get(player.id),{type:'owner-grants',record:this.grantSummary(player.id)});
   }else if(body.action==='ban'||body.action==='mute'){
    const hours=Number(body.hours);if(![1,24,168,720,0].includes(hours))throw Error('Choose a valid restriction duration');const expires=hours?this.now()+hours*3600000:null;
    this.db.transaction(()=>{this.db.run('UPDATE sanctions SET revoked=? WHERE player=? AND kind=? AND revoked IS NULL',this.now(),player.id,body.action);this.db.run('INSERT INTO sanctions VALUES(?,?,?,?,?,NULL,?)',randomUUID(),player.id,body.action,this.now(),expires,reason);this.audit(req,body,body.action,reason,player.id,{expires});});if(body.action==='ban')this.disconnectPlayer(player.id,reason,true);
   }else if(body.action==='unban'||body.action==='unmute'){this.db.run('UPDATE sanctions SET revoked=? WHERE player=? AND kind=? AND revoked IS NULL',this.now(),player.id,body.action.slice(2));this.audit(req,body,body.action,reason,player.id);}
   else{this.audit(req,body,'kick',reason,player.id);this.disconnectPlayer(player.id,reason);}
  }else if(body.action==='close-room'){
   const room=this.liveRooms().find(x=>x.key===body.room);if(!room)throw Error('This room has already closed');this.audit(req,body,'room-closed',reason,room.code,{mode:room.mode,players:room.players});
   const pub=r.publicHost.roomByAddress(room.key),authority=r.authority.rooms.get(room.key),host=r.peers.get(room.key),ids=new Set([room.key,...(pub?.members.keys()||[]),...(authority?[...authority.members.values()].map(p=>p.id):[]),...(host?[...host.links.values()].map(p=>p.id):[])]);
   for(const u of r.parties.users.values())if(ids.has(u.matchPeer)||u.matchCode===room.code)this.disconnectPlayer(u.id,reason);
   for(const id of ids){const peer=r.peers.get(id);if(peer){r.authority.disconnect(peer);r.remove(peer,1008,'Owner closed this room');}}for(const [token,t]of r.parties.tickets)if(t.code===room.code)r.parties.tickets.delete(token);
  }else if(body.action==='clear-chat'){
   r.parties.lobbyChat.rooms.delete('universal');for(const u of r.parties.users.values())r.parties.send(u,{type:'lobby-chat-cleared',channel:'universal'});this.audit(req,body,'chat-cleared',reason);
  }else if(body.action==='revoke-sessions'){const current=this.token(req,body);for(const token of this.tokens.keys())if(token!==current)this.tokens.delete(token);this.audit(req,body,'access-revoked',reason);}
  else if(body.action==='rotate-code'){
   if(!this.checkCode(body.currentCode))throw Error('Current access code is incorrect');if(!/^\d{12,32}$/.test(body.newCode||'')||body.newCode!==body.repeatCode||body.newCode===body.currentCode)throw Error('Use a different matching numeric code, 12–32 digits long');
   const salt=randomBytes(24),digest=scryptSync(body.newCode,salt,64);this.db.setMeta('accessHash',{salt:salt.toString('hex'),digest:digest.toString('hex')});const current=this.token(req,body);for(const token of this.tokens.keys())if(token!==current)this.tokens.delete(token);this.audit(req,body,'access-code-changed',reason);
  }else throw Error('Unknown owner action');
  this.db.event('action',reason,body.player||body.room||'',{action:body.action,result,fingerprint,actor:this.actor(req,body)},'action:'+body.requestId);return result;
 }
 async handle(req,res,{origins,relay}){
  if(!this.relay)this.relay=relay;const origin=req.headers.origin;if(!origin||!origins.includes(origin)){json(res,403,{error:'Origin denied'});return;}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'});res.end();return;}
  try{
   const route=req.url?.split('?')[0];
   if(route==='/owner/public'&&req.method==='GET'){json(res,200,this.publicControls(),origin);return;}
   if(route==='/owner/activity'&&req.method==='POST'){if(!this.authHash().digest){json(res,503,{error:'Owner analytics are not configured'},origin);return;}const body=await readBody(req,2048);json(res,this.activity(body)?200:400,{ok:true},origin);return;}
   if(route==='/owner/client-error'&&req.method==='POST'){const body=await readBody(req,2048);if(!/^[-a-f0-9]{36}$/.test(body.id||''))throw Error('Invalid session');const previous=this.errors.get(body.id)||0;if(this.now()-previous<60000){json(res,429,{error:'Report limit reached'},origin);return;}if(this.errors.size>2000)this.errors.clear();this.errors.set(body.id,this.now());this.systemEvent('client-error',clean(body.message,500),body.id,{file:clean(body.file,120).split('?')[0],line:Math.max(0,Number(body.line)||0),mode:ownerMode(body.mode)});json(res,200,{ok:true},origin);return;}
   if(route==='/owner/login'&&req.method==='POST'){
    const key=req.socket?.remoteAddress||'local',now=this.now(),attempts=(this.attempts.get(key)||[]).filter(t=>now-t<15*60000);if(!this.authHash().digest){json(res,503,{error:'Owner access is not configured'},origin);return;}if(attempts.length>=5){json(res,429,{error:'Too many attempts. Wait 15 minutes.'},origin);return;}
    const body=await readBody(req,2048);attempts.push(now);this.attempts.set(key,attempts);if(this.attempts.size>2000)this.attempts.delete(this.attempts.keys().next().value);
    if(!this.checkCode(body.code)){this.systemEvent('access-denied','An owner sign-in was rejected');json(res,401,{error:'Incorrect code'},origin);return;}
    this.attempts.delete(key);if(this.tokens.size>=10)this.tokens.delete(this.tokens.keys().next().value);const token=randomBytes(32).toString('hex');this.tokens.set(token,now+WINDOW);this.systemEvent('access-unlocked','Owner signed in');json(res,200,{token,expires:now+WINDOW},origin);return;
   }
   const limit=route==='/owner/import'?25_000_000:route==='/owner/map-assets'?12_000_000:route==='/owner/maps'?1_100_000:16384;
   const body=req.method==='POST'?await readBody(req,limit):{};
   if(!this.authorized(req,body)){json(res,401,{error:'Owner access expired. Unlock Owner Access again.'},origin);return;}
   this.tokens.set(this.token(req,body),this.now()+WINDOW);
   if(route==='/owner/logout'&&req.method==='POST'){this.systemEvent('access-locked','Owner locked the console');this.tokens.delete(this.token(req,body));json(res,200,{ok:true},origin);return;}
   if(route==='/owner/storage'){json(res,200,this.db.storage(),origin);return;}
   this.db.assert();
   if(route==='/owner/icon-voting'&&req.method==='POST'){
    if(!relay.iconVoting)throw Error('Voting is unavailable');
    if(body.action==='list'){json(res,200,relay.iconVoting.summary(),origin);return;}
    if(!['edit','delete'].includes(body.action))throw Error('Unknown owner voting action');
    const data=await relay.iconVoting.mutate(null,body,true);
    this.audit(req,body,'icon-vote-'+body.action,'Owner '+body.action+' voting option',body.id,{first:body.first,last:body.last,previousFirst:body.expectedFirst,previousLast:body.expectedLast});
    json(res,200,data,origin);return;
   }
   if(route==='/owner/summary'){json(res,200,this.summary(body),origin);return;}
   if(route==='/owner/fair-play'&&req.method==='POST'){json(res,200,relay.fairPlay.overview(),origin);return;}
   if(route==='/owner/tournaments'&&req.method==='POST'){json(res,200,relay.tournament.overview(),origin);return;}
   if(route==='/owner/players'){json(res,200,this.players(body),origin);return;}
   if(route==='/owner/history'){json(res,200,this.db.history(body.type,body),origin);return;}
   if(route==='/owner/action'&&req.method==='POST'){json(res,200,await this.action(req,body),origin);return;}
   if(route==='/owner/export'&&req.method==='POST'){const data=body.type==='backup'?this.db.exportHistory():this.db.history(body.type,{...body,limit:200});this.audit(req,body,'export','Exported '+(body.type||'history'));json(res,200,data,origin);return;}
   if(route==='/owner/backup'&&req.method==='POST'){const info=await this.db.createBackup(),bytes=await readFile(info.path);res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Disposition':'attachment; filename="'+info.name+'"','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin'});res.end(bytes);return;}
   if(route==='/owner/import'&&req.method==='POST'){if(body.apply&&body.confirm!=='MERGE HISTORY')throw Error('Type MERGE HISTORY to confirm');const result=this.db.mergeHistory(body.backup,body.apply===true);if(body.apply===true)this.audit(req,body,'history-merge-confirmed','Owner confirmed append-only history merge','',result);json(res,200,result,origin);return;}
   if(route==='/owner/requests'&&req.method==='POST'){
    const store=relay.parties?.store;if(!store)throw Error('Feature inbox unavailable');let data;
    if(body.action&&body.action!=='list'){if(!store.featureRequests.some(r=>r.id===body.id)){const archived=this.db.get('SELECT data FROM tickets WHERE id=?',body.id);if(archived){const restored=JSON.parse(archived.data);restored.replies=(restored.replies||[]).slice(-50);if(store.featureRequests.length>=1000){const old=store.featureRequests.findIndex(t=>['completed','dismissed'].includes(t.status)&&(t.replies||[]).every(x=>x.read));if(old<0)throw Error('Resolve an active support ticket before restoring another.');this.recordTicket(store.featureRequests[old]);store.featureRequests.splice(old,1);}store.featureRequests.push(restored);}}data=store.featureInbox(body.action,body.id,body.showCleared===true,body.text);await store.flush();const ticket=store.featureRequests.find(r=>r.id===body.id);if(ticket){this.recordTicket(ticket);relay.parties.send(relay.parties.users.get(ticket.player),{type:'feature-updates',updates:store.featureUpdates(ticket.player)});}this.audit(req,body,'support-'+body.action,'Updated support ticket',body.id);}
    for(const ticket of store.featureRequests)this.db.ticket(ticket);const page=this.db.history('tickets',{...body,range:'all',status:body.status|| (body.showCleared?'archived':undefined)});json(res,200,{...page,requests:page.rows.map(r=>r.data),open:this.db.get("SELECT count(*) n FROM tickets WHERE status='open'").n,cleared:this.db.get("SELECT count(*) n FROM tickets WHERE status='archived'").n},origin);return;
   }
   if(route==='/owner/maps'&&req.method==='POST'){
    const maps=relay.mapStore;if(!maps)throw Error('Map editor is unavailable');await maps.ready;let data;if(body.action==='list')data=maps.overview();else if(body.action==='get')data=maps.get(body.mapId);else if(['save','publish'].includes(body.action)){data=await maps.update(body.mapId,body.layout,body.expectedVersion,body.action==='publish');this.audit(req,body,'map-'+body.action,'Map '+body.action,body.mapId,{version:body.expectedVersion});}else throw Error('Unknown map action');json(res,200,data,origin);return;
   }
   if(route==='/owner/map-assets'&&req.method==='POST'){
    if(!relay.mapStore||typeof body.bytes!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.bytes))throw Error('Invalid model upload');const asset=await relay.mapStore.upload(Buffer.from(body.bytes,'base64'),body);this.audit(req,body,'map-asset','Imported map model',asset.id||'',{name:clean(body.name,120)});json(res,200,{asset},origin);return;
   }
   json(res,404,{error:'Not found'},origin);
  }catch(error){json(res,error.status||400,{error:error instanceof SyntaxError?'Invalid JSON request':clean(error.message||'Invalid request',300)},origin);}
 }
 async close(){clearInterval(this.timer);if(this.db.db){this.systemEvent('shutdown','Relay stopped cleanly');await this.db.close();}}
}
