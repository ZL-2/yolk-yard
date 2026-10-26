import {createHash} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {replayFrame} from '../../src/match-replay.js';
const key=(room,match)=>createHash('sha256').update(room+'\n'+match).digest('hex').slice(0,32);
export class MatchReplays{
 constructor(relay,now=Date.now){
  this.relay=relay;this.db=relay.owner.db;this.now=now;this.active=new Map();this.finished=new Set();
  if(this.db.db){this.db.db.exec(`CREATE TABLE IF NOT EXISTS match_replays(id TEXT PRIMARY KEY,room TEXT,match_id TEXT,created INTEGER,updated INTEGER,retained INTEGER DEFAULT 0,data TEXT);CREATE TABLE IF NOT EXISTS match_replay_chunks(replay TEXT,seq INTEGER,first REAL,last REAL,data BLOB,PRIMARY KEY(replay,seq));`);
   for(const row of this.db.all("SELECT id,data FROM match_replays WHERE json_extract(data,'$.status')='recording'")){const m=JSON.parse(row.data);if(m.status==='recording'){m.status='interrupted';m.gaps.push({reason:'Server restarted before the match recording finished.'});this.db.run('UPDATE match_replays SET data=? WHERE id=?',JSON.stringify(m),row.id);}}
  }
 }
 capture(room,matchId,frame,{source,eventId=null,identities=[]}={}){
  if(!frame||!matchId||frame.matchId!==matchId||!this.db.db)return;
  const id=key(room,matchId),now=this.now();if(this.finished.has(id))return;let live=this.active.get(id);
  if(!live){const row=this.db.get('SELECT data FROM match_replays WHERE id=?',id),old=row&&JSON.parse(row.data);if(old?.status==='complete'){this.finished.add(id);return;}live={id,room,matchId,pending:[],deaths:new Map(),last:old?.last??-Infinity,seen:now,meta:old||{id,room,matchId,eventId,source,first:frame.time,last:frame.time,status:'recording',chunks:0,players:[],gaps:[],map:frame.map,mode:frame.mode}};if(old)live.meta.status='recording';this.active.set(id,live);}
  if(frame.time<=live.last||frame.time-live.last<.48&&frame.phase!=='results')return;
  if(Number.isFinite(live.last)&&frame.time-live.last>3)live.meta.gaps.push({time:live.last,to:frame.time,reason:'No recorded snapshots during this interval.'});
  for(const p of frame.players)if(p.health<=0&&!p.downed&&p.killerId)live.deaths.set(p.id,{killerId:p.killerId,time:frame.time});
  live.last=frame.time;live.seen=now;live.meta.last=frame.time;
  for(const p of identities)if(!live.meta.players.some(v=>v.id===p.id&&v.playerId===p.playerId))live.meta.players.push(p);
  if(!frame.builds&&live.latest?.builds)frame.builds=live.latest.builds;if(!frame.vehicles&&live.latest?.vehicles)frame.vehicles=live.latest.vehicles;
  if(live.pending.length>=20){live.meta.gaps.push({time:live.pending[0].time,to:live.last,reason:'Storage was unavailable; the recording buffer could not be saved.'});live.pending=[];live.pendingBytes=0;}
  const bytes=Buffer.byteLength(JSON.stringify(frame));if(live.pending.length&&(live.pendingBytes||0)+bytes>6000000)this.flush(live);
  live.meta.gaps=live.meta.gaps.slice(-100);live.pending.push(frame);live.pendingBytes=(live.pendingBytes||0)+bytes;live.latest=frame;
  if(frame.phase==='results')live.meta.status='complete';
  if(live.pending.length>=10||live.meta.status==='complete')this.flush(live);
  if(live.meta.status==='complete'){this.active.delete(id);this.finished.add(id);if(this.finished.size>256)this.finished.delete(this.finished.values().next().value);}
 }
 flush(live){
  if(!live.pending.length)return;const frames=live.pending,payload=deflateRawSync(Buffer.from(JSON.stringify(frames)),{level:3}),seq=live.meta.chunks;
  const retained=seq===0&&!!(this.db.get("SELECT id FROM teaming_cases WHERE json_extract(data,'$.room')=? AND json_extract(data,'$.matchId')=? LIMIT 1",live.room,live.matchId)||this.db.get('SELECT id FROM fair_play_reports WHERE room=? AND match_id=? LIMIT 1',live.room,live.matchId));
  const next={...live.meta,chunks:seq+1};this.db.transaction(()=>{this.db.run('INSERT INTO match_replay_chunks VALUES(?,?,?,?,?)',live.id,seq,frames[0].time,frames.at(-1).time,payload);this.db.run('INSERT INTO match_replays VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,data=excluded.data',live.id,live.room,live.matchId,this.now(),this.now(),Number(retained),JSON.stringify(next));});live.meta=next;live.pending=[];live.pendingBytes=0;
 }
 server(room){
  const sim=room.sim;if(!sim?.matchId||!room.members.size)return;const id=key(room.code,sim.matchId);if(this.finished.has(id))return;const last=this.active.get(id)?.last;if(last!=null&&sim.time-last<.5&&sim.phase!=='results')return;
  this.capture(room.code,sim.matchId,replayFrame(sim.snapshot({includeLoot:false,includeBuilds:true})),{source:'server simulation',eventId:room.eventId,identities:[...room.members].map(([playerId,p])=>({playerId,id:this.relay.progression.accounts.get(p.progressId)?.socialId,name:sim.players.get(playerId)?.name})).filter(p=>p.id)});
 }
 receive(peer,message){
  const r=this.relay,room=r.publicHost.roomFor(peer),watch=r.hostWatchdog.rooms.get(peer.id)||r.hostWatchdog.owners.get(peer.id);
  if(room?room.host?.peer!==peer.id:!watch||watch.owner!==peer.id&&watch.address!==peer.id)return;
  const matchId=room?.state?.matchId||watch?.matchId,code=room?.code||r.peers.get(watch.address)?.listing?.code,options=room?.options||r.peers.get(watch.address)?.listing;
  if(!code||!options||message.state?.matchId!==matchId)return;
  const now=this.now(),lease=room||watch;if(now-(lease.replayAt||0)<400)return;lease.replayAt=now;
  const frame=replayFrame({...message.state,options:{map:options.map,mode:options.mode,teamSize:options.teamSize},royale:options.mode==='royale'?{...message.state,matchId}:null});
  if(!frame||Math.abs(frame.time-(room?.state?.time??watch?.time))>5)return;
  const identities=room?[...room.members.values()].map(m=>({playerId:m.id,id:m.admission.memberId,name:r.parties.users.get(m.admission.memberId)?.profile.name})):[...r.parties.users.values()].filter(u=>r.parties.matchLocation(u)?.key===watch.address).map(u=>({id:u.id,name:u.profile.name,playerId:r.parties.matchLocation(u).watchId}));
  this.capture(code,matchId,frame,{source:'elected player host',identities:identities.filter(p=>p.id)});
 }
 retain(room,match){const id=key(room,match),live=this.active.get(id);if(live)this.flush(live);this.db.run('UPDATE match_replays SET retained=1 WHERE id=?',id);return this.summary(room,match);}
 mark(room,match,marker){const meta=this.retain(room,match);if(!meta)return;meta.markers=[...(meta.markers||[]),{...marker,time:meta.last}].slice(-500);const live=this.active.get(meta.id);if(live)live.meta=meta;this.db.run('UPDATE match_replays SET data=? WHERE id=?',JSON.stringify(meta),meta.id);}
 summary(room,match){const id=key(room,match),live=this.active.get(id);if(live)return {...live.meta};const r=this.db.get('SELECT data FROM match_replays WHERE id=?',id);return r?JSON.parse(r.data):null;}
 latest(room,match){return this.active.get(key(room,match))?.latest;}
 recentDeath(room,match,player){const id=key(room,match),live=this.active.get(id),death=live?.deaths.get(player);if(death)return {death,latest:live.latest.time};const row=this.db.get('SELECT data FROM match_replay_chunks WHERE replay=? ORDER BY seq DESC LIMIT 1',id);if(!row)return null;const frames=JSON.parse(inflateRawSync(row.data,{maxOutputLength:8000000}).toString()),last=frames.at(-1);for(const f of frames.toReversed()){const p=f.players.find(p=>p.id===player&&p.health<=0&&!p.downed&&p.killerId);if(p)return {death:{killerId:p.killerId,time:f.time},latest:last.time};}return null;}
 read(body){
  if(typeof body.id!=='string'||!/^[a-f0-9]{32}$/.test(body.id))throw Error('Invalid replay');const live=this.active.get(body.id);if(live)this.flush(live);
  const row=this.db.get('SELECT data FROM match_replays WHERE id=?',body.id);if(!row)throw Error('No recording is available for this match.');
  const meta=JSON.parse(row.data),start=Math.max(0,Math.floor(Number(body.start)||0)),count=Math.min(6,Math.max(1,Math.floor(Number(body.count)||1)));
  const chunks=this.db.all('SELECT seq,first,last,data FROM match_replay_chunks WHERE replay=? AND seq>=? ORDER BY seq LIMIT ?',body.id,start,count).map(r=>({seq:r.seq,first:r.first,last:r.last,frames:JSON.parse(inflateRawSync(r.data,{maxOutputLength:8000000}).toString())}));
  return {meta,index:this.db.all('SELECT seq,first,last FROM match_replay_chunks WHERE replay=? ORDER BY seq',body.id),chunks};
 }
 sweep(){const now=this.now();for(const [id,l]of this.active)if(now-l.seen>60000){l.meta.status='interrupted';l.meta.gaps.push({time:l.last,reason:'Match ended or recording source disconnected.'});this.flush(l);this.db.run('UPDATE match_replays SET data=? WHERE id=?',JSON.stringify(l.meta),id);this.active.delete(id);}if(now-(this.cleaned||0)>3600000){this.cleaned=now;this.db.transaction(()=>{this.db.run('DELETE FROM match_replay_chunks WHERE replay IN (SELECT id FROM match_replays WHERE retained=0 AND updated<?)',now-86400000);this.db.run('DELETE FROM match_replays WHERE retained=0 AND updated<?',now-86400000);});}}
 close(){for(const l of this.active.values())this.flush(l);this.active.clear();}
}
