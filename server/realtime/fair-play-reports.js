import {createHash} from 'node:crypto';
export class FairPlayReports{
 constructor(service){this.service=service;this.relay=service.relay;this.db=service.db;this.focus=new Map();if(this.db.db)this.db.db.exec('CREATE TABLE IF NOT EXISTS fair_play_reports(id TEXT PRIMARY KEY,created INTEGER,room TEXT,match_id TEXT,player TEXT,reporter TEXT,category TEXT,data TEXT);');}
 save(user,{location,matchId,target,category,notes='',death=null}){
  if(!['teaming','cheating'].includes(category)||typeof notes!=='string'||notes.length>1000||!target||target.id===user.id)throw Error('Choose an opposing player and a report category.');
  const room=location.listing.code,id=createHash('sha256').update([room,matchId,target.id,user.id].join('|')).digest('hex');const existing=this.db.get('SELECT id FROM fair_play_reports WHERE id=?',id);if(existing)return {ok:true,duplicate:true,message:'Your report is already saved for this player in this match.'};
  const now=this.service.now(),data={reporterName:user.profile.name,targetName:target.name,notes:notes.replace(/[\u0000-\u001f]/g,' ').trim(),death,verified:false};
  this.db.run('INSERT INTO fair_play_reports VALUES(?,?,?,?,?,?,?,?)',id,now,room,matchId,target.id,user.id,category,JSON.stringify(data));try{this.service.replays.mark(room,matchId,{type:'Report',players:[target.id],reason:category+' · unverified'});}catch{this.service.replayError='A report marker could not be saved.';}
  const key=room+':'+matchId,watch=this.focus.get(key)||new Set();if(typeof target.playerId==='string')watch.add(target.playerId);this.focus.set(key,watch);if(this.focus.size>256)this.focus.delete(this.focus.keys().next().value);
  if(location.room?.teamingMonitor){location.room.teamingMonitor.focus=watch;location.room.teamingMonitor.last=-Infinity;}
  const pub=this.relay.publicHost.roomByAddress(location.key);if(pub)for(const member of pub.members.values()){const peer=this.relay.peers.get(member.peer);if(peer)this.relay.send(peer,{type:'fair-play-focus',matchId,players:[...watch]});}
  return {ok:true,message:'Report saved. This player now receives closer monitoring; gameplay evidence is still required for punishment.'};
 }
 death(user,m){
  const p=this.relay.parties;let location=p.matchLocation(user);
  if(!location&&user.inMatch){const peer=this.relay.peers.get(user.matchPeer),room=peer&&this.relay.authority.roomFor(peer),host=room?.hostPeer||[...this.relay.peers.values()].find(p=>p.listing?.code===user.matchCode);if(peer&&host?.listing?.phase==='results')location={key:host.id,listing:host.listing,room,watchId:room?peer.authorityId:peer.hostRecovery?.playerId||(peer.id===host.id?'host':peer.id)};}
  if(!location)throw Error('Report the player from the match where you were eliminated.');
  const matchId=location.room?.sim.matchId||this.relay.publicHost.roomByAddress(location.key)?.state?.matchId||this.relay.hostWatchdog.rooms.get(location.key)?.matchId;
  if(m.matchId!==matchId)throw Error('This report belongs to a different match.');
  const sim=location.room?.sim,actor=sim?.players.get(location.watchId),record=this.service.replays.recentDeath(location.listing.code,matchId,location.watchId);
  const observed=actor&&actor.health<=0&&!actor.downed?{killerId:actor.killerId,time:sim.time}:record?.death;
  if(!observed||typeof m.target!=='string'||observed.killerId!==m.target||!sim&&(!record||record.latest-observed.time>120))throw Error('The selected player is not your recorded recent eliminator.');
  const meta=this.service.replays.summary(location.listing.code,matchId),target=(meta?.players||[]).find(p=>p.playerId===m.target)||[...p.users.values()].filter(u=>p.matchLocation(u)?.key===location.key).map(u=>({id:u.id,name:u.profile.name,playerId:p.matchLocation(u).watchId})).find(p=>p.playerId===m.target);
  return this.save(user,{location,matchId,target,category:m.category,notes:m.notes||'',death:{victim:location.watchId,killer:m.target,time:observed.time,source:sim?'server simulation':'elected player host'}});
 }
 list(){return this.db.all('SELECT * FROM fair_play_reports ORDER BY created DESC LIMIT 200').map(r=>({...r,...JSON.parse(r.data),data:undefined,replay:this.service.replays.summary(r.room,r.match_id)}));}
}
