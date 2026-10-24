import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const id=process.argv[2]||'wren',out=`test-results/roster215/${id}`;await mkdir(out,{recursive:true});
const vite=await createServer({server:{host:'127.0.0.1',port:5274,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1360,height:1000},deviceScaleFactor:.75}),errors=[],poses=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:5274/wren-study.html?operator=${id}`);await page.waitForFunction(()=>window.__wrenStudy,{timeout:45000});
 const asset=await page.evaluate(()=>{const h=window.__wrenStudy.model.userData.human,m=h.mesh,g=m.geometry,s=g.attributes.skinIndex,w=g.attributes.skinWeight;let valid=true;for(let i=0;i<s.count;i++){let sum=0;for(let j=0;j<4;j++){valid&&=s.array[i*4+j]<m.skeleton.bones.length;sum+=w.array[i*4+j];}valid&&=Math.abs(sum-1)<.002;}return {asset:h.asset.id,triangles:g.index.count/3,bones:m.skeleton.bones.length,materials:[].concat(m.material).length,validWeights:valid,texture:[].concat(m.material).every(m=>!!m.map)};});
 assert.equal(asset.asset,id);assert.equal(asset.bones,32);assert.ok(asset.triangles<70000);assert.ok(asset.materials<=2&&asset.validWeights&&asset.texture);
 for(const button of ['Front','Side','Back']){await page.getByRole('button',{name:button,exact:true}).click();const f=await page.evaluate(()=>window.__wrenStudy.frames);await page.waitForFunction(f=>window.__wrenStudy.frames>f+2,f);await page.screenshot({path:`${out}/${button.toLowerCase()}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Front',exact:true}).click();
 const sample=()=>page.evaluate(()=>{const {model,frames}=window.__wrenStudy,h=model.userData.human,m=h.mesh,p=m.geometry.attributes.position;let finite=true,min=Infinity,max=-Infinity;const v=window.__wrenStudy.camera.position.clone();for(let i=0;i<p.count;i+=3){m.getVertexPosition(i,v);finite&&=[v.x,v.y,v.z].every(Number.isFinite);min=Math.min(min,v.y);max=Math.max(max,v.y);}return {frames,finite,min,max,hand:h.bones.handR.matrixWorld.elements.slice()};});
 for(const pose of ['idle','walk','run','crouch','aim','glide']){
  await page.locator('#pose').selectOption(pose);const before=await sample();await page.waitForFunction(f=>window.__wrenStudy.frames>f+18,before.frames,{timeout:25000});const after=await sample();assert.ok(after.finite&&after.min>-.9&&after.max<3,pose+' stable deformation');if(pose==='idle')assert.ok(after.min>-.13&&after.min<.12,'soles meet ground');if(['walk','run'].includes(pose))assert.notDeepEqual(after.hand,before.hand,'animation advances');poses.push({pose,...after,hand:undefined});await page.screenshot({path:`${out}/${pose}.png`,fullPage:true});
 }
 const lod=await page.evaluate(async()=>{const {model}=window.__wrenStudy,h=model.userData.human;await h.asset.lodRequest;const {animateHumanoid}=await import('/src/humanoid.js');animateHumanoid(model,{health:100,grounded:true},1/60,1,{distance:60});return {triangles:h.mesh.geometry.index.count/3,groups:h.mesh.geometry.groups.length,materials:[].concat(h.mesh.material).length};});assert.ok(lod.triangles<asset.triangles*.4&&lod.groups===lod.materials);
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({result:'PASS',asset,poses,lod,errors},null,2));console.log('PASS '+id+': actual asset, weights, views, six game poses, distance LOD');
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({result:'FAIL',error:String(e),errors,poses},null,2));throw e;}
finally{await browser.close();await vite.close();}
