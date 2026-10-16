import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='test-results/operator-refresh',vite=await createServer({server:{host:'127.0.0.1',port:5271,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5271/tests/operator-refresh-preview.html');await page.waitForFunction(()=>window.ready,null,{timeout:60000});assert.deepEqual(errors,[]);assert.equal(await page.locator('article img').count(),8);assert.ok(await page.locator('article img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth===320)));
 const checks=await page.evaluate(()=>window.checks);assert.ok(checks.every(c=>c.revision===166&&c.bones===32&&c.vertices<13000));await mkdir(out,{recursive:true});await page.screenshot({path:out+'/operators.png',fullPage:true});await writeFile(out+'/result.json',JSON.stringify({result:'PASS',checks,errors},null,2));console.log('PASS desktop operator contact, passing, strafe, sprint, shoulder draw and hip draw renders');
}finally{await browser.close();await vite.close();}
