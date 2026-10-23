import {fixture} from '../tests/helpers/public-match.js';
import {TOURNAMENT as E} from '../src/tournament.js';
import {safeProfile} from '../src/data.js';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results/tournament',{recursive:true});
const f=await fixture({serverOptions:{tournamentOptions:{now:()=>E.opensAt,autoStart:false}}});
try{const t=f.app.relay.tournament;t.cleared=true;t.createRoom();const a=f.app.relay.authority,room=t.room,sim=room.sim;clearInterval(a.timer);clearImmediate(a.catchup);clearInterval(f.app.relay.timer);let bytes=0,frames=0,simMs=0,broadcastMs=0;
 for(let i=0;i<64;i++){const id='load-'+i,p=sim.admitPlayer(id,safeProfile({name:'Load '+i}),{partyId:id,memberId:id,partySize:1,teamSize:1,spectator:i>=48});p.loading=false;p.connected=true;const peer={id,authorityRoom:room.key,authorityId:id,ws:{readyState:1,bufferedAmount:0,send(raw){bytes+=raw.length;frames++;},close(){}},links:new Map(),pending:[],pendingBytes:0,history:[],historyBytes:0,seq:0,acked:0};room.members.set(id,peer);f.app.relay.peers.set(id,peer);}
 sim.prepareBattleWorld(Infinity);sim.beginBattle('load-test');for(const p of sim.players.values())if(!p.bot&&p.contestant){p.flight='ground';p.x=-100+(Number(p.id.split('-')[1])%8)*25;p.z=-100+Math.floor(Number(p.id.split('-')[1])/8)*25;p.y=12;}
 a.broadcast(room);for(const p of room.members.values()){p.history=[];p.historyBytes=0;}bytes=0;frames=0;globalThis.gc?.();const start=performance.now(),cpu=process.cpuUsage(),steps=[];for(let n=0;n<600;n++){const s=performance.now();for(const p of sim.players.values())if(!p.bot&&p.contestant){p.health=100;p.shield=100;sim.setInput(p.id,{seq:n+1,dt:1/60,yaw:n/80,pitch:0,forward:1,right:0,jump:n%120===0},true);}const t0=performance.now();sim.tick(1/60);simMs+=performance.now()-t0;room.age+=1/60;if(n%4===0){const t1=performance.now();a.broadcast(room);broadcastMs+=performance.now()-t1;for(const p of room.members.values()){p.history=[];p.historyBytes=0;p.pending=[];p.pendingBytes=0;}}steps.push(performance.now()-s);}
 const usage=process.cpuUsage(cpu),result={simMs,broadcastMs,humans:48,lateSpectators:16,simulatedSeconds:10,wallMs:performance.now()-start,cpuMs:(usage.user+usage.system)/1000,cpuMsPerSimulatedSecond:(usage.user+usage.system)/10000,stepP95:steps.sort((a,b)=>a-b)[Math.floor(steps.length*.95)],stepMax:Math.max(...steps),bytesPerSimulatedSecond:bytes/10,frames,rssMB:process.memoryUsage().rss/1048576};console.log(JSON.stringify(result,null,2));await writeFile('test-results/tournament/performance.json',JSON.stringify(result,null,2));
 // Do not allow fake test peers to enter socket shutdown/recovery code.
 for(const peer of room.members.values()){f.app.relay.peers.delete(peer.id);}room.members.clear();
}finally{await f.close();}
