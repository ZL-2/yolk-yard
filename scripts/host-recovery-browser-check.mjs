import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import {fixture,until} from '../tests/helpers/public-match.js';
const origin='http://127.0.0.1:5296',out='test-results/host-recovery';
await mkdir(out,{recursive:true});
const f=await fixture({serverOptions:{origins:[origin]}});
// Drive the watchdog deadline explicitly so slow software-rendered asset loading
// cannot trigger an unrelated handoff before both browsers are ready.
const sweep=f.app.relay.hostWatchdog.sweep.bind(f.app.relay.hostWatchdog);f.app.relay.hostWatchdog.sweep=()=>{};
const vite=await createServer({server:{host:'127.0.0.1',port:5296,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const errors=[],pages=[];
try{
 f.app.relay.iconVoting.now=()=>Date.parse('2026-10-23T18:00Z');await f.app.relay.iconVoting.mutate('browser-fixture',{action:'nominate',first:'Fixture',last:'Operator'});
 async function player(name){
  const context=await browser.newContext({viewport:{width:960,height:640},deviceScaleFactor:.5,bypassCSP:true,permissions:['local-network-access']});const page=await context.newPage();pages.push(page);page.setDefaultTimeout(90000);page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
  await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${f.app.server.address().port}/game'};`}));
  await page.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name,weapon:'sprinter'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:30}));localStorage.setItem('ravelfront-stormspike-kestrel-199-dismissed','yes');},name);
  await page.goto(origin+'/?qa');console.log('Game loaded',name);await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);
  await page.locator('.icon-voting[open] [data-candidate]').first().click();await page.locator('.icon-voting [data-cast]').click();await page.locator('.icon-voting[open]').waitFor({state:'hidden'});
  return page;
 }
 const host=await player('Recovery Captain'),guest=await player('Recovery Guest');
 console.log('Players loaded; entering public match');
 await host.locator('#menu [data-action=lobby-play]').click();await host.waitForFunction(()=>window.__yolkTest.read().host&&window.__yolkTest.read().state?.royale?.stage==='spawn-island');
 await host.waitForFunction(()=>window.__yolkTest.party().party?.state==='playing');
 await host.locator('#loading-screen').waitFor({state:'hidden'});
 await host.evaluate(()=>window.__yolkTest.fixture(sim=>sim.queueEnds=sim.time+600));
 await guest.locator('#menu [data-action=lobby-play]').click();await guest.waitForFunction(()=>window.__yolkTest.read().state?.players.filter(p=>!p.bot).length===2);
 await guest.evaluate(()=>window.__yolkTest.connectionFixture(net=>{net.lastReadySent=0;net.publicReady();}));
 const address=await host.evaluate(()=>window.__yolkTest.connectionFixture(net=>net.peer.id));
 await until(()=>f.app.relay.publicHost.roomByAddress(address)?.successor(),'Browser successor ready',15000);
 const before=await host.evaluate(()=>window.__yolkTest.read().localId);assert.equal(before,'host');
 // Freeze simulation advancement while the actual game renderer and socket run.
 await host.evaluate(()=>window.__yolkTest.fixture(sim=>{sim.tick=()=>{};}));
 f.app.relay.hostWatchdog.rooms.get(address).advancedAt=1;sweep();
 await guest.waitForFunction(()=>window.__yolkTest.read().host);
 await host.waitForFunction(()=>{const s=window.__yolkTest.read();return !s.host&&!s.migrating&&s.state?.network?.hostId!=='host';});
 const restored=await host.evaluate(()=>window.__yolkTest.read());assert.equal(restored.localId,'host');assert.equal(restored.state.players.filter(p=>p.id==='host').length,1);
 assert.equal(await host.evaluate(()=>window.__yolkTest.fixture(sim=>sim===null)),true);
 await host.waitForFunction(time=>window.__yolkTest.read().state.time>time,restored.state.time);
 await host.evaluate(()=>window.__yolkTest.resume());await host.keyboard.down('w');await host.waitForTimeout(600);await host.keyboard.up('w');
 await host.screenshot({path:out+'/former-host-playing.png'});await guest.screenshot({path:out+'/successor-playing.png'});
 assert.deepEqual(errors,[]);console.log('PASS full-game host demotion, active successor, preserved local player, resumed controls and rendering');
}catch(error){for(const [i,page] of pages.entries()){console.error('Browser failure state',i,await page.evaluate(()=>({party:window.__yolkTest?.party(),screen:window.__yolkTest?.read().screen,dialog:document.querySelector('#dialog')?.innerText,state:window.__yolkTest?.read().state?.phase})).catch(()=>null));await page.screenshot({path:out+'/failure-'+i+'.png'}).catch(()=>{});}throw error;}finally{await browser.close();await vite.close();await f.close();}
