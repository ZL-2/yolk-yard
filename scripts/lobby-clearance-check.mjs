import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
const live=process.env.RAVEL_FRONTEND_URL,origin=live||'http://127.0.0.1:5197';
const vite=live?null:await createServer({server:{host:'127.0.0.1',port:5197,strictPort:true,watch:null}});await vite?.listen();
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 await mkdir('test-results/lobby-clearance',{recursive:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Zach'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));localStorage.setItem('ravelfront-welcome-back-2026-09','dismissed');});
 for(const [width,height]of [[1440,900],[1366,650],[1280,600],[1024,600]]){
  await page.setViewportSize({width,height});await page.goto(origin+'/?qa&clearance='+Date.now());await page.locator('#loading-screen').waitFor({state:'hidden'});await page.locator('.public-royale-card').waitFor();
  assert.ok((await page.locator('body').innerText()).includes('RAVEL'));assert.equal(await page.locator('vite-error-overlay,[data-nextjs-dialog]').count(),0);
  await page.waitForFunction(()=>window.__yolkTest?.read().presentation?.lobbyBounds);
  const result=await page.evaluate(()=>{const b=document.querySelector('.public-royale-card').getBoundingClientRect(),n=document.querySelector('.yard-nav').getBoundingClientRect();return {banner:{top:b.top,bottom:b.bottom,left:b.left,right:b.right},nav:n.bottom,actor:window.__yolkTest.read().presentation.lobbyBounds};});
  console.log({width,height,...result});assert.ok(result.banner.top>=result.nav-1,'Banner clears navigation');assert.ok(result.banner.bottom+8<result.actor.top,'Banner must clear the entire character');
  assert.ok(Math.abs((result.banner.left+result.banner.right)/2-width/2)<2);assert.ok(result.actor.bottom<height,'Full operator stays on screen');
  assert.equal(await page.locator('[data-action=public-join],[data-action=public-spectate]').count(),1);assert.match(await page.locator('.public-royale-card').innerText(),/REAL PLAYERS/);
  await page.screenshot({path:`test-results/lobby-clearance/${width}-${height}.png`});
 }
 if(live){const version=await page.evaluate(async()=>fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()));assert.equal(version.appVersion,'3.8.3');assert.equal(version.release,'113');assert.equal(version.build,process.env.GITHUB_SHA);}
 assert.deepEqual(errors,[]);console.log('PASS '+(live?'live ':'')+'compact public banner clears the lobby operator at desktop and laptop sizes; published version verified.');
}finally{await browser.close();await vite?.close();}
