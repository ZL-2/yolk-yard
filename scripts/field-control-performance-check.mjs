import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import * as T from 'three';
const baseline=process.env.FIELD_CONTROL_BASELINE;assert.ok(baseline,'FIELD_CONTROL_BASELINE is required');
const load=(root,path)=>import(pathToFileURL(resolve(root,path)));
const old=await load(baseline,'src/humanoid.js'),fresh=await load('.','src/humanoid.js'),oldView=await load(baseline,'src/view.js'),newView=await load('.','src/view.js');
const profile={name:'CoastScout',weapon:'sprinter',color:'#59747c',pattern:0,hat:0,eyewear:0,accent:'#d9c28c'};
const a=oldView.makeEgg(profile),b=newView.makeEgg(profile),scene=new T.Scene();scene.add(a,b);let maxMatrixDifference=0;
for(let i=0;i<300;i++){
 const p={health:100,grounded:i%90<60,vx:Math.sin(i*.06)*4,vz:Math.cos(i*.05)*4,yaw:Math.sin(i*.03),pitch:Math.sin(i*.01)*.8,crouching:i%80<20,sliding:i%80>65,building:i%70<10,flight:i%120>100?'glide':'ground',throwProgress:i%200<35?i%200/35:-1};
 a.position.set(i*.01,2,i*.02);b.position.copy(a.position);a.rotation.y=p.yaw;b.rotation.y=p.yaw;scene.updateMatrixWorld(true);
 old.animateHumanoid(a,p,1/60,i/60);fresh.animateHumanoid(b,p,1/60,i/60);scene.updateMatrixWorld(true);
 for(const key of Object.keys(a.userData.human.bones))for(let j=0;j<16;j++)maxMatrixDifference=Math.max(maxMatrixDifference,Math.abs(a.userData.human.bones[key].matrixWorld.elements[j]-b.userData.human.bones[key].matrixWorld.elements[j]));
}
assert.ok(maxMatrixDifference<1e-8,'Animation optimization changed final poses');
const rigs=Array.from({length:48},()=>newView.makeEgg(profile)),p={health:100,grounded:true,vx:2,vz:2,yaw:.2,pitch:.1};
function measure(fn,frames=200){for(let j=0;j<30;j++)fn(j);const start=performance.now();for(let j=0;j<frames;j++)fn(j);return (performance.now()-start)/frames;}
const actorPass=fn=>j=>{for(const m of rigs)fn(m,p,1/60,j/60);};
const samples=[];for(let i=0;i<3;i++)samples.push({previous:measure(actorPass(old.animateHumanoid)),current:measure(actorPass(fresh.animateHumanoid))});
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
const animation={operators:48,previousMs:median(samples.map(s=>s.previous)),currentMs:median(samples.map(s=>s.current)),maxMatrixDifference};animation.ratio=animation.currentMs/animation.previousMs;
const actors=new T.Group(),camera=new T.PerspectiveCamera();for(const m of rigs)actors.add(m);const view={camera,actors,pendingShots:[]};
const idleMuzzle={previousMs:measure(()=>oldView.View.prototype.muzzleEffects.call(view),1000),currentMs:measure(()=>newView.View.prototype.muzzleEffects.call(view),1000)};
assert.ok(animation.ratio<1.15,'48-operator animation CPU regressed');assert.ok(idleMuzzle.currentMs<idleMuzzle.previousMs*.1,'Idle actor matrices must be skipped');
// Include actual near/far scenery with all four added towers. Run the shared
// identical-workload memory check against the same published baseline.
process.env.ARCHITECTURE_BASELINE=baseline;await import('./built-world-performance-check.mjs');
const report={animation,idleMuzzle,note:'CPU timings for identical 48-operator workloads; not a device FPS or network latency claim. Final bone matrices match over 300 varied poses.'};
await mkdir('test-results/expansion/field-control',{recursive:true});await writeFile('test-results/expansion/field-control/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
