import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {SocialStore} from '../server/realtime/social-store.js';
import {persistentMount,DATA_MOUNT} from '../server/realtime/data-path.js';
import {startRealtimeServer} from '../server/realtime/index.js';
import {VERSION,safeProfile} from '../src/data.js';
import WebSocket from 'ws';
import {migrateSocialFile} from '../server/realtime/social-migrate.js';
import {PartyClient} from '../src/party-client.js';

test('old-format identities, accepted friendships, pending requests and blocks survive a schema upgrade and process restart',async()=>{
 const dir=await mkdtemp('/tmp/ravel-social-durable-'),path=dir+'/social.json';let store=new SocialStore(path);
 try{const a=store.identify(null,safeProfile({name:'Captain'})),b=store.identify(null,safeProfile({name:'Bravo'})),c=store.identify(null,safeProfile({name:'Charlie'})),d=store.identify(null,safeProfile({name:'Delta'}));
  store.friendAction(a.identity.id,'friend-send',b.identity.id);store.friendAction(b.identity.id,'friend-accept',a.identity.id);store.friendAction(a.identity.id,'friend-send',c.identity.id);store.friendAction(a.identity.id,'block',d.identity.id);await store.flush();
  const legacy=JSON.parse(await readFile(path));delete legacy.schema;await writeFile(path,JSON.stringify(legacy));store=new SocialStore(path);
  for(const original of [a,b,c,d]){const restored=store.identify(original.token,original.identity.profile);assert.equal(restored.identity.id,original.identity.id);assert.equal(restored.identity.code,original.identity.code);assert.equal(restored.token,original.token);}
  assert.equal(store.status(a.identity.id,b.identity.id),'friends');assert.equal(store.status(a.identity.id,c.identity.id),'outgoing');assert.equal(store.status(c.identity.id,a.identity.id),'incoming');assert.equal(store.status(a.identity.id,d.identity.id),'blocked');await store.flush();assert.equal(JSON.parse(await readFile(path)).schema,1);assert.deepEqual(JSON.parse(await readFile(path+'.bak')),JSON.parse(await readFile(path)));
 }finally{clearTimeout(store.timer);await rm(dir,{recursive:true,force:true});}
});
test('corruption recovers a validated backup, while unknown identities and newer schemas never create replacement records',async()=>{
 const dir=await mkdtemp('/tmp/ravel-social-recovery-'),path=dir+'/social.json';let store=new SocialStore(path);
 try{const a=store.identify(null,safeProfile({name:'Captain'}));await store.flush();await writeFile(path,'broken json');store=new SocialStore(path);assert.equal(store.recoveredBackup,true);assert.equal(store.identify(a.token,a.identity.profile).identity.code,a.identity.code);await store.flush();
  assert.throws(()=>store.identify(randomBytes(32).toString('hex'),a.identity.profile),e=>e.code==='identity-missing');assert.equal(store.identities.size,1);
  const future={...JSON.parse(await readFile(path)),schema:99};await writeFile(path,JSON.stringify(future));store=new SocialStore(path);assert.equal(store.storage().available,false);assert.throws(()=>store.identify(a.token,a.identity.profile));await assert.rejects(store.flush());assert.deepEqual(JSON.parse(await readFile(path)),future);
 }finally{clearTimeout(store.timer);await rm(dir,{recursive:true,force:true});}
});
function client(url,token,name){
 const ws=new WebSocket(url,{origin:'https://zl-2.github.io'}),messages=[],waiting=[],profile=safeProfile({name});let serial=0;
 const next=predicate=>new Promise((resolve,reject)=>{const found=messages.findIndex(predicate);if(found>=0){resolve(messages.splice(found,1)[0]);return;}const item={predicate,resolve,reject};item.timer=setTimeout(()=>{waiting.splice(waiting.indexOf(item),1);reject(Error('Social socket timed out'));},5000);waiting.push(item);});
 ws.on('message',raw=>{const m=JSON.parse(raw),index=waiting.findIndex(w=>w.predicate(m));if(index>=0){const w=waiting.splice(index,1)[0];clearTimeout(w.timer);w.resolve(m);}else messages.push(m);});ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,token,profile})));ws.on('error',()=>{});
 return {ws,next,async ask(type,data={}){const request=++serial;ws.send(JSON.stringify({type,request,...data}));const m=await next(m=>m.type==='reply'&&m.request===request);if(m.error)throw Error(m.error);return m.result;}};
}
test('independent social sockets keep their exact codes and friendships after full relay replacement; lost credentials are refused',async()=>{
 const dir=await mkdtemp('/tmp/ravel-social-restart-'),old=process.env.RAVEL_SOCIAL_DATA_PATH;process.env.RAVEL_SOCIAL_DATA_PATH=dir+'/social.json';let app;const clients=[];
 try{app=await startRealtimeServer({host:'127.0.0.1',port:0});let url=`ws://127.0.0.1:${app.server.address().port}/social`;const a=client(url,null,'Captain'),b=client(url,null,'Bravo');clients.push(a,b);const ah=await a.next(m=>m.type==='hello'),bh=await b.next(m=>m.type==='hello');await a.ask('friend-send',{id:bh.id});await b.ask('friend-accept',{id:ah.id});
  // The success response already includes a completed durable write.
  const saved=JSON.parse(await readFile(dir+'/social.json'));assert.ok(saved.friends.find(([id,list])=>id===ah.id&&list.includes(bh.id)));
  await app.close();app=await startRealtimeServer({host:'127.0.0.1',port:0});url=`ws://127.0.0.1:${app.server.address().port}/social`;
  const ra=client(url,ah.token,'Captain'),rb=client(url,bh.token,'Bravo'),lost=client(url,randomBytes(32).toString('hex'),'Lost');clients.push(ra,rb,lost);
  for(const [c,original]of [[ra,ah],[rb,bh]]){const restored=await c.next(m=>m.type==='hello');assert.equal(restored.id,original.id);assert.equal(restored.code,original.code);assert.equal(restored.token,original.token);const social=await c.ask('social');assert.equal(social.friends.length,1);assert.equal(social.friends[0].relationship,'friends');}
  assert.equal((await lost.next(m=>m.type==='identity-unavailable')).code,'identity-missing');assert.equal(app.relay.parties.store.identities.size,2);
  await writeFile(dir+'/blocker','not a directory');const originalPath=app.relay.parties.store.path;app.relay.parties.store.path=dir+'/blocker/social.json';
  await assert.rejects(ra.ask('friend-remove',{id:bh.id}),/could not be saved/);assert.equal(app.relay.parties.store.storage().available,false);assert.deepEqual(JSON.parse(await readFile(originalPath)).friends,saved.friends);app.relay.parties.store.path=originalPath;
 }finally{for(const c of clients)c.ws.terminate();await app?.close();if(old===undefined)delete process.env.RAVEL_SOCIAL_DATA_PATH;else process.env.RAVEL_SOCIAL_DATA_PATH=old;await rm(dir,{recursive:true,force:true});}
});
test('social migration preserves exact identities and relationships and refuses to replace a populated destination',async()=>{
 const dir=await mkdtemp('/tmp/ravel-social-migrate-'),source=dir+'/old.json',destination=dir+'/permanent/social.json',store=new SocialStore(source);
 try{const a=store.identify(null,safeProfile({name:'Captain'})),b=store.identify(null,safeProfile({name:'Bravo'}));store.friendAction(a.identity.id,'friend-send',b.identity.id);store.friendAction(b.identity.id,'friend-accept',a.identity.id);await store.flush();
  await assert.rejects(migrateSocialFile(source,destination),/not on a persistent/);
  assert.deepEqual(await migrateSocialFile(source,destination,{requireMount:false}),{identities:2,friendships:1,requests:0});const restored=new SocialStore(destination);assert.equal(restored.identify(a.token,a.identity.profile).identity.code,a.identity.code);assert.equal(restored.status(a.identity.id,b.identity.id),'friends');await restored.flush();const before=await readFile(destination,'utf8');await assert.rejects(migrateSocialFile(source,destination,{requireMount:false}),/refusing to overwrite/);assert.equal(await readFile(destination,'utf8'),before);
 }finally{clearTimeout(store.timer);await rm(dir,{recursive:true,force:true});}
});
test('the browser preserves its private credential when a server attempts an identity reset, and creates a new identity only after an explicit choice',()=>{
 const globals=['window','WebSocket','localStorage','sessionStorage'],previous=new Map(globals.map(k=>[k,globalThis[k]]));let party;
 try{const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window={YOLK_NETWORK:{relay:'ws://localhost/game'}};
  class FakeSocket{send(m){this.sent=JSON.parse(m);}close(){this.onclose?.();}message(m){this.onmessage({data:JSON.stringify(m)});}}
  globalThis.WebSocket=FakeSocket;const old='a'.repeat(64),fresh='b'.repeat(64);localStorage.setItem('ravelfront-social-identity',old);party=new PartyClient(safeProfile({name:'Captain'}));party.ws.onopen();assert.equal(party.ws.sent.token,old);
  party.ws.message({type:'hello',token:fresh,identityReset:true,id:'replacement',code:'ABCDE-FGHJK'});assert.equal(party.ready,false);assert.ok(party.identityBlocked);assert.equal(localStorage.getItem('ravelfront-social-identity'),old);assert.equal(party.retry,undefined);
  party.retryIdentity();party.ws.onopen();assert.equal(party.ws.sent.token,old);party.ws.message({type:'identity-unavailable',message:'Restore your saved identity'});assert.equal(localStorage.getItem('ravelfront-social-identity'),old);
  party.newIdentity();assert.equal(localStorage.getItem('ravelfront-social-identity-previous'),old);party.ws.onopen();assert.equal(party.ws.sent.token,null);party.ws.message({type:'hello',token:fresh,id:'fresh',code:'ABCDE-FGHJK'});assert.equal(party.ready,true);assert.equal(localStorage.getItem('ravelfront-social-identity'),fresh);
 }finally{party?.close();for(const k of globals){if(previous.get(k)===undefined)delete globalThis[k];else globalThis[k]=previous.get(k);}}
});
test('mounted storage detection never mistakes the container root or an ordinary directory for a persistent disk',()=>{
 const mounts='20 1 0:1 / / rw - overlay overlay rw\n21 20 8:1 / /var/data/ravelfront rw - ext4 /dev/disk rw\n22 20 0:2 / /proc rw - proc proc rw\n23 20 0:3 / /tmp rw - tmpfs tmpfs rw';
 assert.equal(persistentMount(DATA_MOUNT+'/social.json',mounts),true);assert.equal(persistentMount('/tmp/social.json',mounts),false);assert.equal(persistentMount('/var/data/ravelfront-other/social.json',mounts),false);assert.equal(persistentMount('/proc/secret',mounts),false);
});
