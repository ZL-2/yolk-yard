import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fixture} from '../tests/helpers/public-match.js';
import {grantJimStyle,jimStyleRecord} from '../server/realtime/jim-style.js';
const origin='http://127.0.0.1:5299',out='test-results/jim-release';await mkdir(out,{recursive:true});
const f=await fixture({serverOptions:{origins:[origin],tournamentOptions:{now:()=>Date.parse('2026-10-28T18:00Z'),autoStart:false}}});
const target='http://127.0.0.1:'+f.app.server.address().port;
const vite=await createServer({server:{host:'127.0.0.1',port:5299,strictPort:true,proxy:{'^/(game|social|health|leaderboards|tournament|icon-voting)(/|$|\\?)':{target,ws:true}}}});await vite.listen();await vite.watcher.close();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:.8}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.stack||e.message));
try{
 await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.YOLK_NETWORK={relay:"ws://127.0.0.1:5299/game"};'}));
 await page.addInitScript(()=>{if(!localStorage.getItem('jim-fixture')){localStorage.setItem('jim-fixture','yes');localStorage.setItem('yolk-profile',JSON.stringify({name:'Jim Review',outfit:'outfit-scout',weapon:'sprinter'}));localStorage.setItem('yolk-egg-shop-v1',JSON.stringify({version:1,balance:10000,earned:10000,owned:['outfit-scout'],receipts:[]}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:30}));}});
 await page.goto(origin+'/?qa');await page.locator('.midseason-briefing[open]').waitFor();await page.screenshot({path:out+'/promo.png'});await page.locator('.midseason-hide').check();await page.locator('.midseason-shop').click();await page.locator('[data-shop-back]').click();await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);assert.equal(await page.locator('.icon-voting[open]').count(),0);
 await page.locator('.yard-nav nav [data-action="item-shop"]').click();await page.locator('[data-shop-item="bundle-jim-icon"]').first().click();await page.locator('[data-shop-style="outfit-jim-golf"]').click();await page.screenshot({path:out+'/golf-preview-locked.png'});
 await page.locator('[data-shop-confirm]').click();await page.locator('[data-shop-buy="bundle-jim-icon"]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yolk-egg-shop-v1')).owned.includes('outfit-jim-normal'));
 const w=await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-egg-shop-v1')));assert.equal(w.balance,7000);assert.ok(!w.owned.includes('outfit-jim-golf'));assert.equal(await page.locator('[data-shop-equip-set]').isDisabled(),true);
 await page.locator('[data-shop-style="outfit-jim-normal"]').click();await page.locator('[data-shop-equip-set]').click();await page.locator('[data-shop-back]').click();await page.locator('.yard-nav nav [data-action="lobby-home"]').click();
 await page.waitForFunction(()=>window.__yolkTest.loadingFixture(v=>v.menuEgg?.userData.human?.asset?.id==='jim-normal'));
 const mesh=await page.evaluate(()=>window.__yolkTest.loadingFixture(v=>({groups:v.menuEgg.userData.human.mesh.geometry.groups.length,textures:[].concat(v.menuEgg.userData.human.mesh.material).every(m=>!!m.map)})));assert.equal(mesh.groups,5);assert.ok(mesh.textures);await page.screenshot({path:out+'/jim-lobby.png'});
 const id=await page.evaluate(()=>window.__yolkTest.party().id);assert.equal(grantJimStyle(f.app.relay,id,{won:true,outfit:'outfit-jim-normal'}),true);
 await page.locator('.jim-reward-dialog[open]').waitFor();await page.screenshot({path:out+'/golf-unlocked.png'});await page.locator('[data-jim-equip]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yolk-profile')).outfit==='outfit-jim-golf');
 await page.waitForFunction(()=>window.__yolkTest.loadingFixture(v=>v.menuEgg?.userData.human?.asset?.id==='jim-golf'));
 assert.equal(jimStyleRecord(f.app.relay,id).unlocked,true);
 await page.reload();await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);await page.waitForFunction(()=>document.querySelector('#loading')?.hidden!==false);assert.equal(await page.locator('.midseason-briefing[open]').count(),0);assert.equal(await page.locator('.jim-reward-dialog[open]').count(),0);assert.equal(jimStyleRecord(f.app.relay,id).pending,false);assert.deepEqual(errors,[]);
 await writeFile(out+'/summary.json',JSON.stringify({checks:['startup promo and saved dismissal','voting removed','bundle exact price','Golf not granted by purchase','approved textured Jim production model','verified unlock popup','equip Golf','reconnect ownership and acknowledgement'],errors},null,2));console.log('Jim release browser acceptance passed');
}catch(error){console.error(errors);console.error(await page.locator('body').innerText());await page.screenshot({path:out+'/failure.png'});throw error;}finally{await browser.close();await vite.close();await f.close();}
