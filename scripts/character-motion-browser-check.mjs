import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='test-results/character-motion',vite=await createServer({server:{host:'127.0.0.1',port:5278,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:960,height:640}}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5278/tests/character-motion-preview.html');await page.waitForFunction(()=>window.ready,null,{timeout:60000});assert.deepEqual(errors,[]);assert.equal(await page.locator('article img').count(),24);assert.ok(await page.locator('article img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth===320)));
 const checks=await page.evaluate(()=>window.checks);assert.ok(checks.every(c=>c.revision===166&&c.bones===32&&c.vertices<13000&&c.motion));await mkdir(out,{recursive:true});await page.screenshot({path:out+'/operators.png',fullPage:true});await writeFile(out+'/result.json',JSON.stringify({result:'PASS',checks,errors},null,2));console.log('PASS desktop Mixamo animation states, existing rigs, shoulder and hip draw renders');
 await page.evaluate(()=>window.reviewMotion());assert.deepEqual(errors,[]);
 for(const frame of await page.evaluate(()=>window.motionEvidence))await writeFile(out+'/frame-'+frame.frame+'.png',Buffer.from(frame.image.split(',')[1],'base64'));
 const video=page.video();await page.close();await video.saveAs(out+'/motion.webm');
}finally{await browser.close();await vite.close();}
