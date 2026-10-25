import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {VERSION} from '../src/data.js';
import {OPERATOR_ASSET_IDS} from '../src/operator-assets.js';

// Read-only production verification: no identities, votes, rooms or rewards.
const front='https://zl-2.github.io/yolk-yard/',relay='https://yolk-yard-relay.onrender.com';
const expected=process.env.RAVEL_VERIFY_BUILD||process.env.GITHUB_SHA;
assert.match(expected||'',/^[a-f0-9]{40}$/,'An exact published commit is required');
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const reviews=JSON.parse(await readFile(new URL('../art/operators/reviews.json',import.meta.url),'utf8'));
const get=async url=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.ok(r.ok,`HTTP ${r.status}: ${new URL(url).pathname}`);return r;};
let published,health;
for(let i=0;i<72;i++){
 try{
  [published,health]=await Promise.all([get(front+'version.json?t='+Date.now()).then(r=>r.json()),get(relay+'/health').then(r=>r.json())]);
  if(published.build===expected&&health.build===expected&&health.deployment?.updating===false&&health.socialAvailable)break;
 }catch{}
 await new Promise(r=>setTimeout(r,5000));
}
assert.equal(published?.build,expected);assert.equal(health?.build,expected);
assert.equal(published.appVersion,version);assert.equal(health.deployment.version,version);
assert.equal(published.protocol,VERSION);assert.equal(health.gameVersion,VERSION);
assert.equal(health.ok,true);assert.equal(health.socialAvailable,true);assert.equal(health.deployment.updating,false);
const history=await get(front+'release-history.json?build='+expected).then(r=>r.json());
assert.equal(history.build,expected);assert.equal(history.releases[0].number,published.release);
const event=await get(relay+'/tournament').then(r=>r.json());
assert.ok(Number.isFinite(event.serverNow)&&Math.abs(Date.now()-event.serverNow)<60000,'Fresh relay UTC');
assert.equal(event.timeZone,'America/New_York');
if(['preparing','entry','starting','running'].includes(event.phase))assert.equal(event.locked,true);
const assets=[];
for(const id of OPERATOR_ASSET_IDS){
 const review=reviews.find(r=>r.id===id);assert.equal(review?.revision,216);
 const bytes=Buffer.from(await get(front+'models/operators/'+id+'.glb?v=216&build='+expected).then(r=>r.arrayBuffer()));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),review.assetSha256,id+' published asset');
 assets.push({id,bytes:bytes.length,sha256:review.assetSha256});
}
const viewer=await get(front+'wren-study.html?build='+expected).then(r=>r.text());assert.match(viewer,/type="module"/);
const result={result:'PASS',build:expected,version,protocol:VERSION,release:published.release,readOnly:true,assets,tournament:{id:event.id,phase:event.phase,locked:event.locked,serverNow:event.serverNow,newYorkTime:new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'full',timeStyle:'long'}).format(event.serverNow)}};
await mkdir('test-results/release-live',{recursive:true});await writeFile('test-results/release-live/result.json',JSON.stringify(result,null,2));
console.log('PASS exact website/relay build, all eleven reviewed model hashes, and fresh New York tournament time');
