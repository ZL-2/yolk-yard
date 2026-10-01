import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {VERSION} from '../src/data.js';
import {RELEASE_NOTES} from '../src/releases.js';

const front='https://zl-2.github.io/yolk-yard',relay='https://yolk-yard-relay.onrender.com';
const expected=process.env.GITHUB_SHA||process.env.RAVEL_VERIFY_BUILD;
const appVersion=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
assert.ok(expected,'Expected published build is required');
const json=async url=>{const endpoint=url.startsWith(front)?url+'?verify='+Date.now():url;const r=await fetch(endpoint,{signal:AbortSignal.timeout(20000),cache:'no-store'});assert.ok(r.ok,url+' '+r.status);return r.json();};
let version,health;const deadline=Date.now()+480000;
while(true){
 try{[version,health]=await Promise.all([json(front+'/version.json'),json(relay+'/health')]);if(version.build===expected&&version.appVersion===appVersion&&health.build===expected&&health.gameVersion===VERSION&&health.deployment?.updating===false&&health.socialAvailable)break;}catch(e){console.log('Waiting for publishing:',e.message);}
 assert.ok(Date.now()<deadline,'Game and relay did not publish the same ready version');await new Promise(r=>setTimeout(r,10000));
}
assert.equal(health.maintenance,false);
const history=await json(front+'/release-history.json');assert.equal(history.build,expected);assert.equal(history.releases[0].title,RELEASE_NOTES[0].title);assert.deepEqual(history.releases[0].changes,RELEASE_NOTES[0].changes);
await mkdir('test-results/menu-hub-live',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(front+'/?build='+expected);await page.waitForSelector('.yard-nav');assert.ok((await page.locator('body').innerText()).length>100);
 if(await page.locator('.welcome-close').isVisible()){await page.locator('.welcome-close').click();if(await page.locator('[data-dismiss="forever"]').isVisible())await page.locator('[data-dismiss="forever"]').click();}
 await page.waitForFunction(()=>!document.querySelector('#deployment-screen'));
 const nav=action=>page.locator('.yard-nav nav [data-action="'+action+'"]');
 await nav('locker').click();await page.waitForSelector('.hub-locker');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('.locker-slots img').count(),6);
 await nav('item-shop').click();await page.waitForSelector('.hub-shop');assert.equal(await page.locator('dialog[open]').count(),0);assert.ok(await page.locator('[data-shop-item]').count()>0);
 await nav('career').click();await page.waitForSelector('.career-page');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('.career-stat').count(),6);assert.equal(await page.locator('.career-milestone').count(),6);assert.equal(await page.locator('.career-match').count(),0);assert.ok(await page.locator('.career-empty').isVisible());
 await page.screenshot({path:'test-results/menu-hub-live/career.png'});await page.locator('.hub-page').evaluate(e=>e.scrollTop=e.scrollHeight);await page.screenshot({path:'test-results/menu-hub-live/milestones.png'});
 await nav('lobby-home').click();await page.waitForSelector('.yard-play-card');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('#deployment-screen').count(),0);assert.deepEqual(errors,[]);
for(const action of ['locker','item-shop','career']){await nav(action).click();await page.setViewportSize({width:1024,height:600});const pane=page.locator('.hub-page'),box=await pane.boundingBox();assert.ok(await pane.evaluate(e=>e.scrollHeight>e.clientHeight),'Page must overflow for scroll test');assert.equal(await pane.evaluate(e=>getComputedStyle(e).pointerEvents),'auto');assert.equal(await pane.evaluate(e=>getComputedStyle(e).touchAction),'pan-y');await page.mouse.move(box.x+8,box.y+200);await page.mouse.wheel(0,500);await page.waitForFunction(()=>document.querySelector('.hub-page').scrollTop>0);await page.mouse.wheel(0,-500);await page.waitForFunction(()=>document.querySelector('.hub-page').scrollTop===0);}await nav('lobby-home').click();
 const result={appVersion,release:version.release,title:history.releases[0].title,build:expected,relayBuild:health.build,builtInSections:4,career:true,milestones:6,noMenuDialogs:true,published:true,verifiedLive:true};await writeFile('test-results/menu-hub-live/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
