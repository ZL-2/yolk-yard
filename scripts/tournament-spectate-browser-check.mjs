import {seedBundleVote,voteInBrowser} from '../tests/helpers/icon-vote.js';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fixture,until} from '../tests/helpers/public-match.js';
import {TOURNAMENTS} from '../src/tournament.js';
const origin='http://127.0.0.1:5300',out='test-results/tournament-spectate',code='89271406539284756012';await mkdir(out,{recursive:true});
let now=Date.parse('2026-10-27T15:00Z');
const f=await fixture({serverOptions:{origins:[origin,'https://zl-2.github.io'],ownerCode:code,tournamentOptions:{events:[],now:()=>now,autoStart:false}}}),service=f.app.relay.tournament;
const base='http://127.0.0.1:'+f.app.server.address().port;let token;
async function post(path,body){const r=await fetch(base+'/owner/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:JSON.stringify({...body,token})});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
token=(await post('login',{code})).token;
// Use the same authenticated schedule API as the website editor, not a coded event.
const definition={...TOURNAMENTS[1],name:'Spectate Verification Cup',description:'Owner-created spectator verification event.',teamSize:3,opensAt:now+3600000,lockAt:now+3420000,startsAt:now+3660000,capacity:6,spectators:1};
const created=await post('action',{action:'tournament-save',event:definition,revision:service.catalog.revision,requestId:randomUUID(),reason:'Isolated browser spectating verification.'}),event=service.event(created.eventId);
await seedBundleVote(f.app.relay.iconVoting);
const vite=await createServer({server:{host:'127.0.0.1',port:5300,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:.5,bypassCSP:true,permissions:['local-network-access']}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
try{
 if(process.env.SPARSE_ASSET_ORIGIN)await page.route(/\/(?:models|art|audio|inventory-previews|season|shop|loading|modes|compete|campaign)\//,async route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.continue();try{const response=await fetch(process.env.SPARSE_ASSET_ORIGIN+url.pathname,{signal:AbortSignal.timeout(30000)});await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/octet-stream',body:Buffer.from(await response.arrayBuffer())});}catch{await route.abort('failed');}});
 await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${f.app.server.address().port}/game'};`}));
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Cup Spectate Reviewer',weapon:'sprinter'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:30}));localStorage.setItem('ravelfront-stormspike-kestrel-199-dismissed','yes');});
 console.log('Opening Cup lobby');await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);await voteInBrowser(page);
 console.log('Lobby ready, starting edited Cup');const players=[await f.user('Cup Alpha'),await f.user('Cup Bravo')];now=definition.opensAt;service.tick();
 for(const u of players){console.log('Admitting',u.profile.name);await u.ask('tournament-join',{eventId:event.id});const g=await f.game(u);g.net.input({seq:1,dt:1/60,yaw:0,pitch:0});}
 await until(()=>[...event.room.sim.players.values()].every(p=>!p.loading),'Contestants loaded');event.room.sim.tickActivity=()=>{};
 now=definition.startsAt;service.tick();assert.equal(event.phase,'running');
 console.log('Cup running, testing full spectator seats');const overflow=await f.user('Cup Viewer');await overflow.ask('tournament-join',{eventId:event.id,spectate:true});const occupied=await f.game(overflow);
 await page.locator('[data-action=tournament-spectate]').waitFor();assert.equal(await page.locator('[data-action=tournament-spectate]').isEnabled(),true);
 await page.locator('[data-action=tournament-spectate]').click();await page.locator('[data-tournament-entry-error]').waitFor();assert.match(await page.locator('[data-tournament-entry-error]').innerText(),/spectator seats are full/);await page.screenshot({path:out+'/full-seats.png'});await page.locator('#dialog [data-action=close]').last().click();
 occupied.net.destroy();await until(()=>!event.room.sim.players.has(occupied.net.id),'Viewer seat released');await overflow.ask('returned');
 console.log('Seat free, clicking lobby Spectate');const button=page.locator('[data-action=tournament-spectate]');await button.click();
 await page.waitForFunction(()=>{const r=window.__yolkTest.read();return r.screen==='game'&&r.state?.players.some(p=>p.id===r.localId&&p.spectating&&p.lateSpectator&&!p.contestant);});
 await page.locator('#loading-screen').waitFor({state:'hidden'});await page.locator('#spectate-panel').waitFor();assert.equal(await page.locator('#spectate-panel [data-action=rejoin]').isHidden(),true);
 await page.evaluate(()=>window.__yolkTest.resume());const first=await page.locator('#spectate-info').innerText();await page.locator('[data-action=spectate-next]').click();await page.waitForFunction(old=>document.querySelector('#spectate-info').textContent!==old,first);await page.screenshot({path:out+'/watching.png'});
 const identity=await page.evaluate(()=>window.__yolkTest.party().id),time=await page.evaluate(()=>window.__yolkTest.read().state.time);await page.waitForFunction(t=>window.__yolkTest.read().state.time>t+.5,time);assert.equal(f.app.owner.grantSummary(identity).marks,0);
 await page.evaluate(()=>window.__yolkTest.leave());await page.locator('[data-action=tournament-spectate]').waitFor();await until(()=>event.summary().spectators===0,'Leaving the lobby viewer releases the seat');await page.locator('[data-action=tournament-spectate]').click();await page.waitForFunction(()=>window.__yolkTest.read().screen==='game');await page.locator('#loading-screen').waitFor({state:'hidden'});
 assert.equal(event.summary().spectators,1);assert.equal([...event.room.sim.players.values()].filter(p=>p.memberId===identity).length,1);
 // The in-match owner panel must work for a Cup spectator, not only the host.
 await page.evaluate(()=>window.__yolkTest.resume());await page.keyboard.press('Slash');await page.locator('#chat-input').fill('/'+code);await page.locator('#chat-input').press('Enter');await page.locator('.om-context').filter({hasText:'FRONTIER CUP'}).waitFor();
 await page.locator(`[data-player="${players[0].id}"]`).click();await page.locator('.om-reason').fill('Please stop coordinating with opposing teams.');await page.locator('[data-om-action=warn]').click();await page.locator('.om-apply').click();await page.locator('.om-status').filter({hasText:'Warn applied'}).waitFor();assert.ok((await players[0].ask('owner-match-status')).notices.some(n=>n.kind==='warn'));
 await page.locator('.om-reason').fill('Ending this isolated verification event.');await page.locator('[data-om-action=end-match]').click();assert.match(await page.locator('.om-confirm').innerText(),/cancelled without Cup rewards/);await page.locator('.om-apply').click();await page.waitForFunction(()=>window.__yolkTest.read().screen==='menu');assert.equal(event.phase,'cancelled');assert.deepEqual(event.state.results,[]);assert.ok(players.every(p=>f.app.owner.grantSummary(p.id).marks===0));await page.screenshot({path:out+'/cancelled.png'});
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({passed:true,checks:['website-created-cup','lobby-spectate-button','full-seat-message','seat-release','live-viewer','switch-camera','no-contestant-seat-or-prize','leave-and-rejoin','spectating-owner-panel','private-warning','owner-cup-cancellation'],errors},null,2));console.log('PASS lobby Cup spectating, full seats, live camera, return/rejoin and in-Cup owner actions');
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error('Spectate failure',await page.evaluate(()=>({screen:window.__yolkTest?.read().screen,dialog:document.querySelector('#dialog')?.innerText,menu:document.querySelector('#menu')?.innerText.slice(0,350)})).catch(()=>null),errors);throw error;}finally{await browser.close();await vite.close();await f.close();}
