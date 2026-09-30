import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
const origin='http://127.0.0.1:5199';const vite=await createServer({server:{host:'127.0.0.1',port:5199,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errors=[];await mkdir('test-results/lobby-status',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/src/maintenance.js',r=>r.fulfill({contentType:'application/javascript',body:'import "/src/main.js";'}));
 const startedAt=Date.now()-65000;await p.route('**/status',r=>r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({serverTime:Date.now(),active:[{id:'fixture',startedAt,message:'Match updates are taking longer than expected.'}]})}));
 await p.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 await p.goto(origin+'/?qa');await p.locator('.yard-logo').waitFor();await p.locator('.lobby-service-status').waitFor();
 assert.equal(await p.locator('.service-issue').textContent(),'Match updates are taking longer than expected.');const first=await p.locator('.service-elapsed time').textContent();await p.waitForTimeout(1100);assert.notEqual(await p.locator('.service-elapsed time').textContent(),first);assert.match(await p.locator('.service-work').textContent(),/working/);
 for(const width of [1280,390]){
  await p.setViewportSize({width,height:800});await p.screenshot({path:`test-results/lobby-status/lobby-${width}.png`});
  const b=await p.locator('.lobby-service-status').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=800);
  const play=await p.locator('.yard-play-card').boundingBox();if(play)assert.ok(b.y+b.height<=play.y||b.x>=play.x+play.width||b.x+b.width<=play.x,'Status must not cover Play');
 }
 await p.reload();await p.locator('.lobby-service-status').waitFor();assert.match(await p.locator('.service-elapsed time').textContent(),/00:01:/);
 assert.deepEqual(errors,[]);console.log('Live lobby notice, clock, refresh and desktop/mobile layout passed');
}finally{await browser.close();await vite.close();}
