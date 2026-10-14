import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startRealtimeServer} from '../server/realtime/index.js';
const out='test-results/expansion/kestrel',origin='http://127.0.0.1:5253',temp=await mkdtemp(join(tmpdir(),'ravelfront-kestrel-'));await mkdir(out,{recursive:true});
process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]});
const vite=await createServer({plugins:[{name:'kestrel-local-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${relay.server.address().port}/game'};`);});}}],server:{host:'127.0.0.1',port:5253,strictPort:true,watch:null}});await vite.listen();
let browser;const pages=[],errors=[],checks={};
async function player(name,quality){
 const p=await browser.newPage({bypassCSP:true,viewport:{width:1440,height:900}});pages.push(p);p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|Shader Error/i.test(m.text()))errors.push(m.text());});
 await p.addInitScript(({name,quality})=>{localStorage.setItem('ravelfront-season-1-update-150-dismissed','yes');localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality,volume:0,musicVolume:0,fov:65}));},{name,quality});await p.goto(origin+'/?qa');await p.waitForFunction(()=>window.__yolkTest);await p.locator('#loading-screen').waitFor({state:'hidden'});return p;
}
const shot=(p,name)=>p.screenshot({path:out+'/'+name+'.png',animations:'disabled'});
const diagnostic=p=>p.evaluate(async()=>{const {kestrelDiagnostics}=await import('/src/kestrel-model.js');return kestrelDiagnostics();});
async function resume(p){await p.bringToFront();const button=p.locator('#dialog [data-action=resume]');if(await button.isVisible())await button.click();}
async function frames(p){await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const host=await player('Kestrel Captain','high');await host.locator('#menu [data-action=play-custom]').click();await host.locator('#setup-mode').selectOption('royale');await host.locator('[data-action=create-room]').click();await host.locator('#lobby [data-action=start-match]').waitFor();const code=(await host.locator('#lobby .room-code').innerText()).replace(/[^A-Z2-9]/g,'');
 const guest=await player('Kestrel Wing','low');await guest.locator('#menu [data-action=play-custom]').click();await guest.locator('[data-action=join]').click();await guest.locator('#join-code').fill(code);await guest.locator('[data-action=join-room]').click();await guest.locator('#lobby .room-code').waitFor();
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{s.options.fill=false;s.options.bots=0;s.options.capacity=4;}));await host.locator('[data-action=start-match]').click();await host.waitForFunction(()=>window.__yolkTest.read().state?.royale?.stage==='spawn-island');await host.locator('#loading-screen').waitFor({state:'hidden'});await host.evaluate(()=>window.__yolkTest.fixture(s=>s.queueEnds=s.time+1000));await resume(host);
 await host.evaluate(async()=>{const {getMap}=await import('/src/maps.js'),v=getMap('hatchery-atoll').parkedTransport,x=v.x-14,z=v.z-18,eye=3.2+1.6,yaw=Math.atan2(x-v.x,z-v.z),pitch=Math.atan2(v.y+1.2-eye,Math.hypot(x-v.x,z-v.z));window.__yolkTest.pose({x,y:3.2,z,yaw,pitch,grounded:true,flight:'ground'});window.__yolkTest.look(yaw,pitch);});await frames(host);
 const parked=await diagnostic(host);assert.equal(parked.revision,154);assert.equal(parked.engines.length,2);assert.equal(parked.detail,2);assert.equal(parked.shadow,true);assert.ok(parked.triangles<=21000);await shot(host,'kestrel-airstrip');checks.parkedModel=true;
 await host.evaluate(async()=>{const {getMap}=await import('/src/maps.js'),v=getMap('hatchery-atoll').parkedTransport,x=v.x-12,z=v.z+1,yaw=Math.atan2(x-v.x,z-v.z),pitch=Math.atan2(v.y+1.1-4.8,12);window.__yolkTest.pose({x,y:3.2,z,yaw,pitch,grounded:true});window.__yolkTest.look(yaw,pitch);});await frames(host);await shot(host,'kestrel-cargo-and-cockpit');
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{s.beginBattle();s.route.duration=300;s.elapsed=10;s.startedAt=s.time-10;}));await guest.waitForFunction(()=>window.__yolkTest.read().state?.royale?.stage==='battle-bus');await guest.locator('#loading-screen').waitFor({state:'hidden'});
 for(const p of [host,guest]){await resume(p);const cameras=[];for(const [yaw,pitch]of [[-1.3,0],[1.3,0],[0,-.8],[0,.8]]){await p.evaluate(([y,x])=>window.__yolkTest.look(y,x),[yaw,pitch]);await frames(p);const r=await p.evaluate(()=>window.__yolkTest.read());assert.equal(r.state.players.find(q=>q.id===r.localId).flight,'transport');cameras.push(r.camera);}assert.ok(Math.abs(cameras[0][1]-cameras[1][1])>.3);assert.ok(Math.abs(cameras[2][0]-cameras[3][0])>.3);}checks.hostGuestLook=true;
 await resume(host);await host.evaluate(()=>window.__yolkTest.look(.55,0));await frames(host);const flying=await diagnostic(host);assert.equal(flying.shadow,false);assert.ok(flying.engines.every(a=>a<-.4));assert.ok(flying.gear[0][2]>.8);await shot(host,'kestrel-flight');checks.flightAnimation=true;
 const low=await diagnostic(guest);assert.equal(low.detail,1);assert.ok(low.triangles<=8500);checks.lowGraphics=true;
 await resume(guest);await guest.locator('[data-action=royale-jump]').click();await guest.waitForFunction(()=>{const r=window.__yolkTest.read();return ['dive','glide','ground'].includes(r.state.players.find(p=>p.id===r.localId)?.flight);});checks.guestDeploy=true;await shot(guest,'guest-deployment');assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors,parked,flying,low},null,2));console.log('PASS Kestrel gameplay',checks);
}catch(error){for(const p of pages)await p.screenshot({path:out+'/failure-'+pages.indexOf(p)+'.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({checks,errors,error:String(error)},null,2));throw error;}
finally{await browser?.close();await vite.close();await relay.close();await rm(temp,{recursive:true,force:true});}
