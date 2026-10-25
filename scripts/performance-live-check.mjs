import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {VERSION} from '../src/data.js';
const front='https://zl-2.github.io/yolk-yard/',relay='https://yolk-yard-relay.onrender.com',build=process.env.RAVEL_VERIFY_BUILD||process.env.GITHUB_SHA;
assert.match(build||'',/^[a-f0-9]{40}$/);
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const get=async url=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.ok(r.ok,'HTTP '+r.status+' '+new URL(url).pathname);return r.json();};
let published,health;
for(let i=0;i<72;i++){
 try{[published,health]=await Promise.all([get(front+'version.json?t='+Date.now()),get(relay+'/health')]);if(published.build===build&&health.build===build&&health.ok&&health.socialAvailable&&!health.deployment.updating)break;}catch{}
 await new Promise(r=>setTimeout(r,5000));
}
assert.equal(published?.build,build);assert.equal(health?.build,build);assert.equal(published.appVersion,version);assert.equal(health.deployment.version,version);assert.equal(published.protocol,VERSION);assert.equal(health.gameVersion,VERSION);assert.equal(health.ok,true);assert.equal(health.socialAvailable,true);assert.equal(health.deployment.updating,false);
const event=await get(relay+'/tournament'),history=await get(front+'release-history.json?t='+Date.now());assert.equal(history.build,build);assert.equal(history.releases[0].number,'217');assert.equal(event.timeZone,'America/New_York');assert.ok(Math.abs(Date.now()-event.serverNow)<60000);
if(['preparing','entry','starting','running'].includes(event.phase))assert.equal(event.locked,true);
const result={result:'PASS',build,version,protocol:VERSION,release:published.release,readOnly:true,tournament:{id:event.id,phase:event.phase,locked:event.locked,serverNow:event.serverNow,scheduleRevision:event.scheduleRevision,events:event.events.map(e=>({id:e.id,phase:e.phase,opensAt:e.opensAt,startsAt:e.startsAt,prizes:e.prizes,duplicateReward:e.duplicateReward}))}};
await mkdir('test-results/release-live',{recursive:true});await writeFile('test-results/release-live/result.json',JSON.stringify(result,null,2));console.log('PASS exact performance release, healthy relay, preserved schedule and fresh tournament clock',JSON.stringify({build,version,phase:event.phase}));
