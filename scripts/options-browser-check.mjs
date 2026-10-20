import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const temp=await mkdtemp('/tmp/ravel-options-'),origin='http://127.0.0.1:5324',out='test-results/options';
process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/rewards.json';
let app,vite,browser,page;const errors=[],checks=[];const pass=s=>{checks.push(s);console.log('PASS',s);};
try{
 await mkdir(out,{recursive:true});app=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin],publicRoyale:false,mapPath:temp+'/maps.json',recoveryPath:null});
 const relay=`ws://127.0.0.1:${app.server.address().port}/game`;
 vite=await createServer({plugins:[{name:'test-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'${relay}'};`);});}}],server:{host:'127.0.0.1',port:5324,strictPort:true,watch:null}});await vite.listen();
 browser=await chromium.launch({headless:true,executablePath:process.env.YOLK_TEST_CHROME||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({bypassCSP:true,viewport:{width:1440,height:900},deviceScaleFactor:.5});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('yolk-profile',JSON.stringify({name:'Options Pilot'}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,musicVolume:0,fpsLimit:30}));localStorage.setItem('ravelfront-voice-192-dismissed','yes');});
 await page.goto(origin+'/?qa',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yolkTest?.party().ready);await page.locator('#loading-screen').waitFor({state:'hidden'});
 const saved=async(key,value)=>page.waitForFunction(([k,v])=>window.__yolkTest.party().party.selection[k]===v,[key,value]);
 const close=()=>page.locator('#lobby-options-form [data-action=close]').click();
 for(const [experience,key,value]of [['royale','building','false'],['box-fights','scoreLimit','7'],['zone-wars','capacity','12'],['zombies','teamSize','2'],['ffa','weaponPool','precision']]){
  await page.locator('[data-action=choose-mode]').click();await page.locator(`[data-experience="${experience}"]`).click();await page.locator('[data-action=lobby-options]').click();
  assert.equal(await page.locator('#lobby-options-form [type=submit]').count(),0);
  await page.locator('#lobby-access').selectOption('private');await saved('access','private');
  await page.locator('#lobby-'+key).selectOption(value);await saved(key,value==='false'?false:key==='scoreLimit'||key==='capacity'||key==='teamSize'?Number(value):value);
  await page.locator('[data-options-status]').filter({hasText:'Changes saved'}).waitFor();await close();await page.locator('#dialog').waitFor({state:'hidden'});pass(experience+' options save automatically to the server');
 }
 await page.locator('[data-action=lobby-options]').click();await page.locator('#lobby-minutes').fill('0');await page.locator('#lobby-minutes').dispatchEvent('change');assert.equal(await page.evaluate(()=>__yolkTest.party().party.selection.minutes),5);
 await page.locator('#lobby-minutes').fill('17');await close();await page.locator('#dialog').waitFor({state:'hidden'});await saved('minutes',17);pass('invalid numeric edits are rejected and closing commits a valid last edit');
 await page.locator('[data-action=lobby-options]').click();await page.evaluate(()=>{const field=document.querySelector('#lobby-weaponPool');for(const value of ['all','close','precision']){field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));}});await saved('weaponPool','precision');await page.locator('[data-options-status]').filter({hasText:'Changes saved'}).waitFor();
 await page.screenshot({path:out+'/automatic-options.png'});await close();await page.locator('[data-action=lobby-options]').click();assert.equal(await page.locator('#lobby-weaponPool').inputValue(),'precision');pass('rapid edits retain the final selection when reopening options');
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors},null,2));
}catch(error){await page?.screenshot({path:out+'/failure.png',timeout:15000}).catch(()=>{});console.error((await page?.locator('body').innerText().catch(()=>''))?.slice(-1200));throw error;}
finally{await browser?.close();await vite?.close();await app?.close();await rm(temp,{recursive:true,force:true});}
