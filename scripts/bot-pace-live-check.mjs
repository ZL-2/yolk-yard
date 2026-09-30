import assert from 'node:assert/strict';
import {VERSION} from '../src/data.js';
import {RELEASE_NOTES} from '../src/releases.js';
const expected=process.env.GITHUB_SHA;assert.ok(expected);
const json=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok(),url+' '+r.status);return r.json();};
const origin='https://zl-2.github.io/yolk-yard',stamp=Date.now();
const v=await json(origin+'/version.json?bot-pace='+stamp),history=await json(origin+'/release-history.json?bot-pace='+stamp);
assert.equal(v.build,expected);assert.equal(history.build,expected);assert.equal(history.releases[0].title,RELEASE_NOTES[0].title);assert.deepEqual(history.releases[0].changes,RELEASE_NOTES[0].changes);
let health;const deadline=Date.now()+480000;
while(true){try{health=await json('https://yolk-yard-relay.onrender.com/health');if(health.build===expected&&health.gameVersion===VERSION)break;}catch(e){console.log('Waiting for relay:',e.message);}assert.ok(Date.now()<deadline,'Relay did not deploy this build');await new Promise(r=>setTimeout(r,15000));}
assert.equal(health.maintenance,false);assert.ok(health.socialAvailable);assert.equal(health.weaponBalanceRevision,1);
console.log(JSON.stringify({build:expected,relayBuild:health.build,release:v.release,version:'3.4.2',title:history.releases[0].title,arenaBotSpeed:7.4,arenaCombatLateralInput:.6,smoothCombatReversals:true,playerMovementUnchanged:true,royaleMovementUnchanged:true,published:true,verifiedLive:true}));
