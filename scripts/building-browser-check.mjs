import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const vite=await createServer({server:{host:'127.0.0.1',port:5183,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:.4}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER',e.message);});page.setDefaultTimeout(45000);await mkdir('test-results',{recursive:true});
let activePage=page;
try{
 if(!process.argv.includes('--mobile-only')){
 await page.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 await page.goto(process.env.YOLK_TEST_URL||'http://127.0.0.1:5183/?qa=1',{waitUntil:'domcontentloaded'});console.log('Browser loaded');await page.locator('[data-action="play"]').click();await page.locator('[data-action="play-royale"]').click();await page.locator('[data-action="play-local"]').click();console.log('Starting Royale');await page.locator('[data-action="confirm-local"]').click();await page.waitForFunction(()=>window.__yolkTest?.read().state?.royale);
 console.log('Royale ready');await page.evaluate(()=>{window.__yolkTest.fixture(s=>{s.botInput=p=>({yaw:p.yaw,slot:p.slot});for(const p of s.players.values())if(p.bot){p.flight='ground';p.x=200;p.y=0;p.z=200;}});window.__yolkTest.pose({x:72,y:0,z:0,yaw:0,pitch:0,flight:'ground',grounded:true,slot:5,materials:{wood:100,brick:100,metal:100}});});
 if(await page.locator('[data-action="resume"]').isVisible())await page.locator('[data-action="resume"]').click();
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>document.querySelectorAll('#royale-hotbar .royale-slot').length===6);await page.keyboard.press('KeyZ');await page.locator('#world').dispatchEvent('mousedown',{button:0});await page.evaluate(()=>window.__yolkTest.pose({yaw:0,pitch:0}));await page.waitForFunction(()=>window.__yolkTest.read().state.royale.builds.length>0);await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mouseup',{button:0})));await page.evaluate(()=>window.__yolkTest.pose({yaw:0,pitch:0}));await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').yaw===0);
 assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.royale.builds[0].type),'wall');await page.screenshot({path:'test-results/building-wall.png'});console.log('Wall placed');
 await page.keyboard.press('KeyJ');await page.locator('.build-edit').waitFor({state:'visible'});
 // Selections use the actual game crosshair, with a held input across several frames.
 const aim=async y=>page.evaluate(y=>{const q=window.__yolkTest.read(),p=q.state.players.find(p=>p.id===q.localId),b=q.state.royale.builds[0];window.__yolkTest.pose({yaw:0,pitch:Math.atan2(y-(p.y+1.43),Math.abs(b.z-p.z))});},y);
 const selectDown=()=>page.locator('#world').dispatchEvent('mousedown',{button:0});
 const selectUp=()=>page.evaluate(()=>document.dispatchEvent(new MouseEvent('mouseup',{button:0})));
 await aim(.65);await selectDown();await page.waitForFunction(()=>window.__yolkTest.read().building.editDraft.mask===2);await selectUp();
 await page.keyboard.press('KeyJ');assert.ok(await page.locator('.edit-status').innerText()==='INVALID SELECTION');assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.royale.builds[0].mask),0);
 await page.locator('#world').dispatchEvent('mousedown',{button:2});await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mouseup',{button:2})));
 await aim(2);await selectDown();await page.waitForFunction(()=>window.__yolkTest.read().building.editDraft.mask===16);await page.screenshot({path:'test-results/building-world-grid.png'});await selectUp();await page.keyboard.press('KeyJ');await page.waitForFunction(()=>window.__yolkTest.read().state.royale.builds[0].mask===16);
 await page.keyboard.press('KeyJ');await page.locator('.build-edit').waitFor({state:'visible'});
 await page.locator('#world').dispatchEvent('mousedown',{button:2});await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mouseup',{button:2})));await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.royale.builds[0].mask),16);
 if(await page.locator('[data-action="resume"]').isVisible())await page.locator('[data-action="resume"]').click();
 await aim(2);await page.keyboard.press('KeyJ');await page.locator('.build-edit').waitFor({state:'visible'});
 await aim(.65);await selectDown();await page.waitForFunction(()=>window.__yolkTest.read().building.editDraft.mask===18);await selectUp();await page.keyboard.press('KeyJ');await page.waitForFunction(()=>window.__yolkTest.read().state.royale.builds[0].mask===18);
 await page.screenshot({path:'test-results/building-door.png'});
 await page.keyboard.press('KeyP');await page.keyboard.press('KeyI');assert.equal(await page.locator('.royale-inventory-grid .royale-slot').count(),6);assert.equal(await page.locator('[data-action="royale-drop"]').last().isDisabled(),true);await page.screenshot({path:'test-results/building-inventory.png'});
 }
 await page.close();
 const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:.4,isMobile:true,hasTouch:true});activePage=phone;phone.setDefaultTimeout(60000);phone.on('pageerror',e=>errors.push(e.message));await phone.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));await phone.goto('http://127.0.0.1:5183/?qa=1',{waitUntil:'domcontentloaded'});await phone.locator('[data-action="play"]').click();await phone.locator('[data-action="play-royale"]').click();await phone.locator('[data-action="play-local"]').click();await phone.locator('[data-action="confirm-local"]').click();await phone.waitForFunction(()=>window.__yolkTest?.read().state?.royale);await phone.evaluate(()=>window.__yolkTest.pose({x:72,y:0,z:0,yaw:0,pitch:0,flight:'ground',grounded:true,slot:5,materials:{wood:100,brick:100,metal:100}}));await phone.locator('[data-piece="stairs"]').tap();await phone.locator('.build-help').waitFor({state:'visible'});await phone.screenshot({path:'test-results/building-mobile.png'});const rects=await phone.locator('.build-hud,.touch-buttons,.royale-hotbar,.royale-tools').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {name:n.className,x:r.x,y:r.y,w:r.width,h:r.height};}));for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`${a.name} overlaps ${b.name}`);}
 assert.deepEqual(errors,[]);console.log(process.argv.includes('--mobile-only')?'PASS mobile build controls, viewport layout and no browser errors':'PASS crosshair world grid, invalid selection, window confirm, cancel preservation, door confirm, six-slot inventory, mobile layout, no browser errors');
}catch(e){console.error(e.stack);console.log(await activePage.locator('body').innerText());await activePage.screenshot({path:'test-results/building-failure.png'});throw e;}finally{await browser.close();await vite.close();}
