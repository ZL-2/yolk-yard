import {createHash,randomUUID} from 'node:crypto';
const clean=v=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,300);
const actions=new Set(['warn','kick','ban','unban','mute','unmute','teaming','cheating','reverse-teaming','announce','end-match']);
export class OwnerMatchService{
 constructor(owner){this.owner=owner;this.db=owner.db;if(this.db.db)this.db.db.exec(`CREATE TABLE IF NOT EXISTS owner_match_notices(id TEXT PRIMARY KEY,player TEXT NOT NULL,created INTEGER NOT NULL,data TEXT NOT NULL,read_at INTEGER);CREATE TABLE IF NOT EXISTS owner_notice_views(notice TEXT NOT NULL,player TEXT NOT NULL,shown INTEGER NOT NULL,PRIMARY KEY(notice,player));CREATE INDEX IF NOT EXISTS owner_match_notices_player ON owner_match_notices(player,created);`);}
 get relay(){return this.owner.relay;}
 context(body){
  const r=this.relay,host=[...r.peers.values()].find(p=>p.listing?.code===body.code&&(p.ws||p.virtualRoom));
  if(!host)throw Error('This match is no longer available.');
  const authority=r.authority.rooms.get(host.id),pub=r.publicHost.roomByAddress(host.id),watch=r.hostWatchdog.rooms.get(host.id),matchId=authority?.sim.matchId||pub?.state?.matchId||watch?.matchId;
  if(!matchId||matchId!==body.matchId)throw Object.assign(Error('The match changed. Refresh the owner panel before acting.'),{status:409});
  const roster=[...r.parties.users.values()].filter(u=>r.parties.matchLocation(u)?.key===host.id).map(u=>{const location=r.parties.matchLocation(u),member=pub&&[...pub.members.values()].find(m=>m.admission.memberId===u.id),actor=authority?.sim.players.get(location.watchId);return {id:u.id,name:u.profile.name,playerId:member?.id||location.watchId,connected:r.parties.connected(u),team:actor?.team??null,spectating:!!(actor?.spectating||member?.admission.spectator),host:authority?actor?.id===authority.owner:member?member.id===pub.host?.id:location.watchId===watch?.hostId};});
  return {host,authority,pub,matchId,code:body.code,roster};
 }
 history(code,matchId){return this.db.all("SELECT * FROM events WHERE kind='owner-match' AND json_extract(data,'$.code')=? AND json_extract(data,'$.matchId')=? ORDER BY at DESC,rowid DESC LIMIT 30",code,matchId).map(row=>({...row,...JSON.parse(row.data)}));}
 overview(body){
  const c=this.context(body),history=this.history(c.code,c.matchId),known=new Map(c.roster.map(p=>[p.id,{...p,present:true}]));
  for(const h of history)for(const p of h.targets||[])if(!known.has(p.id))known.set(p.id,{id:p.id,name:p.name,present:false});
  const cases=this.db.all("SELECT * FROM teaming_cases WHERE status='confirmed' AND json_extract(data,'$.room')=? AND json_extract(data,'$.matchId')=? ORDER BY updated DESC LIMIT 200",c.code,c.matchId).map(row=>({id:row.id,...JSON.parse(row.data)}));
  for(const row of cases)for(const p of row.players)if(!known.has(p.id))known.set(p.id,{id:p.id,name:p.name,present:false});
  return {code:c.code,matchId:c.matchId,mode:c.host.listing.mode,serverNow:this.owner.now(),cup:!!c.authority?.tournament,roster:[...known.values()].map(p=>({...p,mute:this.owner.sanction(p.id,'mute'),ban:this.owner.sanction(p.id,'ban'),fairPlay:this.relay.fairPlay.status(p.id)})),cases:cases.map(c=>({id:c.id,kind:c.kind,eventId:c.eventId,players:c.players,decision:c.decision,evidence:c.evidence,replay:this.relay.fairPlay.replays.summary(c.room,c.matchId)})),history:history.map(h=>({at:h.at,action:h.action,reason:h.message,targets:h.targets||[]}))};
 }
 status(player){return {identity:player,serverNow:this.owner.now(),mute:this.owner.sanction(player,'mute'),ban:this.owner.sanction(player,'ban'),notices:this.db.all('SELECT id,created,data FROM owner_match_notices WHERE player=? AND read_at IS NULL ORDER BY created DESC,rowid DESC LIMIT 20',player).map(r=>{const data=JSON.parse(r.data);if(data.requiredRead)this.db.run('INSERT OR IGNORE INTO owner_notice_views VALUES(?,?,?)',r.id,player,this.owner.now());return {id:r.id,at:r.created,...data};})};}
 sync(player){const status=this.status(player);this.relay.parties.send(this.relay.parties.users.get(player),{type:'owner-match-status',status});return status;}
 acknowledge(player,ids){if(!Array.isArray(ids)||ids.length>20||ids.some(id=>typeof id!=='string'||id.length>200))throw Error('Invalid notice acknowledgement');for(const id of ids){const row=this.db.get('SELECT data FROM owner_match_notices WHERE id=? AND player=?',id,player);if(row){const data=JSON.parse(row.data);if(data.requiredRead){const view=this.db.get('SELECT shown FROM owner_notice_views WHERE notice=? AND player=?',id,player);if(!view||this.owner.now()-view.shown<(data.minimumReadMs||15000))throw Error('Read the complete notice before acknowledging.');}}}for(const id of ids)this.db.run('UPDATE owner_match_notices SET read_at=? WHERE id=? AND player=?',this.owner.now(),id,player);return this.sync(player);}
 notice(player,requestId,data){this.db.run('INSERT OR IGNORE INTO owner_match_notices VALUES(?,?,?,?,NULL)',requestId+':'+player,player,this.owner.now(),JSON.stringify(data));}
 chatIdentity(peer,sender){
  if(!sender)return this.relay.progression.accounts.get(peer.progressId)?.socialId||[...this.relay.parties.users.values()].find(u=>u.matchPeer===peer.id)?.id;
  const room=this.relay.publicHost.roomFor(peer);if(room){const member=[...room.members.values()].find(m=>m.id===sender);return member?.admission.memberId;}
  for(const u of this.relay.parties.users.values()){const l=this.relay.parties.matchLocation(u);if(l&&(l.key===peer.id||l.key===peer.hostReady?.address)&&l.watchId===sender)return u.id;}
  return null;
 }
 chatAllowed(peer,data){const id=this.chatIdentity(peer,data.type==='chat-message'?data.message?.sender:null);return !id||!this.owner.sanction(id,'mute');}
 async action(req,body){
  if(!actions.has(body.action)||!/^[-a-f0-9]{36}$/.test(body.requestId||''))throw Error('Invalid match action');
  const fingerprint=createHash('sha256').update(JSON.stringify([body.action,body.code,body.matchId,body.players,body.reason,body.hours,body.caseId])).digest('hex'),key='owner-match:'+body.requestId;
  const previous=this.db.get('SELECT data FROM events WHERE id=?',key);if(previous){const old=JSON.parse(previous.data);if(old.fingerprint!==fingerprint)throw Object.assign(Error('This request was already used for a different action.'),{status:409});return old.result;}
  const c=this.context(body),reason=clean(body.reason);if(reason.length<5)throw Error('Give the player a clear reason (at least five characters).');
  const view=this.overview(body),ids=Array.isArray(body.players)?[...new Set(body.players)]:[];
  if(!['announce','end-match','reverse-teaming'].includes(body.action)&&(!ids.length||ids.length>8))throw Error('Select one to eight players.');
  const targets=ids.map(id=>view.roster.find(p=>p.id===id));if(targets.some(p=>!p||!p.present&&!['unmute','unban'].includes(body.action)))throw Error('A selected player left this match. Refresh the roster.');
  const now=this.owner.now(),hours=Number(body.hours??1),r=this.relay,result={ok:true,action:body.action,at:now};
  if(['ban','mute'].includes(body.action)&&![1,24,168].includes(hours))throw Error('Choose 1 hour, 24 hours, or 7 days.');
  if(body.action==='end-match'&&c.authority?.sim.phase==='results')throw Error('This match has already completed.');
  const record=()=>this.db.event('owner-match',reason,c.code,{code:c.code,matchId:c.matchId,action:body.action,targets:targets.map(p=>({id:p.id,name:p.name})),actor:this.owner.actor(req,body),fingerprint,result},key);
  if(['teaming','cheating'].includes(body.action)){
   const id='owner-'+body.action+':'+body.requestId,data={kind:body.action,players:targets.map(p=>({id:p.id,name:p.name})),room:c.code,matchId:c.matchId,eventId:c.authority?.eventId||null,evidence:{source:'owner observation',note:reason,actor:this.owner.actor(req,body)},notes:[]};
   r.fairPlay.enforce(id,data,{automatic:false,reason:'Owner observed '+body.action+': '+reason,audit:record});
  }else if(body.action==='reverse-teaming'){
   if(!view.cases.some(c=>c.id===body.caseId))throw Error('This active penalty is not from the current match.');
   r.fairPlay.manage({action:'teaming-revoke',caseId:body.caseId,reason:'Owner match review: '+reason},()=>record());
   const reviewed=view.cases.find(c=>c.id===body.caseId);for(const p of reviewed.players){this.notice(p.id,body.requestId,{title:'Fair-play penalty reversed',message:reason+' Your suspension'+(reviewed.eventId?' and Cup exclusion':'')+' from this case were lifted. A running match cannot be rejoined.',kind:'reversal'});this.sync(p.id);}
  }else if(body.action==='end-match'){
   if(c.authority?.tournament){r.tournament.manage({action:'tournament-cancel',eventId:c.authority.eventId,revision:r.tournament.catalog.revision,reason},()=>record());}
   else {await this.owner.action(req,{...body,action:'close-room',room:c.host.id,reason:'Match ended by owner: '+reason});record();}
  }else{
   const affected=body.action==='announce'?c.roster:targets;
   this.db.transaction(()=>{
    for(const p of affected){
     if(['ban','mute'].includes(body.action)){this.db.run('UPDATE sanctions SET revoked=? WHERE player=? AND kind=? AND revoked IS NULL',now,p.id,body.action);this.db.run('INSERT INTO sanctions VALUES(?,?,?,?,?,NULL,?)',randomUUID(),p.id,body.action,now,now+hours*3600000,reason);}
     if(['unban','unmute'].includes(body.action))this.db.run('UPDATE sanctions SET revoked=? WHERE player=? AND kind=? AND revoked IS NULL',now,p.id,body.action.slice(2));
     const titles={warn:'Owner warning',kick:'Removed from the match',ban:'Gameplay suspension',unban:'Owner suspension lifted',mute:'Text chat restricted',unmute:'Text chat restored',announce:'Match announcement'};
     const details={kick:'You were removed from this match.',ban:`All game modes are suspended for ${hours} hour${hours===1?'':'s'}.`,mute:`Match and lobby text chat are restricted for ${hours} hour${hours===1?'':'s'}. Voice chat is unchanged.`,unban:'This owner suspension has ended. Other active restrictions still apply.',unmute:'This owner text-chat restriction has ended.'};
     this.notice(p.id,body.requestId,{title:titles[body.action],message:reason+(details[body.action]?' '+details[body.action]:''),kind:body.action,expires:['ban','mute'].includes(body.action)?now+hours*3600000:null});
    }record();
   });
   for(const p of affected)this.sync(p.id);
   if(['kick','ban'].includes(body.action))for(const p of targets)this.owner.disconnectPlayer(p.id,(body.action==='ban'?`Owner suspended all game modes until ${new Date(now+hours*3600000).toISOString()}. `:'Removed from the match by the owner. ')+reason);
  }
  return result;
 }
}
