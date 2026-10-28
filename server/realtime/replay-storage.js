// Replay footage is a bounded cache. Flagged evidence is never evicted here.
export const REPLAY_BUDGET=96*1024*1024;
export function trimReplays(db,{budget=REPLAY_BUDGET,incoming=0,now=Date.now(),current=null}={}){
 const total=()=>Number(db.prepare('SELECT coalesce(sum(length(data)),0) n FROM match_replay_chunks').get().n);
 let bytes=total();
 const rows=db.prepare(`SELECT id,updated,retained FROM match_replays WHERE retained=0 AND id!=? AND (updated<? OR json_extract(data,'$.status')!='recording') ORDER BY updated,id`).all(current||'',now-60000);
 for(const row of rows){
  if(bytes+incoming<=budget&&row.updated>=now-86400000)continue;
  const size=Number(db.prepare('SELECT coalesce(sum(length(data)),0) n FROM match_replay_chunks WHERE replay=?').get(row.id).n);
  db.exec('BEGIN IMMEDIATE');try{
   db.prepare('DELETE FROM match_replay_chunks WHERE replay=?').run(row.id);
   db.prepare('DELETE FROM match_replays WHERE id=? AND retained=0').run(row.id);
   db.exec('COMMIT');bytes-=size;
  }catch(error){db.exec('ROLLBACK');throw error;}
  // Bound the WAL during recovery of a previously oversized database.
  db.exec('PRAGMA wal_checkpoint(PASSIVE)');
 }
 return {bytes,allowed:bytes+incoming<=budget};
}
