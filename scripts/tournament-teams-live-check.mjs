import assert from 'node:assert/strict';
const base='https://yolk-yard-relay.onrender.com',site='https://zl-2.github.io/yolk-yard',sha=process.env.GITHUB_SHA;
for(let i=0;i<60;i++){
 try{
  const [front,health,cups]=await Promise.all([fetch(site+'/version.json?t='+Date.now()).then(r=>r.json()),fetch(base+'/health').then(r=>r.json()),fetch(base+'/tournament').then(r=>r.json())]);
  if(front.build===sha&&health.build===sha&&health.socialAvailable){
   for(const e of cups.events){assert.ok([1,2,3,4].includes(e.teamSize));assert.ok(e.name.endsWith(' - '+['Solos','Duos','Trios','Squads'][e.teamSize-1]));}
   console.log('PASS matching client/server commit, healthy social service and formatted tournament schedule',sha);process.exit(0);
  }
 }catch(error){console.log('Waiting for deployment readiness:',error.message);}
 await new Promise(r=>setTimeout(r,5000));
}
assert.fail('Client, relay and tournament schedule did not reach the published commit');
