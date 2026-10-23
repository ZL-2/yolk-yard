import {startRealtimeServer} from '../server/realtime/index.js';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import WebSocket from 'ws';
import {Network} from '../src/network.js';
import {VERSION,safeProfile} from '../src/data.js';

const out='test-results/update-207',origin='http://127.0.0.1:5262',temp=await mkdtemp(tmpdir()+'/ravel-public-ui-');
await mkdir(out,{recursive:true});
process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/rewards.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]}),endpoint=`ws://127.0.0.1:${relay.server.address().port}`;
await relay.relay.progression.ready;
const rankProfile=safeProfile({name:'Recovery Champion',pickaxe:'pickaxe-rank-1'}),rankStore=relay.relay.parties.store;
const {identity:rankIdentity,token:rankToken}=rankStore.identify(null,rankProfile),progressToken='20702070207020702070207020702070';
relay.relay.progression.accounts.set(relay.relay.progression.identity(progressToken),{socialId:rankIdentity.id,publicName:rankProfile.name,publicParticipant:true,publicTotals:{version:1,wins:3,kills:49},receipts:[]});
relay.relay.progression.rankRewards.invalidate();relay.relay.progression.rankRewards.claim(rankIdentity.id,['pickaxe-rank-1'],'pickaxe-rank-1');
const vite=await createServer({plugins:[{name:'public-match-local-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'${endpoint}/game'};`);});}}],server:{host:'127.0.0.1',port:5262,strictPort:true,watch:null}});await vite.listen();
const errors=[],checks={},pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){const end=Date.now()+20000;while(!check()){assert.ok(Date.now()<end,label);await pause(25);}}
let browser,page,social,guest,guestState,launch,party,guestStates=0;
const trace=[];
const record=(stage,detail={})=>{const row={stage,at:new Date().toISOString(),...detail};trace.push(row);console.log(JSON.stringify(row));};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 // Keep desktop CSS dimensions while limiting SwiftShader's pixel workload.
 page=await browser.newPage({bypassCSP:true,deviceScaleFactor:.5,viewport:{width:1280,height:720}});page.setDefaultTimeout(60000);page.on('pageerror',e=>{errors.push(e.stack||e.message);record('pageerror',{error:e.stack||e.message});});
 await page.addInitScript(({rankToken,progressToken,rankProfile})=>{localStorage.setItem('ravelfront-social-identity',rankToken);localStorage.setItem('ravelfront-progress-token',progressToken);localStorage.setItem('ravelfront-stormspike-kestrel-199-dismissed','yes');localStorage.setItem('ravelfront-season-1-update-150-dismissed','yes');localStorage.setItem('ravelfront-referrals-dismissed','yes');localStorage.setItem('ravelfront-perspective-157-dismissed','yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,musicVolume:0}));localStorage.setItem('yolk-profile',JSON.stringify(rankProfile));},{rankToken,progressToken,rankProfile});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party().ready);await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.locator('.prestige-dialog[open]').waitFor();await page.locator('[data-prestige-close]').first().click();await page.locator('.prestige-dialog[open]').waitFor({state:'hidden'});record('lobby-ready');
 await page.locator('[data-action=lobby-options]').click();await page.locator('#lobby-teamSize').selectOption('1');await page.locator('#lobby-options-form [data-action=close]').click();
 await page.locator('[data-action=lobby-play]').click();
 await page.waitForFunction(()=>{const r=window.__yolkTest.read();return r.host&&r.screen==='game'&&r.state?.royale?.stage==='spawn-island';});
 await until(()=>relay.relay.publicHost.members.size===1,'Browser owns the public room');record('browser-host');
 // A real socket guest validates the actual browser host without a second GPU.
 globalThis.window={YOLK_NETWORK:{relay:endpoint+'/game'}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin});}};
 social=new globalThis.WebSocket(endpoint+'/social');
 social.on('open',()=>social.send(JSON.stringify({type:'hello',version:VERSION,profile:safeProfile({name:'Public UI Guest'})})));
 social.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='party')party=m.party;if(m.type==='launch')launch=m.launch;});
 await until(()=>party,'Guest lobby connected');social.send(JSON.stringify({type:'queue',publicRoyale:true,request:1}));await until(()=>launch,'Guest admitted to the same public room');assert.equal(launch.host,false);
 guest=new Network({onState:s=>{guestState=s;guestStates++;},onError:e=>errors.push(e),onStatus:s=>record('guest-status',{status:s})});await guest.join(launch.code,safeProfile({name:'Public UI Guest'}),launch.ticket);social.send(JSON.stringify({type:'joined',id:launch.id,request:2}));
 await until(()=>guestState?.players.some(p=>p.id===guest.id),'Browser sends guest state');
 for(const id of ['pickaxe-rank-25','pickaxe-rank-10','pickaxe-rank-5','pickaxe-rank-1']){
  await page.evaluate(id=>window.__yolkTest.social('rank-claim',{ids:[id],equip:id}),id);
  await page.waitForFunction(id=>{const r=window.__yolkTest.read();return r.state.players.find(p=>p.id===r.localId)?.pickaxe===id;},id);
  await until(()=>guestState.players.find(p=>p.id==='host')?.pickaxe===id,'Equipped tool reaches guest');
  for(const perspective of ['first','third']){
   await page.evaluate(p=>window.__yolkTest.setPerspective(p),perspective);
   const before=await page.evaluate(()=>({frames:window.__yolkTest.framePacing().frames,time:window.__yolkTest.read().state.time}));
   await page.waitForFunction(before=>window.__yolkTest.framePacing().frames>before.frames+2&&window.__yolkTest.read().state.time>before.time,before);
  }
  record('rank-tool-playing',{id});
 }
 checks.allFourToolsAndPerspectives=true;
 const matchId=guestState.royale.matchId;assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.royale.matchId),matchId);
 const before=guestState.time,beforeStates=guestStates;record('interrupt',{time:before,states:beforeStates,stage:guestState.royale.stage});guest.hostConnection.close();await until(()=>!guest.migrating&&guestStates>beforeStates&&guestState.time>before,'Guest reconnects to the browser host');record('reconnected',{time:guestState.time,states:guestStates});
 assert.equal(guestState.royale.matchId,matchId);assert.equal(guestState.players.find(p=>p.id===guest.id).lateSpectator,false);
 assert.equal(relay.relay.publicHost.members.size,2);
 record('starting-battle');await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.queueEnds=s.time+.1;}));
 await page.waitForFunction(()=>['battle-bus','drop','active'].includes(window.__yolkTest.read().state?.royale?.stage));
 await page.locator('#loading-screen').waitFor({state:'hidden'});
 record('battle-started',{state:await page.evaluate(()=>{const r=window.__yolkTest.read();return {time:r.state.time,stage:r.state.royale.stage,players:r.state.players.length,view:window.__yolkTest.repairView()};})});
 const battleTime=guestState.time;await until(()=>guestState.time>battleTime+3,'Battle simulation continues');
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.stage='active';for(const p of s.players.values())if(!p.boss&&!p.henchman){Object.assign(p,{flight:'ground',x:40+(s.random()-.5)*20,y:2,z:40+(s.random()-.5)*20,health:100,shield:100,shieldUntil:0});}}));
 const combatTime=guestState.time;await until(()=>guestState.time>combatTime+5,'Combat simulation continues');
 record('combat-advanced',{time:guestState.time});assert.deepEqual(errors,[]);checks.actualBrowserHostAndGuest=true;checks.matchAndCombatAdvance=true;checks.reconnectSameRound=true;
 await writeFile(out+'/result.json',JSON.stringify({result:'PASS',checks,errors,trace},null,2));console.log(JSON.stringify({result:'PASS',checks}));
}catch(error){record('failure',{error:String(error),states:guestStates,time:guestState?.time,migrating:guest?.migrating,closed:guest?.closed,peerClosed:guest?.peer?.destroyed,channelOpen:guest?.hostConnection?.open,public:relay.relay.publicHost.summary()});await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({error:String(error),checks,errors,trace},null,2));throw error;}
finally{guest?.destroy();social?.terminate();await browser?.close();await vite.close();await relay.close();await rm(temp,{recursive:true,force:true});}
