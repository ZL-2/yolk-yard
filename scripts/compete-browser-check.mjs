import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fixture} from '../tests/helpers/public-match.js';
import {TOURNAMENTS} from '../src/tournament.js';
const [friday,monday]=TOURNAMENTS,origin='http://127.0.0.1:5292',out='test-results/compete';await mkdir(out,{recursive:true});let now=friday.startsAt+240000;
const f=await fixture({serverOptions:{origins:[origin,'https://zl-2.github.io'],tournamentOptions:{events:[friday,{...monday,teamSize:2}],now:()=>now,autoStart:false}}}),service=f.app.relay.tournament;
f.app.relay.iconVoting.now=()=>Date.parse('2026-10-23T18:00Z');
await f.app.relay.iconVoting.mutate('browser-fixture',{action:'nominate',first:'Fixture',last:'Operator'});
service.event(friday.id).complete('finished','Tournament complete. Normal matchmaking is open.',Array.from({length:30},(_,i)=>({identity:'fixture-'+i,name:i?'Player '+(i+1):'Archive Champion',place:i+1,kills:30-i})));
const vite=await createServer({server:{host:'127.0.0.1',port:5292,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const errors=[],page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:process.env.CI ? .6 : 1,bypassCSP:true});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${f.app.server.address().port}/game'};`}));
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Compete Reviewer',weapon:'sprinter'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:30}));localStorage.setItem('ravelfront-stormspike-kestrel-199-dismissed','yes');});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);await page.waitForFunction(()=>!document.querySelector('#loading')||document.querySelector('#loading').hidden);
 // Complete the existing vote prerequisite on this isolated fixture before
 // asserting lobby focus or interacting with the underlying game menus.
 await page.locator('.icon-voting[open] [data-candidate]').first().click();await page.locator('.icon-voting [data-cast]').click();await page.locator('.icon-voting[open]').waitFor({state:'hidden'});
 await page.locator('[data-action="lobby-options"]').click();await page.locator('#lobby-teamSize').selectOption('3');await page.waitForFunction(()=>window.__yolkTest.party().party.selection.teamSize===3);
 await page.locator('#lobby-access').selectOption('private');await page.waitForFunction(()=>window.__yolkTest.party().party.selection.access==='private');assert.equal(await page.locator('#lobby-teamSize').inputValue(),'3');await page.screenshot({path:out+'/trios-options.png'});await page.locator('#lobby-options-form [data-action="close"]').click();

 await page.locator('.tournament-standings').waitFor();const table=await page.locator('.tournament-standings').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));assert.ok(table.scroll>table.height,'Lobby placements scroll');await page.screenshot({path:out+'/lobby-results.png'});
 assert.ok(await page.evaluate(async event=>{const {updateTournamentCard}=await import('/src/tournament-ui.js');const list=document.querySelector('.tournament-standings');list.scrollTop=60;list.focus();updateTournamentCard(document,event,true,event.serverNow+1000);return list.isConnected&&list.scrollTop===60&&document.activeElement===list;},service.summary()),'Clock refresh retains standings scroll and keyboard focus');
 const tabs=await page.locator('nav[aria-label="Main navigation"] button').allTextContents();assert.equal(tabs[tabs.indexOf('CAREER')-1],'COMPETE');
 await page.getByRole('button',{name:'COMPETE',exact:true}).click();await page.locator('.compete-event-card').first().waitFor();assert.equal(await page.locator('.compete-event-card').count(),2);await page.screenshot({path:out+'/schedule.png'});
 await page.locator('[data-compete-view="month"]').click();assert.equal(await page.locator('[data-compete-day]').count(),42);await page.screenshot({path:out+'/calendar.png'});
 await page.locator('[data-compete-filter="upcoming"]').click();assert.equal(await page.locator('.compete-event-card').count(),1);await page.locator('.compete-event-card').click();await page.locator('.compete-event-hero').waitFor();await page.screenshot({path:out+'/monday-event.png'});assert.match(await page.locator('.compete-event-hero').innerText(),/12:00 PM/);
 await page.locator('[data-compete-bookmark]').click();assert.equal(await page.locator('[data-compete-bookmark]').getAttribute('aria-pressed'),'true');await page.locator('[data-compete-tab="rewards"]').click();assert.match(await page.locator('.compete-prizes').innerText(),/10,000 Marks instead/);await page.screenshot({path:out+'/rewards.png'});
 await page.locator('[data-compete-back]').click();await page.locator('[data-compete-filter="past"]').click();await page.locator('.compete-event-card').click();await page.locator('[data-compete-tab="leaderboard"]').click();assert.equal(await page.locator('.tournament-standings tbody tr').count(),30);await page.locator('[data-compete-search]').fill('Player 30');assert.equal(await page.locator('.tournament-standings tbody tr').count(),1);assert.match(await page.locator('.tournament-standings').innerText(),/0 Marks/);await page.locator('[data-compete-search]').fill('');await page.screenshot({path:out+'/placements.png'});
 await page.getByRole('button',{name:'PLAY',exact:true}).click();now+=7200001;service.tick();await page.waitForFunction(()=>!document.querySelector('.tournament-card'));
 // The client clock correctly advances between server updates. Keep this
 // browser assertion clear of the boundary; the unit test checks the exact ms.
 now=monday.opensAt-7260000;service.tick();await page.waitForTimeout(300);assert.equal(await page.locator('.tournament-card').count(),0);now=monday.opensAt-7200000;service.tick();await page.locator('.tournament-card').waitFor();assert.match(await page.locator('.tournament-card').innerText(),/12:00 PM/);assert.equal(await page.locator('[data-action="tournament-join"]').isDisabled(),true);
 now=monday.opensAt;service.tick();await page.getByRole('button',{name:'JOIN TOURNAMENT',exact:true}).waitFor();assert.equal(await page.locator('[data-action="tournament-join"]').isEnabled(),true);assert.equal(await page.locator('.lobby-play').isDisabled(),true);
 assert.ok(await page.evaluate(async event=>{const {updateTournamentCard}=await import('/src/tournament-ui.js');const button=document.querySelector('[data-action="compete-event"]');button.focus();for(let i=1;i<=3;i++)updateTournamentCard(document,event,true,event.serverNow+i*1000);return button.isConnected&&document.activeElement===button;},service.summary()),'Countdown retains the clickable event button');
 // Exercise the actual server rejection and both client entry buttons.
 assert.match(await page.locator('.tournament-card .tournament-team-entry').innerText(),/LOBBY PARTY FIRST/);
 await page.screenshot({path:out+'/team-entry-lobby.png'});
 const p=f.app.relay.parties,reviewer=p.users.get(await page.evaluate(()=>window.__yolkTest.party().id)),guests=[await f.user('Party Guest One'),await f.user('Party Guest Two')];
 for(const guest of guests)p.join(p.users.get(guest.id),reviewer.party);
 await page.waitForFunction(()=>window.__yolkTest.party().party.members.length===3);
 await page.locator('[data-action="tournament-join"]').click();await page.locator('#dialog[data-kind="tournament-entry"][open]').waitFor();
 assert.match(await page.locator('[data-tournament-entry-error]').innerText(),/Your party has 3 players.*Frontier Cup - Duos.*at most 2 players/);
 assert.equal(service.event(monday.id).entryTeams.size,0);assert.equal(p.tickets.size,0);await page.screenshot({path:out+'/party-too-large.png'});
 await page.locator('#dialog button[data-action="close"]').last().click();
 await page.locator('[data-action="compete-event"]').click();assert.match(await page.locator('.compete-event-hero').innerText(),/12:00 PM/);
 assert.match(await page.locator('.compete-event-hero .tournament-team-entry').innerText(),/1–2 players allowed.*2 maximum/);
 await page.locator('[data-compete-join]').click();await page.locator('#dialog[data-kind="tournament-entry"][open]').waitFor();
 assert.match(await page.locator('[data-tournament-entry-error]').innerText(),/Your party has 3 players.*at most 2 players/);
 await page.locator('#dialog button[data-action="close"]').last().click();
 // A valid-size party member gets the leader instruction instead of silently entering alone.
 await guests[1].ask('leave');const current=p.parties.get(reviewer.party);current.leader=guests[0].id;p.sync(current);
 await page.waitForFunction(()=>window.__yolkTest.party().party.members.length===2&&window.__yolkTest.party().party.leader!==window.__yolkTest.party().id);
 await page.locator('[data-compete-join]').click();await page.locator('#dialog[data-kind="tournament-entry"][open]').waitFor();assert.match(await page.locator('[data-tournament-entry-error]').innerText(),/party leader must enter the team/);
 assert.equal(service.event(monday.id).entryTeams.size,0);await page.locator('#dialog button[data-action="close"]').last().click();
 await page.setViewportSize({width:1024,height:768});await page.screenshot({path:out+'/desktop-1024.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS Compete navigation, schedule, calendar, bookmarks, rewards, searchable standings, card windows, team entry directions, oversized-party popups, leader-only entry and entry lock');await writeFile(out+'/result.json',JSON.stringify({errors,table,tabs},null,2));
}catch(error){await page.screenshot({path:out+'/failure.png'});console.log({errors});throw error;}finally{await browser.close();await vite.close();await f.close();}
