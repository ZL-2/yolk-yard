import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const out='art/icon-bundle/validation';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/tmp/input-browser-extract/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1500,height:1160},deviceScaleFactor:1}),errors=[],assets={};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(30000);
try{
 await page.goto(pathToFileURL(resolve('art/icon-bundle/Jim-Bundle-Review.html')).href);
 await page.waitForFunction(()=>window.__bundleReview);await page.evaluate(()=>window.__bundleReview.setPaused(true));
 for(const slot of ['pickaxe','wrap','backbling','glider','trail']){
  const row=await page.evaluate(slot=>{const r=window.__bundleReview;r.select(slot);r.setTime(0);return r.stats();},slot);assets[slot]=row;
  assert.ok(row.triangles>100&&row.triangles<100000,slot+' triangle budget');
  await page.screenshot({path:`${out}/${slot}.png`,fullPage:true});
  const data=await page.evaluate(()=>window.__bundleReview.capture());await writeFile(`${out}/${slot}-render.png`,Buffer.from(data.split(',')[1],'base64'));
  await page.evaluate(()=>window.__bundleReview.fit('detail'));await page.screenshot({path:`${out}/${slot}-detail.png`,fullPage:true});
 }
 // Different instances own their uniforms and animated matrices. Rendering two
 // at once must not overwrite the first one's effect or corrupt shared meshes.
 const geometry=await page.evaluate(()=>{const r=window.__bundleReview,results={};for(const slot of ['pickaxe','backbling','glider','trail']){
   r.select(slot);r.setTime(0);const first=[];r.current.traverse(m=>{if(m.isMesh)first.push([m.geometry.uuid,m.geometry.attributes.position.array.slice(0,12)]);});r.advance(120);
   let finite=true;r.current.updateMatrixWorld(true);r.current.traverse(m=>{finite&&=m.matrixWorld.elements.every(Number.isFinite);if(m.isInstancedMesh)finite&&=m.instanceMatrix.array.every(Number.isFinite);});results[slot]={finite,geometryStable:first.every(([id,a])=>{let match;r.current.traverse(m=>{if(m.geometry?.uuid===id)match=m.geometry;});return match&&a.every((v,i)=>v===match.attributes.position.array[i]);})};
 }return results;});for(const row of Object.values(geometry))assert.ok(row.finite&&row.geometryStable);
 await page.evaluate(()=>{const r=window.__bundleReview;r.select('glider');r.setTime(0);r.replay();r.setPaused(true);r.setTime(.3);});await page.screenshot({path:out+'/glider-opening.png'});
 await page.evaluate(()=>window.__bundleReview.setTime(1.5));await page.screenshot({path:out+'/glider-open.png'});
 await page.getByRole('tab',{name:/03.*Back accessory/}).click();await page.locator('#mannequin').check();await page.screenshot({path:out+'/bottle-scale.png'});
 await page.getByRole('tab',{name:/02.*Weapon wrap/}).click();for(const weapon of ['sprinter','doubleyolk','crackshot','pip']){await page.locator('#weapon').selectOption(weapon);await page.evaluate(()=>window.__bundleReview.advance(1));await page.screenshot({path:`${out}/wrap-${weapon}.png`});}
 await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:/04.*Glider/}).click();await page.screenshot({path:out+'/narrow-layout.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[],'no render or JavaScript errors');await writeFile(out+'/result.json',JSON.stringify({result:'PASS',assets,geometry,errors},null,2));console.log(JSON.stringify({result:'PASS',assets,geometry}));
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({result:'FAIL',error:String(e),errors,assets},null,2));throw e;}finally{await browser.close();}
