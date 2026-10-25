import assert from 'node:assert/strict';
import {Session} from 'node:inspector';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Isolated authority fixture: never creates a production identity or match.
const root=resolve(process.argv[2]||'.'),count=Number(process.argv[3]||11),ticks=Number(process.argv[4]||1200),tag=process.argv[5]||'current';
const out=resolve('test-results/performance217');await mkdir(out,{recursive:true});
const load=p=>import(pathToFileURL(resolve(root,p)));
const [{fixture},{TOURNAMENT},{safeProfile,rng},{rebuildMap},{groundAt}]=await Promise.all(['tests/helpers/public-match.js','src/tournament.js','src/data.js','src/building.js','src/terrain.js'].map(load));
const event={...TOURNAMENT,id:'isolated-performance217',code:'PERF217X',capacity:48,spectators:16};
const f=await fixture({serverOptions:{tournamentOptions:{events:[event],now:()=>event.opensAt,autoStart:false}}});
const methods={},traffic={bytes:0,frames:0,samples:[]},actors=[];let profile;
try{
 const t=f.app.relay.tournament.event(event.id);t.cleared=true;t.createRoom();
 const a=f.app.relay.authority,room=t.room,sim=room.sim;clearInterval(a.timer);clearImmediate(a.catchup);clearInterval(f.app.relay.timer);sim.random=rng(217);sim.phase='lobby';sim.startRound();sim.matchId='performance217';
 for(let i=0;i<count+3;i++){
  const id='load-'+i,p=sim.admitPlayer(id,safeProfile({name:'Load '+i}),{partyId:id,memberId:id,partySize:1,teamSize:1,spectator:i>=count});
  p.loading=false;p.connected=true;if(i<count)actors.push(p);
  const peer={id,authorityRoom:room.key,authorityId:id,ws:{readyState:1,bufferedAmount:0,send(raw){traffic.bytes+=Buffer.byteLength(raw);traffic.frames++;if(id==='load-0'&&traffic.samples.length<400)traffic.samples.push(raw);},close(){}},links:new Map(),pending:[],pendingBytes:0,history:[],historyBytes:0,seq:0,acked:0};
  room.members.set(id,peer);f.app.relay.peers.set(id,peer);
 }
 sim.prepareBattleWorld(Infinity);assert.ok(sim.beginBattle('isolated-performance'));
 sim.stormSteps=sim.stormSteps.map(v=>({...v,start:1e9,closeAt:1e9,end:2e9}));sim.stage='active';
 for(let i=0;i<count;i++){
  const p=actors[i],angle=i/count*Math.PI*2;
  Object.assign(p,{x:158+Math.sin(angle)*14,z:56+Math.cos(angle)*14,y:sim.map.helipad.y+1,health:1e6,shield:0,shieldUntil:0,flight:'ground',grounded:true,slot:1,contestant:true,equipUntil:0});
  p.inventory[1]={id:i%4===0?'stormspike':'sprinter',weapon:true,rarity:3,ammo:9999};p.bank={medium:99999,heavy:99999,light:99999};sim.syncInventory(p);
 }
 sim.builds=Array.from({length:180},(_,i)=>({id:'bench-'+i,type:i%3?'wall':'stairs',x:-130+(i%20)*4,y:groundAt(sim.map,-130+(i%20)*4,-100+Math.floor(i/20)*4),z:-100+Math.floor(i/20)*4,rotation:0,material:'wood',owner:actors[0].id,health:150,maxHealth:150,constructionRemaining:0,revision:0,mask:0,created:sim.time}));sim.buildVersion++;rebuildMap(sim);
 const wrap=(o,key)=>{const fn=o[key];if(typeof fn!=='function')return;o[key]=function(...args){const start=performance.now();try{return fn.apply(this,args);}finally{(methods[key]??=[]).push(performance.now()-start);}};};
 for(const name of ['tick','snapshot','fire','shotPath','updateProjectiles','damageWorld','interact','syncInventory'])wrap(sim,name);const broadcast=a.broadcast.bind(a);a.broadcast=room=>{const start=performance.now();broadcast(room);a.flushBroadcast?.(room);(methods.broadcast??=[]).push(performance.now()-start);};
 const ack=()=>{for(const peer of room.members.values()){peer.history.length=0;peer.historyBytes=0;peer.acked=peer.seq;peer.pending.length=0;peer.pendingBytes=0;}};
 const step=n=>{
  for(let i=0;i<count;i++){const p=actors[i];sim.setInput(p.id,{seq:n+1,dt:1/60,yaw:Math.atan2(p.x-158,p.z-56),pitch:-.005,aim:true,fire:i%4?n%60<45:n%60===0,slot:1,strafe:Math.sin(n*.02+i)*.2,shotTime:sim.time-.08},true);}
  sim.tick(1/60);room.age+=1/60;if(n%3===0){a.broadcast(room);ack();}
 };
 for(let n=0;n<120;n++)step(n);
 for(const values of Object.values(methods))values.length=0;traffic.bytes=traffic.frames=0;traffic.samples=[];
 const session=new Session();session.connect();const post=(m,p={})=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
 await post('Profiler.enable');await post('Profiler.start');globalThis.gc?.();
 const begin=performance.now(),cpu=process.cpuUsage(),windows=[];
 for(let n=0;n<ticks;n++){const start=performance.now();step(n+120);windows.push(performance.now()-start);}
 const usage=process.cpuUsage(cpu),wallMs=performance.now()-begin;({profile}=await post('Profiler.stop'));session.disconnect();
 const stats=values=>{const a=[...values].sort((a,b)=>a-b);return {count:a.length,totalMs:a.reduce((a,b)=>a+b,0),p50:a[Math.floor(a.length*.5)]||0,p95:a[Math.floor(a.length*.95)]||0,p99:a[Math.floor(a.length*.99)]||0,max:a.at(-1)||0};};
 const result={tag,root,humans:count,spectators:3,npcs:[...sim.players.values()].filter(p=>p.bot).length,ticks,simulatedSeconds:ticks/60,wallMs,cpuMs:(usage.user+usage.system)/1000,cpuMsPerSecond:(usage.user+usage.system)/1000/(ticks/60),bytesPerSecond:traffic.bytes/(ticks/60),frames:traffic.frames,step:stats(windows),methods:Object.fromEntries(Object.entries(methods).map(([key,values])=>[key,stats(values)])),shots:sim.shotId,events:sim.eventId,outcome:actors.map(p=>({id:p.id,health:p.health,x:p.x,y:p.y,z:p.z})),rssMB:process.memoryUsage().rss/1048576};
 await writeFile(`${out}/${tag}-${count}-packets.json`,JSON.stringify(traffic.samples.map(JSON.parse),null,2));
 await writeFile(`${out}/${tag}-${count}.json`,JSON.stringify(result,null,2));await writeFile(`${out}/${tag}-${count}.cpuprofile`,JSON.stringify(profile));
 console.log(JSON.stringify({...result,outcome:undefined},null,2));
 for(const peer of room.members.values())f.app.relay.peers.delete(peer.id);room.members.clear();
}finally{await f.close();}
