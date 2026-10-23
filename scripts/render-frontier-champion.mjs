// Capture the exact gameplay mesh with real Three.js materials and lighting.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const vite=await createServer({server:{host:'127.0.0.1',port:5291,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:1000},deviceScaleFactor:1});await page.goto('http://127.0.0.1:5291/');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js'),{makeShopPickaxe}=await import('/src/shop-models.js');
  document.body.innerHTML='';document.body.style.cssText='margin:0;background:#071327;';
  const scene=new THREE.Scene(),model=makeShopPickaxe('pickaxe-frontier-champion');scene.add(model);model.rotation.y=-.32;model.rotation.z=-.10;
  const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());model.position.sub(center);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(1000,1000);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;document.body.append(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xcfefff,0x32445a,3));const key=new THREE.DirectionalLight(0xfff0cf,5);key.position.set(2,3,5);scene.add(key);const rim=new THREE.DirectionalLight(0x68dfff,3);rim.position.set(-2,1,-2);scene.add(rim);const fill=new THREE.DirectionalLight(0xffffff,2);fill.position.set(-3,2,4);scene.add(fill);
  const size=bounds.getSize(new THREE.Vector3()),d=Math.max(size.y,size.x)*.61,camera=new THREE.OrthographicCamera(-d,d,d,-d,.01,20);camera.position.set(0,.1,5);camera.lookAt(0,0,0);renderer.render(scene,camera);window.__pickaxeImage=renderer.domElement.toDataURL('image/png');window.__pickaxeInfo={triangles:model.children.reduce((n,m)=>n+(m.geometry?.index?.count||m.geometry?.attributes.position.count||0)/3,0),source:'makeShopPickaxe(pickaxe-frontier-champion)'};
 });
 await mkdir('public/compete',{recursive:true});const data=await page.evaluate(()=>window.__pickaxeImage);await writeFile('public/compete/frontier-champion.png',Buffer.from(data.split(',')[1],'base64'));console.log(await page.evaluate(()=>window.__pickaxeInfo));
}finally{await browser.close();await vite.close();}
