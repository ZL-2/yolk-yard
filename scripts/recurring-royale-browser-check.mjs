import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const live=!!process.env.RAVEL_FRONTEND_URL,origin=process.env.RAVEL_FRONTEND_URL||'http://127.0.0.1:5196',relay=process.env.RAVEL_RELAY_URL||'ws://127.0.0.1:9002/game',pages=[],errors=[];
let temp,app,vite,browser;const out=live?'test-results/recurring-royale-live':'test-results/recurring-royale';
async function player(name,width=1440){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
 if(!live)await context.route('**/network-config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'${relay}'};`}));
 const page=await context.newPage();pages.push(page);page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(name+': '+e.message));
 await page.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));localStorage.setItem('ravelfront-welcome-back-2026-09','dismissed');},name);
 await page.goto(origin+(live?'/?verify-recurring='+Date.now():'/?qa'));await page.locator('#loading-screen').waitFor({state:'hidden'});await page.locator('#menu [data-action=play-custom]:enabled').waitFor();
 assert.ok((await page.locator('body').innerText()).includes('RAVEL'));assert.equal(await page.locator('vite-error-overlay, [data-nextjs-dialog]').count(),0);
 assert.equal(await page.locator('#menu .yard-play-card button').count(),1);assert.equal(await page.locator('#menu [data-action=find-public]').count(),0);assert.match(await page.locator('.public-royale-card').innerText(),/48 CONTESTANTS/);
 const boxes=await page.evaluate(()=>{const get=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,x:r.x,width:r.width};};return {public:get('.public-royale-card'),nav:get('.yard-nav'),private:get('.yard-private-card'),party:get('.yard-party'),vw:innerWidth};});
 assert.ok(Math.abs(boxes.public.left+boxes.public.width/2-boxes.vw/2)<2,'Public card is top-center');assert.ok(boxes.public.top>=boxes.nav.bottom,'Public card clears navigation');assert.ok(boxes.public.bottom<=boxes.party.top||boxes.public.right<=boxes.party.left,'Public card clears party');assert.ok(boxes.private.top>boxes.public.bottom,'Private button is below public card');
 return page;
}
async function privateMatch(mode,teamSize){
 const host=await player('Private '+mode+teamSize),guest=await player('Code '+mode+teamSize,390);
 await host.locator('#menu [data-action=play-custom]').click();assert.equal(await host.locator('#setup-mode option[value=teams]').count(),0);
 await host.locator('#setup-mode').selectOption(mode);if(mode==='royale')await host.locator('#setup-teamSize').selectOption(String(teamSize));
 if(mode==='royale')await host.locator('#setup-capacity').selectOption(teamSize===4?'8':'4');await host.locator('#setup-bots').selectOption(mode==='royale'?'3':'1');
 await host.locator('[data-action=create-room]').click();await host.locator('#loading-screen').waitFor({state:'hidden'});await host.locator('#lobby [data-action=start-match]').waitFor({state:'visible'});
 const code=(await host.locator('#lobby .room-code').innerText()).replace(/[^A-Z2-9]/g,'');assert.equal(code.length,8);assert.notEqual(code,'FRONTIER');
 await guest.locator('#menu [data-action=play-custom]').click();await guest.locator('[data-action=join]').click();await guest.locator('#join-code').fill(code);await guest.locator('[data-action=join-room]').click();await guest.locator('#loading-screen').waitFor({state:'hidden'});await guest.locator('#lobby .room-code').waitFor({state:'visible'});
 assert.match(await guest.locator('#lobby').innerText(),/Waiting for the host to start/);assert.equal((await guest.locator('#lobby .room-code').innerText()).replace(/[^A-Z2-9]/g,''),code);
 if(!live){assert.equal(await host.evaluate(()=>window.__yolkTest.read().state.phase),'lobby');assert.equal(await guest.evaluate(()=>window.__yolkTest.read().host),false);assert.equal(app.relay.authority.rooms.size,1);}
 await host.screenshot({path:out+'/private-'+mode+teamSize+'.png'});await host.locator('#lobby [data-action=start-match]').click();await host.locator('#lobby').waitFor({state:'hidden'});await guest.locator('#lobby').waitFor({state:'hidden'});
 if(!live&&mode==='royale'){assert.equal(await host.evaluate(()=>window.__yolkTest.read().state.royale.stage),'spawn-island');assert.equal(await host.evaluate(()=>window.__yolkTest.read().state.options.recurring),false);}
 await guest.context().close();await host.context().close();
}
try{
 if(!live){temp=await mkdtemp('/tmp/ravel-recurring-browser-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';app=await startRealtimeServer({host:'127.0.0.1',port:9002,origins:[origin]});vite=await createServer({server:{host:'127.0.0.1',port:5196,strictPort:true,watch:null}});await vite.listen();}
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,channel:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?undefined:'chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});await mkdir(out,{recursive:true});
 const lobby=await player('Lobby Observer'),mobile=await player('Mobile Observer',390);await lobby.screenshot({path:out+'/lobby.png'});await mobile.screenshot({path:out+'/lobby-mobile.png'});await mobile.context().close();
 if(!live){assert.equal(app.relay.authority.publicSummary().humanPlayers,0);assert.equal(app.relay.authority.publicSummary().botPlayers,48);await lobby.locator('[data-action=public-join]:enabled').waitFor();}
 await lobby.context().close();
 for(const [mode,size]of [['ffa',1],['royale',1],['royale',2],['royale',4]])await privateMatch(mode,size);
 if(!live){
  const watcher=await player('Public Observer'),pilot=await player('Public Pilot');
  // Reset the empty server window, then use the real UI and ticket admission.
  app.relay.authority.publicRoom.sim.resetPublicWarmup();await pilot.locator('[data-action=public-join]:enabled').click();await pilot.waitForFunction(()=>window.__yolkTest.read().state?.options.recurring===true);await pilot.locator('#loading-screen').waitFor({state:'hidden'});
  const room=app.relay.authority.publicRoom;assert.equal(room.sim.players.size,48);assert.equal([...room.sim.players.values()].filter(p=>p.bot).length,47);assert.equal(room.owner,'server');assert.equal(await pilot.evaluate(()=>window.__yolkTest.read().host),false);
  await watcher.waitForFunction(()=>document.querySelector('.public-royale-humans b')?.textContent==='1');assert.match(await watcher.locator('.public-royale-card').innerText(),/Est. remaining/);
  room.sim.time=room.sim.queueEnds;room.sim.advanceWarmupClock();await watcher.locator('[data-action=public-spectate]:enabled').waitFor();await watcher.screenshot({path:out+'/spectate-card.png'});
  await watcher.locator('[data-action=public-spectate]').click();await watcher.waitForFunction(()=>{const r=window.__yolkTest.read();return r.state?.players.find(p=>p.id===r.localId)?.lateSpectator;});await watcher.locator('#loading-screen').waitFor({state:'hidden'});
  const before=room.sim.matchId;room.sim.phase='results';room.sim.stage='finished';room.restartAt=room.age;await pilot.waitForFunction(id=>window.__yolkTest.read().state?.royale.matchId!==id,before);await watcher.waitForFunction(()=>{const r=window.__yolkTest.read();return r.state?.royale.stage==='spawn-island'&&r.state.players.find(p=>p.id===r.localId)?.contestant;});
  assert.equal(room.sim.players.size,48);assert.equal(app.relay.authority.rooms.size,1);await pilot.context().close();await watcher.context().close();
 }
 assert.deepEqual(errors,[]);console.log('PASS '+(live?'live ':'')+'top-center public card, desktop/mobile layout, human count and estimate, only Custom Private Match below, no Team Scramble, all four private modes with post-loading code/manual Start, '+(!live?'public Join → server-owned round → Spectate → recurring Spawn Island.':'published lobby and hosted gameplay.'));
}catch(error){for(let i=0;i<pages.length;i++)if(!pages[i].isClosed()){console.log('PAGE',i,(await pages[i].locator('body').innerText().catch(()=>'' )).slice(0,1700));await pages[i].screenshot({path:out+'/failure-'+i+'.png'}).catch(()=>{});}throw error;}
finally{await browser?.close();await vite?.close();await app?.close();if(temp)await rm(temp,{recursive:true,force:true});}
