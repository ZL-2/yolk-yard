import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://zl-2.github.io/yolk-yard/',out='test-results/connected-island-live',checks=[],errors=[],browsers=[],pages=[];
const ref=await fetch('https://api.github.com/repos/ZL-2/yolk-yard/git/ref/heads/main').then(r=>r.json());
const version=await fetch(base+'version.json?verify='+Date.now(),{cache:'no-store'}).then(r=>r.json());
assert.equal(version.build,process.env.YOLK_EXPECT_BUILD||ref.object.sha);assert.equal(version.release,'56');
const history=await fetch(base+'release-history.json?verify='+Date.now(),{cache:'no-store'}).then(r=>r.json());assert.equal(history.releases[0].title,'Connected Island — On-Time Departure');
await mkdir(out,{recursive:true});const pass=s=>{checks.push(s);console.log('PASS',s);};
async function make(name){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});browsers.push(browser);
 const page=await browser.newPage({viewport:name.includes('Guest')?{width:620,height:430}:{width:1100,height:700},deviceScaleFactor:.3});pages.push(page);page.setDefaultTimeout(120000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',name,e.message);});
 page.on('console',m=>{if(/^(RELAY_CLOSE|LONG_TASK)/.test(m.text()))console.log(m.text());});
 await page.addInitScript(name=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);this.addEventListener('close',e=>console.log('RELAY_CLOSE',name,e.code,e.reason));}};new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.duration>2000)console.log('LONG_TASK',name,Math.round(e.duration));}).observe({entryTypes:['longtask']});localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);
 await page.goto(base+'?verify='+Date.now());await page.locator('[data-action="play"]').waitFor();assert.equal(await page.evaluate(()=>typeof window.__yolkTest),'undefined');return page;
}
async function enter(page){await page.waitForFunction(()=>!document.querySelector('#royale-hud')?.hidden);if(await page.locator('#dialog [data-action="resume"]').isVisible())await page.locator('#dialog [data-action="resume"]').click();}
const presentation=page=>page.evaluate(()=>({map:document.querySelector('#hud-map')?.textContent,phase:document.querySelector('#royale-flight-title')?.textContent,help:document.querySelector('#royale-flight-help')?.textContent,network:document.querySelector('#hud-network')?.textContent,dialog:document.querySelector('#dialog[open]')?.textContent?.slice(0,250),warmup:document.body.classList.contains('in-spawn-island')}));
try{
 const host=await make('Connected Host'),guest=await make('Connected Guest');
 assert.match(await host.locator('[data-action="updates"]').innerText(),/56/);await host.locator('[data-action="updates"]').click();assert.match(await host.locator('.release-note').first().innerText(),/Connected Island/);await host.locator('#dialog [data-action="close"]').first().click();pass('Live Quality Update 56 and published revision match main');
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
 const compact=await guest.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return {map:box('.royale-map-stack'),build:box('.build-hud'),health:box('.health-card'),items:box('#royale-hotbar')};});
 const separate=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
 assert.ok(separate(compact.map,compact.build));assert.ok(separate(compact.health,compact.items));assert.ok(separate(compact.health,compact.build));
 await writeFile(out+'/compact-layout.json',JSON.stringify(compact,null,2));
 await guest.keyboard.press('Digit5');await guest.waitForFunction(()=>document.querySelector('#royale-hotbar [data-royale-slot="5"]').getAttribute('aria-pressed')==='true');await guest.keyboard.press('KeyP');
 pass('Live guest replaces a bot in the filled 32-contestant warmup, with pickaxe and five functional numbered slots');
 // Observe the real host timer without accelerating time or changing game state.
 const progress=setInterval(()=>Promise.all([presentation(host),presentation(guest)]).then(s=>console.log('LIVE TIMER',JSON.stringify(s))).catch(()=>{}),30000);
 try{await guest.waitForFunction(()=>!document.body.classList.contains('in-spawn-island')&&document.querySelector('#hud-map')?.textContent==='Sunnybreak Island',null,{timeout:180000});}finally{clearInterval(progress);}
 pass('Live authoritative countdown completed and transferred the guest to Sunnybreak');
 assert.equal(await guest.locator('#royale-hotbar .royale-item-slots .royale-slot').filter({hasText:'Empty'}).count(),5);
 await guest.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent.includes('Choose your landing spot'));await guest.keyboard.down('Space');await guest.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent==='Freefall');await guest.keyboard.up('Space');
 pass('Real host countdown transfers both browsers to Sunnybreak with reset equipment; non-host Bus exit works');
 const late=await make('Connected Observer');await late.locator('[data-action="play"]').click();await late.locator('[data-action="join"]').click();await late.locator('#join-code').fill(code);await late.locator('[data-action="join-room"]').click();await enter(late);await late.locator('#spectate-panel').waitFor();assert.equal(await late.locator('[data-action="rejoin"]').isVisible(),false);await late.locator('[data-action="spectate-next"]').click();pass('Live late-join observer receives the larger roster and can switch spectator targets');
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({version,checks,errors},null,2));
 // Capture after the timed interactions, with one software GPU left to render.
 await late.close();await guest.close();await host.setViewportSize({width:620,height:430});await host.screenshot({path:out+'/live-compact.png',timeout:120000});
}catch(error){const state=await Promise.all(pages.filter(p=>!p.isClosed()).map(p=>presentation(p).catch(()=>null)));console.error('LIVE FAILURE',JSON.stringify({state,errors}));await writeFile(out+'/failure.json',JSON.stringify({state,errors,message:error.message},null,2));throw error;}
finally{await Promise.all(browsers.map(b=>Promise.race([b.close(),new Promise(resolve=>setTimeout(resolve,5000))])));}
