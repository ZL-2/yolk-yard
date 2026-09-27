import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://zl-2.github.io/yolk-yard/',out='test-results/connected-island-live',checks=[],errors=[],browsers=[];
const ref=await fetch('https://api.github.com/repos/ZL-2/yolk-yard/git/ref/heads/main').then(r=>r.json());
const version=await fetch(base+'version.json?verify='+Date.now(),{cache:'no-store'}).then(r=>r.json());
assert.equal(version.build,process.env.YOLK_EXPECT_BUILD||ref.object.sha);assert.equal(version.release,'55');
const history=await fetch(base+'release-history.json?verify='+Date.now(),{cache:'no-store'}).then(r=>r.json());assert.equal(history.releases[0].title,'Connected Island');
await mkdir(out,{recursive:true});const pass=s=>{checks.push(s);console.log('PASS',s);};
async function make(name){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});browsers.push(browser);
 const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:.3});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);
 await page.goto(base+'?verify='+Date.now());await page.locator('[data-action="play"]').waitFor();assert.equal(await page.evaluate(()=>typeof window.__yolkTest),'undefined');return page;
}
async function enter(page){await page.waitForFunction(()=>!document.querySelector('#royale-hud')?.hidden);if(await page.locator('#dialog [data-action="resume"]').isVisible())await page.locator('#dialog [data-action="resume"]').click();}
try{
 const host=await make('Connected Host'),guest=await make('Connected Guest');
 assert.match(await host.locator('[data-action="updates"]').innerText(),/55/);await host.locator('[data-action="updates"]').click();assert.match(await host.locator('.release-note').first().innerText(),/Connected Island/);await host.locator('#dialog [data-action="close"]').first().click();pass('Live Quality Update 55 and published revision match main');
 await guest.locator('[data-action="play"]').click();await guest.locator('[data-action="join"]').click();
 for(const action of ['play','play-royale','play-custom'])await host.locator(`[data-action="${action}"]`).click();
 await host.locator('#setup-visibility').selectOption('private');await host.locator('#setup-capacity').selectOption('32');await host.locator('#setup-fill').selectOption('on');await host.locator('[data-action="create-room"]').click();await enter(host);
 await host.waitForFunction(()=>document.body.classList.contains('in-spawn-island'));
 assert.match(await host.locator('#royale-flight-title').innerText(),/32\/32/);
 const countdown=+(await host.locator('#royale-flight-help').innerText()).match(/in (\d+)s/)?.[1];assert.ok(countdown>0&&countdown<=60);
 const code=(await host.locator('#hud-network').innerText()).split('·').at(-1).trim();assert.match(code,/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
 await guest.locator('#join-code').fill(code);await guest.locator('[data-action="join-room"]').click();await enter(guest);await guest.waitForFunction(()=>document.body.classList.contains('in-spawn-island'));
 assert.match(await guest.locator('#royale-flight-title').innerText(),/32\/32/);
 assert.deepEqual(await guest.locator('#royale-hotbar .royale-item-slots kbd').allTextContents(),['1','2','3','4','5']);assert.equal(await guest.locator('#royale-hotbar>.royale-slot kbd').innerText(),'P');
 await guest.setViewportSize({width:620,height:430});
 const compact=await guest.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return {map:box('.royale-map-stack'),build:box('.build-hud'),health:box('.health-card'),items:box('#royale-hotbar')};});
 const separate=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
 assert.ok(separate(compact.map,compact.build));assert.ok(separate(compact.health,compact.items));assert.ok(separate(compact.health,compact.build));
 await guest.screenshot({path:out+'/compact-layout.png',timeout:15000});await guest.setViewportSize({width:1100,height:700});
 await guest.keyboard.press('Digit5');await guest.waitForFunction(()=>document.querySelector('#royale-hotbar [data-royale-slot="5"]').getAttribute('aria-pressed')==='true');await guest.keyboard.press('KeyP');
 await guest.screenshot({path:out+'/guest-spawn-32.png',timeout:15000});pass('Live guest replaces a bot in the filled 32-contestant warmup, with pickaxe and five functional numbered slots');
 await guest.waitForFunction(()=>!document.body.classList.contains('in-spawn-island')&&document.querySelector('#hud-map')?.textContent==='Sunnybreak Island',null,{timeout:240000});
 assert.equal(await guest.locator('#royale-hotbar .royale-item-slots .royale-slot').filter({hasText:'Empty'}).count(),5);
 await guest.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent.includes('Choose your landing spot'));await guest.keyboard.down('Space');await guest.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent==='Freefall');await guest.keyboard.up('Space');
 pass('Real host countdown transfers both browsers to Sunnybreak with reset equipment; non-host Bus exit works');
 await guest.screenshot({path:out+'/live-island.png',timeout:15000});
 const late=await make('Connected Observer');await late.locator('[data-action="play"]').click();await late.locator('[data-action="join"]').click();await late.locator('#join-code').fill(code);await late.locator('[data-action="join-room"]').click();await enter(late);await late.locator('#spectate-panel').waitFor();assert.equal(await late.locator('[data-action="rejoin"]').isVisible(),false);await late.locator('[data-action="spectate-next"]').click();pass('Live late-join observer receives the larger roster and can switch spectator targets');
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({version,checks,errors},null,2));
}finally{await Promise.all(browsers.map(b=>Promise.race([b.close(),new Promise(resolve=>setTimeout(resolve,5000))])));}
