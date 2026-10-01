import {DeploymentStatus} from './deployment.js';
import {readFileSync} from 'node:fs';
import {BALANCE_REVISION} from '../../src/weapon-balance.js';
import {arenaSpawnPoints} from '../../src/arena-spawns.js';
import {ServiceStatus} from './service-status.js';
import {CpuQuotaMonitor} from './cpu-quota.js';
import {MAPS,navigation} from '../../src/maps.js';
import {ROYALE_MAP} from '../../src/royale-map.js';
import {SPAWN_ISLAND} from '../../src/spawn-island.js';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {WebSocketServer} from 'ws';
import {RealtimeRelay} from './relay.js';
import {OwnerService} from './owner.js';
import {VERSION} from '../../src/data.js';
export async function startRealtimeServer({port=Number(process.env.PORT)||3000,host='0.0.0.0',origins=(process.env.ALLOWED_ORIGINS||'https://zl-2.github.io').split(','),maintenance=process.env.RAVEL_MAINTENANCE==='true'}={}){
  // Build immutable navigation before accepting sockets or starting the match clock.
  for(const map of [...MAPS,ROYALE_MAP,SPAWN_ISLAND])navigation(map);
  for(const map of MAPS)arenaSpawnPoints(map);
  const cpuQuota=new CpuQuotaMonitor();await cpuQuota.start();
  const relay=new RealtimeRelay();relay.cpuQuota=cpuQuota;relay.serviceStatus=new ServiceStatus(relay,{path:host==='127.0.0.1'?null:undefined});await relay.serviceStatus.ready;
  const appVersion=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version;
  relay.deployment=new DeploymentStatus(relay,{version:appVersion});await relay.deployment.ready;relay.deployment.start();
  const owner=new OwnerService();await owner.ready;
  const server=createServer((req,res)=>{
    if(req.url?.split('?')[0]==='/deployment'){const origin=req.headers.origin;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(relay.deployment.snapshot()));return;}
    if(req.url?.split('?')[0]==='/status'){const origin=req.headers.origin;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(relay.serviceStatus.snapshot()));return;}
    if(req.url?.startsWith('/owner/')){void owner.handle(req,res,{origins,relay});return;}
    const social=relay.parties.store.storage();
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.writeHead(req.url==='/health'?200:404);res.end(JSON.stringify(req.url==='/health'?{ok:true,protocol:'yolk-realtime-v2',gameVersion:VERSION,weaponBalanceRevision:BALANCE_REVISION,build:process.env.RENDER_GIT_COMMIT||null,brand:'Ravelfront',performanceRevision:100,deployment:relay.deployment.snapshot(),customMatches:'private-host',royaleMatches:'private-host',serverModes:['ffa','teams'],teamBotRevision:1,friendSpectating:true,capacity:relay.authority.capacity.snapshot(),socialRevision:92,statusRevision:96,reopeningRevision:87,maintenance,partyLimit:4,socialStorage:social.mode,socialAvailable:social.available,cpu:cpuQuota.snapshot(),features:['hosted-royale','squad-bot-follow','priority-bot-revives','bot-materials','private-host-customs','friend-spectating','bot-teammate-fill','coordinated-updates','workload-admission','batched-snapshots','staggered-bots','central-weapon-balance','friends','friend-codes','presence','blocking','four-player-parties','squads','human-team-fill','parties','duos','party-reservations','marks-rewards','afk-59','humanoids','server-authority','crouch-slide','dbno-revive','duo-pings']}:{error:'Not found'}));
  });
  const sockets=new WebSocketServer({noServer:true,maxPayload:2_000_000,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    if(!['/game','/social'].includes(req.url)||!origins.includes(req.headers.origin)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    const token=(req.headers['sec-websocket-protocol']||'').split(',').map(s=>s.trim()).find(s=>/^owner\.[a-f0-9]{64}$/.test(s))?.slice(6);
    if(maintenance&&!owner.authorized(req,{token})){socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\nMaintenance');return;}
    sockets.handleUpgrade(req,socket,head,ws=>{
      if(maintenance){const timer=setTimeout(()=>ws.close(1008,'Administrator session expired'),Math.max(0,owner.tokens.get(token)-Date.now()));timer.unref?.();ws.once('close',()=>clearTimeout(timer));}
      req.url==='/social'?relay.parties.attach(ws):relay.attach(ws);
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  return {server,relay,owner,async close(){relay.deployment.close();await relay.serviceStatus.close();cpuQuota.close();relay.close();for(const ws of sockets.clients)ws.terminate();await new Promise(r=>sockets.close(r));await new Promise(r=>server.close(r));await owner.close();await relay.parties.store.flush();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=await startRealtimeServer();console.log(`Ravelfront relay listening on ${app.server.address().port}`);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.relay.deployment.set(true);await app.close();process.exit(0);});
}
