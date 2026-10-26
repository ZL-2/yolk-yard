import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {monitorEventLoopDelay,PerformanceObserver} from 'node:perf_hooks';
import {Session} from 'node:inspector';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const root=resolve(process.argv[2]||'.'),count=Number(process.argv[3]||11),tag=process.argv[4]||'current',seconds=Math.max(12,Number(process.env.PERFORMANCE_SECONDS)||12),load=p=>import(pathToFileURL(resolve(root,p)));
const stats=values=>{const a=[...values].sort((a,b)=>a-b);return {count:a.length,p50:a[Math.floor(a.length*.5)]||0,p95:a[Math.floor(a.length*.95)]||0,p99:a[Math.floor(a.length*.99)]||0,max:a.at(-1)||0};};
if(process.argv[5]==='clients'){
 const {default:WebSocket}=await import('ws');globalThis.window={YOLK_NETWORK:{relay:process.argv[6]+'/game'}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 const clientStart=Number(process.env.PERFORMANCE_CLIENT_START)||0,clientEnd=Number(process.env.PERFORMANCE_CLIENT_END)||count+3;
 const {RelayPeer}=await load('src/relay-peer.js'),clients=[],errors=[];let timer,n=0,measuring=false;
 await Promise.all(Array.from({length:clientEnd-clientStart},(_,offset)=>new Promise(resolve=>{const i=clientStart+offset;const peer=new RelayPeer(),row={peer,i,gaps:[],frames:0,sequence:0};clients.push(row);peer.on('error',e=>errors.push(e));peer.on('authority-state',state=>{const now=performance.now();if(measuring){if(row.at)row.gaps.push(now-row.at);row.at=now;row.frames++;}row.state=state;});peer.on('open',()=>resolve());})));
 clients.sort((a,b)=>a.i-b.i);process.send({type:'ready',start:clientStart,ids:clients.map(c=>c.peer.id)});
 process.on('message',m=>{
  if(m.type==='start')timer=setInterval(()=>{n++;for(const row of clients){if(row.i>=count)continue;const p=row.state?.players.find(p=>p.id===row.peer.id);row.peer.control({type:'authority-command',command:{type:'input',input:{seq:++row.sequence,dt:1/60,yaw:p?Math.atan2(p.x-158,p.z-56):0,pitch:-.005,aim:true,fire:row.i%4?n%60<45:n%60===0,slot:1,strafe:Math.sin(n*.02+row.i)*.2,shotTime:(row.state?.time||0)-.08}}});}},1000/60);
  if(m.type==='measure'){measuring=true;for(const row of clients){row.at=null;row.frames=0;row.gaps=[];row.bytes=row.peer.receivedBytes;}setTimeout(()=>{const socket=clients.at(-1).peer.socket;socket._socket.pause();setTimeout(()=>socket._socket.resume(),300);},4000);}
  if(m.type==='finish'){clearInterval(timer);process.send({type:'result',errors,clients:clients.map(c=>({id:c.peer.id,spectator:c.i>=count,frames:c.frames,gaps:stats(c.gaps),bytes:c.peer.receivedBytes-c.bytes,reset:!!c.peer.authorityReset,time:c.state?.time,ack:c.state?.players.find(p=>p.id===c.peer.id)?.ack||0}))});for(const c of clients)c.peer.destroy();process.disconnect();}
 });
}else{
 const [{fixture,until,pause},{TOURNAMENT},{safeProfile,rng},{rebuildMap},{groundAt}]=await Promise.all(['tests/helpers/public-match.js','src/tournament.js','src/data.js','src/building.js','src/terrain.js'].map(load));
 const event={...TOURNAMENT,id:'isolated-realtime217',code:'PERF217R',capacity:48,spectators:16},f=await fixture({serverOptions:{tournamentOptions:{events:[event],now:()=>event.opensAt,autoStart:false}}});let children=[];
 try{
  const t=f.app.relay.tournament.event(event.id);t.cleared=true;t.createRoom();const room=t.room,sim=room.sim,a=f.app.relay.authority;clearInterval(a.timer);clearImmediate(a.catchup);sim.random=rng(217);sim.phase='lobby';sim.startRound();sim.matchId='realtime217';
  const base='ws://127.0.0.1:'+f.app.server.address().port,messages=[];
  const shards=Math.min(count+3,Math.max(1,Number(process.env.PERFORMANCE_CLIENT_SHARDS)||1)),size=Math.ceil((count+3)/shards);
  for(let start=0;start<count+3;start+=size){const child=fork(fileURLToPath(import.meta.url),[root,String(count),tag,'clients',base],{env:{...process.env,PERFORMANCE_CLIENT_START:String(start),PERFORMANCE_CLIENT_END:String(Math.min(count+3,start+size))},stdio:['ignore','inherit','inherit','ipc']});children.push(child);child.on('message',m=>messages.push(m));}
  await until(()=>messages.filter(m=>m.type==='ready').length===children.length,'Local clients registered',30000);const ids=messages.filter(m=>m.type==='ready').sort((a,b)=>a.start-b.start).flatMap(m=>m.ids);
  for(let i=0;i<ids.length;i++){const id=ids[i],peer=f.app.relay.peers.get(id),p=sim.admitPlayer(id,safeProfile({name:'Local '+i}),{partyId:id,memberId:id,partySize:1,teamSize:1,spectator:i>=count});Object.assign(peer,{authorityRoom:room.key,authorityId:id,controlReady:true});room.members.set(id,peer);p.loading=false;p.connected=true;}
  sim.prepareBattleWorld(Infinity);sim.beginBattle('isolated-realtime');sim.stage='active';sim.stormSteps=sim.stormSteps.map(s=>({...s,start:1e9,closeAt:1e9,end:2e9}));
  for(let i=0;i<count;i++){const p=sim.players.get(ids[i]),angle=i/count*Math.PI*2;Object.assign(p,{x:158+Math.sin(angle)*14,z:56+Math.cos(angle)*14,y:sim.map.helipad.y+1,health:1e6,shield:0,shieldUntil:0,flight:'ground',grounded:true,slot:1,contestant:true,equipUntil:0});p.inventory[1]={id:i%4===0?'stormspike':'sprinter',weapon:true,rarity:3,ammo:9999};p.bank={medium:99999,heavy:99999,light:99999};sim.syncInventory(p);}
  sim.builds=Array.from({length:180},(_,i)=>({id:'bench-'+i,type:i%3?'wall':'stairs',x:-130+(i%20)*4,y:groundAt(sim.map,-130+(i%20)*4,-100+Math.floor(i/20)*4),z:-100+Math.floor(i/20)*4,rotation:0,material:'wood',owner:ids[0],health:150,maxHealth:150,constructionRemaining:0,revision:0,mask:0,created:sim.time}));sim.buildVersion++;rebuildMap(sim);
  a.last=performance.now();a.accumulator=0;// Repeating scripted input intentionally fails the game's anti-AFK policy.
  // Keep only the long synthetic fixture active; production AFK rules are untouched.
  a.timer=setInterval(()=>{if(seconds>30)for(const p of sim.players.values())if(p.activity&&!p.spectating)p.activity.last=sim.time;a.tick();},16);for(const child of children)child.send({type:'start'});await pause(2000);for(const child of children)child.send({type:'measure'});const hist=monitorEventLoopDelay({resolution:5});hist.enable();const cpu=process.cpuUsage(),start=performance.now(),simStart=sim.time,wireStart=ids.reduce((n,id)=>n+(f.app.relay.peers.get(id)?.ws?._socket?.bytesWritten||0),0);room.timingKey=null;
  const slowTicks=[],slowSlices=[],gc=[];let session,observer,profileStart;
  const profile=process.env.PERFORMANCE_PROFILE==='1',diagnostics=profile||process.env.PERFORMANCE_DIAGNOSTICS==='1';
  if(diagnostics){
   observer=new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.duration>5)gc.push({at:e.startTime,duration:e.duration,kind:e.detail.kind});});observer.observe({entryTypes:['gc']});
   if(profile){session=new Session();session.connect();await new Promise((res,rej)=>session.post('Profiler.enable',e=>e?rej(e):res()));await new Promise((res,rej)=>session.post('Profiler.start',e=>e?rej(e):res()));profileStart=performance.now();}
   if(a.snapshotWork){const onSlice=a.snapshotWork.onSlice;a.snapshotWork.onSlice=(room,ms,cpu)=>{onSlice?.(room,ms,cpu);if(ms>15)slowSlices.push({at:performance.now()-ms,ms,cpu});};}
   let costs={};for(const name of ['botInput','fire','updateProjectiles','damageWorld','interact']){const original=sim[name];sim[name]=function(...args){const at=performance.now();try{return original.apply(this,args);}finally{costs[name]=(costs[name]||0)+performance.now()-at;}};}
   const tick=sim.tick;sim.tick=function(...args){costs={};const at=performance.now();try{return tick.apply(this,args);}finally{const ms=performance.now()-at;if(ms>15)slowTicks.push({at,ms,time:sim.time,builds:sim.builds.length,version:sim.buildVersion,costs});}};
  }

  await pause(seconds*1000);const elapsed=performance.now()-start,usage=process.cpuUsage(cpu),wireEnd=ids.reduce((n,id)=>n+(f.app.relay.peers.get(id)?.ws?._socket?.bytesWritten||0),0);hist.disable();for(const child of children)child.send({type:'finish'});await until(()=>messages.filter(m=>m.type==='result').length===children.length,'Client report',10000);
  let cpuProfile;if(session){cpuProfile=await new Promise((res,rej)=>session.post('Profiler.stop',(e,r)=>e?rej(e):res(r.profile)));session.disconnect();}observer?.disconnect();
  const reports=messages.filter(m=>m.type==='result'),clients={errors:reports.flatMap(m=>m.errors),clients:reports.flatMap(m=>m.clients)};const result={tag,root,clientProcesses:children.length,...(diagnostics?{profileStart,slowTicks,slowSlices,gc}:{}),fixtureRefreshActivity:seconds>30,phase:sim.phase,activeHumans:ids.slice(0,count).filter(id=>sim.players.get(id)?.health>0&&!sim.players.get(id)?.spectating).length,humans:count,spectators:3,elapsedMs:elapsed,simulatedSeconds:sim.time-simStart,memory:process.memoryUsage(),serverCpuMsPerSecond:(usage.user+usage.system)/elapsed,wireBytesPerSecond:(wireEnd-wireStart)*1000/elapsed,eventLoopMs:{p50:hist.percentile(50)/1e6,p95:hist.percentile(95)/1e6,p99:hist.percentile(99)/1e6,max:hist.max/1e6},timing:room.timing,shots:sim.shotId,...clients};delete result.type;
  await mkdir('test-results/performance217',{recursive:true});await writeFile('test-results/performance217/realtime-'+tag+'.json',JSON.stringify(result,null,2));if(cpuProfile)await writeFile('test-results/performance217/realtime-'+tag+'.cpuprofile',JSON.stringify(cpuProfile));console.log(JSON.stringify(result,null,2));
  assert.equal(result.phase,'playing');assert.equal(result.activeHumans,count);assert.deepEqual(clients.errors,[]);assert.ok(result.simulatedSeconds>seconds-.5);assert.ok(clients.clients.every(c=>c.frames>(c.spectator?seconds*7:seconds*15)&&!c.reset));assert.ok(clients.clients.filter(c=>!c.spectator).every(c=>c.ack>100));

 }finally{for(const child of children)child.kill();await f.close();}
}
