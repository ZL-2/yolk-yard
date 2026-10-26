import {PublicFairPlay} from './royale-fair-play.js';
import {tournamentName} from '../../src/tournament.js';
import {TeamingMonitor} from './teaming-monitor.js';

const HOUR=3600000;
const clean=(v,n=1000)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
export class FairPlayService{
 constructor(relay,{now=Date.now}={}){
  this.relay=relay;this.publicMatches=new PublicFairPlay(relay,{now});this.db=relay.owner.db;this.now=now;this.byPlayer=new Map();
  if(this.db.db)this.db.db.exec(`CREATE TABLE IF NOT EXISTS teaming_cases(id TEXT PRIMARY KEY, created INTEGER NOT NULL, updated INTEGER NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS teaming_penalties(id TEXT PRIMARY KEY, player TEXT NOT NULL, created INTEGER NOT NULL, until_at INTEGER NOT NULL, revoked INTEGER, data TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS teaming_player ON teaming_penalties(player);`);
  if(this.db.db)this.reloadPenalties();
 }
 nextCup(after,excluded){return this.relay.tournament?.events.filter(e=>e.id!==excluded&&!e.event.removed&&!['finished','cancelled'].includes(e.phase)&&e.event.startsAt>after).sort((a,b)=>a.event.opensAt-b.event.opensAt)[0]||null;}
 cupData(e){return e?{id:e.id,name:tournamentName(e.event),opensAt:e.event.opensAt}:null;}
 reloadPenalties(){this.byPlayer.clear();for(const r of this.db.all('SELECT * FROM teaming_penalties WHERE revoked IS NULL')){r.data=JSON.parse(r.data);if(!this.byPlayer.has(r.player))this.byPlayer.set(r.player,[]);this.byPlayer.get(r.player).push(r);}}
 penalties(player){return this.byPlayer.get(player)||[];}
 status(player){
  const now=this.now(),rows=this.penalties(player),cups=[];let until=0;
  for(const r of rows){
   until=Math.max(until,r.until_at);
   let cup=r.data.cup,e=cup&&this.relay.tournament?.event(cup.id);
   if(!cup||!e||e.state?.phase!=='finished'&&(e.event.removed||e.phase==='cancelled')){
    const next=this.nextCup(Math.max(r.created,now),r.data.eventId);cup=this.cupData(next);
    if(JSON.stringify(cup)!==JSON.stringify(r.data.cup)){r.data.cup=cup;this.db.run('UPDATE teaming_penalties SET data=? WHERE id=?',JSON.stringify(r.data),r.id);}e=next;
   }
   if(!cup)cups.push({pending:true,name:'Next scheduled Frontier Cup'});
   else if(e?.phase!=='finished'&&e?.state?.phase!=='finished')cups.push({...cup,...this.cupData(e)});
  }
  return {identity:player,serverNow:now,until:until>now?until:null,cups:[...new Map(cups.map(c=>[c.id||'pending',c])).values()],reason:'Confirmed teaming with opponents',appeal:'Use Report a problem to request a review. Include your Friend Code.'};
 }
 reconcileSchedule(){for(const player of this.byPlayer.keys())this.status(player);}
 sync(player){const status=this.status(player);this.relay.parties.send(this.relay.parties.users.get(player),{type:'fair-play',status});return status;}
 assertPlay(player){if(!player)return;const r=this.penalties(player).filter(r=>r.until_at>this.now()).sort((a,b)=>b.until_at-a.until_at)[0];if(r)throw Error('Teaming suspension: all game modes are blocked until '+new Date(r.until_at).toISOString()+'. Your next scheduled Cup is also prohibited.');}
 assertCup(player,id){this.assertPlay(player);if(this.status(player).cups.some(c=>c.id===id))throw Error('You are prohibited from this Cup because of confirmed teaming. The Cup restriction continues after the one-hour suspension ends.');if(this.disqualified(player,id))throw Error('You were removed from this Cup for teaming and cannot re-enter.');}
 disqualifiedMatch(player,room,matchId){return this.penalties(player).some(p=>p.data.room===room.split('-').at(-1)&&p.data.matchId===matchId);}
 disqualified(player,eventId){return !!eventId&&this.penalties(player).some(p=>p.data.eventId===eventId);}
 observe(room){
  if(room.sim?.options.mode!=='royale')return;
  if(room.teamingMatch!==room.sim.matchId){room.teamingMatch=room.sim.matchId;delete room.teamingMonitor;}
  if(!room.teamingMonitor){room.teamingMonitor=new TeamingMonitor({identity:id=>this.relay.progression.accounts.get(room.members.get(id)?.progressId)?.socialId,onFlag:data=>this.flag({...data,room:room.code,matchId:room.sim.matchId,eventId:room.eventId})});room.sim.fairPlayObserver=e=>room.teamingMonitor.combat(e,room.sim);room.sim.fairPlayTransfer=e=>room.teamingMonitor.transfer(e);}
  try{room.teamingMonitor.sample(room.sim);}catch{if(!this.lastErrorAt||this.now()-this.lastErrorAt>60000){this.lastErrorAt=this.now();this.relay.owner.systemEvent('fair-play-error','Fair-play evidence could not be saved. No unsaved penalty was applied.');}}
 }
 flag({players,evidence,room,matchId,eventId=null}){
  const ids=[...new Set(players)].sort();if(ids.length<2||ids.some(id=>!this.relay.parties.store.identities.has(id)))return null;
  const id='teaming:'+room+':'+matchId+':'+ids.join(':'),old=this.db.get('SELECT * FROM teaming_cases WHERE id=?',id);
  if(old&&old.status!=='pending')return id;
  const data={players:ids.map(id=>({id,name:this.relay.parties.store.identities.get(id).profile.name})),room,matchId,eventId,evidence,notes:old?JSON.parse(old.data).notes||[]:[]};
  this.db.run('INSERT INTO teaming_cases VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,data=excluded.data',id,old?.created||this.now(),this.now(),'pending',JSON.stringify(data));
  if(evidence.enforce===true&&evidence.source==='server simulation')this.enforce(id,data);
  return id;
 }
 report(user,{players,notes}){
  const location=this.relay.parties.matchLocation(user);if(!location)throw Error('Report teaming while you are in the match or spectating it.');
  const roster=this.roster(user),ids=Array.isArray(players)?[...new Set(players)]:[];
  if(ids.length<2||ids.length>8||ids.some(id=>!roster.some(p=>p.id===id)))throw Error('Select two to eight players from this match.');
  if(clean(notes).length<15)throw Error('Describe the cooperation you observed (at least 15 characters).');
  const sim=location.room?.sim,host=this.relay.publicHost.roomByAddress(location.key),matchId=sim?.matchId||host?.state?.matchId||location.key;
  const key='teaming:'+location.listing.code+':'+matchId+':'+ids.sort().join(':'),existing=this.db.get('SELECT data FROM teaming_cases WHERE id=?',key);
  const id=this.flag({players:ids,room:location.listing.code,matchId,eventId:location.room?.eventId,evidence:existing?JSON.parse(existing.data).evidence:{source:'player report',note:'Unverified allegation. Report count does not establish teaming.'}});
  const row=id&&this.db.get('SELECT * FROM teaming_cases WHERE id=?',id);if(row&&row.status==='pending'){const data=JSON.parse(row.data);if(!data.notes.some(n=>n.reporter===user.id)&&data.notes.length<20){data.notes.push({reporter:user.id,at:this.now(),text:clean(notes)});this.db.run('UPDATE teaming_cases SET data=?,updated=? WHERE id=?',JSON.stringify(data),this.now(),id);}}
  return {ok:true};
 }
 roster(user){const location=this.relay.parties.matchLocation(user);if(!location)return [];return [...this.relay.parties.users.values()].filter(u=>this.relay.parties.matchLocation(u)?.key===location.key).map(u=>({id:u.id,name:u.profile.name}));}
 overview(){return {cases:this.db.all('SELECT * FROM teaming_cases ORDER BY (status=\'pending\') DESC,updated DESC LIMIT 100').map(r=>({...r,...JSON.parse(r.data),data:undefined})),penalties:this.db.all('SELECT * FROM teaming_penalties ORDER BY created DESC LIMIT 100').map(r=>({...r,...JSON.parse(r.data),data:undefined,name:this.relay.parties.store.identities.get(r.player)?.profile.name||r.player}))};}
 enforce(id,data){
  const now=this.now(),cup=this.cupData(this.nextCup(now,data.eventId));
  const ids=data.players.map(p=>p.id).filter(player=>!this.penalties(player).some(p=>p.data.matchId===data.matchId&&p.data.room===data.room));
  const reason='Automatic teaming detection: sustained cross-team co-travel, non-aggression and repeated coordinated combat.';
  data.decision={reason,players:ids,at:now,automatic:true};
  this.db.transaction(()=>{for(const player of ids)this.db.run('INSERT INTO teaming_penalties VALUES(?,?,?,?,NULL,?)',id+':'+player,player,now,now+HOUR,JSON.stringify({caseId:id,eventId:data.eventId,matchId:data.matchId,room:data.room,cup,reason}));this.db.run('UPDATE teaming_cases SET status=?,updated=?,data=? WHERE id=?','confirmed',now,JSON.stringify(data),id);this.relay.owner.systemEvent('teaming-auto-removal',reason,id,{players:ids,until:now+HOUR,cup,evidence:data.evidence});});
  this.reloadPenalties();
  for(const player of ids){this.sync(player);this.relay.owner.disconnectPlayer(player,'Removed for teaming. All game modes are suspended for 1 hour. You are also prohibited from the next scheduled Cup.');}
 }
 manage(body,audit){
  const reason=clean(body.reason,500);if(reason.length<20)throw Error('Record the observed evidence or review reason (at least 20 characters).');
  const row=this.db.get('SELECT * FROM teaming_cases WHERE id=?',body.caseId);if(!row)throw Error('Teaming case not found.');const data=JSON.parse(row.data),now=this.now();
  if(body.action==='teaming-revoke'){
   if(row.status!=='confirmed')throw Error('Only a confirmed case can be reversed.');
   this.db.transaction(()=>{for(const p of data.players)this.db.run('UPDATE teaming_penalties SET revoked=? WHERE id=?',now,row.id+':'+p.id);this.db.run('UPDATE teaming_cases SET status=?,updated=? WHERE id=?','reversed',now,row.id);audit({ok:true},data);});
   this.reloadPenalties();
   for(const p of data.players)this.sync(p.id);return {ok:true};
  }
  if(row.status!=='pending')throw Error('This case was already reviewed. Refresh the list.');
  if(body.action!=='teaming-dismiss')throw Error('Unknown teaming action.');
  data.decision={reason,players:[],at:now};
  this.db.transaction(()=>{this.db.run('UPDATE teaming_cases SET status=?,updated=?,data=? WHERE id=?','dismissed',now,JSON.stringify(data),row.id);audit({ok:true},data);});
  return {ok:true};
 }
}
