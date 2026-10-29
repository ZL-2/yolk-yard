import assert from 'node:assert/strict';
const expected=process.env.GITHUB_SHA;
for(let i=0;i<60;i++){
 try{
 const [front,health]=await Promise.all([fetch('https://zl-2.github.io/yolk-yard/version.json?t='+Date.now(),{signal:AbortSignal.timeout(15000)}).then(r=>r.json()),fetch('https://yolk-yard-relay.onrender.com/health',{signal:AbortSignal.timeout(15000)}).then(r=>r.json())]);
 if(front.build===expected&&health.build===expected){assert.equal(health.socialAvailable,true);assert.equal(health.communityGameplay?.gifting,true);assert.equal(health.communityGameplay?.iconSharePercent,5);assert.equal(health.communityGameplay?.victoryWinPoints,100);assert.equal(health.communityGameplay?.tournamentSiphon,50);assert.equal(health.communityGameplay?.tournamentVehicles,false);console.log('PASS exact live website and healthy relay with gifting, Icon earnings and Cup gameplay',expected);process.exit(0);}
 }catch(e){console.log('Waiting for release readiness:',e.message);}
 await new Promise(r=>setTimeout(r,5000));
}
assert.fail('Website and relay did not both reach the published commit');
