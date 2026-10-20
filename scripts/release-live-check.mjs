import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import WebSocket from 'ws';
import {chromium} from 'playwright';
import {Network} from '../src/network.js';
import {ZoneWarsSimulation} from '../src/zone-wars.js';
import {BoxFightSimulation} from '../src/box-fights.js';
import {buildingTick,editBuilding} from '../src/building.js';
import {zombieClients} from './zombies-clients.mjs';
import {VERSION,safeProfile} from '../src/data.js';

const front='https://zl-2.github.io/yolk-yard/',relay='https://yolk-yard-relay.onrender.com';
const expected=process.env.RAVEL_VERIFY_BUILD||process.env.GITHUB_SHA;
assert.match(expected||'',/^[a-f0-9]{40}$/,'An exact published commit is required');
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const out='test-results/release-live';await mkdir(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const get=async url=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});assert.ok(r.ok,`HTTP ${r.status}: ${new URL(url).pathname}`);return r.json();};
async function wait(fn,label,ms=15000){const end=Date.now()+ms;while(!await fn()){assert.ok(Date.now()<end,label);await delay(100);}}
let published,health,lastError;
await wait(async()=>{
 try{[published,health]=await Promise.all([get(front+'version.json?t='+Date.now()),get(relay+'/health')]);return published.build===expected&&health.build===expected&&published.appVersion===version&&health.gameVersion===VERSION&&health.deployment?.updating===false&&health.socialAvailable;}
 catch(e){lastError=e.message;return false;}
},'Website and relay must finish the same release'+(lastError||''),360000);
assert.equal(published.protocol,VERSION);assert.equal(health.publicHosting,'player');assert.ok(health.serverModes.includes('zombies'));assert.equal(health.zombiesRevision,3);assert.equal(health.boxFightRevision,2);assert.ok(health.privateModes.includes('boxfight'));assert.equal(health.zoneWarsRevision,2);assert.ok(health.privateModes.includes('zonewars'));assert.equal(health.leaderboardRevision,3);
const history=await get(front+'release-history.json?t='+Date.now());assert.equal(history.build,expected);assert.equal(history.releases[0].number,published.release);
assert.equal(health.voiceRevision,1);assert.equal(health.emoteRevision,2);
const board=await get(relay+'/leaderboards');assert.ok(Array.isArray(board.kills.rows)&&Array.isArray(board.wins.rows));

