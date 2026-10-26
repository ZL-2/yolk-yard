import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:5297',out='test-results/fair-play';await mkdir(out,{recursive:true});
const vite=await createServer({server:{host:'127.0.0.1',port:5297,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route(origin+'/fair-play-check',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><style>body{background:#102239;color:white;font:16px Arial}#menu{position:relative;height:950px;--lobby-left:250px;--lobby-right:270px;--lobby-gap:20px}dialog{width:700px;background:#172739;color:white}</style></head><body><div id="menu"><div data-tournament-slot></div></div><dialog id="dialog"><h2>Game menu</h2></dialog><script type="module">import '/src/lobby.css';import '/src/compete.css';import '/src/tournament.css';import {FairPlayRuntime} from '/src/fair-play.js';import {updateTournamentCard} from '/src/tournament-ui.js';import {TOURNAMENT} from '/src/tournament.js';window.eventData={...TOURNAMENT,phase:'finished',endedAt:Date.now(),standingsComplete:true,results:Array.from({length:48},(_,i)=>({identity:'player'+i,name:'Player '+(i+1),place:i+1,marks:i<3?1000:0,kills:0}))};window.paint=()=>updateTournamentCard(document,eventData,true,eventData.endedAt);paint();window.removals=0;window.fairPlay=new FairPlayRuntime({onRemoval:()=>window.removals++});window.ready=true;</script></body></html>`}));
 await page.goto(origin+'/fair-play-check');await page.waitForFunction(()=>window.ready);
 const pane=page.locator('.tournament-standings'),bar=page.locator('.tournament-board-scroll .frontier-scrollbar');await pane.waitFor();
 await pane.hover();await page.mouse.wheel(0,260);await page.waitForFunction(()=>document.querySelector('.tournament-standings').scrollTop>0);
 await bar.focus();await page.keyboard.press('End');assert.ok(await pane.evaluate(e=>Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop)<2));
 await page.keyboard.press('Home');assert.equal(await pane.evaluate(e=>e.scrollTop),0);
 const thumb=await bar.locator('i').boundingBox();assert.ok(thumb?.height>=24);await page.mouse.move(thumb.x+thumb.width/2,thumb.y+thumb.height/2);await page.mouse.down();await page.mouse.move(thumb.x+thumb.width/2,thumb.y+80,{steps:8});await page.mouse.up();assert.ok(await pane.evaluate(e=>e.scrollTop)>100);
 const before=await pane.evaluate(e=>e.scrollTop);await page.evaluate(()=>{for(let i=0;i<5;i++)paint();});assert.equal(await pane.evaluate(e=>e.scrollTop),before);assert.ok(await bar.locator('i').evaluate(e=>e.style.height));
 const now=Date.now();await page.evaluate(now=>fairPlay.set({identity:'fixture',serverNow:now,until:now+3600000,cups:[{id:'next',name:'Frontier Cup - Trios',opensAt:now+86400000}]}),now);
 await page.locator('.fair-play-notice').waitFor();assert.match(await page.locator('.fair-play-notice').innerText(),/60:00|59:59/);assert.equal(await page.evaluate(()=>removals),1);
 assert.equal(await page.evaluate(()=>{try{fairPlay.admission();return false;}catch{return true;}}),true);
 await page.evaluate(()=>document.querySelector('#dialog').showModal());await page.locator('.fair-play-dialog-notice').waitFor();assert.match(await page.locator('.fair-play-dialog-notice').innerText(),/Frontier Cup - Trios/);await page.screenshot({path:out+'/restriction.png'});
 await page.reload();await page.waitForFunction(()=>window.ready);assert.match(await page.locator('.fair-play-notice').innerText(),/All game modes suspended/);
 await page.evaluate(now=>fairPlay.set({identity:'fixture',serverNow:now+3600000,until:null,cups:[{id:'next',name:'Frontier Cup - Trios',opensAt:now+86400000}]}),now);
 assert.doesNotMatch(await page.locator('.fair-play-notice').innerText(),/All game modes suspended/);assert.match(await page.locator('.fair-play-notice').innerText(),/cannot enter/);assert.equal(await page.evaluate(()=>{try{fairPlay.admission();return true;}catch{return false;}}),true);assert.equal(await page.evaluate(()=>{try{fairPlay.admission('next');return false;}catch{return true;}}),true);
 await page.evaluate(now=>fairPlay.set({identity:'fixture',serverNow:now+3600001,until:null,cups:[]}),now);await page.locator('.fair-play-notice').waitFor({state:'hidden'});
 await page.setViewportSize({width:1024,height:768});await page.screenshot({path:out+'/cup-scroll.png'});assert.ok(await pane.evaluate(e=>e.scrollHeight>e.clientHeight));assert.deepEqual(errors,[]);
 await writeFile(out+'/result.json',JSON.stringify({passed:true,checks:['wheel','thumb-drag','keyboard','48-placements','stable-timer-update','removal','persistent-ban','reload','dialog-notice','hour-expiry','cup-exclusion','reversal'],errors},null,2));console.log('PASS Cup scrolling and persistent automatic teaming restrictions');
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();await vite.close();}
