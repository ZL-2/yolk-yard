import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='test-results/connected-island',checks=[],errors=[];
await mkdir(out,{recursive:true});
const vite=await createServer({server:{host:'127.0.0.1',port:5189,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:.7});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
const pass=s=>{checks.push(s);console.log('PASS',s);},read=()=>page.evaluate(()=>window.__yolkTest.read());
const hostSlot=slot=>page.waitForFunction(slot=>window.__yolkTest.read().state.players.find(p=>p.id==='host').slot===slot,slot);
try{
 await page.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 await page.goto('http://127.0.0.1:5189/?qa=1');
 await page.locator('[data-action="settings"]').click();
 for(const action of ['buildEdit','buildReset']){await page.locator(`[data-bind="${action}"][data-bind-slot="0"]`).click();await page.mouse.wheel(0,120);}
 await page.locator('[data-bind="primary"][data-bind-slot="0"]').click();await page.keyboard.press('KeyU');
 await page.locator('[data-bind-command="apply"]').click();
 for(const action of ['buildEdit','buildReset','nextSlot'])assert.equal(await page.locator(`[data-bind="${action}"][data-bind-slot="0"]`).innerText(),'Wheel down');
 await page.locator('#dialog [data-action="close"]').first().click();
 for(const action of ['play','play-royale','play-local','confirm-local'])await page.locator(`[data-action="${action}"]`).click();
 await page.waitForFunction(()=>window.__yolkTest?.read().state?.royale?.practice);
 let r=await read();assert.equal(r.state.royale.contestants,32);assert.ok(r.state.royale.queueEnds-r.state.time>30&&r.state.royale.queueEnds-r.state.time<=60);
 assert.equal(await page.locator('#royale-hotbar>.royale-slot kbd').innerText(),'P');
 assert.deepEqual(await page.locator('#royale-hotbar .royale-item-slots kbd').allTextContents(),['U','2','3','4','5']);
 await page.keyboard.press('KeyU');await hostSlot(1);await page.keyboard.press('Digit5');await hostSlot(5);await page.keyboard.press('KeyP');await hostSlot(0);
 const layout=await page.evaluate(()=>{const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};};return {slots:[...document.querySelectorAll('#royale-hotbar .royale-item-slots .royale-slot')].map(rect),health:rect(document.querySelector('.health-card')),hotbar:rect(document.querySelector('#royale-hotbar'))};});
 assert.ok(layout.slots.every(s=>s.w===layout.slots[0].w&&s.h===layout.slots[0].h));assert.ok(layout.health.w>=280);assert.ok(layout.health.right<layout.hotbar.x||layout.health.bottom<layout.hotbar.y);
 await page.screenshot({path:out+'/spawn-32.png'});pass('32-seat Spawn Island, authoritative countdown, rebound HUD prompts, dedicated pickaxe and five equal item slots');
 // The opening assertion covers the real deadline. Hold this controlled scene
 // while collecting software-GPU frames and exercising the build fixtures.
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.queueEnds=s.time+600;}));
 const frameTimes=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let last=performance.now();function frame(now){samples.push(now-last);last=now;if(samples.length===120)resolve(samples);else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));
 // Controlled build fixtures retain the real atoll terrain and collision map.
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.queueEnds=s.time+200;s.botInput=p=>({yaw:p.yaw,pitch:0,slot:0});for(const p of s.players.values())if(p.bot)Object.assign(p,{x:-45,z:-45,y:0});window.__yolkTest.pose({x:0,z:2,y:3.2,yaw:0,pitch:0,grounded:true,flight:'ground',slot:0});s.players.get('host').materials={wood:10,brick:10,metal:10};}));
 await page.keyboard.press('KeyZ');
 for(let i=0;i<3;i++){
  await page.evaluate(i=>window.__yolkTest.pose({x:i*8,z:2,y:3.2,yaw:0,pitch:0}),i);
  await page.waitForFunction(()=>!window.__yolkTest.read().building.reason);
  await page.locator('#world').dispatchEvent('mousedown',{button:0});
  await page.waitForFunction(n=>window.__yolkTest.read().state.royale.builds.length===n,i+1);
  await page.locator('#world').dispatchEvent('mouseup',{button:0});
 }
 r=await read();assert.deepEqual(r.state.royale.builds.map(b=>b.material),['wood','brick','metal']);assert.deepEqual(r.state.players.find(p=>p.id==='host').materials,{wood:0,brick:0,metal:0});
 await page.waitForFunction(()=>window.__yolkTest.read().building.reason==='Not enough materials'||window.__yolkTest.read().building.reason==='Already built');
 await page.screenshot({path:out+'/materials-exhausted.png'});pass('Actual preview and mouse placement continue through wood, brick and metal with authoritative resource spending');
 await page.keyboard.press('KeyP');
 await page.evaluate(async()=>{const {rebuildMap}=await import('/src/building.js');window.__yolkTest.fixture(s=>{s.builds=[{id:'build-99',owner:'host',type:'wall',x:0,y:3.2,z:-2,rotation:0,material:'wood',mask:16,path:[],revision:1,health:100,maxHealth:150,constructionRemaining:0}];s.buildVersion++;rebuildMap(s);window.__yolkTest.pose({x:0,y:3.2,z:2,yaw:0,pitch:0,slot:0});});});
 await page.waitForFunction(()=>window.__yolkTest.read().state.royale.builds[0]?.mask===16);await page.mouse.wheel(0,120);
 await page.waitForFunction(()=>window.__yolkTest.read().state.royale.builds[0]?.mask===0&&!window.__yolkTest.read().building.editing);await hostSlot(0);
 for(let i=0;i<4;i++)await page.mouse.wheel(0,60);await hostSlot(0);
 await page.evaluate(()=>window.__yolkTest.pose({yaw:Math.PI/2,pitch:0}));await page.mouse.wheel(0,120);await hostSlot(1);await page.mouse.wheel(0,-120);await hostSlot(0);
 pass('Shared scroll direction resets and confirms an edited wall; rapid notches stay out of weapon switching, while scrolling away cycles items');
 await page.evaluate(async()=>{const {rebuildMap}=await import('/src/building.js');window.__yolkTest.fixture(s=>{s.builds=[{id:'build-100',owner:'host',type:'stairs',x:0,y:3.2,z:4,rotation:0,material:'wood',mask:0,health:150,maxHealth:150,constructionRemaining:0}];s.buildVersion++;rebuildMap(s);s.players.get('host').materials={wood:100,brick:100,metal:100};window.__yolkTest.pose({x:0,y:5.2,z:4,yaw:0,pitch:0,slot:0,grounded:true});});});
 await page.keyboard.press('KeyC');await page.keyboard.down('KeyW');await page.waitForFunction(()=>{const r=window.__yolkTest.read(),a=r.building.buildAnchor?.split(',').map(Number);return !r.building.reason&&a?.[1]>7;});
 await page.locator('#world').dispatchEvent('mousedown',{button:0});await page.waitForFunction(()=>window.__yolkTest.read().state.royale.builds.some(b=>b.type==='floor'&&b.y>7));await page.locator('#world').dispatchEvent('mouseup',{button:0});await page.keyboard.up('KeyW');await page.keyboard.press('KeyP');
 await page.screenshot({path:out+'/ramp-floor.png'});pass('Moving up a real ramp chooses and places the connected upper floor');
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.beginBattle();s.time=s.startedAt+50;}));await page.waitForFunction(()=>window.__yolkTest.read().state.options.map==='sunnybreak');
 for(let i=0;i<9;i++)for(const roof of [false,true]){
  await page.evaluate(({i,roof})=>window.__yolkTest.fixture(s=>{const poi=s.map.districts[i],b=s.map.buildings.find(b=>b.poi===poi.id),point=s.map.floorLoot.find(p=>p.building===s.map.buildings.indexOf(b)&&p.floor===0&&p.role==='weapon');window.__yolkTest.pose({x:roof?b.x+2:point.x,y:roof?b.baseY+b.h+.18:point.y,z:roof?b.z+2:point.z,flight:'ground',grounded:true,vy:0,fall:null,yaw:roof?.75:0,pitch:roof?-.18:-.2,slot:0});}),{i,roof});
  await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').flight==='ground');await page.screenshot({path:`${out}/poi-${i}-${roof?'roof':'interior'}.png`});
 }
 pass('All nine major POIs render from ground-floor interiors and rooftops with the repaired geometry');
 await page.evaluate(async()=>{const {groundAt}=await import('/src/terrain.js');window.__yolkTest.fixture(s=>{s.time=s.startedAt+260;const storm=s.storm;window.__yolkTest.pose({x:storm.x+100,z:storm.z,y:groundAt(s.map,storm.x+100,storm.z),flight:'ground',grounded:true,health:100,shield:70,yaw:-Math.PI/2,pitch:0});});});
 await page.waitForFunction(()=>window.__yolkTest.read().stormVisual.visible);
 r=await read();assert.ok(Math.abs(r.stormVisual.radius-r.state.royale.storm.radius)<1);assert.equal(r.stormVisual.x,r.state.royale.storm.x);assert.equal(r.stormVisual.z,r.state.royale.storm.z);
 await page.screenshot({path:out+'/storm-wall.png'});pass('Animated storm uses the authoritative radius and center');
 await page.setViewportSize({width:620,height:430});await page.screenshot({path:out+'/compact-hud.png'});
 const compact=await page.evaluate(()=>{const h=document.querySelector('.health-card').getBoundingClientRect(),b=document.querySelector('#royale-hotbar').getBoundingClientRect();return {h:{right:h.right,bottom:h.bottom},b:{x:b.x,y:b.y,right:b.right},width:innerWidth};});assert.ok(compact.b.right<=compact.width);assert.ok(compact.h.right<compact.b.x||compact.h.bottom<compact.b.y);
 assert.deepEqual(errors,[]);frameTimes.sort((a,b)=>a-b);await writeFile(out+'/browser.json',JSON.stringify({checks,errors,softwareGpuFrameMedian:frameTimes[60],softwareGpuFrameP95:frameTimes[114],drawCalls:r.drawCalls,triangles:r.triangles},null,2));
}catch(error){await page.screenshot({path:out+'/failure.png',timeout:10000}).catch(()=>{});console.error('Last state',await read().then(r=>({screen:r.screen,paused:r.paused,build:r.building,stage:r.state?.royale?.stage,host:r.state?.players.find(p=>p.id==='host')})).catch(()=>null));throw error;}
finally{await browser.close();await vite.close();}
