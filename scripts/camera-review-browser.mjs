import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='test-results/camera-review';await mkdir(out,{recursive:true});
const vite=await createServer({server:{host:'127.0.0.1',port:5272,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5272/tests/camera-review.html');await page.waitForFunction(()=>window.reviewReady,{timeout:60000});
 for(const mode of ['hip','aim','down','up','crouch']){const result=await page.evaluate(m=>window.cameraReview(m),mode);assert.ok(result.error<1e-7,mode+' muzzle projected on reticle');await page.screenshot({path:out+'/'+mode+'.png'});}
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({passed:true,errors},null,2));console.log('PASS camera framing and muzzle projection in hip, aim, up, down, crouch');
 await page.goto('http://127.0.0.1:5272/wren-study.html');await page.waitForFunction(()=>window.__wrenStudy,{timeout:60000});
 await page.getByRole('button',{name:'Face detail'}).click();await page.waitForTimeout(500);await page.screenshot({path:out+'/wren-head.png'});
}finally{await browser.close();await vite.close();}
