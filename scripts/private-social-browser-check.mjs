import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const temp=await mkdtemp('/tmp/ravel-private-browser-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';
const origin='http://127.0.0.1:5197',relay='ws://127.0.0.1:9002';
const app=await startRealtimeServer({host:'127.0.0.1',port:9002,origins:[origin]}),vite=await createServer({server:{host:'127.0.0.1',port:5197,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,channel:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?undefined:'chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}),pages=[],errors=[];
await mkdir('test-results/private-social',{recursive:true});
async function player(name){const context=await browser.newContext({viewport:{width:1440,height:900}});await context.route('**/network-config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'${relay}/game'};`}));
 const page=await context.newPage();page.setDefaultTimeout(45000);pages.push(page);page.on('pageerror',e=>errors.push(name+': '+e.message));await page.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));localStorage.setItem('ravelfront-welcome-back-2026-09','dismissed');},name);await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party().ready);return page;
}
try{
 const a=await player('Private Captain'),b=await player('Private Friend');
 assert.equal(await a.locator('vite-error-overlay').count(),0);await a.locator('#loading-screen').waitFor({state:'hidden'});assert.match(await a.locator('#menu [data-action=settings]').innerText(),/SETTINGS/);
 await b.locator('#menu .yard-nav-tools [data-action=social]').click();const code=await b.locator('.friend-code strong').innerText(),bid=await b.evaluate(()=>window.__yolkTest.party().id);await b.locator('#dialog [data-action=close]').click();
 await a.locator('#menu .yard-nav-tools [data-action=social]').click();await a.locator('[data-action=add-friend]').click();await a.locator('#friend-code').fill(code);await a.locator('#friend-find-form button').click();await a.locator('[data-social-action=friend-send]').click();
 await b.locator('#menu .yard-nav-tools [data-action=social]').click();await b.locator('[data-social-action=friend-accept]').click();await a.locator('#dialog [data-action=social]').click();await a.locator(`[data-party-invite="${bid}"]`).click();await b.locator('#dialog [data-party-accept]').click();
 await a.waitForFunction(()=>window.__yolkTest.party().party.members.length===2);await b.locator('.social-notifications .party-invitation').waitFor({state:'detached'});for(const p of [a,b])if(await p.locator('#dialog [data-action=close]').isVisible())await p.locator('#dialog [data-action=close]').click();
 await b.locator('#menu [data-action=party-ready]').click();await a.waitForFunction(()=>window.__yolkTest.party().party.members.every(m=>m.ready||m.id===window.__yolkTest.party().party.leader));
 await a.locator('[data-action=play-custom]').click();await a.locator('#setup-capacity').selectOption('8');await a.locator('#setup-teamFill').selectOption('off');assert.equal(await a.locator('#setup-visibility').inputValue(),'private');assert.equal(await a.locator('#setup-visibility').isDisabled(),true);
 await a.screenshot({path:'test-results/private-social/party-custom-setup.png'});await Promise.all([a,b].map(p=>p.setViewportSize({width:800,height:450})));await a.locator('[data-action=create-room]').click();
 await a.waitForFunction(()=>{if(window.__yolkTest.read().state?.royale?.stage!=='spawn-island')return false;window.__yolkTest.fixture(sim=>sim.queueEnds=sim.time+600);return true;});await b.waitForFunction(()=>window.__yolkTest.read().state?.royale?.stage==='spawn-island');await a.waitForFunction(()=>window.__yolkTest.party().party.state==='playing');assert.equal(app.relay.authority.rooms.size,0);assert.equal(await a.evaluate(()=>window.__yolkTest.read().host),true);
 const roster=await b.evaluate(()=>window.__yolkTest.read().state.players.filter(p=>!p.bot));assert.equal(roster.length,2);assert.equal(roster[0].team,roster[1].team);await b.locator('#loading-screen').waitFor({state:'hidden'});await b.screenshot({path:'test-results/private-social/private-party-island.png'});
 // Real host events alert only the player's teammate, not an opposing squad.
 await a.evaluate(()=>window.__yolkTest.fixture(sim=>{const enemy=[...sim.players.values()].find(p=>p.bot);sim.emit('knocked',{target:enemy.id,targetName:enemy.name});}));
 await b.waitForTimeout(200);assert.ok(!(await b.locator('#notice').innerText()).includes('Teammate downed'));
 await a.evaluate(()=>window.__yolkTest.fixture(sim=>sim.emit('knocked',{target:'host',targetName:'Private Captain'})));await b.locator('#notice').getByText('Teammate downed · Private Captain').waitFor();
 await a.evaluate(()=>window.__yolkTest.fixture(sim=>{const mate=[...sim.players.values()].find(p=>!p.bot&&p.id!=='host');sim.emit('knocked',{target:mate.id,targetName:mate.name});}));await a.locator('#notice').getByText('Teammate downed · Private Friend').waitFor();
 // Return only the friend to Social, then watch the host's private match.
 await b.evaluate(()=>document.querySelector('#dialog').close());await b.evaluate(()=>document.querySelector('[data-action=leave]')?.click());
 if(await b.evaluate(()=>window.__yolkTest.read().screen!=='menu')){await b.keyboard.press('Escape');await b.locator('[data-action=leave-confirm]').click();}
 await b.waitForFunction(()=>window.__yolkTest.read().screen==='menu');await b.locator('#menu .yard-nav-tools [data-action=social]').click();await b.locator('[data-spectate-friend]').click();
 await b.waitForFunction(()=>window.__yolkTest.read().state?.players.find(p=>p.id===window.__yolkTest.read().localId)?.friendSpectator);assert.equal(await b.locator('#spectate-panel [data-action=rejoin]').isVisible(),false);await b.locator('#loading-screen').waitFor({state:'hidden'});await b.screenshot({path:'test-results/private-social/spectate-friend.png'});
 // A committed update cannot clear on a failed request, reload, or old build.
 const version=await (await fetch(origin+'/version.json')).json();app.relay.deployment.build=version.build;await app.relay.deployment.set(true);
 await Promise.all([a,b].map(p=>p.locator('#deployment-screen').waitFor({state:'visible'})));await a.screenshot({path:'test-results/private-social/updating.png'});
 await b.route('**/deployment?*',r=>r.abort());await b.waitForTimeout(4300);assert.equal(await b.locator('#deployment-screen').isVisible(),true);await b.unroute('**/deployment?*');
 await b.reload();await b.locator('#deployment-screen').waitFor({state:'visible'});await app.relay.deployment.set(false);await Promise.all([a,b].map(p=>p.locator('#deployment-screen').waitFor({state:'hidden'})));
 assert.deepEqual(errors,[]);console.log('PASS browser settings label, friend request/accept, party ready + changed custom settings, private host match, teammate-only downed alerts, friend spectating, hidden rejoin, update overlay across failed probes/reload and exact-build reopening.');
}catch(error){for(let i=0;i<pages.length;i++){console.log('PAGE',i,await pages[i].evaluate(()=>({body:document.body.innerText.slice(0,1700),party:window.__yolkTest?.party(),screen:window.__yolkTest?.read().screen,stage:window.__yolkTest?.read().state?.royale?.stage})).catch(()=>null));await pages[i].screenshot({path:`test-results/private-social/failure-${i}.png`}).catch(()=>{});}console.log('ERRORS',errors);throw error;}
finally{await browser.close();await vite.close();await app.close();await rm(temp,{recursive:true,force:true});}
