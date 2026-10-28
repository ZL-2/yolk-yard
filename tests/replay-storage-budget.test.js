import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {trimReplays} from '../server/realtime/replay-storage.js';
function fixture(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE match_replays(id TEXT PRIMARY KEY,updated INTEGER,retained INTEGER,data TEXT);CREATE TABLE match_replay_chunks(replay TEXT,data BLOB);');return db;}
function add(db,id,bytes,{retained=0,status='complete',at=1000}={}){db.prepare('INSERT INTO match_replays VALUES(?,?,?,?)').run(id,at,retained,JSON.stringify({status}));db.prepare('INSERT INTO match_replay_chunks VALUES(?,?)').run(id,Buffer.alloc(bytes));}
test('busy-day recording recycles oldest ordinary footage before accepting incoming data',()=>{const db=fixture();try{add(db,'old',70);add(db,'new',20,{at:2000});const r=trimReplays(db,{budget:100,incoming:30,now:3000});assert.equal(r.allowed,true);assert.equal(r.bytes,20);assert.deepEqual(db.prepare('SELECT id FROM match_replays').all().map(x=>x.id),['new']);}finally{db.close();}});
test('protected evidence is preserved and the budget refuses more footage',()=>{const db=fixture();try{add(db,'case',100,{retained:1});assert.equal(trimReplays(db,{budget:100,incoming:1,now:3000}).allowed,false);assert.equal(db.prepare('SELECT length(data) n FROM match_replay_chunks').get().n,100);}finally{db.close();}});
test('active matches and current recording survive rotation',()=>{const db=fixture();try{add(db,'active',60,{status:'recording',at:3000});add(db,'current',30);assert.equal(trimReplays(db,{budget:100,incoming:20,now:3000,current:'current'}).allowed,false);assert.equal(db.prepare('SELECT count(*) n FROM match_replays').get().n,2);}finally{db.close();}});
test('ordinary footage expires after a day even below the budget',()=>{const db=fixture();try{add(db,'expired',20);add(db,'case',20,{retained:1});const r=trimReplays(db,{budget:100,now:86402000});assert.equal(r.bytes,20);assert.equal(db.prepare('SELECT id FROM match_replays').get().id,'case');}finally{db.close();}});
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ReplayWriter} from '../server/realtime/replay-writer.js';
test('real worker saves recordings and releases queued memory after a database write failure',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'replay-budget-')),path=join(dir,'history.sqlite');
 const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE match_replays(id TEXT PRIMARY KEY,room TEXT,match_id TEXT,created INTEGER,updated INTEGER,retained INTEGER,data TEXT);
 CREATE TABLE match_replay_chunks(replay TEXT,seq INTEGER,first REAL,last REAL,data BLOB,PRIMARY KEY(replay,seq));
 CREATE TABLE teaming_cases(id TEXT,data TEXT);CREATE TABLE fair_play_reports(id TEXT,room TEXT,match_id TEXT);`);
 const writer=new ReplayWriter(path,()=>{}),meta={id:'record',room:'room',matchId:'match',status:'recording',gaps:[],chunks:1};
 try{
  assert.equal(writer.enqueue({meta,frames:[{time:1,players:[]}],seq:0,at:Date.now()},4096),true);await writer.drain();
  assert.equal(db.prepare('SELECT count(*) n FROM match_replay_chunks').get().n,1);assert.equal(writer.bytes,0);
  writer.enqueue({meta,frames:[{time:2}],seq:0,at:Date.now()},4096);await assert.rejects(writer.drain());
  assert.equal(writer.pending.size,0);assert.equal(writer.bytes,0);
 }finally{await writer.close().catch(()=>{});db.close();await rm(dir,{recursive:true,force:true});}
});
import {OwnerStore} from '../server/realtime/owner-store.js';
import {readdir,writeFile} from 'node:fs/promises';
test('verified backups rotate to two copies and remove failed temporary copies',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'backup-budget-'));let now=Date.now();const store=new OwnerStore({path:join(dir,'owner.sqlite'),now:()=>now});
 try{
  assert.ok(store.db,store.error?.message);
  for(let i=0;i<4;i++){now+=1000;await store.createBackup();}
  const backups=store.path+'.backups';await writeFile(join(backups,'owner-2026-10-28T00-00-00-000Z.sqlite.tmp'),'incomplete');now+=1000;await store.createBackup();
  const names=await readdir(backups);assert.equal(names.filter(n=>n.endsWith('.sqlite')).length,2);assert.equal(names.some(n=>n.includes('.tmp')),false);
  const latest=store.storage().lastBackup;const check=new DatabaseSync(join(backups,latest.name),{readOnly:true});assert.equal(check.prepare('PRAGMA quick_check').get().quick_check,'ok');check.close();
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});
