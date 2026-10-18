// Desktop visual evidence for the dry map. Uses the actual game geometry/materials.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/zone-map';await mkdir(out,{recursive:true});
const vite=await createServer({plugins:[{name:'zone-map-preview',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/map-preview')return next();res.setHeader('Content-Type','text/html');res.end('<html><head><title>Tilted dry map review</title></head><body style="margin:0"></body></html>');});}}],server:{host:'127.0.0.1',port:5292,strictPort:true,watch:null}});await vite.listen();
let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:5292/map-preview');
 const metrics=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{buildZoneDistrict}=await import('/src/zone-wars-view.js'),{ZONE_MAP:map}=await import('/src/zone-wars-map.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,1000);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(map.sky);scene.fog=new T.Fog(map.sky,180,320);scene.add(new T.HemisphereLight(0xd2efff,0x9a7950,2.0));const sun=new T.DirectionalLight(0xffedcb,3);sun.position.set(-36,76,42);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,far:220});sun.shadow.bias=-.0006;sun.shadow.normalBias=.06;scene.add(sun);
  const world=new T.Group();scene.add(world);buildZoneDistrict(world,map);const camera=new T.PerspectiveCamera(50,1440/1000,.1,500);
  const frame=(position,target)=>{camera.position.set(...position);camera.lookAt(...target);renderer.render(scene,camera);};window.zonePreview={frame,renderer,scene,camera,map};frame([89,104,115],[0,2,0]);
  return {revision:map.revision,buildings:map.buildings.length,clocks:map.buildings.filter(b=>b.clock).length,pads:map.bouncePads.length,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};
 });
 const views=[['overview',[89,104,115],[0,2,0]],['reverse-overview',[-102,88,-124],[0,6,0]],['top-down',[0,165,.01],[0,0,0]],['central-street',[14,2.2,23],[0,15,-1]],['courtyard',[33,2.1,39],[33,7,22]],['clock',[14,2.1,38],[0,19,32]],['court',[-22,9,46],[-30,5.3,27]],['tower-interior',[-5,13.6,-3],[3,13.3,-8]]];
 for(const [name,position,target]of views){await page.evaluate(({position,target})=>window.zonePreview.frame(position,target),{position,target});await page.screenshot({path:out+'/'+name+'.png',timeout:60000});}
 assert.equal(metrics.clocks,4);assert.equal(metrics.pads,6);assert.ok(metrics.calls<200,'Batched map calls');assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({result:'PASS',metrics,errors},null,2));console.log(JSON.stringify({result:'PASS',metrics}));
}finally{await browser?.close();await vite.close();}
