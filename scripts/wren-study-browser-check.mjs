import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer,preview} from 'vite';
const out='test-results/wren-study';await mkdir(out,{recursive:true});
const built=process.env.STUDY_BUILT==='1';
const vite=built?await preview({preview:{host:'127.0.0.1',port:5268,strictPort:true}}):await createServer({server:{host:'127.0.0.1',port:5268,strictPort:true,watch:null}});if(!built)await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1120}}),errors=[],poses=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5268/wren-study.html');await page.waitForFunction(()=>window.__wrenStudy,{timeout:45000});
 const asset=await page.evaluate(()=>{const {model,renderer}=window.__wrenStudy,m=model.userData.human.mesh,g=m.geometry,s=g.attributes.skinIndex,w=g.attributes.skinWeight;let valid=true;for(let i=0;i<s.count;i++){let sum=0;for(let j=0;j<4;j++){valid&&=s.array[i*4+j]<m.skeleton.bones.length;sum+=w.array[i*4+j];}valid&&=Math.abs(sum-1)<.002;}return{asset:model.userData.asset,triangles:g.index.count/3,bones:m.skeleton.bones.length,materials:Array.isArray(m.material)?m.material.length:1,validWeights:valid,texture:!!m.material.map};});
 assert.equal(asset.asset,'wren-prototype.glb');assert.ok(asset.triangles<40000&&asset.triangles>10000);assert.equal(asset.bones,32);assert.equal(asset.materials,1);assert.ok(asset.validWeights&&asset.texture);
 await page.screenshot({path:out+'/comparison.png',fullPage:true});
 for(const button of ['Side','Back','Front']){await page.getByRole('button',{name:button,exact:true}).click();await page.waitForTimeout(100);await page.screenshot({path:out+'/'+button.toLowerCase()+'.png',fullPage:true});}
 const sample=()=>page.evaluate(()=>{const {model,frames}=window.__wrenStudy,h=model.userData.human,m=h.mesh,p=m.geometry.attributes.position;let finite=true,min=Infinity,max=-Infinity;const v=window.__wrenStudy.camera.position.clone();for(let i=0;i<p.count;i++){m.getVertexPosition(i,v);finite&&=[v.x,v.y,v.z].every(Number.isFinite);min=Math.min(min,v.y);max=Math.max(max,v.y);}return{frames,finite,min,max,bone:Array.from(h.bones.handR.matrixWorld.elements)};});
 for(const pose of ['idle','walk','run','crouch','aim','glide']){
  await page.locator('#pose').selectOption(pose);const before=await sample();await page.waitForFunction(f=>window.__wrenStudy.frames>f+20,before.frames,{timeout:20000});const after=await sample();assert.ok(after.finite,pose+' finite skinned vertices');assert.ok(after.min>-.8&&after.max<3,pose+' bounded model');if(pose==='idle')assert.ok(after.min>-.1&&after.min<.08,'idle soles remain on the ground');if(['walk','run'].includes(pose))assert.notDeepEqual(after.bone,before.bone,pose+' actually advances');poses.push({pose,...after,bone:undefined});await page.screenshot({path:out+'/'+pose+'.png',fullPage:true});
 }
 await page.locator('#wire').click();assert.equal(await page.evaluate(()=>window.__wrenStudy.model.userData.human.mesh.material.wireframe),true);await page.locator('#wire').click();
 await page.getByRole('button',{name:'Auto rotate'}).click();const angle=await page.evaluate(()=>window.__wrenStudy.model.rotation.y);await page.waitForFunction(a=>window.__wrenStudy.model.rotation.y>a+.04,angle);
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({result:'PASS',asset,poses,errors},null,2));console.log('PASS Wren actual GLB, skin weights, three views, six game animations, wireframe and rotation');
}catch(error){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({result:'FAIL',error:String(error),errors,poses},null,2));throw error;}
finally{await browser.close();if(built)await new Promise(resolve=>vite.httpServer.close(resolve));else await vite.close();}
