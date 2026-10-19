import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {VERSION,safeProfile} from '../src/data.js';
const origin='http://127.0.0.1:5319',out='test-results/match-recovery',temp=await mkdtemp('/tmp/ravel-recovery-browser-');
process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/rewards.json';
let app,vite,browser,page,social,guest,guestState,launch,party;const errors=[],checks=[];
const until=async(fn,label,timeout=15000)=>{const end=Date.now()+timeout;while(!await fn()){assert.ok(Date.now()<end,label);await new Promise(r=>setTimeout(r,30));}};
const config={host:'127.0.0.1',origins:[origin],mapPath:temp+'/maps.json',recoveryPath:temp+'/relay.bin'};
try{
 await mkdir(out,{recursive:true});app=await startRealtimeServer({...config,port:0});const port=app.server.address().port,base='ws://127.0.0.1:'+port;
 vite=await createServer({plugins:[{name:'test-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'${base}/game'};`);});}}],server:{host:'127.0.0.1',port:5319,strictPort:true,watch:null}});await vite.listen();
 browser=await chromium.launch({headless:true,executablePath:process.env.YOLK_TEST_CHROME||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});page=await browser.newPage({bypassCSP:true,viewport:{width:1280,height:720},deviceScaleFactor:.5});page.setDefaultTimeout(120000);page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Recovery Pilot'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,musicVolume:0,fpsLimit:30}));});await page.goto(origin+'/?qa',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yolkTest?.party().ready);await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.locator('[data-action=lobby-play]').click();await page.waitForFunction(()=>{const r=window.__yolkTest.read();return r.host&&r.screen==='game'&&r.state?.royale?.stage==='spawn-island';});await page.locator('#loading-screen').waitFor({state:'hidden'});console.log('Browser public host on spawn island');
 globalThis.window={YOLK_NETWORK:{relay:base+'/game'}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin});}};
 social=new globalThis.WebSocket(base+'/social');social.on('error',()=>{});social.on('open',()=>social.send(JSON.stringify({type:'hello',version:VERSION,profile:safeProfile({name:'Recovery Wingmate'})})));social.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='party')party=m.party;if(m.type==='launch')launch=m.launch;});await until(()=>party,'Guest lobby');social.send(JSON.stringify({type:'queue'}));await until(()=>launch,'Guest reservation');assert.equal(launch.host,false);
 guest=new Network({onState:s=>guestState=s,onError:e=>errors.push(e)});await guest.join(launch.code,safeProfile({name:'Recovery Wingmate'}),launch.ticket);social.send(JSON.stringify({type:'joined',id:launch.id}));await until(()=>guestState?.royale,'Guest synchronized',60000);const match=guestState.royale.matchId;
 // Exercise the real warmup-to-battle-map render path before disrupting transport.
 await page.keyboard.down('KeyW');await page.waitForFunction(()=>['battle-bus','drop','active'].includes(window.__yolkTest.read().state?.royale?.stage));await page.keyboard.up('KeyW');await page.locator('#loading-screen').waitFor({state:'hidden'});checks.push('spawn island to battle map without losing the room');console.log(checks.at(-1));
 const before=guestState.time,peerIds=[...app.relay.peers.keys()],channel=guest.hostConnection.channel;
 await app.close({restart:true});app=await startRealtimeServer({...config,port});
 await until(()=>guestState?.time>before&&!guest.peer.reconnecting,'Original gameplay resumes after restart',30000);
 assert.equal(guestState.royale.matchId,match);assert.equal(guest.hostConnection.channel,channel);assert.equal(guest.migrating,false);assert.deepEqual([...app.relay.peers.keys()].sort(),peerIds.sort());
 const state=await page.evaluate(()=>{const r=window.__yolkTest.read();return {match:r.state.royale.matchId,screen:r.screen,host:r.host};});assert.deepEqual(state,{match,screen:'game',host:true});checks.push('real relay restart preserves browser host, guest, room and round');console.log(checks.at(-1));await page.screenshot({path:out+'/restored-match.png'});
 await page.evaluate(()=>window.__yolkTest.fixture(sim=>{const id=window.__yolkTest.read().localId;for(const p of sim.players.values())if(p.id!==id){p.health=0;p.spectating=true;}const winner=sim.players.get(id);winner.health=100;winner.spectating=false;sim.finish();}));await page.waitForFunction(()=>window.__yolkTest.read().state?.phase==='results');await page.evaluate(()=>window.__yolkTest.leave());await page.locator('#loading-screen').waitFor({state:'hidden'});await page.waitForFunction(()=>window.__yolkTest.read().screen==='menu');checks.push('match reaches results and returns to the lobby');
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS',JSON.stringify(checks));
}catch(error){console.error('Recovery check failed:',error,'Guest:',{time:guestState?.time,stage:guestState?.royale?.stage,reconnecting:guest?.peer?.reconnecting,closed:guest?.closed},'Browser errors:',errors);if(page){await page.screenshot({path:out+'/failure.png',timeout:10000}).catch(()=>{});console.error((await page.locator('body').innerText().catch(()=>'' )).slice(-1600));}throw error;}
finally{guest?.destroy();social?.terminate();await browser?.close();await vite?.close();await app?.close();await rm(temp,{recursive:true,force:true});}
