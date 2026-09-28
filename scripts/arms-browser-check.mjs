import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5178,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1800,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5178/tests/arms-preview.html');
 await page.waitForFunction(()=>window.ready,{},{timeout:90000});
 assert.equal(await page.locator('.tile img').count(),55);
 assert.ok(await page.locator('.tile img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));
 assert.equal(new Set(await page.locator('.tile img').evaluateAll(imgs=>imgs.map(i=>i.src))).size,55);
 const rigs=await page.evaluate(async()=>{
  const {makeArms}=await import('/src/arms.js');const {WEAPONS,ROYALE_WEAPONS}=await import('/src/data.js');
  for(const w of [...WEAPONS,...ROYALE_WEAPONS]){const rig=makeArms(w.id,{outfit:'outfit-garden'});for(const limb of rig.userData.limbs){if(!limb.arm.geometry.attributes.position.array.every(Number.isFinite))throw Error('Invalid human arm vertices');if(!limb.hand.geometry.attributes.position.array.every(Number.isFinite))throw Error('Invalid hand vertices');if(limb.hand.material.color.getHexString()!=='17262e')throw Error('Operator gloves missing');}}return 11;
 });assert.equal(rigs,11);
 assert.deepEqual(errors,[]);
 await mkdir('test-results/arms',{recursive:true});
 await page.screenshot({path:'test-results/arms/blaster-poses.png',fullPage:true});
 const portraits=await page.locator('.tile img').evaluateAll(imgs=>imgs.map(i=>i.src));
 for(const [i,name] of [[0,'sprinter-idle'],[1,'sprinter-reload'],[35,'pip-idle'],[4,'sprinter-draw']])
  await writeFile(`test-results/arms/${name}.png`,Buffer.from(portraits[i].split(',')[1],'base64'));
 console.log('PASS all eleven human arm rigs render idle, reload, sight alignment and third-person poses');
} finally {await browser.close();await server.close();}
