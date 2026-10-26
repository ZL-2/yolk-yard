import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fixture,until} from '../tests/helpers/public-match.js';
import {TOURNAMENT as E} from '../src/tournament.js';
const origin='http://127.0.0.1:5302',out='test-results/input-response';await mkdir(out,{recursive:true});
let now=E.lockAt-60000;
const f=await fixture({serverOptions:{origins:[origin,'https://zl-2.github.io'],tournamentOptions:{events:[E],now:()=>now,autoStart:false}}});
const service=f.app.relay.tournament,event=service.event(E.id),authority=f.app.relay.authority;
const vite=await createServer({server:{host:'127.0.0.1',port:5302,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1100,height:750},deviceScaleFactor:.5,bypassCSP:true,permissions:['local-network-access']}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
try{
 f.app.relay.iconVoting.now=()=>Date.parse('2026-10-23T18:00Z');await f.app.relay.iconVoting.mutate('browser-fixture',{action:'nominate',first:'Fixture',last:'Operator'});
 await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${f.app.server.address().port}/game'};`}));
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Response Reviewer',weapon:'sprinter'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:60}));localStorage.setItem('ravelfront-stormspike-kestrel-199-dismissed','yes');});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest);
 await page.evaluate(()=>window.__yolkTest.loadingFixture(v=>{v.renderer.savedRender=v.renderer.render;v.renderer.render=()=>{};}));
 await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);
 await page.locator('.icon-voting[open] [data-candidate]').first().click();await page.locator('.icon-voting [data-cast]').click();await page.locator('.icon-voting[open]').waitFor({state:'hidden'});
 now=E.opensAt;service.tick();await page.evaluate(id=>window.__yolkTest.social('tournament-join',{eventId:id}),E.id);
 await page.waitForFunction(()=>window.__yolkTest.read().screen==='game');await page.locator('#loading-screen').waitFor({state:'hidden'});
 await until(()=>event.room&&[...event.room.sim.players.values()].some(p=>p.name==='Response Reviewer'&&!p.loading),'Browser input reaches Cup authority',90000);
 console.log('Cup entered; isolating control latency from software GPU rendering');
 const sim=event.room.sim,p=[...sim.players.values()].find(p=>p.name==='Response Reviewer');sim.tickActivity=()=>{};sim.queueEnds=sim.time+10000;
 p.inventory[1]={id:'sprinter',weapon:true,rarity:1,ammo:30,count:1};p.inventory[2]={id:'scatter',weapon:true,rarity:1,ammo:8,count:1};sim.syncInventory(p);authority.broadcast(event.room);
 await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id===window.__yolkTest.read().localId)?.inventory?.[2]?.id==='scatter');
 await page.evaluate(()=>window.__yolkTest.resume());await page.keyboard.press('1');await page.waitForFunction(()=>{const r=window.__yolkTest.read();return r.state.players.find(p=>p.id===r.localId).slot===1;});
 // Hold application of decoded authority states while keeping real networking,
 // input transmission, frame scheduling and rendering alive.
 await page.waitForFunction(()=>{const r=window.__yolkTest.read();if(r.input.slot!==1||r.state.players.find(p=>p.id===r.localId).slot!==1)return false;window.__yolkTest.connectionFixture(n=>{n.savedState=n.callbacks.onState;n.callbacks.onState=s=>{n.pendingState=s;};});return true;});
 console.log('Holding state updates; checking switch before acknowledgement');
 await page.keyboard.press('2');await page.waitForFunction(()=>window.__yolkTest.loadingFixture(v=>v.localWeapon==='scatter'),null,{timeout:15000});
 const beforeAck=await page.evaluate(()=>{const r=window.__yolkTest.read();return {authoritativeSlot:r.state.players.find(p=>p.id===r.localId).slot,requested:r.input.slot,model:window.__yolkTest.loadingFixture(v=>v.localWeapon)};});
 assert.equal(beforeAck.authoritativeSlot,1);assert.equal(beforeAck.requested,2);assert.equal(beforeAck.model,'scatter');
 console.log('Local switch confirmed before network acknowledgement');
 const position=await page.evaluate(()=>{const p=window.__yolkTest.read().predicted;return {x:p.x,z:p.z};});await page.keyboard.down('w');await page.waitForTimeout(180);await page.keyboard.up('w');
 const moved=await page.evaluate(()=>window.__yolkTest.read().predicted);assert.ok(Math.hypot(moved.x-position.x,moved.z-position.z)>.1,'Movement responds while state updates are withheld');
 await page.evaluate(()=>window.__yolkTest.connectionFixture(n=>{n.callbacks.onState=n.savedState;n.savedState(n.pendingState);}));
 await page.waitForFunction(()=>{const r=window.__yolkTest.read();return r.state.players.find(p=>p.id===r.localId).slot===2;});
 await page.keyboard.press('1');await page.waitForFunction(()=>window.__yolkTest.loadingFixture(v=>v.localWeapon==='sprinter'));const rifle=await page.evaluate(()=>window.__yolkTest.loadingFixture(v=>v.localModel.uuid));
 for(let i=0;i<8;i++){await page.keyboard.press(i%2?'1':'2');await page.waitForFunction(id=>window.__yolkTest.loadingFixture(v=>v.localWeapon===id),i%2?'sprinter':'scatter');}
 assert.equal(await page.evaluate(()=>window.__yolkTest.loadingFixture(v=>v.localModel.uuid)),rifle,'Switching reuses the exact model instead of rebuilding it');
 // Put one unique, reachable pickup at the player's feet. During the delay the
 // prompt reacts, but the inventory remains authoritative (no phantom item).
 console.log('Rapid switches passed; checking pickup');
 sim.dropLoot(p,{id:'needle',weapon:true,rarity:1,ammo:5,count:1});const item=sim.loot.at(-1);authority.broadcast(event.room);
 await page.waitForFunction(uid=>window.__yolkTest.read().state.royale.loot.some(i=>i.uid===uid),item.uid);
 await page.evaluate(()=>window.__yolkTest.connectionFixture(n=>{n.callbacks.onState=s=>{n.pendingState=s;};}));
 await page.keyboard.press('f');await page.waitForFunction(()=>document.querySelector('#royale-prompt')?.textContent.includes('Picking up'),null,{timeout:10000});
 assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.players.find(p=>p.id===window.__yolkTest.read().localId).inventory.some(i=>i?.id==='needle')),false);
 await until(()=>p.inventory.some(i=>i?.id==='needle'),'Authority accepted exactly one pickup');
 await page.evaluate(()=>window.__yolkTest.connectionFixture(n=>{n.callbacks.onState=n.savedState;if(n.pendingState)n.savedState(n.pendingState);}));
 await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id===window.__yolkTest.read().localId).inventory.some(i=>i?.id==='needle'));
 assert.equal(p.inventory.filter(i=>i?.id==='needle').length,1);assert.ok(!sim.loot.some(i=>i.uid===item.uid));
 // Full scene rendering is separately checked by performance-browser-check;
 // keep software GPU cost out of this input-isolation fixture.
 await page.screenshot({path:out+'/confirmed-inventory.png'});assert.deepEqual(errors,[]);
 await writeFile(out+'/browser.json',JSON.stringify({passed:true,beforeAck,checks:['real-cup-authority','weapon-before-ack','movement-before-ack','rapid-switch-cache','pending-pickup-feedback','single-authoritative-pickup'],errors},null,2));console.log('PASS real Cup inputs, immediate weapon/movement, cached switching and confirmed pickups');
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error('Response test failure',await page.evaluate(()=>({screen:window.__yolkTest?.read().screen,paused:window.__yolkTest?.read().paused,dialog:document.querySelector('#dialog')?.innerText,prompt:document.querySelector('#royale-prompt')?.innerText,report:window.__yolkTest?.read().connection})).catch(()=>null),errors);throw error;}
finally{await browser.close();await vite.close();await f.close();}
