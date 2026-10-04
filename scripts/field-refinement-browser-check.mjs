import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {RELEASE_NOTES} from '../src/releases.js';
const live=process.env.RAVEL_FRONTEND_URL,origin=(live||'http://127.0.0.1:5201').replace(/\/$/,''),out='test-results/field-refinement';
const vite=live?null:await createServer({server:{host:'127.0.0.1',port:5201,strictPort:true,watch:null}});await vite?.listen();
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],metrics={live:!!live,viewports:[]};page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
try{
 await page.addInitScript(()=>{localStorage.setItem('ravelfront-season-1-dismissed','yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));localStorage.setItem('yolk-profile',JSON.stringify({name:'Field Check'}));});
 await page.goto(origin+'/?qa&refinement='+Date.now());await page.locator('#loading-screen').waitFor({state:'hidden'});assert.equal(await page.locator('vite-error-overlay').count(),0);
 await page.locator('[data-action=settings]').click();await page.locator('[data-settings-tab=audio]').click();assert.equal(await page.locator('#visualSoundEffects').isChecked(),true);await page.locator('#visualSoundEffects').uncheck();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-settings')).visualSoundEffects),false);await page.locator('#visualSoundEffects').check();await page.locator('#dialog [data-action=close]').first().click();
 await page.locator('[data-action=training]').click();await page.locator('[data-action=start-training]').click();await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.evaluate(()=>document.querySelector('#royale-hud [data-action=royale-inventory]').click());await page.locator('.royale-inventory-grid').waitFor({state:'visible'});await page.locator('#dialog [data-royale-slot="1"]').click();await page.locator('[data-action=royale-inspect]').click();await page.locator('#inventory-inspect .weapon-stats').waitFor({state:'visible'});
 for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:1024,height:640},{width:800,height:600}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(250);
  const layout=await page.locator('#dialog').evaluate(d=>{const footer=d.querySelector('.inventory-actions').getBoundingClientRect(),cards=[...d.querySelectorAll('.inventory-ammo,[data-royale-slot]')].map(e=>e.getBoundingClientRect());return {scroll:d.scrollHeight> d.clientHeight+2,bodyScroll:d.querySelector('.dialog-body').scrollHeight>d.querySelector('.dialog-body').clientHeight+2,footerBottom:footer.bottom,cards:cards.map(r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right}))};});
  metrics.viewports.push({viewport,layout});assert.equal(layout.scroll,false,'inventory fits '+JSON.stringify(viewport));assert.equal(layout.bodyScroll,false);assert.ok(layout.footerBottom<=viewport.height);assert.equal(layout.cards.length,14);assert.ok(layout.cards.every(r=>r.top>=0&&r.bottom<=viewport.height));
 }
 await page.setViewportSize({width:1280,height:720});await page.screenshot({path:out+'/inventory.png'});
 // Drag across the real modal backdrop, beyond the inventory dialog's left edge.
 const slot=page.locator('#dialog [data-royale-slot="1"]'),box=await slot.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-15,box.y+box.height/2,{steps:5});await page.mouse.move(40,box.y+box.height/2,{steps:25});await page.mouse.up();
 await page.locator('#dialog [data-royale-slot="1"] .empty-slot-mark').waitFor({state:'visible',timeout:10000});metrics.dropOutsidePanel=true;
 await page.locator('#dialog [data-action=resume]').click();await page.keyboard.press('Escape');
 await page.evaluate(()=>{document.querySelector('#dialog').close();});
 if(!live){
  // Exercise the shipped ChatPanel under continuous HUD updates while a native
  // channel popup is open. Transport routing remains covered by chat/party tests.
  await page.evaluate(async()=>{
   const {ChatPanel}=await import('/src/chat-ui.js'),root=document.createElement('div');root.id='chat-regression';document.body.append(root);
   const ctx={connected:true,localId:'host',preference:'all',enabled:true,roomMuted:[],host:false,state:{phase:'playing',options:{mode:'royale',teamSize:2},players:[{id:'host',name:'Host',team:0},{id:'guest',name:'Guest',team:0}]}};
   const panel=new ChatPanel(root,{context:()=>ctx,open(){},close(){window.__chatClosed=true;},send:()=>({ok:true}),setPreference(){}});window.__chatPanel=panel;panel.open();window.__chatTimer=setInterval(()=>panel.update(),16);
  });
  const select=page.locator('#chat-regression #chat-channel');await select.focus();await page.keyboard.press('Space');await page.waitForTimeout(700);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await select.inputValue(),'team');await page.locator('#chat-regression .chat-hud-close').click();assert.equal(await page.evaluate(()=>window.__chatClosed),true);
  await page.evaluate(()=>{window.__chatPanel.open();});await page.locator('#chat-regression #chat-channel').focus();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__chatPanel.opened),false);await page.evaluate(()=>{clearInterval(window.__chatTimer);document.querySelector('#chat-regression').remove();});metrics.chatNativeChannelStable=true;
 }
 if(live){const version=await page.evaluate(async()=>fetch('./version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()));assert.equal(version.appVersion,JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version);assert.equal(String(version.release),RELEASE_NOTES[0].number);if(process.env.GITHUB_SHA)assert.equal(version.build,process.env.GITHUB_SHA);metrics.version=version;}
 assert.deepEqual(errors,[]);await writeFile(out+'/metrics.json',JSON.stringify(metrics,null,2));console.log('PASS Field refinement UI: saved sound toggle, four fitted inventory viewports, backdrop drop, '+(!live?'stable chat channel and close':'published version')+'; '+JSON.stringify(metrics));
}catch(e){await writeFile(out+'/metrics.json',JSON.stringify(metrics,null,2));await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.log('FAIL UI',JSON.stringify(metrics),(await page.locator('body').innerText()).slice(-2000));throw e;}
finally{await browser.close();await vite?.close();}
