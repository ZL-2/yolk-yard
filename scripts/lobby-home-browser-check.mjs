import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import {fixture} from '../tests/helpers/public-match.js';
import {TOURNAMENTS} from '../src/tournament.js';
const origin='http://127.0.0.1:5296',out='test-results/lobby-home';
await mkdir(out,{recursive:true});
let now=Date.parse('2026-10-24T18:00Z');
const f=await fixture({serverOptions:{origins:[origin],tournamentOptions:{now:()=>now,autoStart:false}}});
now-=10800000;f.app.relay.tournament.event(TOURNAMENTS[0].id).complete('cancelled','Past fixture event');now+=10800000;
for(let i=0;i<25;i++)Object.assign(f.app.relay.progression.account('review-'+i),{publicName:'Operator '+(i+1),publicParticipant:true,publicTotals:{version:1,kills:500-i*17,wins:30-i}});
const vite=await createServer({server:{host:'127.0.0.1',port:5296,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,bypassCSP:true}),errors=[];
page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
const clear=(a,b)=>a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1;
async function layout(){
 const selectors=['.yard-nav','.lobby-news','.lobby-deploy','.yard-party','.yard-community-actions','.frontier-leaderboard','.yard-footer'];
 const rects=await page.evaluate(selectors=>selectors.map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),clip=e.closest('.yard-party-stack')?.getBoundingClientRect();return {s,x:r.x,y:r.y,width:r.width,height:Math.max(0,Math.min(r.bottom,clip?.bottom??r.bottom)-r.y)};}),selectors);
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert.ok(clear(rects[i],rects[j]),'Overlapping '+rects[i].s+' / '+rects[j].s);
 for(const selector of ['.lobby-play','.yard-nav-tools','.yard-invite','.lobby-more summary']){const r=await page.locator(selector).boundingBox(),v=page.viewportSize();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1,selector+' clipped');}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
}
try{
 await page.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${f.app.server.address().port}/game'};`}));
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Zach',weapon:'sprinter'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:30}));localStorage.setItem('ravelfront-stormspike-kestrel-199-dismissed','yes');});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party()?.ready);await page.waitForFunction(()=>!document.querySelector('#loading')||document.querySelector('#loading').hidden);
 await page.locator('.lobby-comms:not([hidden])').waitFor();await page.locator('.frontier-rank').nth(20).waitFor({state:'attached'});await layout();await page.screenshot({path:out+'/desktop.png'});
 for(const viewport of [{width:1280,height:720},{width:1024,height:600}]){await page.setViewportSize(viewport);await layout();await page.screenshot({path:out+'/'+viewport.width+'.png'});}
 await page.locator('[data-action="leaderboard-open"]').scrollIntoViewIfNeeded();await page.locator('[data-action="leaderboard-open"]').click();await page.locator('.frontier-leaderboard-expanded').waitFor();await page.keyboard.press('Escape');await page.locator('.yard-party-stack').evaluate(e=>e.scrollTop=0);
 await page.locator('.lobby-chat-toggle').click();await page.locator('.lobby-chat-panel:not([hidden])').waitFor();const chat=await page.locator('.lobby-chat-panel').boundingBox();assert.ok(chat.y>76&&chat.y+chat.height<600);await page.locator('.lobby-chat-toggle').click();
 await page.locator('.lobby-more summary').click();await page.locator('.lobby-more-menu [data-action="help"]').click();await page.locator('#dialog[open]').waitFor();await page.keyboard.press('Escape');
 await page.locator('[data-action="choose-mode"]').click();await page.locator('.lobby-discover').waitFor();await page.keyboard.press('Escape');
 await page.locator('[data-action="lobby-options"]').click();await page.locator('#lobby-options-form').waitFor();await page.keyboard.press('Escape');
 const privacy=await page.locator('.lobby-privacy-toggle').innerText();await page.locator('.lobby-privacy-toggle').click();await page.waitForFunction(before=>document.querySelector('.lobby-privacy-toggle').innerText!==before,privacy);await page.locator('.lobby-privacy-toggle').click();
 for(const action of ['locker','compete','career','lobby-home']){await page.locator('.yard-nav nav [data-action="'+action+'"]').click();await page.waitForTimeout(100);}
 await page.locator('.lobby-deploy').waitFor();await page.setViewportSize({width:1280,height:720});
 now=TOURNAMENTS[1].opensAt-600000;f.app.relay.tournament.tick();await page.locator('.tournament-card').waitFor();
 const cup=await page.locator('.tournament-card').boundingBox();for(const s of ['.lobby-deployment-rail','.yard-party-stack','.yard-nav','.yard-character-label'])assert.ok(clear(cup,await page.locator(s).boundingBox()),'Tournament overlaps '+s);
 await page.screenshot({path:out+'/tournament.png'});assert.deepEqual(errors,[]);
 console.log('PASS home layout at 1440/1280/1024, primary controls, chat, help, options, privacy, navigation and tournament clearance');
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();await vite.close();await f.close();}
