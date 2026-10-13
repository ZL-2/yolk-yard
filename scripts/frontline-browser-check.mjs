import {startRealtimeServer} from '../server/realtime/index.js';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/expansion/frontline',origin='http://127.0.0.1:5249';await mkdir(out,{recursive:true});
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]});relay.relay.progression.path=null;
const vite=await createServer({plugins:[{name:'frontline-local-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${relay.server.address().port}/game'};`);});}}],server:{host:'127.0.0.1',port:5249,strictPort:true,watch:null}});await vite.listen();
let browser,page;const errors=[],checks={};
try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ravelfront-season-1-update-150-dismissed','yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:.3,musicVolume:.3}));localStorage.setItem('yolk-profile',JSON.stringify({name:'Frontline QA'}));});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest);await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.locator('[data-action=training]:visible').click();await page.locator('[data-action=start-training]').click();await page.locator('#loading-screen').waitFor({state:'hidden'});
 const resume=page.locator('#dialog [data-action=resume]');if(await resume.isVisible())await resume.click();else await page.mouse.click(720,450);
 await page.waitForFunction(()=>!window.__yolkTest.read().paused&&document.pointerLockElement);
 await page.evaluate(async()=>{const {initializeOperations}=await import('/src/field-operations.js'),{groundAt}=await import('/src/terrain.js');window.__yolkTest.fixture(s=>{
  const id=window.__yolkTest.read().localId,p=s.players.get(id);s.options.training=false;s.stage='active';s.startedAt=s.time-80;s.alive=20;initializeOperations(s);s.operations.nextAt=1000;s.operations.sequence=1;
  const x=18,z=30,y=groundAt(s.map,x,z);s.operations.uplink={id:1,x,y,z,name:'Coastal station',status:'active',progress:6,team:id,occupants:[id],contested:false,expiresAt:s.time+300,lastOccupied:s.time};s.operations.scanAt=s.time+300;
  p.shieldUntil=s.time+300;p.inventory[1]={id:'sprinter',weapon:true,count:1,ammo:30,rarity:2};p.slot=1;s.syncInventory(p);window.__yolkTest.pose({x,y,z:z+6,yaw:0,pitch:0,slot:1,grounded:true,flight:'ground',vy:0});window.__yolkTest.look(0,0);
 });});
 await page.waitForFunction(()=>document.querySelector('#field-operations .field-title')?.textContent==='CAPTURING UPLINK'&&window.__yolkTest.frontline().uplink);
 assert.equal(await page.locator('#field-operations progress.field-capture').getAttribute('max'),'14');
 const layout=await page.evaluate(()=>{const box=s=>document.querySelector(s)?.getBoundingClientRect(),overlap=(a,b)=>a&&b&&a.width&&b.width&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;const panel=box('#field-operations');return {clearMap:!overlap(panel,box('.royale-map-stack')),clearBuild:!overlap(panel,box('.build-hud')),capture:!document.querySelector('#field-capture-status').hidden};});assert.equal(layout.clearMap,true);assert.equal(layout.clearBuild,true);assert.equal(layout.capture,true);
 await page.waitForFunction(()=>['objective','final'].includes(window.__yolkTest.frontline().score.scene));checks.objectiveHUDAndMusic=true;
 await page.screenshot({path:out+'/uplink-gameplay.png'});
 await page.evaluate(()=>window.__yolkTest.fixture(s=>s.emit('field-medal',{player:window.__yolkTest.read().localId,medal:'uplink',xp:150})));
 // Read both rectangles in one browser frame: under software rendering a
 // 2.5-second toast can expire between separate protocol round trips.
 await page.waitForFunction(()=>{const medal=document.querySelector('#field-medal'),storm=document.querySelector('.royale-storm-warning');if(!medal||medal.hidden)return false;const a=medal.getBoundingClientRect(),b=storm?.getBoundingClientRect();if(b?.height&&a.top<b.bottom)throw Error('Medals overlap the storm countdown');return true;});
 await page.screenshot({path:out+'/medal.png'});checks.medal=true;
 await page.keyboard.press('Escape');await page.locator('#dialog [data-action=field-orders]').click();
 assert.equal(await page.locator('.field-order-list article').count(),3);assert.equal(await page.locator('.field-report-grid>div').count(),8);assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 await page.screenshot({path:out+'/field-orders.png'});await page.waitForFunction(()=>window.__yolkTest.frontline().score.scene==='silent');checks.ordersAndPause=true;
 await page.locator('#dialog [data-action=resume]').click();await page.keyboard.down('KeyW');await page.waitForFunction(()=>Math.abs(window.__yolkTest.frontline().motion?.x||0)>.0001);await page.keyboard.up('KeyW');checks.motion=true;
 // Render original effects through a real Web Audio graph, not only mocks.
 checks.audio=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio.js'),ctx=new OfflineAudioContext(2,44100*3,44100),s=new Sound();s.ctx=ctx;s.master=ctx.createGain();s.master.gain.value=.5;s.master.connect(ctx.destination);s.noiseBuffer=ctx.createBuffer(1,88200,44100);
  const data=s.noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.sin(i*2.399)*.5;
  s.shot('sprinter');s.cue('uplink-secured');s.cue('shield-break');const rendered=await ctx.startRendering();let peak=0,energy=0;
  for(const n of rendered.getChannelData(0)){if(!Number.isFinite(n))throw Error('Non-finite audio sample');peak=Math.max(peak,Math.abs(n));energy+=n*n;}
  if(peak<.01||peak>1||energy<1)throw Error('Silent or clipped effect mix');return {peak,energy};
 });
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS Frontline browser',checks);
}catch(error){await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({checks,errors,error:String(error)},null,2));throw error;}
finally{await browser?.close();await vite.close();await relay.close();}
