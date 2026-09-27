import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url='https://zl-2.github.io/yolk-yard/',expected='e1a8be4f7369451057da8d0d27d5551c349616f6';
let version;
for(let i=0;i<12;i++){
 const response=await fetch(url+'version.json?t='+Date.now(),{signal:AbortSignal.timeout(15000),cache:'no-store'});
 if(response.ok){version=await response.json();if(Number(version.release)===52&&version.build===expected)break;}
 await new Promise(r=>setTimeout(r,5000));
}
console.log('Published version observed',JSON.stringify(version));assert.equal(Number(version?.release),52);assert.equal(version?.build,expected);
console.log('PASS live version',JSON.stringify(version));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],out='test-results/live-quality42';await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:960,height:640}});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>{errors.push(e.message);console.error('Page error',e.message);});
 await page.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 await page.goto(url,{waitUntil:'domcontentloaded'});console.log('Opened published page');
 await page.locator('[data-action="play"]').waitFor();
 await page.screenshot({path:out+'/release-menu.png'});
 for(const action of ['play','play-royale','play-local','confirm-local']){console.log('Live UI',action);await page.locator('[data-action="'+action+'"]').click();}
 await page.locator('#royale-flight').waitFor();console.log('PASS published game entered transport');
 assert.match(await page.locator('#royale-flight-close').textContent(),/L.*Close/);
 const lock=await page.evaluate(()=>document.pointerLockElement?.tagName||null);
 await page.keyboard.press('KeyL');
 await page.locator('#royale-flight').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.pointerLockElement?.tagName||null),lock);
 assert.equal(await page.locator('#dialog').isVisible(),false);
 console.log('PASS live L dismisses flight tips without opening a menu or releasing pointer lock');
 await page.keyboard.press('KeyM');await page.locator('#royale-fullmap').waitFor();
 assert.equal(await page.locator('#royale-fullmap').getAttribute('width'),'720');
 await page.screenshot({path:out+'/published-island-map.png'});console.log('PASS published island map opens');
 assert.deepEqual(errors,[]);
 await writeFile(out+'/report.json',JSON.stringify({url,version,errors,checks:['production release 52 and exact commit','transport entry','L flight dismissal','pointer lock retained','no menu opened','island map opens']},null,2));
}catch(error){console.error(error);throw error;}finally{await browser.close();}
