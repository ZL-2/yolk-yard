import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const role=process.argv[2],out='test-results/distributed',base='https://zl-2.github.io/yolk-yard/',checks=[],errors=[],browsers=[];
assert.ok(['host','guest'].includes(role));await mkdir(out,{recursive:true});
const pass=s=>{checks.push(s);console.log('PASS',s);};
const api='https://api.github.com/repos/'+process.env.GITHUB_REPOSITORY;
async function artifact(name,timeout=240000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  const response=await fetch(api+'/actions/runs/'+process.env.GITHUB_RUN_ID+'/artifacts',{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,'User-Agent':'Yolk-live-check'}});assert.ok(response.ok,'Artifact directory unavailable');
  const item=(await response.json()).artifacts.find(a=>a.name===name);
  if(item){const data=await fetch(item.archive_download_url,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,'User-Agent':'Yolk-live-check'}});assert.ok(data.ok);const path=out+'/'+name+'.zip';await writeFile(path,Buffer.from(await data.arrayBuffer()));return JSON.parse(execFileSync('unzip',['-p',path,name.endsWith('-ready')?name.includes('-host-')?'host-ready.json':'guest-ready.json':'guest-result.json'],{encoding:'utf8'}));}
  await new Promise(resolve=>setTimeout(resolve,1500));
 }throw Error('Timed out waiting for '+name);
}
async function make(name){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});browsers.push(browser);
 const ctx=await browser.newContext({viewport:{width:1100,height:700},deviceScaleFactor:.5});
 await ctx.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);
 const p=await ctx.newPage();p.setDefaultTimeout(90000);p.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await p.goto(base+'?verify='+Date.now());await p.locator('[data-action="play"]').waitFor();assert.equal(await p.evaluate(()=>typeof window.__yolkTest),'undefined');return p;
}
async function enter(p){
 await p.locator('#royale-hud').waitFor();
 await p.waitForFunction(()=>document.pointerLockElement||document.querySelector('#dialog[open] [data-action="resume"]'));
 if(await p.locator('#dialog [data-action="resume"]').isVisible())await p.locator('#dialog [data-action="resume"]').click();
 await p.waitForFunction(()=>!!document.pointerLockElement);
}
let page,version,ok=false;
try{
 const ref=await fetch(api+'/git/ref/heads/main',{headers:{'User-Agent':'Yolk-live-check'}}).then(r=>r.json());
 version=await fetch(base+'version.json?verify='+Date.now(),{cache:'no-store'}).then(r=>r.json());assert.equal(version.build,ref.object.sha);assert.equal(version.release,'54');pass('Published Quality Update 54 matches the current main revision');
 page=await make(role==='host'?'Release Captain':'Release Guest');await page.locator('[data-action="play"]').click();
 if(role==='host'){
  await page.locator('[data-action="play-royale"]').click();await page.locator('[data-action="play-custom"]').click();
  await page.locator('#setup-visibility').selectOption('private');await page.locator('#setup-capacity').selectOption('4');await page.locator('#setup-bots').selectOption('2');await page.locator('#setup-fill').selectOption('off');
  await artifact('quality54-guest-ready');
  await page.locator('[data-action="create-room"]').click();await enter(page);await page.waitForFunction(()=>document.body.classList.contains('in-spawn-island'));
  const code=(await page.locator('#hud-network').innerText()).split('·').at(-1).trim();assert.match(code,/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);await writeFile(out+'/host-ready.json',JSON.stringify({code,version}));
  await page.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent.includes('4/4'));pass('The host admits a human guest alongside two bots on playable Spawn Island');
  await page.waitForFunction(()=>!document.body.classList.contains('in-spawn-island')&&document.querySelector('#hud-map').textContent==='Sunnybreak Island',null,{timeout:180000});pass('Host countdown completes and changes to the real Battle Royale island');
  const result=await artifact('quality54-guest-report');assert.equal(result.ok,true,result.error);pass('Independent guest and late-spectator browser flows complete on the production relay');
 }else{
  await page.locator('[data-action="join"]').click();await writeFile(out+'/guest-ready.json',JSON.stringify({version}));const {code}=await artifact('quality54-host-ready');
  await page.locator('#join-code').fill(code);await page.locator('[data-action="join-room"]').click();await enter(page);
  await page.waitForFunction(()=>document.body.classList.contains('in-spawn-island'));assert.match(await page.locator('#royale-flight-title').innerText(),/4\/4/);assert.match(await page.locator('#royale-hotbar .royale-slot').first().innerText(),/Pickaxe/);
  await page.keyboard.down('KeyW');await page.waitForTimeout(500);await page.keyboard.up('KeyW');pass('Early non-host enters Spawn Island with controls and first-slot pickaxe');
  await page.waitForFunction(()=>!document.body.classList.contains('in-spawn-island')&&document.querySelector('#hud-map').textContent==='Sunnybreak Island',null,{timeout:180000});assert.equal(await page.locator('#royale-hotbar .royale-slot').filter({hasText:'Empty'}).count(),5);pass('Non-host reaches Battle Bus with a clean match inventory');
  await page.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent.includes('Choose your landing spot'));
  await page.keyboard.press('KeyL');assert.equal(await page.locator('#royale-flight').isVisible(),false);assert.equal(await page.evaluate(()=>!!document.pointerLockElement),true);
  await page.keyboard.down('Space');await page.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent==='Freefall');await page.keyboard.up('Space');await page.waitForTimeout(350);await page.keyboard.down('Space');await page.waitForFunction(()=>document.querySelector('#royale-flight-title').textContent==='Shell glider deployed');await page.keyboard.up('Space');pass('Non-host closes tips, keeps mouse lock, exits Bus and deploys the glider');
  await page.screenshot({path:out+'/live-glider.png',timeout:15000}).catch(()=>console.log('Optional glider screenshot unavailable'));
  await page.context().browser().close();page=await make('Release Observer');await page.locator('[data-action="play"]').click();await page.locator('[data-action="join"]').click();await page.locator('#join-code').fill(code);await page.locator('[data-action="join-room"]').click();await enter(page);
  await page.locator('#spectate-panel').waitFor();assert.equal(await page.locator('[data-action="rejoin"]').isVisible(),false);assert.equal(await page.locator('#spawn-button').isVisible(),false);assert.equal(await page.evaluate(()=>document.body.classList.contains('in-spawn-island')),false);
  await page.locator('[data-action="spectate-next"]').click();pass('Late arrival is spectator-only with living-target switching and no spawn/rejoin control');
 }
 assert.deepEqual(errors,[]);ok=true;
}catch(error){console.error(error);errors.push(error.message);if(page)await page.screenshot({path:out+'/'+role+'-failure.png',timeout:5000}).catch(()=>{});}
finally{await writeFile(out+'/'+role+'-result.json',JSON.stringify({ok,version,checks,errors,error:errors.join('; ')},null,2));await Promise.all(browsers.map(b=>b.close()));}
process.exitCode=ok?0:1;
