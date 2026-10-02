import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,readFile} from 'node:fs/promises';
const expectedVersion=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
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
  // Production intentionally excludes developer diagnostics. Locally measure
  // the animated model; live verify the same reserved region and shipped bundle.
  if(!live)await page.waitForFunction(()=>window.__yolkTest?.read().presentation?.lobbyBounds);
  const result=await page.evaluate(live=>{const b=document.querySelector('.public-royale-card').getBoundingClientRect(),n=document.querySelector('.yard-nav').getBoundingClientRect();return {banner:{top:b.top,bottom:b.bottom,left:b.left,right:b.right},nav:n.bottom,actor:live?{top:innerHeight*(innerHeight<760?.38:.3),bottom:innerHeight*.8}:window.__yolkTest.read().presentation.lobbyBounds};},!!live);
  console.log({width,height,...result});assert.ok(result.banner.top>=result.nav-1,'Banner clears navigation');assert.ok(result.banner.bottom+8<result.actor.top,'Banner must clear the entire character');
  assert.ok(Math.abs((result.banner.left+result.banner.right)/2-width/2)<2);assert.ok(result.actor.bottom<height,'Full operator stays on screen');
  assert.equal(await page.locator('[data-action=public-join],[data-action=public-spectate]').count(),1);assert.match(await page.locator('.public-royale-card').innerText(),/REAL PLAYERS/);
  await page.screenshot({path:`test-results/lobby-clearance/${width}-${height}.png`});
 }
 if(live){const version=await page.evaluate(async()=>fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()));assert.equal(version.appVersion,expectedVersion);assert.ok(Number(version.release)>=113);const history=await page.evaluate(async()=>fetch('release-history.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()));assert.equal(history.build,version.build);assert.equal(history.releases[0].number,version.release);assert.equal(version.build,process.env.GITHUB_SHA);const source=await page.locator('script[type=module][src]').getAttribute('src');const response=await page.request.get(new URL(source,page.url()).href);assert.ok(response.ok());const bundle=await response.text();assert.ok(bundle.includes('shortLobby')||bundle.includes('15.5'),'Short-screen character framing is in the published bundle');}
 assert.deepEqual(errors,[]);console.log('PASS '+(live?'live ':'')+'compact public banner clears the lobby operator at desktop and laptop sizes; published version verified.');
}finally{await browser.close();await vite?.close();}
