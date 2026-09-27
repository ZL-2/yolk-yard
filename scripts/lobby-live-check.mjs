import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {VERSION} from '../src/data.js';
const base='https://zl-2.github.io/yolk-yard/',expected=process.env.GITHUB_SHA;
let version;
for(let i=0;i<18;i++){try{const r=await fetch(base+'version.json?t='+Date.now(),{signal:AbortSignal.timeout(10000)});version=await r.json();if(!expected||version.build===expected)break;}catch{}await new Promise(r=>setTimeout(r,5000));}
assert.equal(version?.build,expected,'Pages must serve this exact release');
const health=await fetch('https://yolk-yard-relay.onrender.com/health',{signal:AbortSignal.timeout(30000)}).then(r=>r.json());assert.equal(health.gameVersion,VERSION);assert.ok(health.features.includes('parties'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),pages=[];
await mkdir('test-results/live-lobby',{recursive:true});
async function player(name){const c=await browser.newContext({viewport:{width:1365,height:768}}),p=await c.newPage();p.setDefaultTimeout(90000);await p.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);await p.goto(base+'?build='+version.build);pages.push(p);await p.locator('#menu [data-action="find-public"]:enabled').waitFor();return p;}
try{
 const suffix=String(Date.now()).slice(-5),nameA='Check Sunny '+suffix,nameB='Check Buddy '+suffix;
 const a=await player(nameA),b=await player(nameB);
 assert.equal(await a.getByText('Play Offline With Bots',{exact:true}).count(),0);
 await a.locator('#menu [data-action="play"]').click();await a.locator('[data-experience="duos"]').click();await a.locator('#menu [data-action="social"]').first().click();
 await a.locator('.social-person').filter({hasText:nameB}).locator('[data-party-invite]').click();await b.locator('[data-party-accept]').click();
 await a.locator('#dialog [data-action="close"]').first().click();await a.locator('.yard-party').getByText(nameB,{exact:false}).waitFor();await b.locator('[data-action="party-ready"]').click();await a.waitForFunction(()=>!document.querySelector('.yard-queue-state').textContent.includes('Waiting for your teammate'));
 await a.screenshot({path:'test-results/live-lobby/party.png'});
 await a.locator('#menu [data-action="play-custom"]').click();await a.locator('#setup-visibility').selectOption('private');await a.locator('#setup-capacity').selectOption('4');await a.locator('[data-action="create-room"]').click();
 for(const p of [a,b]){await p.locator('#royale-flight-help').filter({hasText:'2 real players'}).waitFor();await p.locator('#duo-hud').filter({hasText:p===a?nameB:nameA}).waitFor();}
 await b.screenshot({path:'test-results/live-lobby/island.png'});
 // The real, unchanged host countdown must bring both clients into the Bus.
 await Promise.all([a,b].map(p=>p.locator('#royale-flight-title').filter({hasText:/Doors open|Choose your landing/}).waitFor({timeout:90000})));
 await b.screenshot({path:'test-results/live-lobby/bus.png'});
 console.log(JSON.stringify({passed:true,build:version.build,qualityUpdate:version.release,relayGameVersion:health.gameVersion,liveInvitations:true,livePrivateDuos:true,sharedIslandAndBus:true}));
}catch(e){for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:`test-results/live-lobby/failure-${i}.png`}).catch(()=>{});throw e;}
finally{await browser.close();}
