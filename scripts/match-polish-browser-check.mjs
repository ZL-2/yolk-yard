import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';

const out='test-results/expansion/match-polish',port=5233,origin=`http://127.0.0.1:${port}`;
await mkdir(out,{recursive:true});
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]}),relayPort=relay.server.address().port;
relay.relay.progression.path=null;
const vite=await createServer({plugins:[{name:'match-polish-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${relayPort}/game'};`);});}}],server:{host:'127.0.0.1',port,strictPort:true,watch:null}});
await vite.listen();
let browser,page;const errors=[],checks={};
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ravelfront-season-1-dismissed','yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:.25,musicVolume:0}));if(!localStorage.getItem('yolk-profile'))localStorage.setItem('yolk-profile',JSON.stringify({name:'Player'}));});
 await page.goto(origin+'/?qa');await page.locator('#loading-screen').waitFor({state:'hidden'});await page.locator('#dialog[data-kind=name-required]').waitFor({state:'visible'});
 assert.equal(relay.relay.parties.users.size,0,'no anonymous social identity before choosing a name');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#dialog[data-kind=name-required]').isVisible(),true);
 await page.locator('#required-name').fill('Player');await page.locator('[data-action=save-player-name]').click();assert.match(await page.locator('#required-name-error').textContent(),/other than Player/);
 await page.locator('#required-name').fill('Polish Scout');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__yolkTest.party().ready);
 const identity=await page.evaluate(()=>localStorage.getItem('ravelfront-social-identity'));assert.ok(identity);
 await page.reload();await page.locator('#loading-screen').waitFor({state:'hidden'});await page.waitForFunction(()=>window.__yolkTest.party().ready);assert.equal(await page.locator('#dialog[data-kind=name-required]').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('ravelfront-social-identity')),identity);checks.requiredNameAndIdentity=true;

 for(let i=0;i<30;i++)relay.relay.progression.accounts.set('rank-'+i,{publicParticipant:true,publicName:'Ranked Scout '+i,publicTotals:{version:1,kills:100-i,wins:30-i}});
 relay.relay.progression.leaderboardCache=null;await page.locator('[data-action=leaderboard-refresh]:visible').first().click();await page.waitForFunction(()=>document.querySelectorAll('#menu .frontier-board-ranks .frontier-rank').length===25);
 checks.visibleLeaderboardRows=await page.locator('#menu .frontier-board-ranks').evaluate(box=>{const b=box.getBoundingClientRect();return [...box.querySelectorAll('.frontier-rank')].filter(el=>{const r=el.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom;}).length;});assert.ok(checks.visibleLeaderboardRows>=4,'several names must fit without View All');
 assert.match(await page.locator('.public-royale-card').evaluate(el=>getComputedStyle(el).backgroundImage),/public-frontier-v144/);assert.equal((await page.request.get(origin+'/art/public-frontier-v144.webp')).status(),200);await page.screenshot({path:out+'/lobby-laptop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#menu .frontier-leaderboard').scrollIntoViewIfNeeded();assert.equal(await page.locator('#menu .frontier-leaderboard').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:out+'/leaderboard-mobile.png'});checks.leaderboardAndArtwork=true;await page.setViewportSize({width:1366,height:768});

 await page.locator('[data-action=training]:visible').click();await page.locator('[data-action=start-training]').click();await page.locator('#loading-screen').waitFor({state:'hidden'});
 if(await page.locator('#dialog [data-action=resume]').isVisible())await page.locator('#dialog [data-action=resume]').click();
 await page.waitForFunction(()=>!window.__yolkTest.read().paused);await page.waitForFunction(()=>window.__yolkTest.fieldAudio().loaded.length===3);checks.samplesDecoded=true;
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.options.training=false;s.beginBattle();const id=window.__yolkTest.read().localId,me=s.players.get(id);for(const p of s.players.values()){if(p.id!==id){p.health=0;p.spectating=true;}}const enemy=[...s.players.values()].find(p=>p.bot&&!p.boss&&p.contestant);Object.assign(enemy,{health:100,shield:0,spectating:false,flight:'ground',grounded:true,x:0,y:0,z:-20,shieldUntil:999999});Object.assign(me,{x:0,y:0,z:0,health:100,shield:0,spectating:false,flight:'ground',grounded:true,shieldUntil:0});s.stormSteps=s.stormSteps.map(q=>({...q,start:999999,closeAt:999999,end:999999}));s.damage(me,enemy,110,'M15 Assault Rifle');}));
 await page.locator('#royale-end-screen').waitFor({state:'visible'});await page.waitForFunction(()=>window.__yolkTest.endPresentation().effects.active>0);await page.screenshot({path:out+'/elimination-beam.png'});
 await page.waitForFunction(()=>window.__yolkTest.endPresentation().phase==='placement');assert.match(await page.locator('#royale-end-screen h1').textContent(),/YOU PLACED #2/);assert.ok((await page.evaluate(()=>window.__yolkTest.fieldAudio())).plays.elimination>=1,'supplied death sound plays even when local results pause');
 await page.locator('[data-action=match-stats]').click();await page.locator('#dialog[data-kind=royale-stats]').waitFor({state:'visible'});await page.locator('#dialog [data-action=close]').first().click();await page.screenshot({path:out+'/placement.png'});checks.eliminationAndStats=true;
 await page.locator('[data-action=royale-queue]').click();await page.locator('#loading-screen').waitFor({state:'hidden'});await page.locator('[data-action=training]:visible').click();await page.locator('[data-action=start-training]').click();await page.locator('#loading-screen').waitFor({state:'hidden'});
 if(await page.locator('#dialog [data-action=resume]').isVisible())await page.locator('#dialog [data-action=resume]').click();
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.options.training=false;s.beginBattle();const id=window.__yolkTest.read().localId,p=s.players.get(id);for(const q of s.players.values())if(q.id!==id){q.health=0;q.spectating=true;}Object.assign(p,{x:0,y:0,z:0,health:100,shield:100,flight:'ground',grounded:true,spectating:false,kills:3});s.finish();}));
 await page.waitForFunction(()=>window.__yolkTest.endPresentation().phase==='victory');assert.match(await page.locator('#royale-end-screen h1').textContent(),/VICTORY ROYALE/);await page.waitForFunction(()=>window.__yolkTest.celebrations().localVisible);await page.screenshot({path:out+'/victory-desktop.png'});
 await page.locator('#royale-end-screen [data-action=emotes]').click();await page.locator('[data-emote=cheer]').click();await page.waitForFunction(()=>window.__yolkTest.celebrations().localPose==='emote-cheer');assert.equal(await page.evaluate(()=>!!document.pointerLockElement),false,'victory controls retain the mouse');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#royale-end-screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:out+'/victory-mobile.png'});checks.victoryAndCelebration=true;
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS match polish',checks);
}catch(error){await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({checks,errors,error:String(error)},null,2));throw error;}
finally{await browser?.close();await vite.close();await relay.close();}
