import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import {fixture} from '../tests/helpers/public-match.js';
const origin='http://127.0.0.1:5298',out='test-results/economy';await mkdir(out,{recursive:true});
const f=await fixture({serverOptions:{origins:[origin]}}),target='http://127.0.0.1:'+f.app.server.address().port;
const vite=await createServer({server:{host:'127.0.0.1',port:5298,strictPort:true,proxy:{'^/(game|social|health|leaderboards|tournament|icon-voting)(/|$|\\?)':{target,ws:true}}}});await vite.listen();await vite.watcher.close();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:.6}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.YOLK_NETWORK={relay:"ws://127.0.0.1:5298/game"};'}));
 await page.addInitScript(()=>{if(!localStorage.getItem('economy-seed')){localStorage.setItem('economy-seed','yes');localStorage.setItem('yolk-profile',JSON.stringify({name:'Economy Reviewer',outfit:'outfit-scout',weapon:'sprinter'}));localStorage.setItem('yolk-egg-shop-v1',JSON.stringify({version:1,balance:999999999,earned:999999999,owned:['outfit-scout','outfit-jim-normal'],receipts:[]}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:30}));}});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);
 const id=await page.evaluate(()=>window.__yolkTest.party().id);let deadline=Date.now()+90000;while(!f.app.relay.economy.view(id).migrated){assert.ok(Date.now()<deadline,'wallet migration');await new Promise(r=>setTimeout(r,100));}
 assert.equal(f.app.relay.economy.view(id).balance,300);assert.ok(!f.app.relay.economy.view(id).owned.includes('outfit-jim-normal'));
 await page.locator('.midseason-briefing[open]').waitFor();await page.locator('.midseason-shop').click();await page.locator('[data-shop-back]').click();await page.locator('.yard-nav nav [data-action="item-shop"]').click();
 f.app.relay.economy.credit(id,'browser-test-grant',5000,'grant',Date.now());f.app.relay.economy.publish(id);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yolk-egg-shop-v1')).balance===5300);
 await page.locator('[data-shop-item="bundle-jim-icon"]').first().click();await page.locator('[data-shop-confirm]').click();await page.locator('[data-shop-buy="bundle-jim-icon"]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yolk-egg-shop-v1')).balance===2300);assert.ok(f.app.relay.economy.view(id).owned.includes('outfit-jim-normal'));
 await page.screenshot({path:out+'/server-purchase.png'});
 await page.evaluate(()=>{const w=JSON.parse(localStorage.getItem('yolk-egg-shop-v1'));w.balance=1e9;localStorage.setItem('yolk-egg-shop-v1',JSON.stringify(w));});
 await page.reload();await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yolk-egg-shop-v1')).balance===2300);
 const notice={title:'Official test notice',requiredRead:true,minimumReadMs:15000,sections:Array.from({length:6},(_,i)=>'Section '+(i+1)+': This section explains the account action, correction, suspension, Cup exclusion and appeal instructions. '.repeat(4)),message:'Read every section.'};f.app.relay.owner.match.notice(id,'economy-browser-notice',notice);f.app.relay.owner.match.sync(id);
 const dialog=page.locator('.owner-required-notice');await dialog.waitFor({state:'visible'});assert.equal(await dialog.locator('button').isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);
 await dialog.locator('.owner-required-copy').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await dialog.locator('input').check();await page.waitForFunction(()=>!document.querySelector('.owner-required-notice button').disabled);await page.screenshot({path:out+'/required-notice.png'});await dialog.locator('button').click();await dialog.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);console.log('PASS forged migration balance rejected, server purchase, reconnect correction and required notice acknowledgement');
}catch(error){await page.screenshot({path:out+'/failure.png'});console.error(await page.locator('body').innerText());throw error;}finally{await browser.close();await vite.close();await f.close();}
