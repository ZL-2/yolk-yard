import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';

const out='test-results/expansion/field-control',origin='http://127.0.0.1:5261',temp=await mkdtemp('/tmp/ravel-field-control-');
await mkdir(out,{recursive:true});
process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]});
const vite=await createServer({plugins:[{name:'field-control-local-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${relay.server.address().port}/game'};`);});}}],server:{host:'127.0.0.1',port:5261,strictPort:true,watch:null}});
await vite.listen();
let browser,page,gallery;const errors=[],checks={},views={};
const deadline=setTimeout(()=>{console.error('Field-control browser check exceeded its bounded runtime');process.exit(1);},360000);
async function checkpoint(stage){console.log('FIELD CONTROL',stage);await writeFile(out+'/progress.json',JSON.stringify({stage,checks,errors,views},null,2));}
function watch(p){p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|Shader Error|INVALID_OPERATION/.test(m.text()))errors.push(m.text());});}
const frames=(p,n=2)=>p.evaluate(n=>new Promise(resolve=>{function tick(){if(--n<=0)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}),n);
const shot=name=>page.screenshot({path:out+'/'+name+'.png',animations:'disabled'});
const changeRange=(selector,value)=>page.locator(selector).evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
async function resume(){const b=page.locator('#dialog [data-action=resume]');if(await b.isVisible())await b.evaluate(e=>e.click());}
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({bypassCSP:true,viewport:{width:1100,height:700}});watch(page);await checkpoint('launch');
 await page.addInitScript(()=>{for(const key of ['ravelfront-season-1-update-150-dismissed','ravelfront-referrals-dismissed','ravelfront-perspective-157-dismissed'])localStorage.setItem(key,'yes');localStorage.setItem('yolk-profile',JSON.stringify({name:'Coast Architect'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,musicVolume:0,fov:96}));});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party().ready);await page.locator('#loading-screen').waitFor({state:'hidden'});await shot('actual-lobby');
 await page.locator('#menu [data-action=settings]').click();assert.equal(await page.locator('#fpsLimit').inputValue(),'60');
 for(const value of ['30','60','90','120','144','unlimited']){await page.locator('#fpsLimit').selectOption(value);assert.equal(await page.evaluate(()=>String(JSON.parse(localStorage.getItem('yolk-settings')).fpsLimit)),value);}
 await page.locator('#fpsLimit').selectOption('30');await shot('fps-settings');await page.locator('#dialog [data-action=close]').first().click();checks.fpsChoicesAndPersistence=true;await checkpoint('settings');
 await page.locator('[data-action=training]').first().click();await page.locator('[data-action=start-training]').click();await page.waitForFunction(()=>window.__yolkTest.read().screen==='game');await page.locator('#loading-screen').waitFor({state:'hidden'});await resume();
 await page.waitForFunction(()=>window.__yolkTest.framePacing().limit===30);checks.actualFrameLimit=true;
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.options.training=false;s.beginBattle();}));await page.waitForFunction(()=>window.__yolkTest.read().state?.options.map==='sunnybreak');await page.locator('#loading-screen').waitFor({state:'hidden'});await resume();
 await page.evaluate(async()=>{const {groundAt}=await import('/src/terrain.js');window.__yolkTest.fixture(s=>{s.stage='active';s.options.training=true;s.finish=()=>{};for(const p of [...s.players.values()])if(p.bot)s.players.delete(p.id);const b=s.map.watchtowers[0],p=s.players.get(window.__yolkTest.read().localId),x=b.x,z=b.z+20;Object.assign(p,{x,z,y:groundAt(s.map,x,z),flight:'ground',grounded:true,shieldUntil:Infinity,health:100,shield:100,vy:0});});window.__yolkTest.pose({yaw:0,pitch:.25});});
 await frames(page,3);await shot('actual-watchtower-approach');await page.evaluate(()=>{
  // Software GPU frames may take longer than the ordinary 2.6-second cue.
  // Capture its real opening geometry atomically, then stop this fixture's RAF
  // callbacks so the screenshot observes the same actual gameplay notice.
  const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(now=>{if(!window.__fieldCaptureFrozen)fn(now);});
  const node=document.getElementById('elimination-notice'),observer=new MutationObserver(()=>{if(node.matches(':popover-open')&&node.textContent.includes('Coast Sentinel')){const r=node.getBoundingClientRect();window.__fieldEliminationBox={x:r.x,y:r.y,width:r.width,height:r.height};window.__fieldCaptureFrozen=true;observer.disconnect();}});observer.observe(node,{attributes:true,childList:true,subtree:true});
  window.__yolkTest.fixture(s=>s.emit('elimination',{player:window.__yolkTest.read().localId,target:'qa-rival',name:'Field Scout',targetName:'Coast Sentinel',weapon:'Sprinter',streak:1}));
 });await page.waitForFunction(()=>window.__fieldEliminationBox,{},{polling:100});const box=await page.evaluate(()=>window.__fieldEliminationBox);assert.ok(box.y>350&&box.y+box.height<630);await shot('elimination-lower-center');checks.eliminationPlacement=true;views.island=await page.evaluate(()=>{const r=window.__yolkTest.read();return {drawCalls:r.drawCalls,triangles:r.triangles,streaming:r.presentation.streaming};});assert.ok(views.island.drawCalls<1200);checks.actualIsland=true;await checkpoint('gameplay');await page.close();page=null;
 // Render exact game factories and world/editor bake paths at an inspectable size.
 gallery=await browser.newPage({viewport:{width:1440,height:1080}});watch(gallery);await gallery.route('**/__field-control.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await gallery.goto(origin+'/__field-control.html');
 views.gallery=await gallery.evaluate(async()=>{
  const {THREE:T}=await import('/src/environment-surfaces.js'),{architectureKit}=await import('/src/architecture-surfaces.js'),{dressWatchtower}=await import('/src/watchtowers.js'),{getMap}=await import('/src/maps.js'),{bake}=await import('/src/royale-view.js'),{supplyMapIcon}=await import('/src/supply-drops.js');
  const tower=getMap('sunnybreak').watchtowers[0],g=new T.Group(),kit=architectureKit();for(const b of tower.parts)kit.block(g,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,b.color,b.surface);dressWatchtower(g,tower,kit);bake(g,false,true);g.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(g),center=bounds.getCenter(new T.Vector3());g.position.sub(center);
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(700,700);renderer.outputColorSpace=T.SRGBColorSpace;const scene=new T.Scene();scene.add(g,new T.HemisphereLight(0xffffff,0x566051,2));const key=new T.DirectionalLight(0xffedda,3);key.position.set(-8,15,12);scene.add(key);const camera=new T.OrthographicCamera(-16,16,16,-16,.01,500);camera.position.set(29,23,35);camera.lookAt(0,0,0);renderer.render(scene,camera);const png=renderer.domElement.toDataURL(),icon=document.createElement('canvas');icon.width=480;icon.height=160;const c=icon.getContext('2d');c.fillStyle='#304a58';c.fillRect(0,0,480,160);for(const [i,label]of ['AIRBORNE','CANOPY CUT / LANDED'].entries()){c.save();c.translate(120+i*240,66);c.scale(3.4,3.4);supplyMapIcon(c,0,0,true,!i);c.restore();c.fillStyle='#fff';c.font='bold 14px system-ui';c.textAlign='center';c.fillText(label,120+i*240,143);}
  document.head.innerHTML='<style>body{background:#152830;color:#ecf3eb;font:18px system-ui;padding:24px}h1{font-size:25px}main{display:flex;gap:20px;align-items:center}figure{margin:0;background:#354c54;border-radius:12px;padding:20px}img{max-width:100%}figcaption{text-align:center;padding:14px}</style>';document.body.innerHTML='<h1>RAVELFRONT · FIELD CONTROL</h1><main><figure><img width="700" src="'+png+'"><figcaption>Four-floor military watchtower · actual game geometry</figcaption></figure><figure><img src="'+icon.toDataURL()+'"><figcaption>Supply-drop map markers</figcaption></figure></main>';const stats={draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};renderer.dispose();return stats;
 });
 await gallery.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));await gallery.screenshot({path:out+'/actual-asset-gallery.png',fullPage:true});assert.ok(views.gallery.draws<=3&&views.gallery.triangles<25000);checks.watchtowerAndDropIcons=true;assert.deepEqual(errors,[]);await checkpoint('complete');await writeFile(out+'/result.json',JSON.stringify({checks,views,errors},null,2));console.log('PASS field-control rendering and UI');
}catch(error){await page?.screenshot({path:out+'/failure-game.png'}).catch(()=>{});await gallery?.screenshot({path:out+'/failure-gallery.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({error:String(error),checks,views,errors},null,2));throw error;}
finally{clearTimeout(deadline);await browser?.close();await vite.close();await relay.close();await rm(temp,{recursive:true,force:true});}
