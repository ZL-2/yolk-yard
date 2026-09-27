import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
const vite=await createServer({server:{host:'127.0.0.1',port:5192,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1365,height:768}});page.setDefaultTimeout(60000);
 await page.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 await page.goto('http://127.0.0.1:5192/');await page.locator('[data-action="settings"]').click();
 assert.equal(await page.getByRole('tab').count(),6);
 assert.equal(await page.locator('[role="tabpanel"]:visible').count(),1);
 for(const id of ['video','audio','mouse','hud','gameplay','bindings']){
  await page.locator(`[data-settings-tab="${id}"]`).click();
  assert.equal(await page.locator('#settings-panel-'+id).isVisible(),true);
 }
 await page.locator('[data-settings-tab="mouse"]').click();
 await page.locator('#sensitivity').fill('1.7');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-settings')).sensitivity),1.7);
 await page.locator('[data-reset-slider="sensitivity"]').click();
 assert.equal(await page.locator('#sensitivity').inputValue(),'1');
 await page.locator('[data-settings-tab="bindings"]').click();
 await page.locator('[data-bind="forward"][data-bind-slot="0"]').click();await page.keyboard.press('KeyU');
 await page.locator('[data-settings-tab="video"]').click();await page.locator('.settings-footer [data-action="close"]').click();
 assert.equal(await page.locator('#settings-panel-bindings').isVisible(),true);
 await page.locator('[data-bind-command="discard"]').click();
 await page.locator('[data-bind="forward"][data-bind-slot="0"]').click();await page.keyboard.press('KeyU');await page.locator('[data-bind-command="apply"]').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-settings')).keybinds.forward[0]),'KeyU');
 await mkdir('test-results/settings',{recursive:true});
 for(const width of [1365,768,390]){
  await page.setViewportSize({width,height:768});await page.locator('[data-settings-tab="audio"]').click();
  const r=await page.evaluate(()=>{const d=document.querySelector('#dialog'),f=document.querySelector('.settings-footer').getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth+1,bottom:f.bottom,width:innerWidth,height:innerHeight};});
  assert.equal(r.overflow,false);assert.ok(r.bottom<=r.height+1);await page.screenshot({path:`test-results/settings/${width}.png`});
 }
 console.log('PASS category navigation, saved sliders, reset, persistent binding draft, discard/apply and responsive footer');
}finally{await browser.close();await vite.close();}
