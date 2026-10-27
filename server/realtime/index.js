import {ICON_POLL_ID,ICON_WINNER,ICON_CATEGORIES,ICON_BUNDLE_VOTE_CLOSED} from '../../src/icon-voting-rules.js';
import {IconVoting} from './icon-voting.js';
import {FairPlayService} from './fair-play.js';
import {TournamentService} from './tournament.js';
import {releaseActivity} from './release-activity.js';
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
import {RelayRecovery} from './relay-recovery.js';
import {OwnerService} from './owner.js';
import {MapStore} from './map-store.js';
import {VERSION} from '../../src/data.js';
export async function startRealtimeServer({port=Number(process.env.PORT)||3000,host='0.0.0.0',origins=(process.env.ALLOWED_ORIGINS||'https://zl-2.github.io').split(','),maintenance=process.env.RAVEL_MAINTENANCE==='true',publicRoyale=true,mapPath,ownerPath,ownerCode,recoveryPath,tournamentOptions}={}){
  const mapStore=new MapStore({path:mapPath});await mapStore.ready;
  // Player browsers prepare their own maps and navigation.

  const cpuQuota=new CpuQuotaMonitor();await cpuQuota.start();
  const relay=new RealtimeRelay();relay.mapStore=mapStore;relay.cpuQuota=cpuQuota;relay.serviceStatus=new ServiceStatus(relay,{path:host==='127.0.0.1'?null:undefined});await relay.serviceStatus.ready;
  const appVersion=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version;
  relay.deployment=new DeploymentStatus(relay,{version:appVersion});await relay.deployment.ready;relay.deployment.start();
  const owner=new OwnerService({code:ownerCode??process.env.YOLK_OWNER_CODE,dbPath:ownerPath!==undefined?ownerPath:host==='127.0.0.1'?null:undefined});await owner.ready;await relay.progression.ready;await relay.parties.store.ready;owner.attach(relay);
  if(publicRoyale)relay.authority.ensurePublicRoyale();
  relay.recovery=new RelayRecovery(relay,{path:recoveryPath});relay.recovery.restore();
  relay.fairPlay=new FairPlayService(relay,{now:()=>owner.now()});
  relay.tournament=new TournamentService(relay,tournamentOptions);relay.fairPlay.reconcileSchedule();
  const iconVoting=relay.iconVoting=new IconVoting();await iconVoting.ready;
  const server=createServer((req,res)=>{
    if(req.url?.split('?')[0]==='/icon-voting'){void iconVoting.handle(req,res,{origins,store:relay.parties.store});return;}
    if(req.url?.split('?')[0]==='/tournament'){const origin=req.headers.origin;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(relay.tournament.summary()));return;}
    if(req.url?.split('?')[0]==='/maps'){const origin=req.headers.origin;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify({layouts:mapStore.layouts()}));return;}
    const asset=/^\/map-assets\/([a-f0-9]{64})\.glb$/.exec(req.url||'');
    if(asset){void mapStore.asset(asset[1]).then(bytes=>{res.writeHead(bytes?200:404,{'Content-Type':bytes?'model/gltf-binary':'application/json','X-Content-Type-Options':'nosniff','Cache-Control':bytes?'public, max-age=31536000, immutable':'no-store','Access-Control-Allow-Origin':'*'});res.end(bytes||JSON.stringify({error:'Model unavailable'}));}).catch(()=>{res.writeHead(503);res.end();});return;}
    if(req.url?.split('?')[0]==='/deployment'){const origin=req.headers.origin;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(relay.deployment.snapshot()));return;}
    if(req.url?.split('?')[0]==='/public-match'){const origin=req.headers.origin;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify({match:relay.authority.publicSummary()}));return;}
    if(req.url?.split('?')[0]==='/leaderboards'){const origin=req.headers.origin;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(relay.progression.leaderboards(undefined,{mode:new URL(req.url,'http://relay').searchParams.get('mode'),offset:Number(new URL(req.url,'http://relay').searchParams.get('offset'))})));return;}
    if(req.url?.split('?')[0]==='/status'){const origin=req.headers.origin;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(relay.serviceStatus.snapshot()));return;}
    if(req.url?.startsWith('/owner/')){void owner.handle(req,res,{origins,relay});return;}
    const social=relay.parties.store.storage();
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.writeHead(req.url==='/health'?200:404);res.end(JSON.stringify(req.url==='/health'?{ok:true,protocol:'yolk-realtime-v2',gameVersion:VERSION,tournament:relay.tournament.summary(),weaponBalanceRevision:BALANCE_REVISION,build:process.env.RENDER_GIT_COMMIT||null,brand:'Ravelfront',jimStyleRevision:1,iconVoting:{pollId:ICON_POLL_ID,winner:ICON_WINNER,categories:ICON_CATEGORIES.map(c=>c.id),nominationClosed:true,closed:ICON_BUNDLE_VOTE_CLOSED,available:!iconVoting.error,archivedVotes:Object.keys(iconVoting.data.archive?.votes||{}).length},ownerRevision:3,visitAnalyticsRevision:2,ownerStorage:{available:owner.db.storage().available,persistent:owner.db.storage().persistent},mapEditorRevision:1,mapStorage:mapStore.storage(),performanceRevision:194,fieldRevision:137,publicHostRevision:4,relayRecoveryRevision:1,leaderboardRevision:3,crownRevision:1,bossRevision:4,bossAwarenessRevision:1,bossVoiceRevision:1,emoteRevision:3,voiceRevision:1,deployment:relay.deployment.snapshot(),customMatches:'private-host',royaleMatches:'private-host-with-public-pools',privateModes:['ffa','royale','zombies','boxfight','zonewars'],zoneWarsRevision:3,boxFightRevision:2,serverModes:['zombies'],zombiesRevision:3,publicHosting:'player',publicMatch:relay.authority.publicSummary(),teamBotRevision:1,friendSpectating:true,releaseActivity:releaseActivity(relay),capacity:relay.authority.capacity.snapshot(),socialRevision:92,statusRevision:96,reopeningRevision:87,maintenance,partyLimit:4,socialStorage:social.mode,socialAvailable:social.available,cpu:cpuQuota.snapshot(),features:['live-voice-channels','winner-celebrations','owner-control-room','durable-owner-history','owner-moderation','owner-analytics','tilted-district-zone-wars','per-mode-rankings','lobby-privacy-toggle','lobby-chat-unread','blacktide-field-operations','blacktide-supply-sharing','blacktide-rover-squads','blacktide-timed-extraction','shared-world-24-operators','squad-contracts','persistent-extraction-gear','box-fights-1v1-4v4','box-fights-private-ffa','box-fights-series-recovery','blacktide-zombies','server-zombies-authority','zombies-coop-1-4','public-mode-pools','lobby-mode-picker','party-ready-labels','main-match-leaderboards','browser-public-host','public-host-migration','shadowstep-six-charges','spawn-island-battle-map','shadowstep-mythic','steady-vault-floors','committed-bot-chest-search','shared-immutable-loot','boss-awareness-markers','spatial-boss-voices','boss-voice-cooldowns','three-keyed-vaults','mythic-plunger-grappler','full-bot-recovery','weapon-family-rarity-stats','public-only-crowns','rare-chest-indicators','owner-map-editor','glb-model-import','published-map-layouts','victory-crowns','season-crown-wins','third-person-emotes','three-mythic-bosses','ammo-quantity-labels','boss-crown-sounds','human-start-countdown','vault-ammo','shield-barrels','press-to-swap','gun-first-bots','distance-bot-accuracy','three-boss-map-markers','relay-loot-clearance','build-trigger-release','world-detail-streaming','steady-royale-bots','interest-poses','season-one-breakwater','aster-boss','kestrel-jump-rig','public-open-24-7','tactical-relays','smoke-recon','inventory-supply-drops','recurring-public-royale','48-contestants','manual-private-start','hosted-royale','squad-bot-follow','priority-bot-revives','bot-materials','private-host-customs','friend-spectating','bot-teammate-fill','coordinated-updates','workload-admission','batched-snapshots','staggered-bots','central-weapon-balance','friends','friend-codes','presence','blocking','four-player-parties','squads','human-team-fill','parties','duos','party-reservations','marks-rewards','afk-59','humanoids','server-authority','crouch-slide','dbno-revive','duo-pings']}:{error:'Not found'}));
  });
  const sockets=new WebSocketServer({noServer:true,maxPayload:2_000_000,perMessageDeflate:{threshold:2048,serverNoContextTakeover:true,clientNoContextTakeover:true,concurrencyLimit:2,zlibDeflateOptions:{level:1,memLevel:5}}}),voiceSockets=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    if(!['/game','/social','/voice'].includes(req.url)||!origins.includes(req.headers.origin)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    const token=(req.headers['sec-websocket-protocol']||'').split(',').map(s=>s.trim()).find(s=>/^owner\.[a-f0-9]{64}$/.test(s))?.slice(6);
    if(maintenance&&!owner.authorized(req,{token})){socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\nMaintenance');return;}
    (req.url==='/voice'?voiceSockets:sockets).handleUpgrade(req,socket,head,ws=>{
      if(maintenance){const timer=setTimeout(()=>ws.close(1008,'Administrator session expired'),Math.max(0,owner.tokens.get(token)-Date.now()));timer.unref?.();ws.once('close',()=>clearTimeout(timer));}
      req.url==='/social'?relay.parties.attach(ws):req.url==='/voice'?relay.voice.attach(ws):relay.attach(ws);
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  return {server,relay,owner,mapStore,async close({restart=false}={}){relay.deployment.close();await relay.serviceStatus.close();cpuQuota.close();let preserveSessions=false;if(restart){try{preserveSessions=relay.recovery.save();}catch{console.error('Relay recovery could not be saved');}}const relayClosed=relay.close({preserveSessions});for(const group of [sockets,voiceSockets]){for(const ws of group.clients)ws.terminate();await new Promise(r=>group.close(r));}await new Promise(r=>server.close(r));await relayClosed;await owner.close();await relay.parties.store.flush();await iconVoting.chain;await mapStore.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=await startRealtimeServer();console.log(`Ravelfront relay listening on ${app.server.address().port}`);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.relay.deployment.set(true);await app.close({restart:true});process.exit(0);});
}
