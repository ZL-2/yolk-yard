import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const live=process.env.LOBBY_MOTION_LIVE,origin=live||'http://127.0.0.1:5197',errors=[];
const vite=live?null:await createServer({server:{host:'127.0.0.1',port:5197,strictPort:true,watch:null}});await vite?.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
await mkdir('test-results/lobby-motion',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errors.push(e.message));
 if(live){
  const version=await(await p.request.get(origin+'/version.json?motion='+Date.now())).json();
  assert.equal(version.build,process.env.GITHUB_SHA);assert.ok(Number(version.release)>=72);
  const html=await(await p.request.get(origin+'/?motion='+Date.now())).text();
  const entry=html.match(/<script[^>]*src="([^"]*assets\/[^"]+\.js)"/);assert.ok(entry);
  const entryUrl=new URL(entry[1],origin+'/').href;
  let js=await(await p.request.get(entryUrl)).text();
  // Maintenance loader defers the main game chunk until owner authentication.
  const main=js.match(/["'](\.\/main-[^"']+\.js)["']/);
  if(main)js=await(await p.request.get(new URL(main[1],entryUrl).href)).text();
  assert.ok(js.includes('patrol-aim')&&js.includes('patrol-forward')&&js.includes('lobbyPatrol'));
  const music=await p.request.get(origin+'/audio/patrol-theme.mp3');assert.ok(music.ok());assert.ok((await music.body()).length>1000000);
  console.log(JSON.stringify({live:true,build:version.build,release:version.release,animationInDeployedBundle:true}));
 }else{
  await p.route('**/__lobby-motion',r=>r.fulfill({contentType:'text/html',body:'<style>html,body{margin:0;width:100%;height:100%;background:#97c6c4}canvas{width:100%;height:100%}</style><canvas id="world"></canvas><button id="music-start" style="position:absolute;top:10px;left:10px">Start music</button>'}));
  await p.goto(origin+'/__lobby-motion');
  await p.evaluate(async()=>{const {View}=await import('/src/view.js');const {LobbyMusic}=await import('/src/lobby-music.js');window.music=new LobbyMusic();music.update(true,1/60);document.querySelector('#music-start').onclick=()=>music.unlock();window.view=new View(document.querySelector('canvas'),{quality:'low',resolution:1,fov:85});window.profile={name:'Motion Captain',color:'#fff6da',accent:'#3d8ce8',eyewear:6,hat:2,weapon:'sprinter'};view.setParty([{...profile,name:'Motion Partner',hat:3,weapon:'needle'}]);view.update(null,null,null,0,false,false,profile);});
  await p.click('#music-start');await p.waitForFunction(()=>music.audio?.currentTime>.15);
  await p.evaluate(()=>{music.setVolume(.1);music.update(true,1/60);document.querySelector('#music-start').remove();});
  assert.equal(await p.evaluate(()=>music.audio.paused),false);
  await p.evaluate(()=>{music.update(false,1/60);});assert.equal(await p.evaluate(()=>music.audio.paused&&music.audio.currentTime===0),true);
  await p.evaluate(()=>music.update(true,1/60));await p.waitForFunction(()=>music.audio.currentTime>.15);
  await p.evaluate(()=>music.update(true,1/60,true));assert.equal(await p.evaluate(()=>music.audio.paused),true);
  await p.evaluate(()=>{music.setVolume(0);music.update(true,1/60,false);});assert.equal(await p.evaluate(()=>music.audio.paused),true);
  const results=[];
  for(const [name,frames]of [['patrol-forward',60],['patrol-scan',210],['patrol-aim',270],['patrol-low-ready',780],['loop',420]]){
   const result=await p.evaluate(frames=>{for(let i=0;i<frames;i++){view.lobbyStage.userData.update(1/60);view.animateLobbyCharacter(view.menuEgg,view.lobbyMotion,1/60);for(const member of view.partyEggs)view.animateLobbyCharacter(member,member.userData.lobbyMotion,1/60,.17);}view.renderer.render(view.scene,view.camera);return [view.menuEgg,...view.partyEggs].map(model=>{model.updateMatrixWorld(true);const h=model.userData.human,b=h.bones,feet=['footL','footR'].map(k=>{const v=b[k].getWorldPosition(b[k].position.clone());return model.worldToLocal(v).toArray();});return {pose:h.pose,speed:h.speed,phase:h.phase,feet,finite:Object.values(b).every(b=>[...b.position.toArray(),...b.quaternion.toArray()].every(Number.isFinite))};});},frames);
   for(const actor of result){assert.equal(actor.pose,'locomotion');assert.ok(actor.speed>1);assert.equal(actor.finite,true);assert.ok(actor.feet.some(foot=>Math.abs(foot[1]-.09)<.06),'stance boot is off the road');}
   results.push({name,actors:result});await p.screenshot({path:`test-results/lobby-motion/${name}.png`});
  }
  assert.ok(Math.abs(results[0].actors[0].phase-results[0].actors[1].phase)>.1);
  assert.ok(await p.evaluate(()=>view.lobbyStage.userData.distance>0));
  for(const width of [768,390]){await p.setViewportSize({width,height:844});await p.evaluate(()=>view.update(null,null,null,1/60,false,false,profile));await p.screenshot({path:`test-results/lobby-motion/layout-${width}.png`});}
  await writeFile('test-results/lobby-motion/results.json',JSON.stringify(results,null,2));assert.deepEqual(errors,[]);console.log('PASS walking patrol, finite rigs, staggered party stride, conveyor scenery, responsive framing and real MP3 playback/pause/restart/muting');
 }
}finally{await browser.close();await vite?.close();}
