import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdtemp,rm} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const live=!!process.env.RAVEL_FRONTEND_URL;
const origin=process.env.RAVEL_FRONTEND_URL||'http://127.0.0.1:5196';
let temp,app,vite,browser,page;
try{
 if(!live){
  temp=await mkdtemp('/tmp/ravel-update-screen-');
  process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
  app=await startRealtimeServer({host:'127.0.0.1',port:9002,origins:[origin]});
  vite=await createServer({server:{host:'127.0.0.1',port:5196,strictPort:true,watch:null}});await vite.listen();
 }
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage();page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(!live)await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.YOLK_NETWORK={relay:'ws://127.0.0.1:9002/game'};"}));
 await page.addInitScript(()=>{
  sessionStorage.setItem('ravelfront-update-pending','1');
  localStorage.setItem('yolk-profile',JSON.stringify({name:'Update Check'}));
  localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));
  localStorage.setItem('ravelfront-welcome-back-2026-09','dismissed');
  const Native=WebSocket;window.__updateSockets=[];
  window.WebSocket=class extends Native{constructor(...args){super(...args);window.__updateSockets.push(this);}};
 });
 await page.goto(origin+'/?qa&verify-update-screen='+Date.now());
 await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.locator('#menu [data-action=play-custom]:enabled').waitFor();
 assert.ok((await page.locator('body').innerText()).includes('RAVEL'));
 assert.equal(await page.locator('vite-error-overlay,[data-nextjs-dialog]').count(),0);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('ravelfront-update-pending')),null);
 const updating=()=>page.evaluate(()=>{for(const ws of window.__updateSockets)ws.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'deployment',deployment:{updating:true,build:'next'}})}));});
 await updating();assert.equal(await page.locator('#deployment-screen').count(),0);
 await page.locator('#menu [data-action=play-custom]').click();
 await updating();assert.equal(await page.locator('dialog[open]').count(),1,'Update notice must not close the setup menu');
 await page.locator('#setup-mode').selectOption('ffa');await page.locator('#setup-bots').selectOption('1');
 await page.locator('[data-action=create-room]').click();await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.locator('#lobby [data-action=start-match]').click();await page.locator('#lobby').waitFor({state:'hidden'});
 await updating();assert.equal(await page.locator('#deployment-screen').count(),0);
 assert.equal(await page.locator('dialog[open]').count(),0,'Update notice must not pause hosted gameplay');
 if(!live){const state=await page.evaluate(()=>window.__yolkTest.read());assert.equal(state.paused,false);assert.equal(state.state.phase,'playing');}
 if(live){const version=await page.evaluate(async()=>{const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});return r.json();});assert.equal(version.appVersion,'3.8.2');assert.equal(version.release,'112');assert.equal(version.build,process.env.GITHUB_SHA);}
 assert.deepEqual(errors,[]);
 console.log('PASS '+(live?'live ':'')+'3.8.2 / Quality Update 112: saved update flag cleared, publishing notices do not block lobby, close setup, or pause hosted gameplay; no browser errors.');
}catch(error){console.log(await page?.locator('body').innerText().catch(()=>''));throw error;}
finally{await browser?.close();await vite?.close();await app?.close();if(temp)await rm(temp,{recursive:true,force:true});}
