import {parentPort,workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {deflateRawSync} from 'node:zlib';
const db=new DatabaseSync(workerData.path,{timeout:1000});db.exec('PRAGMA synchronous=FULL;');
const statement=new Map(),sql=q=>{if(!statement.has(q))statement.set(q,db.prepare(q));return statement.get(q);};
parentPort.on('message',task=>{
 try{
  // Compression and serialization happen before acquiring the write lock.
  const payload=task.frames?deflateRawSync(Buffer.from(JSON.stringify(task.frames)),{level:1}):null;
  db.exec('BEGIN IMMEDIATE');
  try{
   if(task.kind==='sweep'){
    sql('DELETE FROM match_replay_chunks WHERE replay IN (SELECT id FROM match_replays WHERE retained=0 AND updated<?)').run(task.before);
    sql('DELETE FROM match_replays WHERE retained=0 AND updated<?').run(task.before);
   }else{
    const {meta}=task;let retained=!!task.retained;
    if(task.seq===0)retained ||= !!(sql("SELECT id FROM teaming_cases WHERE json_extract(data,'$.room')=? AND json_extract(data,'$.matchId')=? LIMIT 1").get(meta.room,meta.matchId)||sql('SELECT id FROM fair_play_reports WHERE room=? AND match_id=? LIMIT 1').get(meta.room,meta.matchId));
    if(payload)sql('INSERT INTO match_replay_chunks VALUES(?,?,?,?,?)').run(meta.id,task.seq,task.frames[0].time,task.frames.at(-1).time,payload);
    sql('INSERT INTO match_replays VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,retained=MAX(match_replays.retained,excluded.retained),data=excluded.data').run(meta.id,meta.room,meta.matchId,task.at,task.at,Number(retained),JSON.stringify(meta));
   }
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  parentPort.postMessage({id:task.id});
 }catch(error){parentPort.postMessage({id:task.id,error:error.message});}
});
