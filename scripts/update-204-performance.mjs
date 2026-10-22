import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {Session} from 'node:inspector';
const output=resolve('test-results/update-204');await mkdir(output,{recursive:true});
if(process.argv[2]!=='--measure'){
 const baseline=process.env.COMBAT_BASELINE;assert.ok(baseline,'Set COMBAT_BASELINE to the Update 203 checkout');
 const comparisons=[];
 for(const count of [12,48]){
  const reports=[];
  for(const [tag,root]of [['before',resolve(baseline)],['after',process.cwd()]]){
   const file=resolve(output,`combat-${count}-${tag}.json`);
   execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--measure',root,String(count),'180',file],{stdio:'inherit',timeout:120000});
   reports.push(JSON.parse(await readFile(file,'utf8')));
  }
  const [before,after]=reports;assert.deepEqual(after.outcome,before.outcome,'Authoritative damage, positions and destruction must be identical');assert.equal(after.rayDigest,before.rayDigest,'Broad-phase rejection must preserve anatomical contacts');
  const result={players:count,tickP95Before:before.methods.tick.p95,tickP95After:after.methods.tick.p95,fireP95Before:before.methods.fire.p95,fireP95After:after.methods.fire.p95,broadcastP95Before:before.methods.broadcast.p95,broadcastP95After:after.methods.broadcast.p95,applicationBytesBefore:before.wireBytes,applicationBytesAfter:after.wireBytes,elapsedBefore:before.elapsed,elapsedAfter:after.elapsed,identicalOutcome:true,identicalRayContacts:true};
  assert.ok(after.wireBytes<before.wireBytes*.8,'Reduce repeated recipient payloads');
  if(count===48){assert.ok(after.methods.tick.p95<before.methods.tick.p95*.5,'Combat tick must substantially improve');assert.ok(after.methods.fire.p95<before.methods.fire.p95*.5,'Human hitscan must substantially improve');}
  comparisons.push(result);console.log(JSON.stringify(result));
 }
 await writeFile(resolve(output,'performance.json'),JSON.stringify({baseline:'0085b257a5f75251772762b4a17019367427a82c',workload:'180 ticks at 60Hz, all-human Royale with sanitized remote inputs, active SMG/Stormspike combat, builds, recipient deltas and checkpoints. CPU/application bytes, not rendered FPS or Internet latency.',comparisons},null,2));
 console.log('PASS: deterministic multiplayer combat comparison');process.exit(0);
}
const root=process.argv[3],count=Number(process.argv[4]),ticks=Number(process.argv[5]),reportPath=process.argv[6];
const load=f=>import(pathToFileURL(resolve(root,'src',f)));
const [{RoyaleSimulation},{Network},{SnapshotEncoder,SnapshotDecoder,SnapshotBatch},{RelaySnapshotWork},{actionFrameDue},{groundAt},{rebuildMap}]=await Promise.all(['royale.js','network.js','snapshot-codec.js','relay-snapshot-work.js','action-network.js','terrain.js','building.js'].map(load));
const {humanHit}=await load('physics.js');let randomSeed=204;const random=()=>((randomSeed=Math.imul(randomSeed,1664525)+1013904223>>>0)/4294967296),contacts=[];
for(let i=0;i<10000;i++){
 const p={x:random()*100,y:random()*20,z:random()*100,yaw:random()*6.28,health:100,grounded:true,lean:random()*2-1,flight:['ground','ground','dive','glide'][i%4],vx:random()*10,vz:random()*10,...[{}, {crouching:true},{lowCrouch:true},{sliding:true},{downed:true}][i%5]},o={x:p.x+(random()-.5)*80,y:p.y+random()*4,z:p.z+(random()-.5)*80},d={x:p.x+(random()-.5)*(i%2?1:8)-o.x,y:p.y+random()*2-o.y,z:p.z+(random()-.5)*(i%2?1:8)-o.z},length=Math.hypot(d.x,d.y,d.z);for(const key of ['x','y','z'])d[key]/=length;
 const hit=humanHit(o,d,p,i%3===0?.25:0);contacts.push([hit.region,Number.isFinite(hit.distance)?Math.round(hit.distance*1e8)/1e8:null]);
}
const rayDigest=createHash('sha256').update(JSON.stringify(contacts)).digest('hex');
const s=new RoyaleSimulation({mode:'royale',capacity:48,bots:0,fill:false,seed:204});for(let i=0;i<count;i++)s.addPlayer('p'+i,{name:'Operator '+i});s.startRound();s.beginBattle();
for(const [id,p]of s.players)if(p.bot)s.players.delete(id);
s.stage='active';s.operations=null;s.stormSteps=s.stormSteps.map(v=>({...v,start:1e9,closeAt:1e9,end:2e9}));
const actors=[...s.players.values()];for(let i=0;i<count;i++){const p=actors[i],a=i/count*Math.PI*2;Object.assign(p,{x:158+Math.sin(a)*14,z:56+Math.cos(a)*14,y:s.map.helipad.y+1,health:1e6,shield:0,shieldUntil:0,flight:'ground',grounded:true,slot:1,contestant:true,connected:true,loading:false,equipUntil:0});p.inventory[1]={id:i%4===0?'stormspike':'sprinter',weapon:true,rarity:3,ammo:999};p.bank={medium:9999,heavy:9999,light:9999};s.syncInventory(p);}
s.builds=Array.from({length:180},(_,i)=>({id:'bench-build-'+i,type:i%3?'wall':'stairs',x:-130+(i%20)*4,y:groundAt(s.map,-130+(i%20)*4,-100+Math.floor(i/20)*4),z:-100+Math.floor(i/20)*4,rotation:0,material:'wood',owner:'p0',health:150,maxHealth:150,constructionRemaining:0,revision:0,mask:0,created:s.time}));s.buildVersion++;rebuildMap(s);
const metrics={},wrap=(o,key)=>{const original=o[key];o[key]=function(...a){const t=performance.now();try{return original.apply(this,a);}finally{(metrics[key]??=[]).push(performance.now()-t);}};};for(const key of ['tick','snapshot','checkpoint','fire','shotPath','damageWorld','updateProjectiles'])if(typeof s[key]==='function')wrap(s,key);
let batch,work,wireBytes=0,checkpointCount=0,guestMs=0;const traffic={};const n=new Network({getCheckpoint:()=>{checkpointCount++;return s.checkpoint();}});n.id='p0';n.members=actors.map(p=>({id:p.id}));n.publishRoom=()=>{};
for(let i=1;i<count;i++){const enc=new SnapshotEncoder(),dec=i===1?new SnapshotDecoder():null;n.connections.set('p'+i,{peer:'p'+i,open:true,dataChannel:{bufferedAmount:0},send(msg){work.measure({type:'data',channel:'p'+i,data:msg});const frame=enc.encode(msg,batch),raw=batch.serialize(frame.frame,'snapshot-v1');wireBytes+=raw.length;if(i===1){const body=frame.frame.full||frame.frame.patch;for(const [name,value]of Object.entries(body)){if(name==='state'||name==='checkpoint'){for(const [key,v]of Object.entries(value))traffic[name+'.'+key]=(traffic[name+'.'+key]||0)+JSON.stringify(v).length;}else traffic[name]=(traffic[name]||0)+JSON.stringify(value).length;}}if(dec){const t=performance.now();dec.decode(JSON.parse(raw).frame);guestMs+=performance.now()-t;}return true;}});}
const session=new Session();session.connect();const post=(m,p={})=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));await post('Profiler.enable');await post('Profiler.start');let state=null,broadcasts=0;
const begin=performance.now();for(let k=0;k<ticks;k++){for(let i=0;i<count;i++){const p=actors[i],yaw=Math.atan2(p.x-158,p.z-56);s.setInput(p.id,{seq:k+1,dt:1/60,yaw,pitch:-.005,aim:true,fire:i%4?k%60<45:k%60===0,slot:1,strafe:Math.sin(k*.02+i)*.2,shotTime:s.time-.08},i>0);}s.tick(1/60);if(k%2===0||actionFrameDue(s,state)){state=s.snapshot();batch=new SnapshotBatch();work=new RelaySnapshotWork();const t=performance.now();n.lastCheckpointSent=k%180?performance.now():-1e9;n.broadcast(state);(metrics.broadcast??=[]).push(performance.now()-t);broadcasts++;}}
const elapsed=performance.now()-begin,{profile}=await post('Profiler.stop');session.disconnect();
const stats=a=>{a.sort((a,b)=>a-b);return {count:a.length,totalMs:a.reduce((a,b)=>a+b,0),p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
const outcome={health:actors.map(p=>p.health),positions:actors.map(p=>[p.x,p.y,p.z]),shots:s.shotId,events:s.eventId,damage:s.worldDamage,builds:s.builds.map(b=>b.id)};const report={outcome,rayDigest,traffic,count,ticks,elapsed,broadcasts,checkpointCount,wireBytes,guestMs,events:s.eventId,methods:Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,stats(v)]))};await writeFile(reportPath.replace('.json','.cpuprofile'),JSON.stringify(profile));await writeFile(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({root,count,ticks,elapsed,events:s.eventId,wireBytes}));
