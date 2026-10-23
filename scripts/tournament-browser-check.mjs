import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fixture,until,pause} from '../tests/helpers/public-match.js';
import {TOURNAMENT as E} from '../src/tournament.js';
const origin='http://127.0.0.1:5276',out='test-results/tournament';await mkdir(out,{recursive:true});
let now=E.lockAt-60000;
const f=await fixture({serverOptions:{origins:[origin,'https://zl-2.github.io'],tournamentOptions:{now:()=>now}}});
const event=f.app.relay.tournament;
const vite=await createServer({plugins:[{name:'tournament-local-relay',configureServer(s){s.middlewares.use((req,res,next)=>{if(!req.url?.split('?')[0].endsWith('/network-config.js'))return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${f.app.server.address().port}/game'};`);});}}],server:{host:'127.0.0.1',port:5276,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const errors=[],checks=[];
async function page(name){const context=await browser.newContext({bypassCSP:true,deviceScaleFactor:.6,viewport:{width:1440,height:900}}),p=await context.newPage();p.setDefaultTimeout(90000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/network-config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${f.app.server.address().port}/game'};`}));await p.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name,weapon:'sprinter'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:30,perspective:'third'}));localStorage.setItem('ravelfront-stormspike-kestrel-199-dismissed','yes');},name);await p.goto(origin+'/?qa');await p.waitForFunction(()=>window.__yolkTest);await p.locator('.tournament-card').waitFor();await p.waitForFunction(()=>window.__yolkTest.party().ready);await p.waitForFunction(()=>!document.querySelector('#loading')||document.querySelector('#loading').hidden);return p;}
try{
 const p=await page('Cup Browser');
 for(const width of [1440,1024,390]){await p.setViewportSize({width,height:900});await p.waitForTimeout(300);await p.screenshot({path:`${out}/lobby-${width}.png`});const box=await p.locator('.tournament-card').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,'Card fits viewport');checks.push({width,box});}
 await p.setViewportSize({width:1440,height:900});now=E.opensAt;event.tick();await p.getByRole('button',{name:'JOIN TOURNAMENT',exact:true}).click();
 await until(()=>event.room&&[...event.room.sim.players.values()].some(p=>p.name==='Cup Browser'&&!p.loading),'Browser entered and submitted controls',90000);
 for(const name of ['Cup Rival One','Cup Rival Two']){const u=await f.user(name);await u.ask('tournament-join');const g=await f.game(u);g.net.input({seq:1,dt:1/60,yaw:0,pitch:0});}
 await until(()=>[...event.room.sim.players.values()].filter(p=>!p.loading).length===3,'Three competitors ready');
 now=E.startsAt;event.tick();assert.equal(event.phase,'running');await p.waitForTimeout(2000);await p.screenshot({path:out+'/tournament-start.png'});
 const late=await page('Cup Late Viewer');await late.getByRole('button',{name:'SPECTATE MATCH',exact:true}).click();await until(()=>[...event.room.sim.players.values()].some(p=>p.name==='Cup Late Viewer'&&p.lateSpectator),'Late browser spectates',90000);await late.waitForTimeout(1200);await late.screenshot({path:out+'/late-spectator.png'});
 const sim=event.room.sim,me=[...sim.players.values()].find(p=>p.name==='Cup Browser');me.flight='ground';sim.damage(me,null,10000,'Disconnected');await p.getByRole('button',{name:'SPECTATE',exact:true}).click();await p.waitForTimeout(1000);await p.screenshot({path:out+'/eliminated-spectator.png'});assert.equal(me.spectating,true);
 const others=[...sim.players.values()].filter(p=>p.contestant&&p.health>0&&!p.bot);others[0].flight='ground';sim.damage(others[0],null,10000,'Disconnected');sim.finish();event.tick();assert.equal(event.locked,false);
 await p.getByRole('button',{name:'RETURN TO LOBBY',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.tournament-card')?.textContent.includes('MATCHMAKING OPEN'));await p.screenshot({path:out+'/finished.png'});
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,results:event.state.results,errors},null,2));console.log('PASS tournament lobby, real entry, late spectating, elimination spectating, awards and reopened lobby');
}catch(error){await writeFile(out+'/failure.json',JSON.stringify({error:String(error),errors,event:event.summary()},null,2));for(const [i,p]of browser.contexts().flatMap(c=>c.pages()).entries())await p.screenshot({path:`${out}/failure-${i}.png`}).catch(()=>{});throw error;}
finally{await browser.close();await vite.close();await f.close();}
