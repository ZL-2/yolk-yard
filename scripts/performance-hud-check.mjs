import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
const origin='http://127.0.0.1:5198';
const server=await createServer({server:{host:'127.0.0.1',port:5198,strictPort:true,watch:null}});await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];await mkdir('test-results/performance-hud',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/__performance-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="background:#253d4c"><div id="fixture"></div><script type="module">import "/src/performance-hud.css";import {PerformanceHUD,PERFORMANCE_DEFAULTS} from "/src/performance-hud.js";window.hud=new PerformanceHUD(document.body);window.options={...PERFORMANCE_DEFAULTS};window.net={serverAuthority:true,lastState:1000,peer:{relayLatency:45,receivedBytes:0,sentBytes:0,receivedPackets:0,sentPackets:0,bufferedAmount:0}};window.render=(now,active=true)=>hud.update(now,1000/60,net,options,active);render(1000);</script></body>'}));
 await p.goto(origin+'/__performance-preview');await p.locator('.performance-fps').waitFor();
 assert.match(await p.locator('.performance-fps').textContent(),/60 FPS/);assert.match(await p.locator('.net-ping').textContent(),/45 ms/);
 assert.equal(await p.locator('.connection-signal').isVisible(),false);
 await p.evaluate(()=>{net.lastState=2000;Object.assign(net.peer,{receivedBytes:2048,sentBytes:1024,receivedPackets:20,sentPackets:10});render(2000);});
 assert.match(await p.locator('.net-down').textContent(),/2.00 KB\/s · 20 msg\/s/);
 await p.evaluate(()=>render(2400));assert.equal(await p.locator('.connection-signal').getAttribute('data-health'),'degraded');
 await p.screenshot({path:'test-results/performance-hud/yellow.png'});
 await p.evaluate(()=>{net.peer.reconnecting=true;render(2700);});assert.equal(await p.locator('.connection-signal').getAttribute('data-health'),'critical');
 for(const width of [1280,390]){await p.setViewportSize({width,height:800});await p.screenshot({path:`test-results/performance-hud/red-${width}.png`});const b=await p.locator('.performance-network').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width);}
 await p.evaluate(()=>{net.peer.reconnecting=false;net.lastState=5000;render(5000);});assert.equal(await p.locator('.connection-signal').isVisible(),false);
 await p.evaluate(()=>{options.netDebugStats=false;options.showFps=false;net.lastState=5300;render(5300);});assert.equal(await p.locator('.performance-network').isVisible(),false);assert.equal(await p.locator('.performance-fps').isVisible(),false);
 await p.evaluate(()=>{net.peer.reconnecting=true;render(5600);});assert.equal(await p.locator('.connection-signal').isVisible(),true);
 await p.evaluate(()=>{options.connectionWarnings=false;render(5900);});assert.equal(await p.locator('.performance-network').isVisible(),false);
 await p.evaluate(()=>render(6200,false));assert.equal(await p.locator('.performance-hud').isVisible(),false);
 // Actual settings menu: migrate old saved settings, toggle, persist and reload.
 await p.route('**/src/maintenance.js',r=>r.fulfill({contentType:'application/javascript',body:'import "/src/main.js";'}));
 await p.addInitScript(()=>localStorage.setItem('ravelfront-welcome-back-2026-09','dismissed'));
 await p.addInitScript(()=>localStorage.setItem('yolk-settings',localStorage.getItem('yolk-settings')||JSON.stringify({quality:'low',volume:0})));
 await p.goto(origin+'/?qa');await p.locator('#menu [data-action="settings"]').first().click();
 assert.equal(await p.locator('#showFps').isChecked(),true);await p.locator('#showFps').uncheck();
 await p.locator('#settings-tab-hud').click();assert.equal(await p.locator('#netDebugStats').isChecked(),true);assert.equal(await p.locator('#connectionWarnings').isChecked(),true);await p.locator('#netDebugStats').uncheck();
 await p.reload();await p.locator('#menu [data-action="settings"]').first().click();assert.equal(await p.locator('#showFps').isChecked(),false);await p.locator('#settings-tab-hud').click();assert.equal(await p.locator('#netDebugStats').isChecked(),false);
 assert.deepEqual(errors,[]);console.log('HUD states, traffic, responsive layout, setting migration and persistence passed');
}finally{await browser.close();await server.close();}