// A separate private room exercises the deployed relay without entering the
// public match, changing its host, or creating public scores.
globalThis.window={YOLK_NETWORK:{relay:relay.replace('https:','wss:')+'/game'}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:new URL(front).origin});}};
const errors=[],sim=new BoxFightSimulation({fill:false,teamSize:1,scoreLimit:1}),suffix=Date.now().toString(36).slice(-5);
sim.addPlayer('host',safeProfile({name:'Release Host '+suffix}));
let state,clock,browser,page,zclients,zclock,zwh,zwg;
const host=new Network({getCheckpoint:()=>sim.checkpoint(),getState:()=>sim.snapshot(),onJoin:(id,p,a)=>!!sim.admitPlayer(id,p,a),onInput:(id,i)=>sim.setInput(id,i,true),onError:e=>errors.push(String(e))});
const guest=new Network({onState:s=>state=s,onError:e=>errors.push(String(e))});
try{
 const code=await host.host();host.setVisibility('private');host.broadcast(sim.snapshot());
 clock=setInterval(()=>host.broadcast(sim.snapshot()),100);
 await guest.join(code,safeProfile({name:'Release Guest '+suffix}));await wait(()=>state?.players.length===2,'Live private admission');assert.equal(state.phase,'lobby');assert.equal(state.options.mode,'boxfight');
 sim.startRound();for(const p of sim.players.values())sim.spawn(p);await wait(()=>state?.phase==='playing','Manual private start');
 guest.input({seq:1,crouch:true,dt:1/60});await wait(()=>sim.inputs.get(guest.id)?.crouch,'Guest input reaches live host');sim.tick(1/60);
 await wait(()=>state.players.find(p=>p.id===guest.id)?.crouching,'Authoritative crouch reaches guest');assert.notEqual(guest.serverAuthority,true);
 const builder=sim.players.get('host');Object.assign(builder,{x:0,y:0,z:-6,yaw:0,pitch:0});buildingTick(sim,builder,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});assert.equal(sim.builds.length,1);assert.ok(editBuilding(sim,builder,'build-edit-16-'+sim.builds[0].id));await wait(()=>state.royale.builds?.[0]?.mask===16,'Live Box window edit');sim.boxEnd=sim.time;sim.tick(1/30);assert.equal(sim.boxStage,'fight');sim.damage(sim.players.get(guest.id),builder,10000,'scatter');sim.tick(1/30);await wait(()=>state.phase==='results'&&state.boxfight.seriesWinner===builder.team,'Live Box series result');
 clearInterval(clock);guest.destroy();host.destroy();
 const zws=new ZoneWarsSimulation({fill:false,scoreLimit:1});zws.addPlayer('host',safeProfile({name:'Zone Release '+suffix}));let zwstate;
 zwh=new Network({getCheckpoint:()=>zws.checkpoint(),getState:()=>zws.snapshot(),onJoin:(id,p,a)=>!!zws.admitPlayer(id,p,a),onInput:(id,i)=>zws.setInput(id,i,true),onError:e=>errors.push(String(e))});zwg=new Network({onState:s=>zwstate={...s,royale:{...zwstate?.royale,...s.royale}},onError:e=>errors.push(String(e))});
 const zwcode=await zwh.host();zwh.setVisibility('private');zwh.broadcast(zws.snapshot());clock=setInterval(()=>zwh.broadcast(zws.snapshot()),100);await zwg.join(zwcode,safeProfile({name:'Zone Guest '+suffix}));await wait(()=>zwstate?.players.length===2,'Live Zone guest admission');assert.equal(zwstate.options.mode,'zonewars');assert.equal(zwstate.options.map,'tilted-district');zws.startRound();await wait(()=>zwstate.zonewars?.stage==='prepare','Live Zone preparation');const zp=zws.players.get(zwg.id);assert.equal(zp.inventory.slice(1).filter(Boolean).length,0);assert.equal(zwstate.royale.loot.length,80);const zl=zws.loot.filter(i=>Math.abs(i.y-zp.y)<.2&&Math.abs(i.x-zp.x)<.1&&i.z>zp.z&&i.z-zp.z<4.3);assert.equal(zl.length,5);assert.ok(['sprinter','duet'].includes(zl[0].id));assert.ok(['scatter','doubleyolk'].includes(zl[1].id));for(const item of zl){Object.assign(zp,{x:item.x,y:item.y,z:item.z});zws.interact(zp,{},1/30);}await wait(()=>zwstate.players.find(p=>p.id===zwg.id).inventory[2]?.weapon,'Live Zone loot pickup');assert.ok(['sprinter','duet'].includes(zp.inventory[1]?.id));assert.ok(['scatter','doubleyolk'].includes(zp.inventory[2]?.id));zws.boxEnd=zws.time;zws.tick(1/30);zws.boxStarted=zws.time-65;zws.tick(1/30);await wait(()=>zwstate.royale.storm.active,'Live moving storm');zws.damage(zp,zws.players.get('host'),10000,'scatter');zws.tick(1/30);await wait(()=>zwstate.phase==='results'&&zwstate.zonewars.seriesWinner==='host','Live Zone victory');clearInterval(clock);zwg.destroy();zwh.destroy();
 for(const mode of ['royale','boxfight','zonewars','zombies','ffa'])assert.equal((await get(relay+'/leaderboards?mode='+mode)).mode,mode);
 zclients=zombieClients(relay.replace('https:','wss:'),new URL(front).origin);
 const za=await zclients.user('Z Lead '+suffix),zb=await zclients.user('Z Mate '+suffix);await zclients.invite(za,zb);await za.ask('select',{mode:'zombies',teamSize:2,access:'private'});await zb.ask('ready',{value:true});await za.ask('queue');await wait(()=>za.launches.length&&zb.launches.length,'Live Zombies reservations');const [zg,zh]=await Promise.all([zclients.launch(za),zclients.launch(zb)]);assert.equal(zg.net.serverAuthority,true);assert.equal(zh.state.players.length,2);assert.equal(zh.state.options.mode,'zombies');zg.net.authorityCommand({type:'start'});zclock=setInterval(()=>{zg.send();zh.send();},100);await wait(()=>zh.state?.zombies?.enemies.length>0,'Live authoritative extraction director',25000);assert.equal(zg.state.matchId,zh.state.matchId);assert.equal(zh.state.zombies.format,'extraction');assert.equal(zh.state.zombies.stage,'expedition');assert.equal(zh.state.zombies.contracts.length,27);assert.equal(zh.state.zombies.evacs.length,3);assert.deepEqual(zg.errors,[]);assert.deepEqual(zh.errors,[]);clearInterval(zclock);await zclients.close();
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:process.env.CI ? .5 : 1});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ravelfront-season-1-update-150-dismissed','yes');localStorage.setItem('ravelfront-referrals-dismissed','yes');localStorage.setItem('ravelfront-perspective-157-dismissed','yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));localStorage.setItem('yolk-profile',JSON.stringify({name:'Release Lobby'}));});
 await page.goto(front+'?release='+expected);await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.locator('#menu [data-action=settings]:visible').first().waitFor();
 assert.match(await page.locator('body').innerText(),/FRONTIER LEADERS/i);
 await page.screenshot({path:out+'/desktop.png',timeout:90000});
 await page.locator('#voice-open').click();await page.locator('[data-voice=enable]').click();await page.waitForFunction(()=>document.querySelector('.voice-status')?.textContent.startsWith('Connected'));assert.equal(await page.locator('[data-channel=game]').isDisabled(),true);assert.match(await page.locator('[data-voice=mic]').innerText(),/ENABLE MIC/);await page.screenshot({path:out+'/voice-live.png',timeout:90000});await page.locator('[data-voice=leave]').click();await page.locator('[data-voice=close]').click();
 await page.locator('[data-action=choose-mode]').click();await page.locator('[data-experience=zombies] .mode-development').waitFor({state:'visible'});assert.equal(await page.locator('[data-experience=zombies] .mode-development').innerText(),'IN MAJOR DEVELOPMENT');assert.deepEqual(await page.locator('[data-experience]').evaluateAll(nodes=>nodes.map(n=>n.dataset.experience)),['royale','box-fights','zone-wars','zombies','ffa','training']);await page.locator('[data-experience=zone-wars]').click();await page.waitForFunction(()=>document.querySelector('[data-leaderboard-mode]')?.value==='zonewars');assert.doesNotMatch(await page.locator('.lobby-options-button').innerText(),/Public|Private/);await page.locator('[data-action=choose-mode]').click();await page.screenshot({path:out+'/zone-wars-live.png',timeout:90000});await page.locator('#dialog .close-btn').click();
 await page.locator('#menu [data-action=settings]:visible').first().click();await page.locator('[data-settings-tab=comfort]').click();await page.locator('#reducedMotion').check();
 await page.screenshot({path:out+'/desktop-settings.png',timeout:90000});
 assert.deepEqual(errors,[]);
 const result={result:'PASS',build:expected,version,protocol:VERSION,release:published.release,matchingBuilds:true,updating:false,privateHostGuest:true,privateBoxFight:true,privateZoneWars:true,zoneStormAndResult:true,modeRankings:true,privacyToggle:true,boxBuildEdit:true,boxSeriesResult:true,privateZombiesCoop:true,serverZombiesExtraction:true,publicMatchUntouched:true,leaderboards:true,desktopLobby:true,zombiesDevelopmentBanner:true,mapStorage:health.mapStorage};
 await writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await page?.screenshot({path:out+'/failure.png',timeout:90000}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({error:String(e),errors},null,2));throw e;}
finally{clearInterval(clock);clearInterval(zclock);guest.destroy();host.destroy();zwg?.destroy();zwh?.destroy();await zclients?.close();await browser?.close();}
