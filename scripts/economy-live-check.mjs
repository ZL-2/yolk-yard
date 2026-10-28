import assert from 'node:assert/strict';
let last;
for(let i=0;i<90;i++){
 try{const [v,h]=await Promise.all([fetch('https://zl-2.github.io/yolk-yard/version.json?t='+Date.now()).then(r=>r.json()),fetch('https://yolk-yard-relay.onrender.com/health?t='+Date.now()).then(r=>r.json())]);last={website:v,build:h.build,version:h.gameVersion,economy:h.economyRevision,updating:h.deployment?.updating,social:h.socialAvailable,owner:h.ownerStorage};if(v.appVersion==='6.35.0'&&v.protocol===90&&h.gameVersion===90&&h.economyRevision===1&&!h.deployment?.updating&&h.socialAvailable&&h.ownerStorage?.available){console.log('PASS published economy protocol, healthy stores and open Play gate',JSON.stringify(last));process.exit(0);}}catch(error){last={error:error.message};}
 await new Promise(r=>setTimeout(r,2000));
}
assert.fail('Live economy verification failed: '+JSON.stringify(last));
