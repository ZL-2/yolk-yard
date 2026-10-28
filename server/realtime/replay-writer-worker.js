import {parentPort,workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {statSync,statfsSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {trimReplays} from './replay-storage.js';
const db=new DatabaseSync(workerData.path,{timeout:1000});db.exec('PRAGMA synchronous=FULL;');
const statement=new Map(),sql=q=>{if(!statement.has(q))statement.set(q,db.prepare(q));return statement.get(q);};
let nextTrim=0,storageBytes=0;
parentPort.on('message',task=>{
 try{
  // Compression and serialization happen before acquiring the write lock.
  const payload=task.frames?deflateRawSync(Buffer.from(JSON.stringify(task.frames)),{level:1}):null;
  let allowed=true;
  if(Date.now()>=nextTrim||storageBytes+(payload?.length||0)>96*1024*1024){
   const result=trimReplays(db,{incoming:payload?.length||0,current:task.meta?.id});
   storageBytes=result.bytes;allowed=result.allowed;nextTrim=Date.now()+60000;
   // Reclaim the old oversized allocation once rotation has made it mostly empty.
   // Never attempt compaction without room for both the compact copy and WAL.
   const pageSize=Number(sql('PRAGMA page_size').get().page_size),pages=Number(sql('PRAGMA page_count').get().page_count),free=Number(sql('PRAGMA freelist_count').get().freelist_count);
   const space=statfsSync(workerData.path),live=(pages-free)*pageSize;
   if(statSync(workerData.path).size>256*1024*1024&&free*pageSize>128*1024*1024&&space.bavail*space.bsize>live*2+32*1024*1024){db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);');}

  }
  if(payload&&!allowed){
   const meta={...task.meta,storageLimited:true,gaps:[...(task.meta.gaps||[]),{time:task.frames[0].time,to:task.frames.at(-1).time,reason:'Recording storage budget reached; retained evidence was preserved.'}].slice(-100)};
   sql('INSERT INTO match_replays VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,data=excluded.data').run(meta.id,meta.room,meta.matchId,task.at,task.at,Number(!!task.retained),JSON.stringify(meta));
   parentPort.postMessage({id:task.id,warning:'Replay recording paused: retained evidence fills the storage budget.'});return;
  }
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
   if(task.kind==='sweep')nextTrim=0;else storageBytes+=(payload?.length||0);
  }catch(error){db.exec('ROLLBACK');throw error;}
  parentPort.postMessage({id:task.id});
 }catch(error){parentPort.postMessage({id:task.id,error:error.message});}
});
