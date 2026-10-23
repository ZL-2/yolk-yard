import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fixture} from '../tests/helpers/public-match.js';
import {TOURNAMENTS} from '../src/tournament.js';
const [friday,monday]=TOURNAMENTS,origin='http://127.0.0.1:5292',out='test-results/compete';await mkdir(out,{recursive:true});let now=friday.startsAt+240000;
const f=await fixture({serverOptions:{origins:[origin,'https://zl-2.github.io'],tournamentOptions:{now:()=>now,autoStart:false}}}),service=f.app.relay.tournament;
service.event(friday.id).complete('finished','Tournament complete. Normal matchmaking is open.',Array.from({length:30},(_,i)=>({identity:'fixture-'+i,name:i?'Player '+(i+1):'Archive Champion',place:i+1,kills:30-i})));
const vite=await createServer({server:{host:'127.0.0.1',port:5292,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const errors=[],page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,bypassCSP:true});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${f.app.server.address().port}/game'};`}));
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Compete Reviewer',weapon:'sprinter'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:30}));localStorage.setItem('ravelfront-stormspike-kestrel-199-dismissed','yes');});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);await page.waitForFunction(()=>!document.querySelector('#loading')||document.querySelector('#loading').hidden);
 await page.locator('.tournament-standings').waitFor();const table=await page.locator('.tournament-standings').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));assert.ok(table.scroll>table.height,'Lobby placements scroll');await page.screenshot({path:out+'/lobby-results.png'});
 const tabs=await page.locator('nav[aria-label="Main navigation"] button').allTextContents();assert.equal(tabs[tabs.indexOf('CAREER')-1],'COMPETE');
 await page.getByRole('button',{name:'COMPETE',exact:true}).click();await page.locator('.compete-event-card').first().waitFor();assert.equal(await page.locator('.compete-event-card').count(),2);await page.screenshot({path:out+'/schedule.png'});
 await page.locator('[data-compete-view="month"]').click();assert.equal(await page.locator('[data-compete-day]').count(),42);await page.screenshot({path:out+'/calendar.png'});
 await page.locator('[data-compete-filter="upcoming"]').click();assert.equal(await page.locator('.compete-event-card').count(),1);await page.locator('.compete-event-card').click();await page.locator('.compete-event-hero').waitFor();await page.screenshot({path:out+'/monday-event.png'});assert.match(await page.locator('.compete-event-hero').innerText(),/12:00 PM/);
 await page.locator('[data-compete-bookmark]').click();assert.equal(await page.locator('[data-compete-bookmark]').getAttribute('aria-pressed'),'true');await page.locator('[data-compete-tab="rewards"]').click();assert.match(await page.locator('.compete-prizes').innerText(),/10,000 Marks instead/);await page.screenshot({path:out+'/rewards.png'});
 await page.locator('[data-compete-back]').click();await page.locator('[data-compete-filter="past"]').click();await page.locator('.compete-event-card').click();await page.locator('[data-compete-tab="leaderboard"]').click();assert.equal(await page.locator('.tournament-standings tbody tr').count(),30);await page.locator('[data-compete-search]').fill('Player 30');assert.equal(await page.locator('.tournament-standings tbody tr').count(),1);assert.match(await page.locator('.tournament-standings').innerText(),/0 Marks/);await page.locator('[data-compete-search]').fill('');await page.screenshot({path:out+'/placements.png'});
 await page.getByRole('button',{name:'PLAY',exact:true}).click();now+=7200001;service.tick();await page.waitForFunction(()=>!document.querySelector('.tournament-card'));
 now=monday.opensAt-3600001;service.tick();await page.waitForTimeout(300);assert.equal(await page.locator('.tournament-card').count(),0);now=monday.opensAt-3600000;service.tick();await page.locator('.tournament-card').waitFor();assert.match(await page.locator('.tournament-card').innerText(),/12:00 PM/);assert.equal(await page.locator('[data-action="tournament-join"]').isDisabled(),true);
 now=monday.opensAt;service.tick();await page.getByRole('button',{name:'JOIN TOURNAMENT',exact:true}).waitFor();assert.equal(await page.locator('[data-action="tournament-join"]').isEnabled(),true);assert.equal(await page.locator('.lobby-play').isDisabled(),true);
 await page.locator('[data-action="compete-event"]').click();assert.match(await page.locator('.compete-event-hero').innerText(),/12:00 PM/);await page.setViewportSize({width:1024,height:768});await page.screenshot({path:out+'/desktop-1024.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS Compete navigation, schedule, calendar, bookmarks, rewards, searchable standings, card windows and entry lock');await writeFile(out+'/result.json',JSON.stringify({errors,table,tabs},null,2));
}catch(error){await page.screenshot({path:out+'/failure.png'});console.log({errors});throw error;}finally{await browser.close();await vite.close();await f.close();}
