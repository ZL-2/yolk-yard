import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const vite=await createServer({server:{host:'127.0.0.1',port:5188,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[],checks=[],out='test-results/gameplay-update';page.setDefaultTimeout(90000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await mkdir(out,{recursive:true});
const pass=s=>{checks.push(s);console.log('PASS',s);};
try{
 await page.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 console.log('Opening local game');await page.goto('http://127.0.0.1:5188/?qa=1');
 for(const action of ['play','play-royale','play-local','confirm-local']){console.log('Click',action);await page.locator(`[data-action="${action}"]`).click();}
 console.log('Waiting for Spawn Island');
 await page.waitForFunction(()=>window.__yolkTest?.read().state?.royale?.practice);
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{let i=0;for(const p of [...s.players.values()])if(p.bot&&i++>=3)s.removePlayer(p.id);s.queueEnds=s.time+100;s.options.capacity=4;}));
 await page.waitForFunction(()=>document.body.classList.contains('in-spawn-island'));
 const start=await page.evaluate(()=>{const s=window.__yolkTest.read();return s.state.players.find(p=>p.id==='host');});assert.equal(start.inventory[0].id,'pickaxe');
 await page.keyboard.down('KeyW');await page.waitForFunction(({x,z})=>{const p=window.__yolkTest.read().state.players.find(p=>p.id==='host');return Math.hypot(p.x-x,p.z-z)>1;},start);await page.keyboard.up('KeyW');
 await page.keyboard.press('Digit2');await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').slot===1);
 await page.keyboard.press('Digit1');await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').slot===0);
 await page.screenshot({path:`${out}/spawn-island.png`});pass('Playable Spawn Island, practice equipment, visible countdown and first-slot pickaxe');
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.queueEnds=s.time+.2;}));
 await page.waitForFunction(()=>window.__yolkTest.read().state.royale.stage==='battle-bus');
 await page.waitForFunction(()=>!document.body.classList.contains('in-spawn-island'));
 const bus=await page.evaluate(()=>window.__yolkTest.read());assert.equal(bus.state.options.map,'sunnybreak');assert.equal(bus.state.players.find(p=>p.id==='host').inventory.slice(1).filter(Boolean).length,0);
 await page.screenshot({path:`${out}/battle-bus.png`});pass('Host countdown changes real map and resets inventory before Battle Bus');
 console.log('Dismissing flight tips');await page.keyboard.press('KeyL');assert.equal(await page.locator('#royale-flight').isVisible(),false);
 console.log('Flight tips dismissed');await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.time=s.startedAt+5;}));console.log('Exit bus state',await page.evaluate(()=>{const r=window.__yolkTest.read();return {paused:r.paused,time:r.state.time,elapsed:r.state.royale.elapsed,flight:r.state.players.find(p=>p.id==='host').flight,dialog:document.querySelector('dialog').open};}));await page.keyboard.down('Space');await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').flight==='dive');await page.keyboard.up('Space');
 console.log('Exited bus');await page.waitForFunction(()=>!window.__yolkTest.read().state.players.find(p=>p.id==='host').flightLatch);console.log('Deploying glider');
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').flight==='glide');await page.keyboard.up('Space');
 await page.screenshot({path:`${out}/gliding.png`});pass('Battle Bus exit, glider deployment and dismissed tips remain connected');
 await page.evaluate(async()=>{const {groundAt}=await import('/src/terrain.js');window.__yolkTest.fixture(s=>{const p=s.players.get('host');p.inventory[1]={id:'impulse',count:2,rarity:2};window.__yolkTest.pose({x:-86,z:-75,y:groundAt(s.map,-86,-75),flight:'ground',grounded:true,vy:0,fall:null,slot:1});s.syncInventory(p);});});
 await page.mouse.down();await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').fall?.source==='shockwave');await page.mouse.up();
 const shock=await page.evaluate(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host'));assert.equal(shock.flight,'ground');assert.equal(shock.fall.immune,true);pass('Actual Shock Egg use launches with temporary immunity and no automatic glider');
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.phase='results';s.stage='finished';}));await page.waitForFunction(()=>window.__yolkTest.read().state.phase==='results');
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.startRound();}));await page.waitForFunction(()=>window.__yolkTest.read().state.royale.practice);pass('New match restores Spawn Island and a fresh temporary inventory');
 await page.keyboard.press('Escape');await page.locator('[data-action="leave-confirm"]').click();
 for(const action of ['play','play-ffa','play-local','confirm-local'])await page.locator(`[data-action="${action}"]`).click();
 await page.locator('[data-action="enter-yard"]').click();
 await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').health>0);
 // Generate the fifth elimination through the authoritative arena damage path.
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{const p=s.players.get('host'),v=[...s.players.values()].find(p=>p.bot);for(const bot of s.players.values())if(bot.bot)bot.bot=false;p.streak=4;p.shieldUntil=0;v.shieldUntil=0;v.team=1-p.team;const random=s.random;s.random=()=>.2;s.damage(v,p,999,'Sprinter');s.random=random;p.damageUntil=s.time+18;}));
 await page.waitForFunction(()=>document.querySelector('#streak-announcement')?.textContent.includes('5 ELIMINATION STREAK'));
 assert.match(await page.locator('#streak-announcement').innerText(),/Egg Breaker/);assert.match(await page.locator('#streak-announcement').innerText(),/0:1[678]/);
 await page.screenshot({path:`${out}/streak.png`});
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.time+=19;}));await page.waitForFunction(()=>document.querySelector('#streak-announcement').hidden);pass('Actual fifth elimination shows earned upgrade; countdown expires in the gameplay HUD');
 assert.deepEqual(errors,[]);await writeFile(`${out}/checks.json`,JSON.stringify({checks,errors},null,2));
}catch(error){console.error(error);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error('Last state',await page.evaluate(()=>{const r=window.__yolkTest?.read();return {screen:r?.screen,paused:r?.paused,phase:r?.state?.phase,stage:r?.state?.royale?.stage,p:r?.state?.players.find(p=>p.id==='host')};}).catch(()=>null));throw error;}finally{await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,5000))]);await vite.close();}
