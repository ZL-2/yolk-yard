// Render the gameplay models, not independently drawn approximations.
// BROWSER_EXECUTABLE can select an installed Chromium on build workstations.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp':'sharp');
await mkdir('public/season',{recursive:true});
if(process.env.UPDATE_BACKGROUND)await sharp(process.env.UPDATE_BACKGROUND).webp({quality:91}).toFile('public/season/stormspike-kestrel-background.webp');
const server=await createServer({server:{port:5179,host:'127.0.0.1'},plugins:[{name:'model-stage',configureServer(s){s.middlewares.use('/__model-stage',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><head><style>body{margin:0;background:transparent}canvas{display:block}</style></head><body></body></html>');});}}]});await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});page.on('pageerror',e=>console.error(e));await page.goto('http://127.0.0.1:5179/__model-stage');
 for(const type of ['stormspike','kestrel']){
  const size=type==='stormspike'?[1400,800]:[1600,900];await page.setViewportSize({width:size[0],height:size[1]});
  const info=await page.evaluate(async({type,size})=>{
   const T=await import('/node_modules/three/build/three.module.js'),{RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
   const {makeBlaster}=await import('/src/weapons.js'),{makeHelicopter}=await import('/src/helicopter-model.js');
   document.body.replaceChildren();const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(...size);renderer.setClearColor(0x000000,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.append(renderer.domElement);
   const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04).texture,scene=new T.Scene();scene.environment=env;
   const model=type==='stormspike'?makeBlaster('stormspike'):makeHelicopter({detail:2,environment:env});scene.add(model);
   scene.add(new T.HemisphereLight(0xcdefff,0x24343b,1.2));const light=new T.DirectionalLight(0xffebc4,2.4);light.position.set(3,6,-3);scene.add(light);const rim=new T.DirectionalLight(0x72daff,2);rim.position.set(-4,2,1);scene.add(rim);
   if(type==='kestrel'){model.getObjectByName('heli-downwash').visible=false;model.getObjectByName('heli-main-rotor').rotation.y=.3;}
   const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3());model.position.sub(center);scene.updateMatrixWorld(true);
   const camera=new T.PerspectiveCamera(28,size[0]/size[1],.01,200);
   const direction=type==='stormspike'?new T.Vector3(3.8,1.5,1.15):new T.Vector3(8.5,4.9,-10);
   camera.position.copy(direction.normalize().multiplyScalar(type==='stormspike'?5.3:22));camera.lookAt(0,0,0);
   // Project the actual bounding corners and fit; dust is excluded from flight art.
   const bounds=new T.Box3().setFromObject(model),points=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new T.Vector3(x,y,z));
   for(let i=0;i<4;i++){camera.updateMatrixWorld();const extent=Math.max(...points.map(p=>{const q=p.clone().project(camera);return Math.max(Math.abs(q.x)/.92,Math.abs(q.y)/.91);}));camera.position.multiplyScalar(extent);}
   renderer.render(scene,camera);window.artRenderer=renderer;
   return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,png:renderer.domElement.toDataURL('image/png')};
  },{type,size});
  const png=Buffer.from(info.png.split(',')[1],'base64');await sharp(png).trim({threshold:5}).extend({top:30,bottom:30,left:30,right:30,background:{r:0,g:0,b:0,alpha:0}}).resize(size[0],size[1],{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:96,alphaQuality:100}).toFile(`public/season/${type}-model.webp`);
  if(type==='stormspike'){const small=await sharp(png).trim().resize(580,310,{fit:'inside'}).extend({top:12,bottom:12,left:10,right:10,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();await writeFile('public/inventory-previews/stormspike.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="334" viewBox="0 0 600 334" aria-label="Stormspike Rifle" data-model-revision="199"><image width="600" height="334" href="data:image/png;base64,${small.toString('base64')}"/></svg>\n`);}
  console.log(type,{calls:info.calls,triangles:info.triangles});
 }
 await page.setViewportSize({width:1672,height:941});await page.evaluate(async()=>{const {midseasonArt}=await import('/src/midseason-briefing.js');document.body.innerHTML=midseasonArt();const style=document.createElement('style');style.textContent='.midseason-art{width:1672px;height:941px}.midseason-feature h2{font-size:100px}.midseason-kestrel h2{font-size:96px}.midseason-kicker{font-size:15px}.midseason-tagline{font-size:22px}.midseason-edition{font-size:19px}';document.head.append(style);await Promise.all([...document.images].map(i=>i.decode()));await document.fonts.ready;});
 await page.locator('.midseason-art').screenshot({path:'public/season/stormspike-kestrel.png'});await sharp('public/season/stormspike-kestrel.png').webp({quality:94}).toFile('public/season/stormspike-kestrel.webp');
 const {unlink}=await import('node:fs/promises');await unlink('public/season/stormspike-kestrel.png');
 const manifest=JSON.parse(await readFile('public/inventory-previews/manifest.json','utf8'));manifest.source=createHash('sha256').update(await readFile('src/weapons.js')).digest('hex');manifest.weapons.stormspike={name:'Stormspike Rifle',sha256:createHash('sha256').update(await readFile('public/inventory-previews/stormspike.svg')).digest('hex')};await writeFile('public/inventory-previews/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 const sources={};for(const file of ['src/weapons.js','src/helicopter-model.js'])sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');await writeFile('public/season/update-199-models.json',JSON.stringify({revision:199,sources,art:['stormspike-model.webp','kestrel-model.webp'],note:'Exact gameplay meshes rendered with studio lighting. Background illustration generated separately.'},null,2)+'\n');
}finally{await browser.close();await server.close();}
