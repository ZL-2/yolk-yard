import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const out='test-results/camera-gameplay',origin='http://127.0.0.1:5273',temp=await mkdtemp('/tmp/ravel-camera-');await mkdir(out,{recursive:true});
process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]});
const vite=await createServer({plugins:[{name:'camera-local-relay',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${relay.server.address().port}/game'};`);});}}],server:{host:'127.0.0.1',port:5273,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({bypassCSP:true,viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[],checks=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
try{
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Camera Review',weapon:'sprinter'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,fpsLimit:30,perspective:'third',thirdPersonFov:65}));localStorage.setItem('ravelfront-stormspike-kestrel-199-dismissed','yes');});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest);await page.evaluate(()=>window.__yolkTest.startFixture({mode:'ffa',bots:0}));await page.locator('#loading-screen').waitFor({state:'hidden'});await page.getByRole('button',{name:'DEPLOY',exact:true}).click();await page.evaluate(()=>window.__yolkTest.resume());
 await page.waitForFunction(()=>window.__yolkTest.perspective().active&&window.__yolkTest.perspective().body);
 for(const [name,pitch,aim,crouch]of [['level',0,false,false],['down',-.5,false,false],['up',.4,false,false],['aim',0,true,false],['crouch',0,false,true]]){
  await page.evaluate(p=>{const q=window.__yolkTest;q.pose({reloadEnd:0,equipUntil:0,equipStarted:-100,equipHolster:0});q.look(0,p);},pitch);
  if(aim)await page.locator('#world').dispatchEvent('mousedown',{button:2});else await page.locator('#world').dispatchEvent('mouseup',{button:2});
  if(crouch)await page.keyboard.down('AltLeft');else await page.keyboard.up('AltLeft');
  await page.waitForTimeout(900);
  const result=await page.evaluate(async()=>{const {Vector3,Quaternion}=await import('/node_modules/three/build/three.module.js');return window.__yolkTest.loadingFixture(v=>{const p=v.renderLocalActor,m=v.models.get(p.id),t=new Vector3(v.thirdPersonTarget.x,v.thirdPersonTarget.y,v.thirdPersonTarget.z),muzzle=m.userData.blaster.userData.muzzle.getWorldPosition(new Vector3()),dir=new Vector3(0,0,-1).applyQuaternion(m.userData.held.getWorldQuaternion(new Quaternion())).normalize(),error=t.clone().sub(muzzle).normalize().distanceTo(dir),ndc=t.project(v.camera);return {error,reticleError:Math.hypot(ndc.x,ndc.y),fov:v.camera.fov,body:m.visible,firstPersonWeapon:v.gunGroup.visible};});});
  checks.push({name,...result});assert.ok(result.error<.003,name+' gun follows crosshair');assert.ok(result.reticleError<.003,name+' camera target is screen centre');assert.ok(result.body&&!result.firstPersonWeapon);await page.screenshot({path:out+'/'+name+'.png'});
 }
 await page.keyboard.up('AltLeft');await page.evaluate(()=>window.__yolkTest.setPerspective('first'));await page.waitForFunction(()=>!window.__yolkTest.perspective().active&&window.__yolkTest.perspective().firstPersonWeapon);
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS actual gameplay camera, visible muzzle convergence, crouch, aim and first-person return');
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({checks,errors,error:String(e)},null,2));throw e;}
finally{await browser.close();await vite.close();await relay.close();await rm(temp,{recursive:true,force:true});}
