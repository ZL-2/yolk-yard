import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import {fixture} from '../tests/helpers/public-match.js';
const out='test-results/community-gameplay',origin='http://127.0.0.1:5297';await mkdir(out,{recursive:true});
const f=await fixture({serverOptions:{origins:[origin,'https://zl-2.github.io']}}),target='http://127.0.0.1:'+f.app.server.address().port;
const recipient=await f.user('Gift Receiver'),creator=await f.user('ballz');
const code=f.app.relay.parties.store.identities.get(recipient.id).code;
const vite=await createServer({server:{host:'127.0.0.1',port:5297,strictPort:true,proxy:{'^/(game|social|health|leaderboards|tournament|icon-voting)(/|$|\\?)':{target,ws:true}}}});await vite.listen();await vite.watcher.close();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:.6});page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.YOLK_NETWORK={relay:"ws://127.0.0.1:5297/game"};'}));
await page.addInitScript(()=>{localStorage.setItem('ravelfront-nightfall-237','seen');localStorage.setItem('yolk-profile',JSON.stringify({name:'Gift Sender'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,musicVolume:0,fpsLimit:30}));});
try{
 await page.goto(origin+'/?qa=1');await page.getByRole('button',{name:'Close community announcement'}).click();await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);
 const sender=await page.evaluate(()=>window.__yolkTest.party().id);f.app.relay.economy.credit(sender,'browser-gift-funds',5000,'grant',Date.now());f.app.relay.economy.publish(sender);
 await page.locator('.yard-nav nav [data-action=item-shop]').click();await page.locator('[data-shop-item=bundle-jim-icon]').first().click();await page.locator('[data-shop-gift-start]').click();await page.locator('.shop-gift-code').fill(code);await page.locator('[data-shop-gift-quote]').click();await page.locator('[data-shop-gift-send]').waitFor();assert.match(await page.locator('.shop-gift').innerText(),/Gift Receiver/);await page.screenshot({path:out+'/gift-confirm.png'});await page.locator('[data-shop-gift-send]').click();await page.waitForFunction(()=>document.querySelector('.shop-detail-notice')?.textContent.includes('Gift delivered'));
 assert.ok(f.app.relay.economy.view(recipient.id).owned.includes('outfit-jim-normal'));assert.equal(f.app.relay.economy.view(creator.id).balance,450);assert.equal(f.app.relay.economy.view(sender).balance,2300);await page.screenshot({path:out+'/gift-delivered.png'});
 const record=f.app.relay.economy.view(recipient.id);assert.match(record.notifications[0].data.reason,/Gift Sender/);
 assert.deepEqual(errors,[]);console.log('PASS real gift UI, recipient confirmation, atomic debit, delivery and creator earnings');
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();await vite.close();await f.close();}
