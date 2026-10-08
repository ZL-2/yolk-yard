import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const origin='http://127.0.0.1:5218',out='test-results/bot-behavior',temp=await mkdtemp('/tmp/ravel-bot-browser-');
process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/rewards.json';process.env.RAVEL_MAP_DATA_PATH=temp+'/maps.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';
const app=await startRealtimeServer({port:9002,host:'127.0.0.1',origins:[origin]}),vite=await createServer({server:{host:'127.0.0.1',port:5218,strictPort:true,watch:null}});
let browser;const errors=[];
try{
 await vite.listen();await mkdir(out,{recursive:true});browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 async function player(name){const context=await browser.newContext({viewport:{width:1100,height:720}});await context.route('**/network-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.YOLK_NETWORK={relay:'ws://127.0.0.1:9002/game'};"}));const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(name+': '+e.message));await page.addInitScript(name=>{localStorage.setItem('ravelfront-season-1-dismissed','yes');localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);await page.goto(origin+'/?qa');await page.locator('#loading-screen').waitFor({state:'hidden'});await page.waitForFunction(()=>window.__yolkTest.party().ready);return page;}
 const host=await player('AI Browser Host');await host.locator('[data-action=public-join]').click();await host.waitForFunction(()=>window.__yolkTest.read().host&&window.__yolkTest.read().screen==='game');await host.locator('#loading-screen').waitFor({state:'hidden'});await host.evaluate(()=>window.__yolkTest.fixture(s=>s.queueEnds=s.time+3600));
 const guest=await player('AI Browser Guest');await guest.locator('[data-action=public-join]').click();await guest.waitForFunction(()=>window.__yolkTest.read().screen==='game');await guest.locator('#loading-screen').waitFor({state:'hidden'});
 for(const page of [host,guest]){const resume=page.locator('#dialog [data-action=resume]');if(await resume.isVisible())await resume.click();else await page.mouse.click(550,360);}
 await host.evaluate(async()=>{const {groundAt}=await import('/src/terrain.js');window.__yolkTest.fixture(s=>{s.beginBattle();s.startedAt=s.time-60;s.stage='active';s.supplyAt=9999;for(const p of s.players.values()){if(p.boss)continue;const q=p.botLand||s.map.floorLoot[0];Object.assign(p,{x:q.x,y:q.y??groundAt(s.map,q.x,q.z),z:q.z,flight:'ground',grounded:true,health:100,shield:100,shieldUntil:p.bot?0:Infinity,brain:null,botPath:[]});if(p.bot){p.inventory[1]={id:'sprinter',weapon:true,rarity:1,ammo:30};p.slot=1;p.bank.medium=120;s.syncInventory(p);}}});});
 await host.waitForFunction(()=>window.__yolkTest.fixture(s=>[...s.players.values()].filter(p=>p.bot&&!p.boss&&p.brain?.task).length>=40));
 await guest.waitForFunction(()=>window.__yolkTest.read().state?.royale?.stage==='active');
 const first=await guest.evaluate(()=>({time:window.__yolkTest.read().state.time,players:window.__yolkTest.read().state.players.filter(p=>p.bot&&!p.boss).map(p=>({id:p.id,x:p.x,z:p.z}))}));
 await guest.waitForFunction(time=>window.__yolkTest.read().state.time>=time+4,first.time);
 const next=await guest.evaluate(()=>window.__yolkTest.read().state.players),moved=first.players.filter(p=>{const q=next.find(q=>q.id===p.id);return q&&Math.hypot(q.x-p.x,q.z-p.z)>1;}).length;
 assert.ok(moved>=20,'guest should receive purposeful movement for most bots: '+moved);assert.equal(app.relay.authority.rooms.size,0);assert.equal(await host.locator('.lag-diagnostics').count(),0);
 const summary=await host.evaluate(()=>window.__yolkTest.fixture(s=>{const bots=[...s.players.values()].filter(p=>p.bot&&!p.boss);return {bots:bots.length,thinking:bots.filter(p=>p.brain?.task).length,personalities:[...new Set(bots.map(p=>p.brain?.personality))],tasks:[...new Set(bots.map(p=>p.brain?.task?.kind))]};}));
 assert.ok(summary.personalities.filter(Number.isInteger).length===4);assert.deepEqual(errors,[]);await guest.screenshot({path:out+'/guest.png'});await writeFile(out+'/browser.json',JSON.stringify({moved,...summary,errors},null,2));console.log(JSON.stringify({moved,...summary,errors}));
}finally{await browser?.close();await vite.close();await app.close();}
