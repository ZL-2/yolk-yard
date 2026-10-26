import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results/frame-stalls',{recursive:true});
const html=`<!doctype html><html><head><base href="/"></head><body style="margin:0"><canvas style="width:100vw;height:100vh"></canvas><script type="module">
import * as THREE from 'three';
import {buildIslandSteps} from '/src/royale-view.js';
import {View,worldKit,makeEgg} from '/src/view.js';
import {preloadOperatorAssets,OPERATOR_ASSET_IDS} from '/src/operator-assets.js';
import {getMap} from '/src/maps.js';
import {RoyaleSimulation} from '/src/royale.js';
import {groundAt} from '/src/terrain.js';
import {authoredBoxes} from '/src/building.js';
const stats=a=>{a.sort((a,b)=>a-b);return {count:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1),over16:a.filter(x=>x>16.7).length,over50:a.filter(x=>x>50).length};};
window.run=async()=>{
 await preloadOperatorAssets();const modelRows=[];
 for(const count of [11,11,48]){const values=[],keep=[];const start=performance.now();for(let i=0;i<count;i++){const t=performance.now();keep.push(makeEgg({name:'Audit '+i,outfit:'outfit-'+OPERATOR_ASSET_IDS[i%11],weapon:'sprinter'}));values.push(performance.now()-t);}modelRows.push({count,totalMs:performance.now()-start,each:stats(values)});}
 const original=getMap('sunnybreak'),map={...original,boxes:authoredBoxes(original)},world=new THREE.Group(),shell=[],shellSlow=[];
 const gen=buildIslandSteps(world,map,worldKit);while(true){const t=performance.now(),r=gen.next();const ms=performance.now()-t;shell.push(ms);if(ms>8)shellSlow.push({step:shell.length,ms,children:world.children.length,last:world.children.at(-1)?.name});if(r.done)break;}
 const details=world.userData.details,build=details.build,slow=[],updates=[];
 details.build=cell=>{const r=build(cell),steps=r.steps;r.steps={next(){const before=r.group.children.length,t=performance.now(),v=steps.next(),ms=performance.now()-t;if(ms>5)slow.push({cell:cell.key,ms,before,after:r.group.children.length});return v;}};return r;};
 for(const [index,p]of [{x:-53,z:-30,yaw:0},{x:172,z:157,yaw:0},{x:-150,z:100,yaw:0}].entries())for(let i=0;i<1500;i++){const t=performance.now();details.update(p,{quality:'low',time:index*30+i/60});updates.push(performance.now()-t);if(details.loaded>0&&!details.pending&&!details.queue?.some(c=>c.wanted&&!c.detail))break;if(i%30===0)await new Promise(r=>setTimeout(r,0));}
 const view=new View(document.querySelector('canvas'),{quality:'low',fpsLimit:60,fov:85,perspective:'first',volume:0});
 view.preparedBattle={group:world,layout:original.layoutKey||'',done:true};
 const sim=new RoyaleSimulation({bots:0,capacity:48,fill:false,seed:226});for(let i=0;i<48;i++)sim.addPlayer('render-'+i,{name:'Operator '+i,outfit:'outfit-'+OPERATOR_ASSET_IDS[i%11]});sim.startRound();sim.beginBattle();
 const state=sim.snapshot();state.events=[];state.players=state.players.filter(p=>!p.bot);const local=state.players[0];
 for(const [i,p]of state.players.entries())Object.assign(p,{x:158+(i?((i-1)%8-3.5)*2:0),y:original.helipad.y+1,z:56-(i?10+Math.floor((i-1)/8)*3:0),yaw:0,pitch:0,health:100,flight:'ground',grounded:true,spectating:false,awaitingEntry:false,slot:1,inventory:[null,{id:'sprinter',weapon:true,rarity:1,ammo:30}],ammo:[0,30],reloadEnd:0,equipUntil:0});
 const render=view.renderer.render.bind(view.renderer);view.renderer.render=()=>{};const creation=[],frame=(n)=>{state.time=1+n/60;view.update(state,local,local,1/60,true,false,local);};
 for(let n=0;n<100;n++){const before=[...view.models.values()].filter(m=>!m.userData.pendingActor).length;frame(n);const after=[...view.models.values()].filter(m=>!m.userData.pendingActor).length;creation.push(after-before);await new Promise(r=>setTimeout(r,0));}
 view.renderer.render=render;const rendered=[];let previous=performance.now();
 for(let n=100;n<160;n++){await new Promise(requestAnimationFrame);frame(n);const now=performance.now();rendered.push(now-previous);previous=now;}
 const visual={frames:rendered.length,frameMs:stats(rendered),maxActorsCreated:Math.max(...creation),models:view.models.size,pendingModels:[...view.models.values()].filter(m=>m.userData.pendingActor).length,drawCalls:view.renderer.info.render.calls,renderer:view.renderer.getContext().getParameter(view.renderer.getContext().RENDERER)};
 return {visual,modelRows,shellSlow,shell:stats(shell),detailUpdates:stats(updates),slowSteps:slow.sort((a,b)=>b.ms-a.ms).slice(0,12),resident:details.loaded};
};window.ready=true;
</script></body></html>`;
const vite=await createServer({plugins:[{name:'audit',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url!=='/performance-audit')return next();try{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,html));}catch(e){next(e);}});}}],server:{host:'127.0.0.1',port:5308,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:.5}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5308/performance-audit');await page.waitForFunction(()=>window.ready,null,{timeout:60000});const result=await page.evaluate(()=>window.run());result.errors=errors;if(result.errors.length||result.visual.pendingModels||result.visual.maxActorsCreated>2||result.visual.frames!==60)throw Error(JSON.stringify(result));await page.screenshot({path:'test-results/frame-stalls/rendered-crowd.png'});await writeFile('test-results/frame-stalls/browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}finally{await browser.close();await vite.close();}
