import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fixture} from '../tests/helpers/public-match.js';
const origin='http://127.0.0.1:5327',out='test-results/zombies-pause';
let f,vite,browser,page;const errors=[];
try{
 await mkdir(out,{recursive:true});f=await fixture({serverOptions:{origins:[origin,'https://zl-2.github.io']}});
 const relay=`ws://127.0.0.1:${f.app.server.address().port}/game`;
 vite=await createServer({plugins:[{name:'pause-test-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'${relay}'};`);});}}],server:{host:'127.0.0.1',port:5327,strictPort:true,watch:null}});await vite.listen();
 browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({bypassCSP:true,viewport:{width:1440,height:900},deviceScaleFactor:.5});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Pause Check'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,musicVolume:0,fpsLimit:30}));localStorage.setItem('ravelfront-voice-192-dismissed','yes');});
 await page.goto(origin+'/?qa',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yolkTest?.party().ready);await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.locator('[data-action=choose-mode]').click();
 assert.deepEqual(await page.locator('[data-experience]').evaluateAll(nodes=>nodes.map(n=>n.dataset.experience)),['royale','box-fights','zone-wars','ffa','training','zombies']);
 const zombie=page.locator('[data-experience=zombies]');assert.equal(await zombie.isDisabled(),true);assert.equal(await zombie.locator('.mode-unavailable').innerText(),'NOT CURRENTLY AVAILABLE');assert.match(await zombie.locator('img').evaluate(n=>getComputedStyle(n).filter),/blur\(2px\)/);
 await page.screenshot({path:out+'/mode-picker.png'});
 await page.locator('[data-experience=ffa]').click();await page.waitForFunction(()=>window.__yolkTest.party().party.selection.mode==='ffa');
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({result:'PASS',zombiesLast:true,unavailable:true,fogged:true,otherModesSelectable:true,errors}));console.log('PASS Zombies paused, fogged, last; other modes remain selectable');
}catch(e){await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}
finally{await browser?.close();await vite?.close();await f?.close();}
