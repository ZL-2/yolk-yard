import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {dirname,join,resolve,basename} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
// Recover only known owner-history files. Never restore a whole disk or replace live state.
export function recoverOwnerVisits(store,legacyPath){
 if(store.path===':memory:')return;
 const roots=new Set([dirname(resolve(store.path)),...(legacyPath?[dirname(resolve(legacyPath))]:[])]),files=new Set();
 for(const root of roots){for(const name of ['owner.json','owner.json.bak','owner.json.backup','ravelfront-owner.json','ravelfront-owner.json.bak','owner-history.json','owner-history.json.bak'])files.add(join(root,name));try{for(const name of readdirSync(root))if(/^(?:ravelfront[-_])?owner[-_.\w]*\.(?:json(?:\.(?:bak|backup))?|sqlite)$/.test(name))files.add(join(root,name));}catch{}}
 if(legacyPath)for(const suffix of ['', '.bak','.backup'])files.add(legacyPath+suffix);
 const directory=store.path+'.backups';try{for(const name of readdirSync(directory).filter(n=>/^owner-[\dTZ-]+\.sqlite$/.test(n)).sort().reverse().slice(0,14))files.add(join(directory,name));}catch{}
 const report={at:store.now(),checked:0,recoveredSessions:0,sources:[],unreadable:[]};
 for(const file of files){if(resolve(file)===resolve(store.path)||!existsSync(file))continue;let source;
  try{const info=statSync(file);if(!info.isFile()||info.size>64*1048576)continue;report.checked++;
   const before=store.get('SELECT count(*) n FROM visits').n,priorTotal=store.visitCoverage().total;
   if(/\.sqlite$/.test(file)){
    source=new DatabaseSync(file,{readOnly:true});if(source.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Integrity check failed');
    const names=new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));if(!names.has('visits')||!names.has('meta'))continue;
    const baselineRow=source.prepare("SELECT value FROM meta WHERE key='legacyVisitBaseline'").get(),baseline=baselineRow?JSON.parse(baselineRow.value):0,total=source.prepare('SELECT count(*) n FROM visits').get().n+baseline;
    const tables={};for(const name of ['visits','segments','pageviews','visit_presence'])if(names.has(name))tables[name]=source.prepare('SELECT * FROM '+name).all();
    store.mergeHistory({format:'ravelfront-owner-history',version:1,legacyVisitBaseline:baseline,tables},true);if(before===0){const salt=source.prepare("SELECT value FROM meta WHERE key='visitorSalt'").get();if(salt&&typeof JSON.parse(salt.value)==='string')store.setMeta('visitorSalt',JSON.parse(salt.value));}
   }else{
    const data=JSON.parse(readFileSync(file,'utf8'));
    if(data?.format==='ravelfront-owner-history')store.mergeHistory({...data,tables:Object.fromEntries(Object.entries(data.tables||{}).filter(([name])=>['visits','segments','pageviews','visit_presence'].includes(name)))},true);
    else if(Array.isArray(data?.past)&&Number.isSafeInteger(data.totals?.visits)&&data.totals.visits>=0)store.importLegacy(file,{recover:true});else continue;
   }
   const added=store.get('SELECT count(*) n FROM visits').n-before,recovered=store.visitCoverage().total-priorTotal;
   report.recoveredSessions+=added;report.sources.push({name:basename(file),added,recoveredTotal:Math.max(0,recovered)});
  }catch{report.unreadable.push(basename(file));}finally{try{source?.close();}catch{}}
 }
 store.setMeta('visitRecovery',report);if(report.recoveredSessions||report.sources.some(r=>r.recoveredTotal))store.event('visit-recovery','Recovered surviving visit history without resetting current records','',report);
}
