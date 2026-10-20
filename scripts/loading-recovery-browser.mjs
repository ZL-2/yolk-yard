import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const out='test-results/loading-recovery',origin='http://127.0.0.1:5291';
const temp=await mkdtemp('/tmp/ravel-recovery-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/rewards.json';
let app,vite,browser,page;const errors=[],checks=[];
try{
 await mkdir(out,{recursive:true});app=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]});
 vite=await createServer({server:{host:'127.0.0.1',port:5291,strictPort:true,watch:null}});await vite.listen();
 browser=await chromium.launch({headless:true,executablePath:process.env.YOLK_TEST_CHROME||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({bypassCSP:true,viewport:{width:1280,height:800},deviceScaleFactor:.5});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${app.server.address().port}/game'};`}));
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Loading Tester'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',fpsLimit:30,volume:0,musicVolume:0}));});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest);await page.locator('#loading-screen').waitFor({state:'hidden'});checks.push('startup');
 async function lobby(){await page.locator('#loading-screen').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__yolkTest.read().screen),'menu');await page.locator('[data-action=lobby-play]').waitFor({state:'visible'});}
 async function leave(){await page.evaluate(()=>window.__yolkTest.leave());await lobby();}
 async function start(stall=false){await page.evaluate(stall=>{window.__yolkTest.loadingFixture(v=>{v.mapId=null;if(!v.originalCompile)v.originalCompile=v.renderer.compileAsync.bind(v.renderer);v.renderer.compileAsync=stall?()=>new Promise(()=>{}):v.originalCompile;});window.__yolkTest.startFixture({mode:'ffa',map:'yard',bots:1,capacity:4});},stall);await page.waitForFunction(()=>window.__yolkTest.loadingFixture(v=>!!v.mapCompile)||document.querySelector('#loading-screen').hidden);}
 console.log('Normal entry and return');await start();await page.locator('#loading-screen').waitFor({state:'hidden'});await leave();checks.push('normal entry and return');
 console.log('Leave during stalled shader preparation');await start(true);await page.evaluate(()=>{window.__oldShader=window.__yolkTest.loadingFixture(v=>v.mapCompile);});await leave();assert.equal(await page.evaluate(()=>window.__yolkTest.loadingFixture(v=>v.mapCompile)),null);checks.push('leave during stalled shaders');
 console.log('Stalled shader deadline recovers entry');await start(true);await page.locator('#loading-screen').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__yolkTest.read().screen),'game');await leave();checks.push('shader timeout fallback');
 console.log('Broken loading artwork and repeated return');await page.route('**/loading/*.webp',r=>r.abort());await start();await page.locator('#loading-screen').waitFor({state:'hidden'});await leave();await page.unroute('**/loading/*.webp');checks.push('failed artwork and repeated return');
 console.log('Zone Wars and Box Fights return with cleared match state');
 for(const mode of ['zonewars','boxfight']){
  await page.evaluate(mode=>{window.__yolkTest.loadingFixture(v=>{v.renderer.compileAsync=v.originalCompile;});window.__yolkTest.startFixture({mode,capacity:4});window.__yolkTest.fixture(s=>{s.addPlayer('rival',{name:'Rival'});s.startRound();});},mode);
  await page.waitForFunction(()=>window.__yolkTest.read().screen==='game');await page.locator('#loading-screen').waitFor({state:'hidden'});await leave();
  await page.waitForFunction(()=>window.__yolkTest.loadingFixture(v=>v.lobbyVisible===true));checks.push(mode+' return');
 }
 console.log('Cancel connection then reconnect');await page.waitForFunction(()=>window.__yolkTest.party().ready);
 await page.locator('[data-action=choose-mode]').click();await page.locator('[data-experience=ffa]').click();await page.locator('[data-action=lobby-options]').click();await page.locator('#lobby-access').selectOption('private');await page.locator('#lobby-options-form [data-action=close]').click();
 await page.evaluate(()=>{const observer=new MutationObserver(()=>{const button=document.querySelector('dialog[data-kind=connecting] [data-action=cancel-connect]');if(button){observer.disconnect();button.click();window.__cancelled=true;}});observer.observe(document.querySelector('dialog'),{attributes:true,childList:true,subtree:true});document.querySelector('[data-action=lobby-play]').click();});await page.waitForFunction(()=>window.__cancelled);await lobby();
 await page.locator('[data-action=lobby-play]').click();await page.locator('#lobby [data-action=start-match]').waitFor();await page.locator('#loading-screen').waitFor({state:'hidden'});await page.locator('#lobby [data-action=leave]').click();await lobby();checks.push('cancel and reconnect');
 assert.deepEqual(errors,[]);await page.screenshot({path:out+'/returned-lobby.png'});await writeFile(out+'/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS',JSON.stringify(checks));
}catch(error){if(page){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(await page.locator('body').innerText());}throw error;}
finally{await browser?.close();await vite?.close();await app?.close();await rm(temp,{recursive:true,force:true});}
