import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startRealtimeServer} from '../server/realtime/index.js';

const out='test-results/expansion/environment',origin='http://127.0.0.1:5257',temp=await mkdtemp(join(tmpdir(),'ravel-environment-'));
await mkdir(out,{recursive:true});
process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]});
const vite=await createServer({plugins:[{name:'environment-local-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${relay.server.address().port}/game'};`);});}}],server:{host:'127.0.0.1',port:5257,strictPort:true,watch:null}});
await vite.listen();
let browser,page,gallery;const errors=[],checks={},views={};
function watch(p){p.setDefaultTimeout(90000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|Shader Error|INVALID_OPERATION/.test(m.text()))errors.push(m.text());});}
const frames=(p,count=4)=>p.evaluate(count=>new Promise(resolve=>{function tick(){if(--count<=0)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}),count);
const shot=(p,name)=>p.screenshot({path:out+'/'+name+'.png',animations:'disabled'});
async function resume(){const b=page.locator('#dialog [data-action=resume]');if(await b.isVisible())await b.evaluate(e=>e.click());}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({bypassCSP:true,viewport:{width:1440,height:900}});watch(page);
 await page.addInitScript(()=>{for(const key of ['ravelfront-season-1-update-150-dismissed','ravelfront-referrals-dismissed','ravelfront-perspective-157-dismissed'])localStorage.setItem(key,'yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'high',volume:0,musicVolume:0,fov:72}));localStorage.setItem('yolk-profile',JSON.stringify({name:'Environment Scout',outfit:'outfit-wren'}));});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest);await page.locator('#loading-screen').waitFor({state:'hidden'});await frames(page);await shot(page,'actual-lobby');checks.lobby=true;
 await page.locator('[data-action=training]').first().click();await page.locator('[data-action=start-training]').click();await page.waitForFunction(()=>window.__yolkTest.read().screen==='game');await page.locator('#loading-screen').waitFor({state:'hidden'});await resume();await frames(page,8);
 const spawn=await page.evaluate(()=>window.__yolkTest.read().presentation.environment);assert.equal(spawn.terrain.revision,159);await shot(page,'actual-training-airfield');checks.spawnTerrain=true;
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.options.training=false;s.beginBattle();}));await page.waitForFunction(()=>window.__yolkTest.read().state?.options.map==='sunnybreak');await page.locator('#loading-screen').waitFor({state:'hidden'});await resume();
 await page.evaluate(()=>window.__yolkTest.fixture(s=>{s.stage='active';s.options.training=true;for(const p of [...s.players.values()])if(p.bot)s.players.delete(p.id);const p=s.players.get(window.__yolkTest.read().localId);p.shieldUntil=Infinity;p.health=100;p.shield=100;}));
 for(const [name,x,z,yaw,pitch]of [['forest',-53,-30,-.75,-.07],['quarry',-158,92,.1,-.12],['coast',194,135,-1.1,-.12]]){
  await page.evaluate(async({x,z,yaw,pitch})=>{const {groundAt}=await import('/src/terrain.js');window.__yolkTest.fixture(s=>{const p=s.players.get(window.__yolkTest.read().localId);Object.assign(p,{x,z,y:groundAt(s.map,x,z),flight:'ground',grounded:true,vx:0,vy:0,vz:0,shieldUntil:Infinity});});window.__yolkTest.pose({yaw,pitch});},{x,z,yaw,pitch});
  await frames(page,24);await shot(page,'actual-'+name);views[name]=await page.evaluate(()=>{const r=window.__yolkTest.read();return {drawCalls:r.drawCalls,triangles:r.triangles,streaming:r.presentation.streaming,environment:r.presentation.environment};});
  assert.equal(views[name].environment.terrain.revision,159);assert.ok(views[name].drawCalls<1200,'Bounded gameplay draws');assert.ok(views[name].environment.groundCover.cells<=16);assert.ok(views[name].environment.groundCover.draws<=32);
 }
 assert.ok(views.coast.streaming.resident<views.coast.streaming.cells);checks.mainTerrainAndStreaming=true;
 await page.setViewportSize({width:800,height:600});await frames(page,8);await shot(page,'actual-compact-viewport');checks.compactViewport=true;
 // Use the exact factories and bake path used by gameplay, not illustrations.
 gallery=await browser.newPage({viewport:{width:1440,height:1000}});watch(gallery);await gallery.route('**/__environment-gallery.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await gallery.goto(origin+'/__environment-gallery.html');
 const catalogs=await gallery.evaluate(async()=>{
  const {THREE:T,updateEnvironmentSurfaces}=await import('/src/environment-surfaces.js'),{environmentTree}=await import('/src/environment-trees.js'),{detailEnvironmentProp,ENVIRONMENT_PROP_KINDS}=await import('/src/environment-props.js'),{bake}=await import('/src/royale-view.js');
  const renderer=new T.WebGLRenderer({canvas:document.createElement('canvas'),alpha:true,antialias:true});renderer.outputColorSpace=T.SRGBColorSpace;renderer.setSize(400,360);updateEnvironmentSurfaces(0);const layouts={};
  function render(g){bake(g,false,true);g.updateMatrixWorld(true);const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x546554,2));const key=new T.DirectionalLight(0xffecda,3.5);key.position.set(-3,5,-4);scene.add(key);const rim=new T.DirectionalLight(0xb8dce9,1.2);rim.position.set(3,2,4);scene.add(rim);scene.add(g);const bounds=new T.Box3().setFromObject(g),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());g.position.sub(center);const d=Math.max(size.x,size.y,size.z)*.7,camera=new T.OrthographicCamera(-d,d,d*.9,-d*.9,.01,100);camera.position.set(-14,8,-19);camera.lookAt(0,0,0);renderer.render(scene,camera);const png=renderer.domElement.toDataURL();g.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();});return png;}
  layouts.trees=['oak','autumn','pine','palm','orchard'].map((kind,i)=>{const g=new T.Group();environmentTree(g,{kind,x:0,y:0,z:0,h:8,seed:i+4},true);return {name:kind,png:render(g)};});
  layouts.props=ENVIRONMENT_PROP_KINDS.map((kind,i)=>{const g=new T.Group();detailEnvironmentProp(g,{kind,x:0,y:0,z:0,w:kind==='car'||kind==='truck'?2.8:3,h:kind==='lamp'?5.8:3,d:kind==='car'||kind==='truck'?6:3,seed:i+3},undefined,true);return {name:kind,png:render(g)};});
  window.catalogs=layouts;window.showCatalog=key=>{document.head.innerHTML='<style>body{margin:0;padding:24px;background:#101e23;color:#e4ece5;font:16px system-ui}h1{letter-spacing:.1em;font-size:24px}p{color:#aabcb8}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:radial-gradient(ellipse at 45% 35%,#4d6061,#24363b);border-radius:10px;overflow:hidden}img{display:block;width:100%;height:250px;object-fit:contain}figcaption{text-transform:capitalize;text-align:center;padding:12px;background:#1b2b30}</style>';document.body.innerHTML='<h1>RAVELFRONT · LIVING TERRAIN</h1><p>Actual gameplay scenery · shared PBR surfaces · no generated illustrations</p><main>'+layouts[key].map(i=>'<figure><img src="'+i.png+'"><figcaption>'+i.name+'</figcaption></figure>').join('')+'</main>';};renderer.dispose();return Object.fromEntries(Object.entries(layouts).map(([k,v])=>[k,v.length]));
 });
 assert.deepEqual(catalogs,{trees:5,props:48});for(const key of Object.keys(catalogs)){await gallery.evaluate(key=>window.showCatalog(key),key);await gallery.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await gallery.screenshot({path:out+'/'+key+'.png',fullPage:true});}checks.allSceneryFactories=true;
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors,views,catalogs},null,2));console.log('PASS living terrain',checks);
}catch(error){await page?.screenshot({path:out+'/failure-game.png'}).catch(()=>{});await gallery?.screenshot({path:out+'/failure-gallery.png',fullPage:true}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({checks,errors,views,error:String(error)},null,2));throw error;}
finally{await browser?.close();await vite.close();await relay.close();await rm(temp,{recursive:true,force:true});}
