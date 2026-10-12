import {startRealtimeServer} from '../server/realtime/index.js';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const out='test-results/expansion/browser',port=5224,origin=`http://127.0.0.1:${port}`;
await mkdir(out,{recursive:true});
const relay=await startRealtimeServer({port:9000,host:'127.0.0.1',origins:[origin]});
relay.relay.progression.path=null;
const vite=await createServer({plugins:[{name:'isolated-expansion-relay',configureServer(server){server.middlewares.use((req,res,next)=>{
 if(req.url?.split('?')[0]!=='/network-config.js')return next();
 res.setHeader('Content-Type','text/javascript');res.end("window.YOLK_NETWORK={relay:'ws://127.0.0.1:9000/game'};");
});}}],server:{host:'127.0.0.1',port,strictPort:true,watch:null}});
await vite.listen();
let browser,page;const errors=[],checks={};
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ravelfront-season-1-dismissed','yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));localStorage.setItem('yolk-profile',JSON.stringify({name:'Expansion QA'}));});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest);await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.evaluate(async()=>{const {View}=await import('/src/view.js'),original=View.prototype.setQuality;window.__qualityResetCount=0;View.prototype.setQuality=function(...args){window.__qualityResetCount++;return original.apply(this,args);};});
 await page.locator('#menu [data-action=settings]:visible').first().click();
 await page.locator('[data-settings-tab=gameplay]').click();await page.locator('#slot_shotgun').selectOption('4');
 await page.locator('[data-settings-tab=mouse]').click();await page.locator('[data-reset-slider=adsSensitivity]').click();await page.locator('#adsSensitivity').fill('0.5');await page.locator('#adsSensitivity').dispatchEvent('input');await page.locator('#adsSensitivity').dispatchEvent('change');
 await page.locator('[data-settings-tab=comfort]').click();await page.locator('#aimMode').selectOption('toggle');await page.locator('#reducedMotion').check();
 await page.locator('[data-settings-tab=hud]').click();await page.locator('#highContrast').check();await page.locator('#mapSide').selectOption('left');
 assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('reduced-motion')),true);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-settings')).slot_shotgun),'4');
 assert.equal(await page.evaluate(()=>window.__qualityResetCount),0,'HUD/comfort/input settings must preserve adaptive rendering');checks.settingsPreserveRenderBudget=true;
 await page.screenshot({path:out+'/settings-desktop.png'});await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:out+'/settings-mobile.png'});checks.settings=true;
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.locator('[data-action=training]:visible').click();await page.locator('[data-action=start-training]').click();await page.locator('#loading-screen').waitFor({state:'hidden'});
 const resume=page.locator('#dialog [data-action=resume]');if(await resume.isVisible())await resume.click();else await page.mouse.click(720,450);
 await page.waitForFunction(()=>!window.__yolkTest.read().paused&&document.pointerLockElement);
 await page.waitForFunction(()=>document.querySelector('.connection-signal')?.hidden);
 const mapBox=await page.locator('.royale-map-stack').boundingBox(),netBox=await page.locator('.performance-network').boundingBox();assert.ok(mapBox.x+mapBox.width<netBox.x,'left minimap must not cover connection statistics');
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{const p=s.players.get(window.__yolkTest.read().localId);s.trainingResupply=s.time+3600;p.inventory[1]={id:'sprinter',weapon:true,count:1,ammo:20,rarity:2};p.inventory[4]=null;s.syncInventory(p);window.__yolkTest.pose({x:18,y:0,z:30,yaw:0,pitch:0,slot:1,grounded:true,flight:'ground',vy:0});}));
 await page.mouse.click(720,450,{button:'right'});await page.waitForFunction(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId).aim&&q.scope.aimBlend>.8;});
 await page.mouse.click(720,450,{button:'right'});await page.waitForFunction(()=>{const q=window.__yolkTest.read();return !q.state.players.find(p=>p.id===q.localId).aim&&q.scope.aimBlend<.1;});checks.toggleAimAndCamera=true;
 await page.waitForFunction(()=>window.__yolkTest.fixture(s=>s.players.get(window.__yolkTest.read().localId).pickupPreferences?.shotgun===4));
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{window.__yolkTest.look(0,-.2);const p=s.players.get(window.__yolkTest.read().localId),item=s.dropLoot({...p,z:p.z-1.8},{id:'scatter',weapon:true,count:1,ammo:5,rarity:4});if(!item)throw Error('loot fixture unreachable');}));
 await page.waitForFunction(()=>document.querySelector('#royale-prompt').textContent.includes('M12 Combat Shotgun'));
 assert.equal(await page.locator('#royale-prompt .loot-comparison').count(),0,'ground weapon stats are intentionally hidden');
 await page.screenshot({path:out+'/loot-pickup.png'});await page.keyboard.press('KeyF');
 await page.waitForFunction(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId).inventory[4]?.id==='scatter';});checks.preferredPickup=true;
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{const id=window.__yolkTest.read().localId,p=s.players.get(id);s.emit('hit',{player:id,target:'qa-enemy',amount:20,shotId:'qa-shield',shield:true,shieldBreak:true});s.emit('hit',{player:'qa-enemy',target:id,amount:10,sourceX:p.x+6,sourceZ:p.z,shield:true});}));
 await page.waitForFunction(()=>document.querySelector('#hit-marker')?.dataset.kind==='break');
 assert.equal(await page.locator('#damage-directions .damage-direction').count(),5);await page.screenshot({path:out+'/combat-feedback.png'});checks.feedback=true;
 await page.evaluate(async()=>{const {rebuildMap}=await import('/src/building.js'),{startEmote}=await import('/src/emotes.js');window.__yolkTest.fixture(s=>{const p=s.players.get(window.__yolkTest.read().localId);window.__yolkTest.look(0,0);p.yaw=0;p.lastDamage=-100;p.emoteReadyAt=0;s.builds.push({id:888888,owner:p.id,type:'wall',material:'wood',rotation:0,mask:0,x:p.x,y:p.y,z:p.z+1.4,health:150,maxHealth:150,builtAt:s.time});s.buildVersion++;rebuildMap(s);if(!startEmote(s,p,'shuffle'))throw Error('Emote camera fixture unavailable');});});
 await page.waitForFunction(()=>{const q=window.__yolkTest.read(),p=q.state.players.find(p=>p.id===q.localId),camera=window.__yolkTest.celebrations().cameraPosition;return !!p.emote&&camera[2]>p.z+.1&&camera[2]<p.z+1.15;});
 await page.screenshot({path:out+'/emote-camera-wall.png'});
 await page.evaluate(async()=>{const {rebuildMap}=await import('/src/building.js');window.__yolkTest.fixture(s=>{s.builds=s.builds.filter(b=>b.id!==888888);s.buildVersion++;rebuildMap(s);});});
 await page.waitForFunction(()=>{const q=window.__yolkTest.read(),p=q.state.players.find(p=>p.id===q.localId),camera=window.__yolkTest.celebrations().cameraPosition;return camera[2]-p.z>3.5;});
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.players.get(window.__yolkTest.read().localId).emote=null;}));checks.cameraCollision=true;
 await page.keyboard.press('KeyI');await page.locator('#dialog[data-kind=royale-inventory]').waitFor({state:'visible'});await page.screenshot({path:out+'/inventory-desktop.png'});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  assert.equal(await page.locator('#dialog .inventory-actions button').evaluateAll(nodes=>nodes.every(el=>el.scrollWidth<=el.clientWidth+1)),true,'mobile inventory button labels must fit');
  assert.equal(await page.locator('#dialog .royale-slot').evaluateAll(nodes=>nodes.every(el=>{const k=el.querySelector('kbd')?.getBoundingClientRect(),b=el.querySelector('b')?.getBoundingClientRect();return !b||k.right+2<=b.left;})),true,'slot key and quantity must not overlap');
  await page.screenshot({path:out+`/inventory-mobile-${width}.png`});
 }
 await page.locator('#dialog [data-action=royale-inspect]').click();await page.locator('#inventory-inspect').waitFor({state:'visible'});await page.locator('#inventory-inspect').scrollIntoViewIfNeeded();
 assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:out+'/inventory-inspect-mobile.png'});checks.inventoryLayout=true;
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS expansion browser',checks);
}catch(error){await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({checks,errors,error:String(error)},null,2));throw error;}
finally{await browser?.close();await vite.close();await relay.close();}
