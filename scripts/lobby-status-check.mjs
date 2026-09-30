import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
const origin='http://127.0.0.1:5199';const vite=await createServer({server:{host:'127.0.0.1',port:5199,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errors=[];await mkdir('test-results/lobby-status',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/src/maintenance.js',r=>r.fulfill({contentType:'application/javascript',body:'import "/src/main.js";'}));
 const startedAt=Date.now()-65000;await p.context().route('**/status',r=>r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({serverTime:Date.now(),notice:{id:'fixture',scope:'widespread',startedAt,message:'Match updates are taking longer than expected.'},active:[]})}));
 await p.addInitScript(()=>localStorage.setItem('ravelfront-welcome-back-2026-09','dismissed'));
 await p.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 await p.goto(origin+'/?qa');await p.locator('.yard-logo').waitFor();await p.locator('.lobby-service-status').waitFor();
 assert.equal(await p.locator('.service-issue').textContent(),'Match updates are taking longer than expected.');const first=await p.locator('.service-elapsed time').textContent();await p.waitForTimeout(1100);assert.notEqual(await p.locator('.service-elapsed time').textContent(),first);assert.match(await p.locator('.service-work').textContent(),/working/);
 for(const width of [1280,390]){
  await p.setViewportSize({width,height:800});await p.screenshot({path:`test-results/lobby-status/lobby-${width}.png`});
  const b=await p.locator('.lobby-service-status').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=800);
  const play=await p.locator('.yard-play-card').boundingBox();if(play)assert.ok(b.y+b.height<=play.y||b.x>=play.x+play.width||b.x+b.width<=play.x,'Status must not cover Play');
  if(width>760){const party=await p.locator('.yard-party').boundingBox();assert.ok(b.y>=party.y+party.height,'Notice must be below Party');assert.ok(Math.abs(b.x+b.width-party.x-party.width)<2,'Notice must align with Party');assert.ok(Math.abs(b.y+b.height-play.y-play.height)<2,'Notice must sit across from matchmaking');}
 }
 await p.reload();await p.locator('.lobby-service-status').waitFor();assert.match(await p.locator('.service-elapsed time').textContent(),/00:01:/);
 const skewed=await p.context().newPage();await skewed.addInitScript(()=>{const original=Date.now;Date.now=()=>original()+7200000;});await skewed.route('**/src/maintenance.js',r=>r.fulfill({contentType:'application/javascript',body:'import \"/src/main.js\";'}));await skewed.goto(origin+'/?qa');await skewed.locator('.lobby-service-status').waitFor();const seconds=s=>s.split(':').reduce((v,n)=>v*60+Number(n),0);assert.ok(Math.abs(seconds(await skewed.locator('.service-elapsed time').textContent())-seconds(await p.locator('.service-elapsed time').textContent()))<=1,'Different computer clocks must show the same shared elapsed time');
 assert.deepEqual(errors,[]);console.log('Live lobby notice, clock, refresh and desktop/mobile layout passed');
}finally{await browser.close();await vite.close();}
