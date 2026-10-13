import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import WebSocket from 'ws';
import {chromium} from 'playwright';
import {Network} from '../src/network.js';
import {Simulation} from '../src/simulation.js';
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
assert.equal(published.protocol,VERSION);assert.equal(health.publicHosting,'player');assert.deepEqual(health.serverModes,[]);assert.equal(health.capacity.rooms,0);
const history=await get(front+'release-history.json?t='+Date.now());assert.equal(history.build,expected);assert.equal(history.releases[0].number,published.release);
const board=await get(relay+'/leaderboards');assert.ok(Array.isArray(board.kills.rows)&&Array.isArray(board.wins.rows));

// A separate private room exercises the deployed relay without entering the
// public match, changing its host, or creating public scores.
globalThis.window={YOLK_NETWORK:{relay:relay.replace('https:','wss:')+'/game'}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:new URL(front).origin});}};
const errors=[],sim=new Simulation({mode:'ffa',bots:0}),suffix=Date.now().toString(36).slice(-5);
sim.addPlayer('host',safeProfile({name:'Release Host '+suffix}));
let state,clock,browser,page;
const host=new Network({getCheckpoint:()=>sim.checkpoint(),getState:()=>sim.snapshot(),onJoin:(id,p,a)=>!!sim.admitPlayer(id,p,a),onInput:(id,i)=>sim.setInput(id,i,true),onError:e=>errors.push(String(e))});
const guest=new Network({onState:s=>state=s,onError:e=>errors.push(String(e))});
try{
 const code=await host.host();host.setVisibility('private');host.broadcast(sim.snapshot());
 clock=setInterval(()=>host.broadcast(sim.snapshot()),100);
 await guest.join(code,safeProfile({name:'Release Guest '+suffix}));await wait(()=>state?.players.length===2,'Live private admission');assert.equal(state.phase,'lobby');
 sim.startRound();for(const p of sim.players.values())sim.spawn(p);await wait(()=>state?.phase==='playing','Manual private start');
 guest.input({seq:1,crouch:true,dt:1/60});await wait(()=>sim.inputs.get(guest.id)?.crouch,'Guest input reaches live host');sim.tick(1/60);
 await wait(()=>state.players.find(p=>p.id===guest.id)?.crouching,'Authoritative crouch reaches guest');assert.notEqual(guest.serverAuthority,true);
 clearInterval(clock);guest.destroy();host.destroy();
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ravelfront-season-1-update-150-dismissed','yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));localStorage.setItem('yolk-profile',JSON.stringify({name:'Release Lobby'}));});
 await page.goto(front+'?release='+expected);await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.locator('#menu [data-action=settings]:visible').first().waitFor();
 assert.match(await page.locator('body').innerText(),/FRONTIER LEADERS/i);
 await page.screenshot({path:out+'/desktop.png'});
 await page.locator('#menu [data-action=settings]:visible').first().click();await page.locator('[data-settings-tab=comfort]').click();await page.locator('#reducedMotion').check();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:out+'/mobile-settings.png'});
 assert.deepEqual(errors,[]);
 const result={result:'PASS',build:expected,version,protocol:VERSION,release:published.release,matchingBuilds:true,updating:false,privateHostGuest:true,publicMatchUntouched:true,leaderboards:true,desktopAndMobile:true,mapStorage:health.mapStorage};
 await writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({error:String(e),errors},null,2));throw e;}
finally{clearInterval(clock);guest.destroy();host.destroy();await browser?.close();}
