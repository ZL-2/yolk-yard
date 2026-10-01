import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const live=!!process.env.RAVEL_FRONTEND_URL,origin=process.env.RAVEL_FRONTEND_URL||'http://127.0.0.1:5196',relay=process.env.RAVEL_RELAY_URL||'ws://127.0.0.1:9002/game',pages=[],errors=[];
let temp,app,vite,browser;
const out=live?'test-results/host-royale-live':'test-results/host-royale';
async function player(name){
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 if(!live)await context.route('**/network-config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'${relay}'};`}));
 const page=await context.newPage();pages.push(page);page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(name+': '+e.message));
 await page.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));localStorage.setItem('ravelfront-welcome-back-2026-09','dismissed');},name);
 await page.goto(origin+(live?'/?verify-host='+Date.now():'/?qa'));await page.locator('#loading-screen').waitFor({state:'hidden'});await page.locator('#menu [data-action=find-public]:enabled').waitFor();
 assert.ok((await page.locator('body').innerText()).includes('RAVEL'));assert.equal(await page.locator('vite-error-overlay, [data-nextjs-dialog]').count(),0);
 return page;
}
async function select(page,id){await page.locator('#menu [data-action=play]').click();await page.locator(`[data-experience="${id}"]`).click();await page.locator('#dialog').waitFor({state:'hidden'});}
async function matchingButtons(page){
 const result=await page.evaluate(()=>{const a=document.querySelector('#menu [data-action=find-public]'),b=document.querySelector('#menu [data-action=play-custom]'),pick=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {background:s.backgroundColor,color:s.color,font:s.fontSize,radius:s.borderRadius,height:r.height,width:r.width,top:r.top,bottom:r.bottom};};return {a:pick(a),b:pick(b),loadout:document.querySelector('#menu .yard-custom')?.getBoundingClientRect().bottom};});
 for(const key of ['background','color','font','radius','height','width'])assert.equal(result.a[key],result.b[key],'Custom button '+key);assert.ok(result.b.top>=result.a.bottom,'Primary buttons do not overlap');if(result.loadout)assert.ok(result.b.top>=result.loadout,'Custom button clears loadout');
}
try{
 if(!live){temp=await mkdtemp('/tmp/ravel-host-browser-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';app=await startRealtimeServer({host:'127.0.0.1',port:9002,origins:[origin]});vite=await createServer({server:{host:'127.0.0.1',port:5196,strictPort:true,watch:null}});await vite.listen();}
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,channel:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?undefined:'chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});await mkdir(out,{recursive:true});
 const captain=await player('Host Captain'),mate=await player('Host Teammate');
 assert.equal((await captain.locator('#menu [data-action=find-public]').innerText()).replace('▶','').trim(),'PLAY');await matchingButtons(captain);await captain.screenshot({path:out+'/play.png'});
 if(!live){
  await mate.locator('#menu .yard-nav-tools [data-action=social]').click();const bid=await mate.evaluate(()=>window.__yolkTest.party().id);await mate.locator('#dialog [data-action=close]').click();
  await captain.locator('#menu .yard-nav-tools [data-action=social]').click();await captain.locator('[data-social-tab=online]').click();await captain.locator(`[data-party-invite="${bid}"]`).click();await mate.locator('[data-party-accept]').first().click();
  await captain.waitForFunction(()=>window.__yolkTest.party().party.members.length===2);for(const p of [captain,mate])if(await p.locator('#dialog [data-action=close]').isVisible())await p.locator('#dialog [data-action=close]').click();
  await mate.locator('#menu [data-action=party-ready]').click();await captain.waitForFunction(()=>window.__yolkTest.party().party.members.every(m=>m.ready||m.id===window.__yolkTest.party().party.leader));
  await captain.locator('#menu [data-action=find-public]').click();await captain.waitForFunction(()=>{if(window.__yolkTest.read().state?.royale?.stage!=='spawn-island')return false;window.__yolkTest.fixture(sim=>sim.queueEnds=sim.time+600);return true;});for(const p of [captain,mate]){await p.waitForFunction(()=>window.__yolkTest.read().state?.royale?.stage==='spawn-island');await p.locator('#loading-screen').waitFor({state:'hidden'});}
  const humans=await mate.evaluate(()=>window.__yolkTest.read().state.players.filter(p=>!p.bot));assert.equal(humans.length,2);assert.equal(humans[0].team,humans[1].team);assert.equal(app.relay.authority.rooms.size,0);assert.equal(app.relay.authority.capacity.reservations.size,0);await mate.screenshot({path:out+'/hosted-party.png'});
  await captain.context().close();await mate.context().close();
 }else{await captain.context().close();await mate.context().close();}
 for(const mode of ['ffa','teams']){
  const host=await player('Private '+mode),guest=await player('Code '+mode);await select(host,mode);assert.match(await host.locator('#menu [data-action=find-public]').innerText(),/FIND PUBLIC MATCH/);await matchingButtons(host);
  await host.setViewportSize({width:390,height:844});await matchingButtons(host);await host.screenshot({path:out+'/'+mode+'-mobile-buttons.png'});await host.setViewportSize({width:1440,height:900});
  await host.locator('#menu [data-action=play-custom]').click();await host.locator('[data-action=create-room]').click();await host.locator('#loading-screen').waitFor({state:'hidden'});await host.locator('#lobby [data-action=start-match]').waitFor({state:'visible'});
  const code=(await host.locator('#lobby .room-code').innerText()).replace(/[^A-Z2-9]/g,'');assert.equal(code.length,8);
  await guest.locator('#menu [data-action=play-custom]').click();await guest.locator('[data-action=join]').click();await guest.locator('#join-code').fill(code);await guest.locator('[data-action=join-room]').click();await guest.locator('#loading-screen').waitFor({state:'hidden'});await guest.locator('#lobby .room-code').waitFor({state:'visible'});
  await host.waitForTimeout(1200);assert.equal(await host.locator('#lobby [data-action=start-match]').isVisible(),true);assert.equal((await guest.locator('#lobby .room-code').innerText()).replace(/[^A-Z2-9]/g,''),code);assert.match(await guest.locator('#lobby').innerText(),/Waiting for the host to start/);
  if(!live){assert.equal(await host.evaluate(()=>window.__yolkTest.read().state.phase),'lobby');assert.equal(app.relay.authority.rooms.size,0);}
  await host.screenshot({path:out+'/'+mode+'-ready.png'});await host.locator('#lobby [data-action=start-match]').click();await host.locator('#lobby').waitFor({state:'hidden'});await guest.locator('#lobby').waitFor({state:'hidden'});await host.locator('#loading-screen').waitFor({state:'hidden'});
  await guest.context().close();await host.context().close();
 }
 assert.deepEqual(errors,[]);console.log('PASS '+(live?'live ':'')+'Royale PLAY, matching desktop/mobile buttons, '+(!live?'ready Royale party on player host, ':'')+'private FFA/Team Scramble code join, post-loading code and manual Start Match screens.');
}catch(error){for(let i=0;i<pages.length;i++)if(!pages[i].isClosed()){console.log('PAGE',i,(await pages[i].locator('body').innerText().catch(()=>'' )).slice(0,1600));await pages[i].screenshot({path:out+'/failure-'+i+'.png'}).catch(()=>{});}throw error;}
finally{await browser?.close();await vite?.close();await app?.close();if(temp)await rm(temp,{recursive:true,force:true});}
