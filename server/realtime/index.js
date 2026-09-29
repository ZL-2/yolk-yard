import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {WebSocketServer} from 'ws';
import {RealtimeRelay} from './relay.js';
import {OwnerService} from './owner.js';
import {VERSION} from '../../src/data.js';
export async function startRealtimeServer({port=Number(process.env.PORT)||3000,host='0.0.0.0',origins=(process.env.ALLOWED_ORIGINS||'https://zl-2.github.io').split(','),maintenance=host!=='127.0.0.1'}={}){
  const relay=new RealtimeRelay();
  const owner=new OwnerService();await owner.ready;
  const server=createServer((req,res)=>{
    if(req.url?.startsWith('/owner/')){void owner.handle(req,res,{origins,relay});return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.writeHead(req.url==='/health'?200:404);res.end(JSON.stringify(req.url==='/health'?{ok:true,protocol:'yolk-realtime-v2',gameVersion:VERSION,brand:'Ravelfront',performanceRevision:71,features:['parties','duos','party-reservations','marks-rewards','afk-59','humanoids','server-authority','crouch-slide','dbno-revive','duo-pings']}:{error:'Not found'}));
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
  return {server,relay,owner,async close(){relay.close();for(const ws of sockets.clients)ws.terminate();await new Promise(r=>sockets.close(r));await new Promise(r=>server.close(r));await owner.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=await startRealtimeServer();console.log(`Ravelfront relay listening on ${app.server.address().port}`);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
}
