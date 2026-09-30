import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const tmp=await mkdtemp('/tmp/ravel-reopening-');process.env.RAVEL_SOCIAL_DATA_PATH=tmp+'/social.json';
const origin='http://127.0.0.1:5197';
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin],maintenance:false});
const server=await createServer({server:{host:'127.0.0.1',port:5197,strictPort:true,watch:null}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.YOLK_TEST_CHROME,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const fixture=(await readFile('index.html','utf8')).replace('wss://0.peerjs.com;',`wss://0.peerjs.com http://127.0.0.1:${relay.server.address().port} ws://127.0.0.1:${relay.server.address().port};`);
const errors=[];await mkdir('test-results/reopening',{recursive:true});
async function player(width){const context=await browser.newContext({viewport:{width,height:900},permissions:['local-network-access']});await context.route('**/?qa',r=>r.fulfill({contentType:'text/html',body:fixture}));await context.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${relay.server.address().port}/game'};`}));await context.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/?qa');await p.locator('.welcome-back').waitFor();await p.waitForFunction(()=>window.__yolkTest?.party().ready);await p.locator('#loading-screen').waitFor({state:'hidden'});return p;}
try{
 const p=await player(1280);assert.equal(await p.locator('.welcome-feature').count(),6);assert.equal(await p.locator('.welcome-feature svg').count(),6);assert.equal(await p.getByText('Temporarily under maintenance').count(),0);
 await p.screenshot({path:'test-results/reopening/welcome-desktop.png'});
 await p.getByRole('button',{name:'Close welcome screen'}).click();await p.getByRole('button',{name:'CLOSE FOR NOW',exact:true}).click();assert.equal(await p.locator('.welcome-back').count(),0);
 await p.reload();await p.locator('.welcome-back').waitFor();await p.keyboard.press('Escape');await p.getByRole('button',{name:'DON’T SHOW AGAIN',exact:true}).click();await p.reload();await p.waitForFunction(()=>window.__yolkTest?.party().ready);assert.equal(await p.locator('.welcome-back').count(),0);
 // A second real, unauthenticated browser identity reaches Social on mobile.
 const mobile=await player(390);await mobile.screenshot({path:'test-results/reopening/welcome-mobile.png'});const dimensions=await mobile.locator('.welcome-back').evaluate(d=>({scroll:d.scrollWidth,width:d.clientWidth}));assert.ok(dimensions.scroll<=dimensions.width);
 await mobile.getByRole('button',{name:'CLOSE & ENTER LOBBY'}).click();await mobile.getByRole('button',{name:'CLOSE FOR NOW',exact:true}).click();
 // Public discovery is served without an administrator session.
 assert.equal((await (await fetch(`http://127.0.0.1:${relay.server.address().port}/health`)).json()).maintenance,false);
 assert.deepEqual(errors,[]);console.log('Public startup/social, illustrated welcome, close/reload/dismiss persistence and mobile layout passed');
}finally{await browser.close();await server.close();await relay.close();await rm(tmp,{recursive:true,force:true});}
