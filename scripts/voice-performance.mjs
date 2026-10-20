import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
async function measure(root){
 const {RoyaleSimulation}=await import(pathToFileURL(resolve(root,'src/royale.js'))),{constructionTick}=await import(pathToFileURL(resolve(root,'src/building.js')));
 const sim=new RoyaleSimulation({mode:'royale',bots:0,fill:false,capacity:16,seed:191});for(let i=0;i<16;i++)sim.addPlayer('p'+i,{name:'Benchmark '+i});
 sim.builds=Array.from({length:1500},(_,i)=>({id:'build-'+i,type:'wall',material:'wood',x:(i%50)*4,y:0,z:Math.floor(i/50)*4,rotation:0,owner:'p'+i%16,team:-1,health:150,maxHealth:150,constructionRemaining:0,repairRemaining:0,constructionTick:1,created:0,revision:0,mask:0,path:[]}));
 sim.worldDamage=Object.fromEntries(Array.from({length:400},(_,i)=>['object-'+i,{health:100,maxHealth:200,destroyed:false,resourcePaid:10,weakpoint:{x:i,y:1,z:0}}]));sim.buildVersion=1;
 const sample=(fn,count)=>{const runs=[];for(let run=0;run<5;run++){const started=performance.now();for(let i=0;i<count;i++)fn(i);if(run)runs.push((performance.now()-started)/count);}return median(runs);};
 const staticSnapshotMs=sample(()=>sim.snapshot({includeLoot:false}),180);
 const changingSnapshotMs=sample(i=>{if(i%6===0){sim.builds[i%1500].health=100+i%50;sim.buildVersion++;}sim.snapshot({includeLoot:false});},180);
 const completedConstructionMs=sample(()=>constructionTick(sim),6000);
 return {players:16,buildings:1500,damagedObjects:400,staticSnapshotMs,changingSnapshotMs,completedConstructionMs};
}
if(process.argv[2]==='--measure'){console.log(JSON.stringify(await measure(process.argv[3])));process.exit(0);}
assert.ok(process.env.VOICE_BASELINE,'VOICE_BASELINE must name the previous production checkout');
const isolated=root=>JSON.parse(execFileSync(process.execPath,[new URL(import.meta.url).pathname,'--measure',root],{encoding:'utf8',maxBuffer:1024*1024}));
const previous=isolated(process.env.VOICE_BASELINE),current=isolated('.'),report={previous,current,staticSnapshotReductionPercent:Math.round((1-current.staticSnapshotMs/previous.staticSnapshotMs)*100),changingSnapshotReductionPercent:Math.round((1-current.changingSnapshotMs/previous.changingSnapshotMs)*100),completedConstructionReductionPercent:Math.round((1-current.completedConstructionMs/previous.completedConstructionMs)*100),note:'Identical populated-room CPU workloads in isolated processes. Changing snapshots update a building every sixth snapshot. These timings are not a device FPS guarantee.'};
await mkdir('test-results/voice',{recursive:true});await writeFile('test-results/voice/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
assert.ok(current.staticSnapshotMs<previous.staticSnapshotMs*.65,'Static snapshot work should fall materially');assert.ok(current.changingSnapshotMs<previous.changingSnapshotMs*1.2,'Changing construction must not materially regress');assert.ok(current.completedConstructionMs<previous.completedConstructionMs*.25,'Completed structures should not be rescanned every tick');
