import {DatabaseSync,backup} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,existsSync,statSync,chmodSync} from 'node:fs';
import {mkdir,readdir,rename,unlink,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {recoverOwnerVisits} from './owner-recovery.js';
import {socialDataPath,persistentMount} from './data-path.js';

export const OWNER_MODES=['royale','boxfight','zonewars','zombies','ffa','training'];
export const ownerMode=value=>OWNER_MODES.includes(value)?value:['lobby','menu','editor'].includes(value)?value:'menu';
export const ownerDatabasePath=()=>process.env.RAVEL_OWNER_DB_PATH||join(dirname(socialDataPath()),'owner-history.sqlite');
const DAY=86400000,number=v=>Number.isFinite(Number(v))?Number(v):0;
const parse=s=>JSON.parse(s);
export const ownerDefaults=()=>({revision:0,maintenance:false,maintenanceMessage:'Matchmaking is temporarily paused. Existing matches can finish.',chatEnabled:true,chatSlowSeconds:0,modes:Object.fromEntries(OWNER_MODES.map(mode=>[mode,{public:true,private:true}])),announcement:null});
const HISTORY_TABLES=['visits','segments','events','samples','results','matches','tickets','pageviews','visit_presence'];
export class OwnerStore{
 constructor({path=ownerDatabasePath(),legacyPath=process.env.YOLK_OWNER_DATA_PATH,now=Date.now}={}){
  this.path=path||':memory:';this.now=now;this.statements=new Map();this.backupPromise=null;
  try{
   if(this.path!==':memory:')mkdirSync(dirname(this.path),{recursive:true});
   this.db=new DatabaseSync(this.path,{timeout:1000});
   if(this.db.prepare('PRAGMA user_version').get().user_version>1)throw Error('Owner history requires a newer server. Existing history was preserved.');
   if(this.db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Owner history needs recovery. Existing files were preserved.');
   this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS grant_reads(id TEXT PRIMARY KEY,player TEXT NOT NULL,at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS visits(id TEXT PRIMARY KEY,client TEXT NOT NULL,visitor TEXT NOT NULL,started INTEGER NOT NULL,seen INTEGER NOT NULL,ended INTEGER,mode TEXT NOT NULL,visible INTEGER NOT NULL DEFAULT 1,activeMs INTEGER NOT NULL DEFAULT 0,reason TEXT NOT NULL DEFAULT '');
    CREATE INDEX IF NOT EXISTS visits_started ON visits(started); CREATE INDEX IF NOT EXISTS visits_client ON visits(client,seen); CREATE INDEX IF NOT EXISTS visits_visitor ON visits(visitor,started);
    CREATE TABLE IF NOT EXISTS segments(id TEXT PRIMARY KEY,visit TEXT NOT NULL,mode TEXT NOT NULL,started INTEGER NOT NULL,ended INTEGER NOT NULL,activeMs INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS segments_started ON segments(started,mode); CREATE INDEX IF NOT EXISTS segments_visit ON segments(visit,started);
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,at INTEGER NOT NULL,kind TEXT NOT NULL,target TEXT NOT NULL DEFAULT '',message TEXT NOT NULL DEFAULT '',data TEXT NOT NULL DEFAULT '{}');
    CREATE INDEX IF NOT EXISTS events_at ON events(at); CREATE INDEX IF NOT EXISTS events_target ON events(target,at);
    CREATE TABLE IF NOT EXISTS samples(at INTEGER PRIMARY KEY,online INTEGER NOT NULL,players INTEGER NOT NULL,rooms INTEGER NOT NULL,cpu REAL,memory REAL,fps REAL,rtt REAL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY,at INTEGER NOT NULL,player TEXT NOT NULL,mode TEXT NOT NULL,public INTEGER NOT NULL,kills INTEGER NOT NULL,wins INTEGER NOT NULL,marks INTEGER NOT NULL,data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS results_at ON results(at,mode); CREATE INDEX IF NOT EXISTS results_player ON results(player,at);
    CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,started INTEGER NOT NULL,seen INTEGER NOT NULL,ended INTEGER,mode TEXT NOT NULL,map TEXT NOT NULL,public INTEGER NOT NULL,phase TEXT NOT NULL,peak INTEGER NOT NULL,data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS matches_started ON matches(started,mode);
    CREATE TABLE IF NOT EXISTS sanctions(id TEXT PRIMARY KEY,player TEXT NOT NULL,kind TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER,revoked INTEGER,reason TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS sanctions_player ON sanctions(player,kind);
    CREATE TABLE IF NOT EXISTS grants(id TEXT PRIMARY KEY,player TEXT NOT NULL,at INTEGER NOT NULL,amount INTEGER NOT NULL,reason TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,at INTEGER NOT NULL,updated INTEGER NOT NULL,status TEXT NOT NULL,player TEXT NOT NULL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pageviews(id TEXT PRIMARY KEY,visit TEXT NOT NULL,at INTEGER NOT NULL,mode TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS pageviews_at ON pageviews(at);
    CREATE TABLE IF NOT EXISTS visit_presence(id TEXT PRIMARY KEY,page TEXT NOT NULL,seq INTEGER NOT NULL DEFAULT 0,activeAt INTEGER NOT NULL DEFAULT 0);
    PRAGMA user_version=1;`);
   if(this.path!==':memory:')chmodSync(this.path,0o600);
   this.setMeta('createdAt',this.meta('createdAt',now()));this.setMeta('pageviewsStartedAt',this.meta('pageviewsStartedAt',now()));this.setMeta('visitorSalt',this.meta('visitorSalt',randomUUID()));
   this.importLegacy(legacyPath);recoverOwnerVisits(this,legacyPath);
   this.run("UPDATE visits SET ended=seen,reason='restart' WHERE ended IS NULL");
   this.run("UPDATE matches SET ended=seen,phase='interrupted' WHERE ended IS NULL");
   this.integrityAt=now();
  }catch(error){this.error=error;try{this.db?.close();}catch{}this.db=null;}
 }
 assert(){if(!this.db)throw Object.assign(Error(this.error?.message||'Owner history unavailable'),{status:503});}
 stmt(sql){this.assert();if(!this.statements.has(sql))this.statements.set(sql,this.db.prepare(sql));return this.statements.get(sql);}
 all(sql,...values){return this.stmt(sql).all(...values);}
 get(sql,...values){return this.stmt(sql).get(...values);}
 run(sql,...values){return this.stmt(sql).run(...values);}
 transaction(fn){this.assert();this.db.exec('BEGIN IMMEDIATE');try{const value=fn();this.db.exec('COMMIT');this.writeAt=this.now();return value;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 meta(key,fallback=null){const row=this.get('SELECT value FROM meta WHERE key=?',key);return row?parse(row.value):fallback;}
 setMeta(key,value){this.run('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value));}
 policy(){return {...ownerDefaults(),...this.meta('policy',{})};}
 event(kind,message='',target='',data={},id=randomUUID(),at=this.now()){
  this.run('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?)',id,at,kind,String(target).slice(0,160),String(message).slice(0,1000),JSON.stringify(data));return id;
 }
 importLegacy(path,{recover=false}={}){
  if(!path||!existsSync(path)||!recover&&this.meta('legacyImported'))return;
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{throw Error('Legacy owner history could not be read. It has not been replaced.');}
  if(!value||!Array.isArray(value.past)||!value.totals||!Number.isFinite(value.totals.visits))throw Error('Legacy owner history format is invalid. It has not been replaced.');
  this.transaction(()=>{
   const previousDetailed=this.get("SELECT count(*) n FROM visits WHERE id LIKE 'legacy:%'").n,previousBaseline=this.meta('legacyVisitBaseline',0),reported=Math.max(this.meta('legacyReportedTotal',previousDetailed+previousBaseline),value.totals.visits);
   const rows=[...value.past,...(value.active||[])];let imported=0;
   for(const s of rows){if(!s||!Number.isFinite(s.started))continue;const seen=Math.max(s.started,number(s.seen)||number(s.ended)||s.started),ended=Math.max(s.started,number(s.ended)||seen),id='legacy:'+createHash('sha256').update(String(s.id)+':'+s.started).digest('hex');
    imported+=this.run('INSERT OR IGNORE INTO visits VALUES(?,?,?,?,?,?,?,?,?,?)',id,String(s.id||id),id,s.started,seen,ended,ownerMode(s.mode),0,Math.max(0,ended-s.started),s.reason||'legacy').changes;
    this.run('INSERT OR IGNORE INTO segments VALUES(?,?,?,?,?,?)',id,id,ownerMode(s.mode),s.started,ended,Math.max(0,ended-s.started));
   }
   const detailed=this.get("SELECT count(*) n FROM visits WHERE id LIKE 'legacy:%'").n;this.setMeta('legacyReportedTotal',reported);this.setMeta('legacyVisitBaseline',Math.max(0,reported-detailed));if(!recover||!this.meta('legacyImported'))this.setMeta('legacyImported',{at:this.now(),sessions:detailed,totalVisits:value.totals.visits});if(imported||previousBaseline!==this.meta('legacyVisitBaseline',0))this.event('migration','Imported the surviving owner history without resetting totals','',{sessions:imported,totalVisits:value.totals.visits});
  });
 }
 visit(input){
  if(typeof input?.id!=='string'||!/^[-a-f0-9]{36}$/.test(input.id)||!['pulse','end'].includes(input.event))return false;
  const now=this.now(),mode=ownerMode(input.mode),visible=input.visible!==false;
  return this.transaction(()=>{
   this.sweep();let old=this.get('SELECT * FROM visits WHERE client=? ORDER BY seen DESC LIMIT 1',input.id);
   const page=/^[-a-f0-9]{36}$/.test(input.pageId||'')?input.pageId:null,seq=Number.isSafeInteger(input.seq)&&input.seq>=0?input.seq:0,presence=old?this.get('SELECT * FROM visit_presence WHERE id=?',old.id):null;
   if(page&&presence&&(presence.page===page&&seq<=presence.seq||input.event==='end'&&presence.page!==page))return true;
   if(page&&presence&&presence.page!==page&&this.get('SELECT 1 FROM pageviews WHERE id=?',page))return true;
   if(input.event==='end'){if(old&&!old.ended)this.run("UPDATE visits SET ended=seen,visible=0,reason='left' WHERE id=?",old.id);if(old&&page)this.run('INSERT INTO visit_presence VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET page=excluded.page,seq=excluded.seq',old.id,page,seq,now);return true;}
   // A returning heartbeat bridges a deployment or a reload without duplicating a visit.
   const inactive=old&&now-(presence?.activeAt||old.seen)>30*60000;
   if(!visible&&(!old||inactive)){if(old)this.run("UPDATE visits SET ended=?,visible=0,reason='inactive' WHERE id=?",presence?.activeAt||old.seen,old.id);return true;}
   if(!old||inactive){
    if(old)this.run("UPDATE visits SET ended=?,reason='inactive' WHERE id=?",presence?.activeAt||old.seen,old.id);
    if(this.get('SELECT count(*) n FROM visits WHERE ended IS NULL').n>=2000)return false;
    const visitor=createHash('sha256').update(this.meta('visitorSalt')+':'+String(/^[-a-f0-9]{36}$/.test(input.visitor||'')?input.visitor:input.id)).digest('hex');
    const id=randomUUID();this.run('INSERT INTO visits VALUES(?,?,?,?,?,NULL,?,?,0,?)',id,input.id,visitor,now,now,mode,Number(visible),'');
    this.run('INSERT INTO segments VALUES(?,?,?,?,?,0)',randomUUID(),id,mode,now,now);this.recordPage(id,page,seq,mode,now);return true;
   }
   const dt=old.visible&&now-old.seen<=45000?Math.max(0,now-old.seen):0;
   this.run("UPDATE visits SET seen=?,ended=NULL,mode=?,visible=?,activeMs=activeMs+?,reason='' WHERE id=?",now,mode,Number(visible),dt,old.id);
   const segment=this.get('SELECT * FROM segments WHERE visit=? ORDER BY started DESC LIMIT 1',old.id);
   if(segment)this.run('UPDATE segments SET ended=?,activeMs=activeMs+? WHERE id=?',now-old.seen>45000?old.seen:now,dt,segment.id);
   if(!segment||segment.mode!==mode||now-old.seen>45000)this.run('INSERT INTO segments VALUES(?,?,?,?,?,0)',randomUUID(),old.id,mode,now,now);
   this.recordPage(old.id,page,seq,mode,visible||old.visible?now:presence?.activeAt||old.seen);return true;
  });
 }
 recordPage(visit,page,seq,mode,activeAt){if(page)this.run('INSERT OR IGNORE INTO pageviews VALUES(?,?,?,?)',page,visit,this.now(),mode);this.run('INSERT INTO visit_presence VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET page=excluded.page,seq=excluded.seq,activeAt=excluded.activeAt',visit,page||'',seq,activeAt);}
 visitCoverage(){const row=this.get('SELECT count(*) n,min(started) first FROM visits'),legacy=this.get("SELECT count(*) n FROM visits WHERE id LIKE 'legacy:%'").n,baseline=this.meta('legacyVisitBaseline',0);return {total:row.n+baseline,detailedVisits:row.n,legacyDetailedVisits:legacy,olderVisitsWithoutDates:baseline,firstRecordedAt:row.first||this.meta('createdAt'),trackingStartedAt:this.meta('createdAt'),lifetimeComplete:false,recovery:this.meta('visitRecovery')};}
 sweep(){this.run("UPDATE visits SET ended=seen,reason='timeout' WHERE ended IS NULL AND seen<?",this.now()-90000);}
 receipt(account,r){if(!r?.id||!Number.isFinite(r.time))return;this.run('INSERT OR IGNORE INTO results VALUES(?,?,?,?,?,?,?,?,?)',r.id,Math.round(r.time*1000),String(account.socialId||''),ownerMode(r.mode),Number(!r.custom),Math.max(0,number(r.kills)),Number(!!r.won),Math.max(0,number(r.amount)),JSON.stringify({eligible:!!r.eligible,reason:r.reason||'',name:account.publicName||'',place:r.place||null}));}
 ticket(r){
  if(!r?.id)return;const old=this.get('SELECT data FROM tickets WHERE id=?',r.id),prior=old?parse(old.data):null;
  // The notification inbox is bounded; the owner archive keeps every response.
  const replies=new Map((prior?.replies||[]).map(reply=>[reply.id,reply]));for(const reply of r.replies||[])replies.set(reply.id,reply);
  const value={...r,replies:[...replies.values()].sort((a,b)=>a.created-b.created)},data=JSON.stringify(value);if(data===old?.data)return;
  this.run('INSERT INTO tickets VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,status=excluded.status,data=excluded.data',r.id,r.created,r.updated||r.created,r.clearedAt?'archived':r.status,r.player,data);
 }
 sample(data){const at=Math.floor(this.now()/60000)*60000;this.run('INSERT INTO samples VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(at) DO UPDATE SET online=max(online,excluded.online),players=max(players,excluded.players),rooms=max(rooms,excluded.rooms),cpu=excluded.cpu,memory=excluded.memory,fps=excluded.fps,rtt=excluded.rtt,data=excluded.data',at,data.online,data.players,data.rooms,data.cpu??null,data.memory??null,data.fps??null,data.rtt??null,JSON.stringify(data));}
 observeMatch(r){this.run('INSERT INTO matches VALUES(?,?,?,NULL,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen,ended=NULL,phase=excluded.phase,peak=max(peak,excluded.peak),data=excluded.data',r.id,r.started||this.now(),this.now(),r.mode,r.map||'',Number(r.public),r.phase,r.players,JSON.stringify(r));}
 finishMissingMatches(){this.run("UPDATE matches SET ended=seen,phase=CASE WHEN phase='results' THEN 'completed' ELSE 'closed' END WHERE ended IS NULL AND seen<?",this.now()-45000);}
 filter(input={},column='at'){
  const now=this.now(),to=Math.min(now+DAY,Math.max(0,number(input.to)||now+1)),from=Math.min(to,Math.max(0,input.range==='all'?0:number(input.from)||to-30*DAY));
  const clauses=[`${column}>=?`,`${column}<?`],values=[from,to];return {from,to,clauses,values};
 }
 history(type,input={}){
  const table={sessions:'visits',audit:'events',performance:'samples',results:'results',matches:'matches',tickets:'tickets',grants:'grants',moderation:'sanctions'}[type];if(!table)throw Error('Unknown history type');
  const column=table==='visits'||table==='matches'?'started':table==='sanctions'?'created':'at',f=this.filter(input,column);
  if(input.mode&&['visits','results','matches'].includes(table)){f.clauses.push(table==='visits'?'EXISTS (SELECT 1 FROM segments WHERE visit=visits.id AND mode=?)':'mode=?');f.values.push(ownerMode(input.mode));}
  if(input.player&&['results','grants','sanctions','tickets'].includes(table)){f.clauses.push('player=?');f.values.push(String(input.player));}
  if(input.target&&table==='events'){f.clauses.push('target=?');f.values.push(String(input.target));}
  if(input.kind&&table==='events'){f.clauses.push('kind=?');f.values.push(String(input.kind));}
  if(input.q){const columns={visits:['client','mode'],events:['kind','message','target'],matches:['mode','map','data'],results:['mode','data'],tickets:['data'],grants:['player','reason'],sanctions:['player','reason']}[table];if(columns){f.clauses.push('('+columns.map(c=>`${c} LIKE ? ESCAPE '\\'`).join(' OR ')+')');f.values.push(...columns.map(()=>'%'+String(input.q).slice(0,100).replace(/[\\%_]/g,'\\$&')+'%'));}}
  if(input.status&&table==='tickets'){f.clauses.push('status=?');f.values.push(String(input.status));}
  const where=f.clauses.join(' AND '),offset=Math.max(0,Math.min(1e9,Math.floor(number(input.offset)))),limit=Math.max(1,Math.min(200,Math.floor(number(input.limit)||50)));
  const rows=this.all(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${column} DESC LIMIT ? OFFSET ?`,...f.values,limit,offset).map(r=>({...r,...(r.data?{data:parse(r.data)}:{})}));
  return {rows,total:this.get(`SELECT count(*) n FROM ${table} WHERE ${where}`,...f.values).n,offset,limit,from:f.from,to:f.to};
 }
 analytics(input={}){
  const f=this.filter(input,'started'),{from,to}=f,mode=OWNER_MODES.includes(input.mode)?input.mode:null,modeSql=mode?' AND mode=?':'',args=mode?[from,to,mode]:[from,to];
  const visitMode=mode?' AND EXISTS (SELECT 1 FROM segments WHERE visit=visits.id AND mode=?)':'';
  const visits=this.get('SELECT count(*) visits,count(DISTINCT visitor) visitors,coalesce(avg(activeMs),0) averageMs FROM visits WHERE started>=? AND started<?'+visitMode,...args);
  const activeSql='sum(activeMs*1.0*max(0,min(ended,?)-max(started,?))/max(1,ended-started))';
  visits.activeMs=this.get('SELECT coalesce('+activeSql+',0) n FROM segments WHERE ended>=? AND started<?'+modeSql,to,from,...args).n;
  const newVisitors=this.get('SELECT count(DISTINCT visitor) n FROM visits WHERE started>=? AND started<?'+visitMode+' AND NOT EXISTS (SELECT 1 FROM visits earlier WHERE earlier.visitor=visits.visitor AND earlier.started<?)',...args,from).n;
  const daily=this.all("SELECT strftime('%Y-%m-%d',started/1000,'unixepoch') day,count(*) visits,count(DISTINCT visitor) visitors,round(sum(activeMs)/60000.0,1) minutes FROM visits WHERE started>=? AND started<?"+visitMode+" GROUP BY day ORDER BY day",...args);
  const modes=this.all('SELECT mode,count(DISTINCT visit) visits,round('+activeSql+'/60000.0,1) minutes FROM segments WHERE ended>=? AND started<? GROUP BY mode ORDER BY minutes DESC',to,from,from,to);
  const results=this.all('SELECT mode,count(*) outcomes,sum(kills) kills,sum(wins) wins,sum(marks) marks FROM results WHERE at>=? AND at<? AND public=1'+modeSql+' GROUP BY mode',...args);
  const population=this.all("SELECT strftime('%Y-%m-%d',at/1000,'unixepoch') day,max(online) peak,round(avg(online),1) average,round(avg(cpu),1) cpu,round(avg(memory),1) memory,round(avg(fps),1) fps,round(avg(rtt),1) rtt FROM samples WHERE at>=? AND at<? GROUP BY day ORDER BY day",from,to);
  return {from,to,...visits,newVisitors,returningVisitors:Math.max(0,visits.visitors-newVisitors),daily,modes,results,population,totalVisits:this.get('SELECT count(*) n FROM visits').n+this.meta('legacyVisitBaseline',0),coverage:this.visitCoverage(),pageViewsSince:this.meta('pageviewsStartedAt'),pageViews:this.get('SELECT count(*) n FROM pageviews WHERE at>=? AND at<?'+(mode?' AND mode=?':''),...args).n,legacy:this.meta('legacyImported'),startedAt:this.meta('createdAt'),peak:this.get('SELECT coalesce(max(online),0) n FROM samples WHERE at>=? AND at<?',from,to).n};
 }
 storage(){let bytes=0;for(const suffix of ['', '-wal'])try{bytes+=statSync(this.path+suffix).size;}catch{}return {available:!!this.db&&!this.error,persistent:persistentMount(this.path),mode:this.path===':memory:'?'memory':persistentMount(this.path)?'persistent-file':'configured-file',schema:1,bytes,integrityAt:this.integrityAt||null,lastWrite:this.writeAt||null,lastBackup:this.db?this.meta('lastBackup'):null,error:this.error?.message||null,retention:'No automatic history deletion',createdAt:this.db?this.meta('createdAt'):null};}
 async createBackup(){
  this.assert();if(this.path===':memory:')throw Error('Backups require configured storage');if(this.backupPromise)return this.backupPromise;
  this.backupPromise=(async()=>{const dir=this.path+'.backups';await mkdir(dir,{recursive:true});const name='owner-'+new Date(this.now()).toISOString().replace(/[:.]/g,'-')+'.sqlite',path=join(dir,name),temp=path+'.tmp';await backup(this.db,temp);const check=new DatabaseSync(temp,{readOnly:true});try{if(check.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Backup verification failed');}finally{check.close();}chmodSync(temp,0o600);await rename(temp,path);const info={name,at:this.now(),bytes:(await stat(path)).size};this.setMeta('lastBackup',info);this.event('backup','Created and verified a database backup','',info);const files=(await readdir(dir)).filter(n=>/^owner-[\dTZ-]+\.sqlite$/.test(n)).sort().reverse();for(const old of files.slice(14))await unlink(join(dir,old));return {path,...info};})().finally(()=>{this.backupPromise=null;});return this.backupPromise;
 }
 exportHistory(){this.assert();return {format:'ravelfront-owner-history',version:1,exportedAt:this.now(),legacyVisitBaseline:this.meta('legacyVisitBaseline',0),tables:Object.fromEntries(HISTORY_TABLES.map(t=>[t,this.all(`SELECT * FROM ${t}`)]))};}
 mergeHistory(value,apply=false){
  if(value?.format!=='ravelfront-owner-history'||value.version!==1||!value.tables||Object.keys(value.tables).some(k=>!HISTORY_TABLES.includes(k)))throw Error('Choose a Ravelfront owner history export');
  const plans=[],seen=new Set();let added=0,existing=0;
  for(const table of HISTORY_TABLES){const rows=value.tables[table]||[];if(!Array.isArray(rows)||rows.length>250000)throw Error('History import is too large; split it into smaller exports');const schema=this.all(`PRAGMA table_info(${table})`),columns=schema.map(c=>c.name),primary=table==='samples'?'at':'id';
   for(const row of rows){if(!row||columns.some(c=>!Object.hasOwn(row,c))||Object.keys(row).some(c=>!columns.includes(c))||columns.some(c=>row[c]!==null&&!['string','number'].includes(typeof row[c]))||typeof row[primary]!== (primary==='at'?'number':'string')||String(row[primary]).length>200||JSON.stringify(row).length>100000)throw Error('Invalid history row');if(schema.some(c=>c.notnull&&row[c.name]===null||row[c.name]!==null&&(c.type==='TEXT'?typeof row[c.name]!=='string':typeof row[c.name]!=='number'||!Number.isFinite(row[c.name])||c.type==='INTEGER'&&!Number.isSafeInteger(row[c.name]))))throw Error('Invalid history column');if(row.data)try{JSON.parse(row.data);}catch{throw Error('Invalid history payload');}
    const key=table+':'+row[primary];if(seen.has(key)||this.get(`SELECT ${primary} FROM ${table} WHERE ${primary}=?`,row[primary]))existing++;else{added++;plans.push({table,columns,row});}seen.add(key);}
  }
  if(apply)this.transaction(()=>{const legacyBefore=this.get("SELECT count(*) n FROM visits WHERE id LIKE 'legacy:%'").n,legacyFloor=Math.max(this.meta('legacyReportedTotal',legacyBefore+this.meta('legacyVisitBaseline',0)),Math.max(0,number(value.legacyVisitBaseline))+(value.tables.visits||[]).filter(r=>r.id.startsWith('legacy:')).length);for(const {table,columns,row}of plans)this.run(`INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,...columns.map(c=>(table==='visits'||table==='matches')&&c==='ended'&&row[c]===null?row.seen:row[c]));this.setMeta('legacyReportedTotal',legacyFloor);this.setMeta('legacyVisitBaseline',Math.max(0,legacyFloor-this.get("SELECT count(*) n FROM visits WHERE id LIKE 'legacy:%'").n));this.event('history-merge','Merged history without replacing current records','',{added,existing});});
  return {added,existing,applied:apply,controlsPreserved:true,grantsPreserved:true};
 }
 async close(){try{await this.backupPromise;}catch{}if(this.db){this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');this.db.close();this.db=null;}}
}
