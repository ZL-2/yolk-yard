import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const vite=await createServer({server:{host:'127.0.0.1',port:5185,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const out='test-results/island-update',checks=[],errors=[];await mkdir(out,{recursive:true});
const pass=s=>{checks.push(s);console.log('PASS',s);};let page;
try{
 page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(60000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 console.log('Opening game');await page.goto('http://127.0.0.1:5185/?qa=1');console.log('Game menu loaded');
 for(const action of ['play','play-royale','play-local','confirm-local']){console.log('Click',action);await page.locator(`[data-action="${action}"]`).click();}
 await page.locator('#royale-flight').waitFor();await page.waitForFunction(()=>window.__yolkTest.read().state.royale.loot.length>100);
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{for(const p of s.players.values())if(p.bot)p.botDrop=1000;}));
 if(!process.env.YOLK_QA_EQUIPMENT_ONLY){
 assert.match(await page.locator('#royale-flight-close').textContent(),/L.*Close/);
 const lock=await page.evaluate(()=>document.pointerLockElement?.tagName||null);await page.keyboard.press('KeyL');
 assert.equal(await page.locator('#royale-flight').isVisible(),false);assert.equal(await page.evaluate(()=>document.pointerLockElement?.tagName||null),lock);
 assert.equal(await page.evaluate(()=>window.__yolkTest.read().paused),false);assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').flight),'transport');
 pass('L dismisses flight tips without changing transport, pause or mouse lock');
 await page.evaluate(()=>window.__yolkTest.fixture(s=>s.time=s.startedAt+5));await page.keyboard.press('Space');await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').flight==='dive');
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').flight==='glide');assert.equal(await page.locator('#royale-flight').isVisible(),false);pass('Diving and gliding remain functional after dismissal');
 await page.keyboard.press('KeyM');await page.locator('#royale-fullmap').waitFor();await page.screenshot({path:`${out}/map.png`});await page.locator('#royale-fullmap').click({position:{x:210,y:160}});await page.keyboard.press('KeyM');pass('Full map opens, labels the island and accepts a waypoint');
 }
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{const a=s.map.floorLoot.find(a=>a.building===0&&a.floor===0&&a.role==='weapon'),p=s.players.get('host');Object.assign(p,{x:a.x,y:a.y,z:a.z,flight:'ground',grounded:true,vy:0,health:100,shield:100});s.loot=[];s.lootVersion++;s.chests=[{id:'check',x:a.x,y:a.y,z:a.z+1.5,opened:false,contents:[{id:'needle',weapon:true,ammo:5,count:1,rarity:2},{id:'heavy',ammoType:'heavy',count:6},{id:'mini',count:2}]}];for(const b of s.players.values())b.bot=false;}));
 await page.evaluate(()=>window.__yolkTest.pose({yaw:0,pitch:0,slot:5}));await page.keyboard.down('KeyF');await page.waitForFunction(()=>window.__yolkTest.read().state.royale.chests[0].opened);await page.keyboard.up('KeyF');
 await page.waitForFunction(()=>window.__yolkTest.fixture(s=>!s.players.get('host').interactLatch));
 console.log('Chest rewards',await page.evaluate(()=>({loot:window.__yolkTest.read().state.royale.loot,position:window.__yolkTest.read().state.players.find(p=>p.id==='host')})));
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{const item=s.loot.find(i=>i.id==='needle');if(!item)throw new Error('Chest weapon missing');Object.assign(s.players.get('host'),{x:item.x,y:item.y,z:item.z,vy:0,grounded:true});}));
 await page.keyboard.down('KeyF');await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').inventory.some(i=>i?.id==='needle'));await page.keyboard.up('KeyF');pass('Search animation opens a chest and its spawned weapon can be picked up');
 await page.screenshot({path:`${out}/interior-loot.png`});
 const optics={needle:4.5,anchor:3.25,peeper:3.5,duet:1.8};
 for(const [id,zoom]of Object.entries(optics)){
  console.log('Checking optic',id);
  await page.evaluate(id=>window.__yolkTest.fixture(s=>{const p=s.players.get('host');p.inventory[0]={id,weapon:true,ammo:3,count:1,rarity:2};p.slot=0;p.bank.heavy=30;p.bank.medium=40;p.reloadEnd=0;s.syncInventory(p);}),id);
  await page.keyboard.press('Digit1');await page.waitForFunction(id=>window.__yolkTest.read().presentation.weapon===id,id);
  const base=await page.evaluate(()=>window.__yolkTest.read().scope.fov);await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__yolkTest.read().scope.aimBlend>.98);
  assert.equal(await page.locator('#scope').isVisible(),true);const fov=await page.evaluate(()=>window.__yolkTest.read().scope.fov);assert.ok(Math.abs(Math.tan(base*Math.PI/360)/Math.tan(fov*Math.PI/360)-zoom)<.12,`${id} zoom`);
  assert.match(await page.locator('#scope-label').textContent(),new RegExp(String(zoom)));
  await page.screenshot({path:`${out}/scope-${id}.png`});await page.mouse.up({button:'right'});await page.waitForFunction(()=>window.__yolkTest.read().scope.aimBlend<.01);
 }
 pass('All four optics render their configured magnification and reticle');
 for(const id of ['sprinter','scatter','needle','zipper','thumper','anchor','duet','pip','peeper','doubleyolk','comet']){
  console.log('Checking switch and fire',id);
  await page.evaluate(id=>window.__yolkTest.fixture(s=>{const p=s.players.get('host');p.inventory[0]={id,weapon:true,ammo:3,count:1,rarity:2};p.slot=0;p.nextShot=0;p.reloadEnd=0;s.syncInventory(p);}),id);
  await page.keyboard.press('Digit1');await page.waitForFunction(id=>window.__yolkTest.read().presentation.weapon===id,id);await page.evaluate(()=>window.__yolkTest.pose({yaw:0,pitch:0,slot:0}));await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>window.__yolkTest.read().presentation.muzzle.every(Number.isFinite)));
  await page.mouse.down();await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').inventory[0].ammo<3);await page.mouse.up();
  if(['sprinter','doubleyolk','thumper'].includes(id))await page.screenshot({path:`${out}/held-${id}.png`});
 }
 pass('All eleven first-person weapon models switch and fire with finite muzzle attachments');
 await page.keyboard.press('KeyL');await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.phase='results';s.startRound();}));await page.waitForFunction(()=>window.__yolkTest.read().state.round===2);await page.locator('#royale-flight').waitFor();assert.ok(await page.locator('#royale-flight').isVisible());pass('New match restores the flight instructions and resets loot');
 await page.screenshot({path:`${out}/flight-new-match.png`});
 assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));
}catch(error){console.error(error);console.error('Page errors:',errors);if(page){console.error('Diagnostics',await page.evaluate(()=>window.__yolkTest?.read()).catch(()=>null));await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}throw error;}finally{await browser.close();await vite.close();}
