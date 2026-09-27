import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://zl-2.github.io/yolk-yard/',out='test-results/quality53-live',checks=[],errors=[];
const ref=await fetch('https://api.github.com/repos/ZL-2/yolk-yard/git/ref/heads/main',{headers:{'User-Agent':'Yolk-Pages-verification'}}).then(r=>r.json());
assert.ok(ref.object?.sha,'Could not resolve deployed source revision');
const expected=process.env.YOLK_EXPECT_BUILD||ref.object.sha;
let version;for(let i=0;i<36;i++){version=await fetch(base+'version.json?verify='+Date.now(),{cache:'no-store'}).then(r=>r.json());if(version.build===expected&&version.release==='54')break;console.log('Waiting for Pages publication',version.release);await new Promise(resolve=>setTimeout(resolve,10000));}
assert.equal(version.build,expected);assert.equal(version.release,process.env.YOLK_EXPECT_RELEASE||'54');
const history=await fetch(base+'release-history.json?verify='+Date.now(),{cache:'no-store'}).then(r=>r.json());
assert.equal(history.releases[0].title,'Smooth Boarding');
await mkdir(out,{recursive:true});const pass=s=>{checks.push(s);console.log('PASS',s);};pass('Live version and release history match the published main commit and Quality Update 54');
const launch=()=>chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']}),pages=[],browsers=[];
async function make(name){const browser=await launch();browsers.push(browser);const ctx=await browser.newContext({viewport:{width:1100,height:700},deviceScaleFactor:.25});await ctx.addInitScript(name=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);this.addEventListener('close',e=>console.log('RELAY_CLOSE',name,e.code,e.reason));}};new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.duration>2000)console.log('LONG_TASK',name,Math.round(entry.duration));}).observe({entryTypes:['longtask']});localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);const p=await ctx.newPage();pages.push(p);p.setDefaultTimeout(120000);p.on('console',m=>{if(/^(RELAY_CLOSE|LONG_TASK)/.test(m.text()))console.log(m.text());});p.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await p.goto(base+'?verify='+Date.now());await p.locator('[data-action="play"]').waitFor();return p;}
async function enter(p){await p.waitForFunction(()=>!document.querySelector('#royale-hud')?.hidden||/Connection ended|Could not join/.test(document.querySelector('#dialog')?.textContent||''));assert.ok(await p.locator('#royale-hud').isVisible(),await p.locator('#dialog').innerText());if(await p.locator('#dialog [data-action="resume"]').isVisible())await p.locator('#dialog [data-action="resume"]').click();}
try{
 const shop=await make('Release Shop');assert.equal(await shop.evaluate(()=>typeof window.__yolkTest),'undefined');
 assert.ok((await shop.locator('[data-action="updates"]').innerText()).includes(version.release));assert.match(await shop.locator('.account-eggs').innerText(),/Eggs:\s*300/);
 await shop.locator('[data-action="updates"]').click();assert.match(await shop.locator('.release-note').first().innerText(),/Smooth Boarding/);await shop.locator('#dialog [data-action="close"]').click();
 await shop.getByRole('button',{name:'Egg Shop',exact:true}).click();assert.match(await shop.locator('#egg-shop').innerText(),/SHELL MARKET/);
 await shop.locator('[data-shop-tab="locker"]').click();assert.equal(await shop.locator('.locker-slots img').count(),6);assert.ok(await shop.locator('.locker-slots img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth===320)));
 await shop.screenshot({path:out+'/locker.png'});await shop.locator('#dialog [data-action="close"]').click();pass('Published Shell Market, actual Locker images, compact Eggs and changelog render without development hooks');

 await shop.context().browser().close();const host=await make('Release Host');
 const guest=await make('Release Guest');await guest.locator('[data-action="play"]').click();await guest.locator('[data-action="join"]').click();
 await host.locator('[data-action="play"]').click();await host.locator('[data-action="play-royale"]').click();await host.locator('[data-action="play-custom"]').click();
 await host.locator('#setup-visibility').selectOption('private');await host.locator('#setup-capacity').selectOption('4');await host.locator('#setup-bots').selectOption('2');await host.locator('#setup-fill').selectOption('off');await host.locator('[data-action="create-room"]').click();await enter(host);
 await host.waitForFunction(()=>document.body.classList.contains('in-spawn-island'));
 const code=(await host.locator('#hud-network').innerText()).split('·').at(-1).trim();assert.match(code,/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
 await guest.locator('#join-code').fill(code);await guest.locator('[data-action="join-room"]').click();await enter(guest);
 await guest.waitForFunction(()=>document.body.classList.contains('in-spawn-island'));
 assert.match(await guest.locator('#royale-flight-title').innerText(),/4\/4/);assert.match(await guest.locator('#royale-hotbar .royale-slot').first().innerText(),/Pickaxe/);
 await guest.keyboard.down('KeyW');await guest.waitForTimeout(400);await guest.keyboard.up('KeyW');await guest.screenshot({path:out+'/guest-spawn-island.png',timeout:10000}).catch(()=>console.log('Spawn Island screenshot unavailable on software GPU'));pass('Live private relay room admits a guest to playable Spawn Island beside the host and two bots');
 await guest.waitForFunction(()=>!document.body.classList.contains('in-spawn-island')&&document.querySelector('#hud-map')?.textContent==='Sunnybreak Island',null,{timeout:180000});
 assert.equal(await guest.locator('#royale-hotbar .royale-slot').filter({hasText:'Empty'}).count(),5);pass('Real countdown transfers host and non-host to Sunnybreak with a clean first-slot pickaxe loadout');
 await guest.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent.includes('Choose your landing spot'));
 const locked=await guest.evaluate(()=>!!document.pointerLockElement);await guest.keyboard.press('KeyL');assert.equal(await guest.locator('#royale-flight').isVisible(),false);assert.equal(await guest.evaluate(()=>!!document.pointerLockElement),locked);
 await guest.keyboard.down('Space');await guest.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent==='Freefall');await guest.keyboard.up('Space');await guest.waitForTimeout(250);await guest.keyboard.down('Space');await guest.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent==='Shell glider deployed');await guest.keyboard.up('Space');
 pass('Non-host flight-tip dismissal preserves mouse lock and real Bus exit/glider controls');
 const late=await make('Release Observer');await late.locator('[data-action="play"]').click();await late.locator('[data-action="join"]').click();await late.locator('#join-code').fill(code);await late.locator('[data-action="join-room"]').click();await enter(late);
 await late.locator('#spectate-panel').waitFor();assert.equal(await late.locator('[data-action="rejoin"]').isVisible(),false);assert.equal(await late.locator('#spawn-button').isVisible(),false);assert.equal(await late.evaluate(()=>document.body.classList.contains('in-spawn-island')),false);
 await late.locator('[data-action="spectate-next"]').click();pass('A late live guest is spectator-only and can switch living targets without a spawn/rejoin option');
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({version,expected,checks,errors},null,2));
}catch(error){console.error(error);for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:out+'/failure-'+i+'.png',timeout:5000}).catch(()=>{});throw error;}
finally{await Promise.all(browsers.map(b=>b.close()));}
