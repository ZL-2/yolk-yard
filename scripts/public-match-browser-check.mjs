import {startRealtimeServer} from '../server/realtime/index.js';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import WebSocket from 'ws';
import {Network} from '../src/network.js';
import {VERSION,safeProfile} from '../src/data.js';

const out='test-results/public-match',origin='http://127.0.0.1:5262',temp=await mkdtemp(tmpdir()+'/ravel-public-ui-');
await mkdir(out,{recursive:true});
process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/rewards.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]}),endpoint=`ws://127.0.0.1:${relay.server.address().port}`;
const vite=await createServer({plugins:[{name:'public-match-local-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'${endpoint}/game'};`);});}}],server:{host:'127.0.0.1',port:5262,strictPort:true,watch:null}});await vite.listen();
const errors=[],checks={},pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){const end=Date.now()+20000;while(!check()){assert.ok(Date.now()<end,label);await pause(25);}}
let browser,page,social,guest,guestState,launch,party,guestStates=0;
const trace=[];
const record=(stage,detail={})=>{const row={stage,at:new Date().toISOString(),...detail};trace.push(row);console.log(JSON.stringify(row));};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({bypassCSP:true,viewport:{width:1280,height:720}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ravelfront-season-1-update-150-dismissed','yes');localStorage.setItem('ravelfront-referrals-dismissed','yes');localStorage.setItem('ravelfront-perspective-157-dismissed','yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,musicVolume:0}));localStorage.setItem('yolk-profile',JSON.stringify({name:'Public UI Host'}));});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party().ready);await page.locator('#loading-screen').waitFor({state:'hidden'});
 relay.relay.parties.publishPublicMatch({...relay.relay.publicHost.summary(),joinSerial:1,lastJoin:{serial:1,name:'Arriving Friend',at:Date.now()}});
 await page.waitForTimeout(100);
 assert.equal(await page.locator('#public-match-arrival').count(),0);
 assert.equal(await page.locator('.public-royale-card').isVisible(),true);
 assert.equal(await page.locator('.public-royale-card [data-action=public-join]').count(),1);
 assert.equal(await page.locator('.public-royale-card').evaluate(el=>getComputedStyle(el).visibility),'visible');
 await page.screenshot({path:out+'/lobby.png'});checks.singleUnobscuredCard=true;
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#public-match-arrival').count(),0);await page.screenshot({path:out+'/mobile.png'});await page.setViewportSize({width:640,height:360});
 await page.locator('.public-royale-card [data-action=public-join]').click();
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
 const matchId=guestState.royale.matchId;assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.royale.matchId),matchId);
 const before=guestState.time,beforeStates=guestStates;record('interrupt',{time:before,states:beforeStates,stage:guestState.royale.stage});guest.hostConnection.close();await until(()=>!guest.migrating&&guestStates>beforeStates&&guestState.time>before,'Guest reconnects to the browser host');record('reconnected',{time:guestState.time,states:guestStates});
 assert.equal(guestState.royale.matchId,matchId);assert.equal(guestState.players.find(p=>p.id===guest.id).lateSpectator,false);
 assert.equal(relay.relay.publicHost.members.size,2);assert.deepEqual(errors,[]);checks.actualBrowserHostAndGuest=true;checks.reconnectSameRound=true;
 await writeFile(out+'/result.json',JSON.stringify({result:'PASS',checks,errors,trace},null,2));console.log(JSON.stringify({result:'PASS',checks}));
}catch(error){record('failure',{error:String(error),states:guestStates,time:guestState?.time,migrating:guest?.migrating,closed:guest?.closed,peerClosed:guest?.peer?.destroyed,channelOpen:guest?.hostConnection?.open,public:relay.relay.publicHost.summary()});await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({error:String(error),checks,errors,trace},null,2));throw error;}
finally{guest?.destroy();social?.terminate();await browser?.close();await vite.close();await relay.close();await rm(temp,{recursive:true,force:true});}
