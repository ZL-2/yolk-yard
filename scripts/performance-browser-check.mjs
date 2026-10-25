import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'.'),tag=process.argv[3]||'current',out='test-results/performance217';await mkdir(out,{recursive:true});
const html=`<!doctype html><html><body style="margin:0"><canvas style="display:block;width:100vw;height:100vh"></canvas><script type="module">
import {View} from '/src/view.js';
import {RoyaleSimulation} from '/src/royale.js';
import {preloadOperatorAssets,OPERATOR_ASSET_IDS,operatorAsset} from '/src/operator-assets.js';
await preloadOperatorAssets();
const sim=new RoyaleSimulation({capacity:16,bots:0,fill:false,seed:217});
for(let i=0;i<11;i++)sim.addPlayer('render-'+i,{name:'Operator '+i,outfit:'outfit-'+OPERATOR_ASSET_IDS[i],weapon:'sprinter'});
sim.startRound();sim.beginBattle();sim.stage='active';
for(const [id,p]of sim.players)if(p.bot)sim.players.delete(id);
const view=new View(document.querySelector('canvas'),{quality:'medium',fpsLimit:60,fov:85,perspective:'first',sensitivity:1,volume:0});
view.renderBudget.sample=()=>false;view.renderBudget.pressure=false;
const render=view.renderer.render.bind(view.renderer);view.renderer.render=()=>{};
const state=sim.snapshot();state.events=[];const local=state.players[0];
for(let i=0;i<state.players.length;i++)Object.assign(state.players[i],{x:i?((i%3)-1)*5:0,y:60,z:i?-(i<4?8+i*3:45+(i-4)*20):0,yaw:0,pitch:0,health:100,shield:100,flight:'ground',grounded:true,spectating:false,awaitingEntry:false,loading:false,vx:0,vz:-2.4,moving:true,weapon:'sprinter',slot:1,inventory:[null,{id:'sprinter',weapon:true,rarity:1,ammo:30}],equipUntil:0,reloadEnd:0});
function frame(n){state.time=1+n/60;view.update(state,local,local,1/60,true,false,local);}
frame(0);await Promise.all(OPERATOR_ASSET_IDS.map(id=>operatorAsset({outfit:'outfit-'+id})?.lodRequest));
for(let n=0;n<360;n++){frame(n);if(n%30===0)await new Promise(r=>setTimeout(r,0));}
window.run=async()=>{
 const samples=[],poses=[];
 for(let n=360;n<660;n++){const start=performance.now();frame(n);samples.push(performance.now()-start);poses.push([...view.models.values()].filter(m=>m.userData.poseClock===view.clock).length);if(n%30===0)await new Promise(r=>setTimeout(r,0));}
 const models=[...view.models].filter(([,m])=>m.visible).map(([id,m])=>{const h=m.userData.human;return {id,distance:m.position.distanceTo(view.camera.position),lod:h.mesh.geometry===h.asset?.lod?.geometry,triangles:h.mesh.geometry.index.count/3,pose:h.pose};});
 view.renderer.info.reset();render(view.actors,view.camera);const actorDraws={...view.renderer.info.render};
 view.renderer.render=render;frame(660);const fullDraws={...view.renderer.info.render};
 const eye=view.camera.position,hitStart=performance.now();
 for(let i=0;i<120;i++){const group=Math.floor(i/3);view.event({type:'hit',player:local.id,target:'target-'+group,shotId:group,amount:30,shield:i%3===0,precision:group%3===0,x:eye.x+(group%8-3.5)*.45,y:eye.y+(Math.floor(group/8)-2)*.35,z:eye.z-4},local.id,state);}
 const hitEnqueueMs=performance.now()-hitStart;view.damageNumbers?.update(0,view.canvas.clientWidth,view.canvas.clientHeight);view.renderer.info.reset();render(view.effects,view.camera);
 const hitFeedback={enqueueMs:hitEnqueueMs,calls:view.renderer.info.render.calls,textures:view.renderer.info.memory.textures,numbers:view.damageNumbers?.diagnostics()||{numbers:view.fx.filter(f=>f.damageText).length},totals:view.damageNumbers?.rows.map(r=>({amount:r.amount,shield:r.shield,critical:r.critical}))};

 const pool=view.damageNumbers;
 if(pool){const mesh=pool.mesh;for(let i=0;i<1000;i++)pool.hit({player:local.id,target:'stress',shotId:'stress'+i,amount:20,x:eye.x,y:eye.y,z:eye.z-3});pool.update(0,view.canvas.clientWidth,view.canvas.clientHeight);hitFeedback.stress=pool.diagnostics();hitFeedback.reusedMesh=pool.mesh===mesh;pool.update(1,1280,800);hitFeedback.expired=pool.diagnostics();pool.clear();}
 else for(const f of view.fx)if(f.damageText){f.mesh.removeFromParent();f.mesh.material.map.dispose();f.mesh.material.dispose();}
 view.fx=view.fx.filter(f=>!f.damageText);
 for(let i=0;i<3;i++)view.event({type:'hit',player:local.id,target:'review'+i,shotId:'review'+i,amount:i===0?36:i===1?72:50,shield:i===2,precision:i===1,x:eye.x+(i-1)*.7,y:eye.y,z:eye.z-3},local.id,state);
 frame(661);frame(662);
 samples.sort((a,b)=>a-b);return {tag:'${tag}',models,actorDraws,fullDraws,hitFeedback,viewCpuMs:{p50:samples[150],p95:samples[285],p99:samples[297],max:samples.at(-1)},posesPerFrame:{min:Math.min(...poses),max:Math.max(...poses),average:poses.reduce((a,b)=>a+b,0)/poses.length},gpu:{renderer:view.renderer.getContext().getParameter(view.renderer.getContext().RENDERER)}};
};window.ready=true;
</script></body></html>`;
const vite=await createServer({root,optimizeDeps:{entries:['src/view.js','src/royale.js']},plugins:[{name:'performance-fixture',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/performance217')return next();res.setHeader('Content-Type','text/html');res.end(html);});}}],server:{host:'127.0.0.1',port:5267,strictPort:true,watch:null}});await vite.listen();
let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||(existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:.5});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE.'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5267/performance217');await page.waitForFunction(()=>window.ready,{},{timeout:120000});
 const result=await page.evaluate(()=>window.run());await page.screenshot({path:out+'/characters-'+tag+'.png'});
 assert.deepEqual(errors,[]);assert.equal(result.models.length,10);
 if(root===process.cwd()){assert.ok(result.models.filter(m=>m.distance>40).every(m=>m.lod));assert.ok(result.models.filter(m=>m.distance<36).every(m=>!m.lod));assert.ok(result.posesPerFrame.max<10);assert.equal(result.hitFeedback.calls,1);assert.equal(result.hitFeedback.numbers.numbers,40);assert.equal(result.hitFeedback.stress.numbers,64);assert.equal(result.hitFeedback.expired.numbers,0);assert.ok(result.hitFeedback.reusedMesh);assert.ok(result.hitFeedback.totals.every(t=>t.amount===90&&t.shield===30));}
 await writeFile(out+'/browser-'+tag+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await vite.close();}
