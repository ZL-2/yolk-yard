import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const origin='http://127.0.0.1:5193';
const relay=await startRealtimeServer({host:'127.0.0.1',port:9002,origins:[origin]});
const attach=relay.relay.attach.bind(relay.relay);relay.relay.attach=ws=>{const read=attach(ws);ws.on('close',(code,reason)=>console.log('RELAY CLOSE',code,String(reason),{pending:read()?.pendingBytes,history:read()?.historyBytes}));return read;};
const vite=await createServer({server:{host:'127.0.0.1',port:5193,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pages=[],errors=[];
await mkdir('test-results/lobby-duos',{recursive:true});
async function player(name){const context=await browser.newContext({viewport:{width:1365,height:768}});await context.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.YOLK_NETWORK={relay:'ws://127.0.0.1:9002/game'};"}));const p=await context.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(name+': '+e.message));await p.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name,color:'#f4c568'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);await p.goto(origin+'/?qa');pages.push(p);await p.waitForFunction(()=>window.__yolkTest?.party().ready&&window.__yolkTest.party().party);return p;}
async function select(p,id){await p.locator('#menu [data-action="play"]').click();await p.locator(`[data-experience="${id}"]`).click();await p.waitForFunction(()=>!document.querySelector('#dialog').open);}
async function shot(p,name){await p.screenshot({path:`test-results/lobby-duos/${name}.png`});}
try{
 const a=await player('Sunny Captain');
 assert.equal(await a.getByText('Play Offline With Bots',{exact:true}).count(),0);
 for(const id of ['ffa','teams','solo','duos'])await select(a,id);
 await a.locator('[data-action="duo-no-fill"]').click();await a.waitForFunction(()=>window.__yolkTest.party().party.selection.duoFill===false);await a.locator('[data-action="duo-fill"]').click();
 for(const width of [1365,768,390]){await a.setViewportSize({width,height:768});await a.waitForTimeout(300);const boxes=await a.locator('#menu [data-action="find-public"],#menu [data-action="play"],#menu [data-action="social"]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,width:innerWidth,height:innerHeight};}));for(const b of boxes){assert.ok(b.x>=0&&b.right<=b.width+1&&b.y>=0&&b.bottom<=b.height,JSON.stringify(b));assert.ok(b.w>=30&&b.h>=28);}assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot(a,'lobby-'+width);}
 await a.setViewportSize({width:1365,height:768});
 const b=await player('Sunny Partner'),bid=await b.evaluate(()=>window.__yolkTest.party().id);
 await a.locator('#menu [data-action="social"]').first().click();await a.locator(`[data-party-invite="${bid}"]`).click();await b.locator('[data-party-decline]').click();await a.waitForTimeout(1600);await a.locator(`[data-party-invite="${bid}"]`).click();await b.locator('[data-party-accept]').click();
 await a.waitForFunction(()=>window.__yolkTest.party().party.members.length===2);await b.waitForFunction(()=>window.__yolkTest.party().party.members.length===2);await a.locator('#dialog [data-action="close"]').first().click();
 await a.waitForFunction(()=>window.__yolkTest.partyMembers()===1);await b.locator('#menu [data-action="party-ready"]').click();await a.waitForFunction(()=>window.__yolkTest.party().party.members.every(m=>m.ready||m.id===window.__yolkTest.party().party.leader));await shot(a,'party-ready');await a.setViewportSize({width:390,height:768});await a.waitForTimeout(300);await shot(a,'party-390');await a.setViewportSize({width:1365,height:768});
 await a.locator('#menu [data-action="play-custom"]').click();await a.locator('#setup-capacity').selectOption('8');await a.locator('#setup-visibility').selectOption('private');await a.locator('[data-action="create-room"]').click();
 await Promise.all([a,b].map(p=>p.waitForFunction(()=>window.__yolkTest.read().state?.royale?.stage==='spawn-island')));
 for(const p of [a,b])if(await p.locator('#dialog [data-action="resume"]').isVisible())await p.locator('#dialog [data-action="resume"]').click();
 const pa=await a.evaluate(()=>window.__yolkTest.read()),pb=await b.evaluate(()=>window.__yolkTest.read());
 assert.equal(pa.state.players.find(p=>p.id===pa.localId).team,pb.state.players.find(p=>p.id===pb.localId).team);assert.equal(pa.state.royale.matchId,pb.state.royale.matchId);for(const r of [pa,pb])assert.ok(r.state.royale.queueEnds-r.state.time>0&&r.state.royale.queueEnds-r.state.time<=60);assert.equal(pa.state.options.capacity,8);await shot(b,'duo-island');
 // Keep the controlled warmup fixture open for input/presentation checks;
 // the unmodified 60-second online countdown is checked on the deployed game.
 await a.evaluate(()=>window.__yolkTest.fixture(s=>{s.queueEnds=s.time+180;const p=s.players.get('host');p.inventory[3]={id:'anchor',weapon:true,rarity:0,count:1,ammo:6};s.syncInventory(p);}));
 if(await a.locator('#dialog [data-action="resume"]').isVisible())await a.locator('#dialog [data-action="resume"]').click();
 await a.keyboard.press('Digit1');await a.waitForFunction(()=>{const r=window.__yolkTest.read();return r.state.players.find(p=>p.id===r.localId)?.slot===1;});
 await a.locator('#world').dispatchEvent('mousedown',{button:0});await a.waitForFunction(()=>{const r=window.__yolkTest.read();return r.state.players.find(p=>p.id===r.localId)?.inventory[1].ammo<30;});await a.locator('#world').dispatchEvent('mouseup',{button:0});
 await a.locator('#world').dispatchEvent('mousedown',{button:2});await a.waitForFunction(()=>{const r=window.__yolkTest.read();return r.state.players.find(p=>p.id===r.localId)?.firstShot;});await shot(a,'settled-ads');
 await a.keyboard.press('Digit3');await a.waitForFunction(()=>window.__yolkTest.read().scope.active&&window.__yolkTest.read().scope.fov<35);await a.keyboard.down('KeyD');await a.waitForTimeout(300);
 assert.equal(await a.evaluate(()=>{const r=window.__yolkTest.read();return r.state.players.find(p=>p.id===r.localId).shotSpread;}),0);await a.keyboard.up('KeyD');await shot(a,'stable-scope');await a.locator('#world').dispatchEvent('mouseup',{button:2});
 await a.keyboard.press('Digit2');await a.waitForFunction(()=>document.querySelector('#crosshair').classList.contains('pellet-reticle'));await a.locator('#world').dispatchEvent('mousedown',{button:0});await a.waitForFunction(()=>{const r=window.__yolkTest.read();return r.state.events.some(e=>e.type==='shot'&&e.player===r.localId&&e.shots.length===10);});await a.locator('#world').dispatchEvent('mouseup',{button:0});
 await a.evaluate(()=>window.__yolkTest.fixture(s=>s.advanceWarmupClock(180)));await Promise.all([a,b].map(p=>p.waitForFunction(()=>window.__yolkTest.read().state?.royale?.stage==='battle-bus')));await shot(b,'duo-bus');
 const knocked=await a.evaluate(()=>window.__yolkTest.fixture(s=>{const h=s.players.get('host'),mate=[...s.players.values()].find(p=>!p.bot&&p!==h),enemy=[...s.players.values()].find(p=>p.team!==h.team);mate.flight='ground';mate.shieldUntil=0;s.damage(mate,enemy,500,'Check');return {spectating:mate.spectating,health:mate.health};}));assert.equal(knocked.health,0);assert.equal(knocked.spectating,true);
 await b.waitForFunction(()=>{const r=window.__yolkTest.read();return r.state.players.find(p=>p.id===r.localId)?.spectating;});
 await a.evaluate(()=>window.__yolkTest.fixture(s=>{const h=s.players.get('host');for(const p of s.players.values())if(p.team!==h.team){p.flight='ground';p.shieldUntil=0;s.damage(p,h,500,'Check');}s.finish();}));await b.waitForFunction(()=>window.__yolkTest.read().state?.phase==='results');
 const result=await b.evaluate(()=>{const r=window.__yolkTest.read();return {place:r.state.players.find(p=>p.id===r.localId).place,winner:r.state.winner};});assert.equal(result.place,1);assert.match(result.winner,/Duo/);await b.waitForTimeout(500);await shot(b,'duo-victory');
 assert.deepEqual(errors,[]);console.log('PASS responsive lobby, modes, Fill, real invites/decline/accept, customized party eggs, readiness, private custom party, shared Spawn Island/Bus, teammate spectating and Duo victory');
}catch(error){for(let i=0;i<pages.length;i++){console.log('PAGE',i,await pages[i].evaluate(()=>({party:window.__yolkTest?.party(),connection:window.__yolkTest?.read().connection,state:window.__yolkTest?.read().state?.royale,dialog:document.querySelector('#dialog')?.textContent,toast:document.querySelector('#toast')?.textContent})).catch(()=>null));await shot(pages[i],'failure-'+i).catch(()=>{});}console.log('BROWSER ERRORS',errors);throw error;}
finally{await browser.close();await vite.close();await relay.close();}
