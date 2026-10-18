import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {OwnerService} from '../server/realtime/owner.js';
import {OwnerStore} from '../server/realtime/owner-store.js';
import {EggWallet} from '../src/egg-wallet.js';
const origin='https://zl-2.github.io',code='89271406539284756012',DAY=86400000;
function relay(){return {peers:new Map(),progression:{accounts:new Map()},authority:{rooms:new Map(),capacity:{snapshot:()=>({})}},publicHost:{roomByAddress:()=>null},parties:{users:new Map(),parties:new Map(),tickets:new Map(),store:{identities:new Map(),featureRequests:[],storage:()=>({})},modeCounts:()=>({}),connected:()=>false,send:()=>{},lobbyChat:{rooms:new Map()}},serviceStatus:{reports:new Map(),history:[],snapshot:()=>({})}};}
async function request(service,{url='/owner/summary',method='POST',body={},token,from=origin}={}){
 let status,result,headers;const res={writeHead(s,h){status=s;headers=h;},end(s){result=s?JSON.parse(s):null;}};
 await service.handle({url,method,headers:{origin:from,...(token?{authorization:'Bearer '+token}:{})},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}},res,{origins:[origin],relay:service.relay||relay()});return {status,result,headers};
}
async function unlock(owner){const r=await request(owner,{url:'/owner/login',body:{code}});assert.equal(r.status,200);return r.result.token;}
const action=(owner,token,body)=>request(owner,{url:'/owner/action',token,body:{requestId:randomUUID(),reason:'Owner test fixture',...body}});
test('owner authentication protects data and actions, rejects cross-origin and expired sessions, and rate limits attempts',async()=>{
 let now=Date.now();const o=new OwnerService({code,dbPath:null,now:()=>now});try{
  assert.equal((await request(o)).status,401);assert.equal((await request(o,{url:'/owner/login',body:{code},from:'https://attacker.example'})).status,403);
  for(const path of ['history','players','export','backup','import','action','requests','maps'])assert.equal((await request(o,{url:'/owner/'+path})).status,401,path);
  const token=await unlock(o);const id=randomUUID();o.activity({id,event:'pulse',mode:'zonewars'});const s=await request(o,{token});assert.equal(s.result.online,1);assert.equal(s.result.visits,1);assert.equal(s.result.active[0].mode,'zonewars');
  assert.equal((await action(o,token,{action:'revoke-sessions',reason:''})).status,400);
  now+=31*60000;assert.equal((await request(o,{token})).status,401);
  const next=await unlock(o);assert.equal((await request(o,{url:'/owner/logout',token:next})).status,200);assert.equal((await request(o,{token:next})).status,401);
  for(let i=0;i<5;i++)assert.equal((await request(o,{url:'/owner/login',body:{code:'111111111111'}})).status,401);assert.equal((await request(o,{url:'/owner/login',body:{code}})).status,429);
 }finally{await o.close();}
});
test('unconfigured access fails closed',async()=>{const o=new OwnerService({code:'',dbPath:null});try{assert.equal((await request(o,{url:'/owner/login',body:{code}})).status,503);}finally{await o.close();}});
test('migration preserves totals, more than 1000 old sessions, and resumed visits across restarts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owner-history-'));let now=Date.now();const legacy=join(dir,'owner.json'),path=join(dir,'history.sqlite');const past=Array.from({length:1205},(_,i)=>({id:randomUUID(),started:now-120*DAY+i*60000,seen:now-120*DAY+i*60000+30000,ended:now-120*DAY+i*60000+30000,mode:'royale'}));await writeFile(legacy,JSON.stringify({totals:{visits:4000},past}));let o=new OwnerStore({path,legacyPath:legacy,now:()=>now});
 try{assert.equal(o.analytics({range:'all'}).totalVisits,4000);assert.equal(o.history('sessions',{range:'all',offset:1200}).rows.length,5);const id=randomUUID();o.visit({id,event:'pulse',mode:'boxfight'});now+=30000;o.visit({id,event:'pulse',mode:'zonewars'});now+=30000;o.visit({id,event:'pulse',mode:'zonewars'});assert.equal(o.analytics({range:'all',mode:'boxfight'}).visits,1);assert.equal(o.history('sessions',{range:'all',mode:'boxfight'}).total,1);await o.close();o=new OwnerStore({path,legacyPath:legacy,now:()=>now});assert.equal(o.analytics({range:'all'}).totalVisits,4001);assert.equal(o.get('SELECT count(*) n FROM visits WHERE ended IS NULL').n,0);now+=10000;o.visit({id,event:'pulse',mode:'zonewars'});assert.equal(o.analytics({range:'all'}).totalVisits,4001);assert.equal(o.history('sessions',{range:'all'}).total,1206);assert.equal(JSON.parse(await readFile(legacy,'utf8')).past.length,1205);}finally{await o.close();await rm(dir,{recursive:true,force:true});}
});
test('foreground time excludes idle gaps and counts every game mode without double visits',async()=>{
 let now=Date.now();const db=new OwnerStore({path:null,now:()=>now}),id=randomUUID(),visitor=randomUUID();try{for(const mode of ['royale','boxfight','zonewars','zombies','ffa','training']){db.visit({id,visitor,event:'pulse',mode});now+=30000;}db.visit({id,visitor,event:'pulse',mode:'training',visible:false});const active=db.analytics({range:'all'}).activeMs;assert.equal(active,180000);now+=600000;db.visit({id,visitor,event:'pulse',mode:'menu'});assert.equal(db.analytics({range:'all'}).activeMs,active);assert.equal(db.analytics({range:'all'}).visits,1);assert.equal(db.analytics({range:'all',mode:'boxfight'}).visits,1);assert.equal(db.analytics({range:'all',mode:'boxfight'}).activeMs,30000);}finally{await db.close();}
});
test('native backups are consistent; append-only import deduplicates and never overwrites policy or grants',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owner-backup-')),db=new OwnerStore({path:join(dir,'owner.sqlite')}),other=new OwnerStore({path:null});try{
 db.visit({id:randomUUID(),event:'pulse',mode:'zombies'});db.setMeta('policy',{revision:7,maintenance:true});db.run('INSERT INTO grants VALUES(?,?,?,?,?)','grant','player',Date.now(),100,'Fixture');const snapshot=await db.createBackup(),copy=new DatabaseSync(snapshot.path,{readOnly:true});assert.equal(copy.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.equal(copy.prepare('SELECT count(*) n FROM visits').get().n,1);copy.close();
 const original=db.exportHistory();other.visit({id:randomUUID(),event:'pulse',mode:'ffa'});const exported=other.exportHistory();assert.equal(db.mergeHistory(exported).added,2);assert.equal(db.history('sessions',{range:'all'}).total,1);db.mergeHistory(exported,true);assert.equal(db.history('sessions',{range:'all'}).total,2);assert.equal(db.mergeHistory(exported,true).added,0);assert.equal(db.meta('policy').revision,7);assert.equal(db.get('SELECT sum(amount) n FROM grants').n,100);assert.equal(db.get('SELECT ended FROM visits WHERE id=?',exported.tables.visits[0].id).ended,exported.tables.visits[0].seen);
 exported.tables.visits[0].started=null;assert.throws(()=>db.mergeHistory(exported,true),/Invalid history/);assert.equal(db.history('sessions',{range:'all'}).total,2);assert.ok(original.tables.events.every(e=>!e.message.includes(code)));
 }finally{await db.close();await other.close();await rm(dir,{recursive:true,force:true});}
});
test('damaged and unsupported databases fail closed without replacing files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owner-corrupt-')),path=join(dir,'owner.sqlite');try{await writeFile(path,'DO NOT ERASE');const bad=new OwnerStore({path});assert.equal(bad.storage().available,false);assert.throws(()=>bad.history('sessions'),/database|history/);assert.equal(await readFile(path,'utf8'),'DO NOT ERASE');await bad.close();const future=join(dir,'future.sqlite'),raw=new DatabaseSync(future);raw.exec('PRAGMA user_version=100');raw.close();const tooNew=new OwnerStore({path:future});assert.match(tooNew.storage().error,/newer server/);assert.equal(tooNew.storage().available,false);}finally{await rm(dir,{recursive:true,force:true});}
});
test('support archive keeps replies after notification pruning and inbox archiving',async()=>{const db=new OwnerStore({path:null}),r={id:randomUUID(),player:'player',name:'Operator',text:'Please improve maps',created:Date.now(),status:'open',replies:[]};try{for(let i=0;i<75;i++){r.replies.push({id:'reply'+i,body:'Response '+i,created:r.created+i,kind:'reply',read:true});if(r.replies.length>50)r.replies.shift();db.ticket(r);}r.clearedAt=Date.now();r.status='dismissed';db.ticket(r);const ticket=db.history('tickets',{range:'all'}).rows[0];assert.equal(ticket.data.replies.length,75);assert.equal(ticket.status,'archived');assert.equal(ticket.data.replies[0].body,'Response 0');}finally{await db.close();}});
test('grants are authenticated, reasoned and exactly once on server and wallet; controls detect stale saves',async()=>{
 const o=new OwnerService({code,dbPath:null});o.relay=relay();const id=randomUUID();o.relay.parties.store.identities.set(id,{id,profile:{name:'Operator'}});try{const token=await unlock(o),requestId=randomUUID(),body={action:'grant',player:id,amount:50000,requestId};assert.equal((await action(o,token,body)).status,200);assert.equal((await action(o,token,body)).status,200);assert.equal(o.grantSummary(id).marks,50000);assert.equal((await action(o,token,{...body,amount:999})).status,409);assert.equal((await action(o,token,{...body,requestId:randomUUID(),amount:-1})).status,400);
 const values=new Map(),wallet=new EggWallet({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}),initial=wallet.value.balance;assert.equal((await wallet.syncOwnerGrants(o.grantSummary(id))).amount,50000);assert.equal((await wallet.syncOwnerGrants(o.grantSummary(id))).amount,0);assert.equal(wallet.value.balance,initial+50000);const reloaded=new EggWallet(wallet.storage);await reloaded.syncOwnerGrants(o.grantSummary(id));assert.equal(reloaded.value.balance,initial+50000);
 const settings={...structuredClone(o.controls),maintenance:true};assert.equal((await action(o,token,{action:'settings',revision:0,controls:settings})).status,200);assert.throws(()=>o.assertAdmission(id,'royale'),/paused/);assert.equal((await action(o,token,{action:'settings',revision:0,controls:settings})).status,409);
 }finally{await o.close();}
});
test('code rotation revokes other sessions and persists across restarts without storing plaintext',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owner-access-')),path=join(dir,'history.sqlite');let o=new OwnerService({code,dbPath:path});o.relay=relay();try{const token=await unlock(o),other=await unlock(o),next='34567890123456789012';assert.equal((await action(o,token,{action:'rotate-code',currentCode:code,newCode:next,repeatCode:next})).status,200);assert.equal((await request(o,{token:other})).status,401);assert.equal((await request(o,{token})).status,200);assert.equal((await request(o,{url:'/owner/login',body:{code}})).status,401);assert.ok(!JSON.stringify(o.db.exportHistory()).includes(next));await o.close();o=new OwnerService({code,dbPath:path});const login=await request(o,{url:'/owner/login',body:{code:next}});assert.equal(login.status,200);assert.equal((await request(o,{url:'/owner/login',body:{code}})).status,401);}finally{await o.close();await rm(dir,{recursive:true,force:true});}
});
