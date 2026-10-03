import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
import {LOADING_ART,loadingMarkup} from '../src/loading-screen.js';
const live=process.env.RAVEL_FRONTEND_URL,origin=(live||'http://127.0.0.1:5198').replace(/\/$/,''),out='test-results/loading-art';
let app,vite,browser,temp;const errors=[],pages=[],metrics={live:!!live,assets:[]};
async function page(name,staticOnly=false){
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 if(!live)await context.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.YOLK_NETWORK={relay:'ws://127.0.0.1:9002/game'};"}));
 if(staticOnly)await context.route(/\/(?:src\/main\.js|assets\/index-[^/]+\.js)(?:\?.*)?$/,r=>r.fulfill({contentType:'application/javascript',body:''}));
 const p=await context.newPage();pages.push(p);p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(name=>{localStorage.setItem('ravelfront-season-1-dismissed','yes');localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);
 await p.goto(origin+'/?qa&loading='+Date.now());return p;
}
async function decoded(p,art){return p.evaluate(async file=>{const img=new Image();img.src=new URL(file,location.href).href;await img.decode();return {file,width:img.naturalWidth,height:img.naturalHeight};},art.file);}
async function shot(p,name){await p.screenshot({path:out+'/'+name+'.png'});}
try{
 await mkdir(out,{recursive:true});
 if(!live){temp=await mkdtemp('/tmp/ravel-loading-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';app=await startRealtimeServer({host:'127.0.0.1',port:9002,origins:[origin]});vite=await createServer({server:{host:'127.0.0.1',port:5198,strictPort:true,watch:null}});await vite.listen();}
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const preview=await page('Loading Artwork',true);
 await preview.locator('#loading-screen[data-loading-art=startup]').waitFor({state:'visible'});
 metrics.assets.push(await decoded(preview,LOADING_ART.startup));
 assert.ok(await preview.locator('.load-status').innerText());await shot(preview,'startup');
 const bootImages=await preview.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name).filter(n=>/\/loading\/.*\.webp/.test(n)));
 assert.ok(bootImages.every(n=>n.includes('kestrel-airstrip.webp')),'boot does not preload all match illustrations');
 for(const art of LOADING_ART.matches){
  const html=loadingMarkup('DEPLOYING TO MATCH','Preparing terrain, operators and equipment.',true,{kind:'enter',art});
  await preview.evaluate(html=>{const root=document.querySelector('#loading-screen');root.className='';root.removeAttribute('data-loading-art');root.removeAttribute('data-loading-kind');root.innerHTML=html;},html);
  const image=await decoded(preview,art);metrics.assets.push(image);assert.ok(image.width>=1500&&image.height>=800);
  assert.ok((await preview.locator('.ravel-loading').evaluate(e=>getComputedStyle(e).backgroundImage)).includes(art.file));
  await preview.locator('[data-action=cancel-connect]').waitFor({state:'visible'});await shot(preview,art.id);
 }
 for(const kind of ['connect','exit']){await preview.evaluate(html=>document.querySelector('#loading-screen').innerHTML=html,loadingMarkup(kind==='exit'?'RETURNING TO LOBBY':'ESTABLISHING MATCH UPLINK',kind==='exit'?'Preparing your operator in the lobby.':'Connecting to the room service.',kind==='connect',{kind,art:LOADING_ART.matches[1]}));await shot(preview,kind);}
 const host=await page('Loading Captain');await host.locator('#loading-screen').waitFor({state:'hidden'});await host.locator('#menu [data-action=play-custom]').waitFor({state:'visible'});
 assert.equal(await host.locator('vite-error-overlay').count(),0);
 if(!live){
  await host.locator('#menu [data-action=play-custom]').click();await host.locator('#setup-mode').selectOption('ffa');await host.locator('#setup-bots').selectOption('2');
  const connecting=await host.evaluate(()=>{document.querySelector('[data-action=create-room]').click();const dialog=document.querySelector('dialog'),root=document.querySelector('#loading-screen .ravel-loading'),art=dialog.querySelector('.ravel-loading').dataset.loadingArt;const result={open:dialog.open,art,rootArt:root.dataset.loadingArt};setTimeout(()=>dialog.querySelector('[data-action=cancel-connect]').click(),300);return result;});
  assert.equal(connecting.open,true);assert.notEqual(connecting.art,'startup');assert.equal(connecting.art,connecting.rootArt);
  await host.locator('#loading-screen').waitFor({state:'hidden'});await host.locator('#menu [data-action=play-custom]').waitFor({state:'visible'});await host.waitForTimeout(2200);
  assert.equal(await host.evaluate(()=>window.__yolkTest.read().screen),'menu','cancel cannot later enter a room');
  await host.locator('#menu [data-action=play-custom]').click();await host.locator('#setup-mode').selectOption('ffa');await host.locator('#setup-bots').selectOption('2');await host.locator('[data-action=create-room]').click();
  await host.locator('#lobby [data-action=start-match]').waitFor({state:'visible'});const code=(await host.locator('#lobby .room-code').innerText()).replace(/[^A-Z2-9]/g,'');
  const guest=await page('Loading Wing');await guest.locator('#loading-screen').waitFor({state:'hidden'});await guest.locator('#menu [data-action=play-custom]').click();await guest.locator('[data-action=join]').click();await guest.locator('#join-code').fill(code);await guest.locator('[data-action=join-room]').click();
  await guest.locator('dialog[data-kind=connecting] .ravel-loading').waitFor({state:'attached'});
  const connected=await guest.locator('#loading-screen .ravel-loading').getAttribute('data-loading-art');assert.notEqual(connected,'startup');assert.equal(await guest.locator('dialog[data-kind=connecting] .ravel-loading').getAttribute('data-loading-art'),connected);
  await guest.locator('#lobby .room-code').waitFor({state:'visible'});await host.locator('[data-action=start-match]').click();
  for(const p of [host,guest]){await p.waitForFunction(()=>window.__yolkTest.read().screen==='game');await p.locator('#loading-screen [data-loading-kind=enter]').waitFor({state:'attached'});assert.notEqual(await p.locator('#loading-screen .ravel-loading').getAttribute('data-loading-art'),'startup');await p.locator('#loading-screen').waitFor({state:'hidden'});}
  const before=await guest.locator('#loading-screen .ravel-loading').getAttribute('data-loading-art');await guest.keyboard.press('Escape');await guest.locator('dialog [data-action=leave-confirm]').click();
  await guest.locator('#loading-screen [data-loading-kind=exit]').waitFor({state:'attached'});const returning=await guest.locator('#loading-screen .ravel-loading').getAttribute('data-loading-art');assert.notEqual(returning,before);assert.equal(await guest.locator('#loading-screen .load-context').textContent(),'RETURNING TO LOBBY');await guest.locator('#loading-screen').waitFor({state:'hidden'});
  assert.equal(await guest.evaluate(()=>window.__yolkTest.read().screen),'menu');assert.equal(await host.evaluate(()=>window.__yolkTest.read().screen),'game');
  await host.keyboard.press('Escape');await host.locator('dialog [data-action=leave-confirm]').click();await host.locator('#loading-screen').waitFor({state:'hidden'});
 }else{
  const version=await host.evaluate(async()=>fetch('./version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()));assert.equal(version.appVersion,'4.2.1');assert.equal(String(version.release),'122');if(process.env.GITHUB_SHA)assert.equal(version.build,process.env.GITHUB_SHA);metrics.version=version;
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/metrics.json',JSON.stringify(metrics,null,2));console.log('PASS Loading art: startup, four decoded match assets, readable live overlays, '+(live?'production version and lobby':'cancel recovery, host/guest entry and both lobby returns')+'; '+JSON.stringify(metrics));
}catch(error){for(const p of pages)if(!p.isClosed()){console.log('FAIL UI',(await p.locator('body').innerText()).slice(-1600));await shot(p,'failure').catch(()=>{});}throw error;}
finally{await browser?.close();await vite?.close();await app?.close();if(temp)await rm(temp,{recursive:true,force:true});}
