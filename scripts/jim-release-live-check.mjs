import assert from 'node:assert/strict';
const sha=process.env.GITHUB_SHA||process.env.RAVEL_VERIFY_BUILD;
assert.match(sha||'',/^[a-f0-9]{40}$/);
const front='https://zl-2.github.io/yolk-yard/',relay='https://yolk-yard-relay.onrender.com/health';
let ready=false;
for(let i=0;i<60;i++){
 try{const [v,h]=await Promise.all([fetch(front+'version.json?t='+Date.now()).then(r=>r.json()),fetch(relay).then(r=>r.json())]);
 if(v.build===sha&&h.build===sha&&h.socialAvailable&&!h.deployment?.updating){assert.equal(v.release,'227');assert.equal(v.protocol,89);assert.equal(h.gameVersion,89);assert.equal(h.jimStyleRevision,1);assert.equal(h.iconVoting.closed,true);ready=true;break;}}catch(error){console.log(error.message);}
 await new Promise(r=>setTimeout(r,5000));
}
assert.ok(ready,'Exact website and relay release must both finish');
for(const path of ['season/jim-icon.webp','models/operators/jim-normal.glb','models/operators/jim-normal-lod.glb','models/operators/jim-golf.glb','models/operators/jim-golf-lod.glb']){const r=await fetch(front+path,{method:'HEAD'});assert.equal(r.status,200,path);}
console.log('PASS Jim website/relay exact commit, protocol, closed vote, durable service and production assets',sha);
