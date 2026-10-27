import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const out='art/jim/review/validation';await mkdir(out,{recursive:true});
const vite=await createServer({configFile:'vite.jim.config.mjs',server:{watch:null}});await vite.listen();
await vite.watcher.close();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1}),errors=[],poses=[];
page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5281/jim-review.html');await page.waitForFunction(()=>window.__jimReview||document.querySelector('.status.error'));
 assert.equal(await page.locator('.status.error').count(),0,errors.join('\n'));await page.evaluate(()=>window.__jimReview.setPaused(true));
 const assets=await page.evaluate(()=>Object.fromEntries(Object.entries(window.__jimReview.models).map(([id,model])=>{
  const h=model.userData.human,m=h.mesh,g=m.geometry,s=g.attributes.skinIndex,w=g.attributes.skinWeight;let validWeights=true;
  for(let i=0;i<s.count;i++){let sum=0;for(let j=0;j<4;j++){validWeights&&=s.array[i*4+j]>=0&&s.array[i*4+j]<32;sum+=w.array[i*4+j];}validWeights&&=Math.abs(sum-1)<.002;}
  return [id,{id:h.asset.id,triangles:g.index.count/3,lodTriangles:h.asset.lod.geometry.index.count/3,bones:m.skeleton.bones.length,validWeights,materials:m.material.length,textures:m.material.every(x=>!!x.map),maxTextureSize:Math.max(...m.material.flatMap(x=>[x.map,x.normalMap].filter(Boolean).flatMap(t=>[t.image.width,t.image.height]))),alphaHair:m.material.some(x=>x.alphaTest>0&&!!x.map),footwearNormal:m.material.some(x=>/footwear/.test(x.name)&&!!x.normalMap),groups:g.groups.length,lodGroups:h.asset.lod.geometry.groups.length}];
 })));
 for(const [id,a]of Object.entries(assets)){assert.equal(a.id,'jim-'+id);assert.equal(a.bones,32);assert.ok(a.validWeights&&a.textures&&a.alphaHair&&a.footwearNormal);assert.ok(a.maxTextureSize<=2048,'texture sizes stay within the review budget');assert.equal(a.groups,5);assert.equal(a.lodGroups,5);assert.ok(a.triangles<100000);assert.ok(a.lodTriangles<a.triangles*.3&&a.lodTriangles<25000);}
 await page.evaluate(()=>{const r=window.__jimReview;r.setPose('bind');r.advance(1);});
 const bindError=await page.evaluate(()=>Math.max(...Object.values(window.__jimReview.models).map(model=>{const m=model.userData.human.mesh,p=m.geometry.attributes.position,a=window.__jimReview.camera.position.clone(),b=a.clone();let error=0;for(let i=0;i<p.count;i+=5){a.fromBufferAttribute(p,i);m.getVertexPosition(i,b);error=Math.max(error,a.distanceTo(b));}return error;})));
 assert.ok(bindError<.0001,'the modeling pose preserves exported geometry: '+bindError);
 for(const angle of ['front','side','back']){await page.evaluate(a=>{const r=window.__jimReview;r.setView(a);r.advance(1);},angle);await page.screenshot({path:`${out}/${angle}.png`,fullPage:true});}
 await page.evaluate(()=>{const r=window.__jimReview;r.setView('front');r.advance(1);});await page.screenshot({path:'art/jim/review/jim-outfits.png',fullPage:true});
 for(const id of ['normal','golf']){await page.evaluate(s=>{const r=window.__jimReview;r.setStyle(s);r.setView('face');r.advance(1);},id);await page.locator('canvas').screenshot({path:`${out}/${id}-face.png`});}
 for(const id of ['normal','golf']){await page.evaluate(s=>{const r=window.__jimReview;r.setStyle(s);r.setView('shoes');r.advance(1);},id);await page.locator('canvas').screenshot({path:`${out}/${id}-shoes.png`});}
 await page.evaluate(()=>{const r=window.__jimReview;r.setStyle('both');r.setView('front');});
 for(const pose of ['idle','walk','run','sprint','strafe','backward','crouch','aim','jump','fall','slide','crawl','revive','reload','melee','salute','shuffle','cheer','glide']){
  const sample=await page.evaluate(pose=>{const r=window.__jimReview;r.setPose(pose);r.advance(90);return Object.fromEntries(Object.entries(r.models).map(([id,model])=>{
   const h=model.userData.human,m=h.mesh,g=m.geometry,v=r.camera.position.clone();let finite=true,min=Infinity,max=-Infinity,gripError=0;
   for(let i=0;i<g.attributes.position.count;i+=5){m.getVertexPosition(i,v);finite&&=[v.x,v.y,v.z].every(Number.isFinite);min=Math.min(min,v.y);max=Math.max(max,v.y);}
   for(const b of m.skeleton.bones)finite&&=b.matrixWorld.elements.every(Number.isFinite);
   if(model.userData.held.visible)for(const S of ['L','R'])if(h['handTarget'+S])gripError=Math.max(gripError,h.bones['hand'+S].getWorldPosition(v).distanceTo(h.mesh.localToWorld(h['handTarget'+S].clone())));
   return [id,{finite,min,max,gripError}];
  }));},pose);
  for(const [id,s]of Object.entries(sample)){assert.ok(s.finite&&s.min>-.9&&s.max<3.1,`${id} ${pose} stable skin`);if(['aim','reload'].includes(pose))assert.ok(s.gripError<.04,`${id} ${pose} weapon grip: ${s.gripError}`);}
  poses.push({pose,...sample});if(['idle','run','aim','crouch','salute','glide'].includes(pose))await page.locator('canvas').screenshot({path:`${out}/${pose}.png`});
 }
 const lod=await page.evaluate(()=>{const r=window.__jimReview;r.setPose('idle');r.advance(90,60);return Object.fromEntries(Object.entries(r.models).map(([id,m])=>[id,{active:m.userData.human.mesh.geometry===m.userData.human.asset.lod.geometry,groups:m.userData.human.mesh.geometry.groups.length}]));});
 for(const a of Object.values(lod))assert.ok(a.active&&a.groups===5);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const r=window.__jimReview;r.setStyle('both');r.setPose('bind');r.setView('front');r.advance(1);});await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile layout does not overflow');
 await page.getByRole('button',{name:'Special',exact:true}).click();await page.getByRole('button',{name:'Footwear',exact:true}).click();assert.equal(await page.evaluate(()=>window.__jimReview.controls.target.y),.09);await page.getByRole('button',{name:'Face',exact:true}).click();await page.locator('#pose').selectOption('idle');await page.getByRole('button',{name:'Pause',exact:true}).click();
 assert.deepEqual(errors,[]);const report={result:'PASS',status:'PRIVATE APPROVAL STUDY — NOT DEPLOYED',assets,bindError,poses,lod,closeUpCameras:['face','shoes'],mobile:{width:390,height:844,overflow:false,controls:true},errors};await writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log('PASS: two Jim models, valid weights/textures, 19 game poses each, grips, distance LOD and mobile controls.');
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({result:'FAIL',error:String(e),errors,poses},null,2));throw e;}
finally{await browser.close();await vite.close();}
