import assert from 'node:assert/strict';
import {VERSION} from '../src/data.js';
const base='https://zl-2.github.io/yolk-yard/';
const json=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(30000),cache:'no-store'});assert.ok(r.ok,`${url}: ${r.status}`);return r.json();};
const version=await json(base+'version.json?t='+Date.now());assert.ok(Number(version.release)>=85);if(process.env.GITHUB_SHA)assert.equal(version.build,process.env.GITHUB_SHA);
const html=await (await fetch(base+'?social='+Date.now())).text(),entry=html.match(/<script[^>]*src="([^"]*assets\/[^\"]+\.js)"/);assert.ok(entry);const entryURL=new URL(entry[1],base).href;let js=await(await fetch(entryURL)).text();const main=js.match(/["'](\.\/main-[^"']+\.js)["']/);if(main)js=await(await fetch(new URL(main[1],entryURL))).text();for(const text of ['YOUR FRIEND CODE','OTHERS ONLINE','SQUADS','friend-send','team-hud-member'])assert.ok(js.includes(text),'Missing deployed feature '+text);
console.log('PASS live GitHub build',version.build,'Quality Update',version.release,'Social/Squads bundle.');
const until=Date.now()+7*60000;let health;
while(Date.now()<until){try{health=await json('https://yolk-yard-relay.onrender.com/health');if(health.gameVersion===VERSION&&health.socialRevision>=85&&health.partyLimit===4&&health.features.includes('squads'))break;console.log('Waiting for backend deploy; current protocol',health.gameVersion);}catch(e){console.log('Waiting for backend health:',e.message);}await new Promise(r=>setTimeout(r,20000));}
assert.equal(health?.gameVersion,VERSION,'Backend protocol not deployed');assert.ok(health.socialRevision>=85&&health.partyLimit===4&&health.features.includes('friends')&&health.features.includes('squads'));console.log('PASS live multiplayer health: protocol',health.gameVersion,'social revision',health.socialRevision,'party limit',health.partyLimit);
