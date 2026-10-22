import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
async function measure(root){
 const load=p=>import(pathToFileURL(resolve(root,'src',p)));
 const [{Simulation},{RoyaleSimulation},{BoxFightSimulation},{ZoneWarsSimulation},physics,{MAPS,getMap}]=await Promise.all(['simulation.js','royale.js','box-fights.js','zone-wars.js','physics.js','maps.js'].map(load));
 const results={};
 for(const [mode,Type,opts]of [['ffa',Simulation,{map:MAPS[0].id}],['teams',Simulation,{map:MAPS[1].id}],['training',RoyaleSimulation,{training:true}],['royale',RoyaleSimulation,{}],['boxfight',BoxFightSimulation,{boxFormat:'ffa'}],['zonewars',ZoneWarsSimulation,{}]]){
  const actual=mode==='training'?'royale':mode,sim=new Type({mode:actual,...opts,capacity:8,bots:0,fill:false,seed:200,session:'offline'});
  sim.addPlayer('host',{name:'Benchmark'});for(let i=1;i<8;i++)sim.addPlayer('actor-'+i,{name:'Operator '+i});sim.startRound();if(actual==='royale'&&!opts.training)sim.beginBattle();
  const map=sim.map,probes=Array.from({length:128},(_,i)=>{const angle=i*2.3999632;return {o:{x:Math.sin(angle)*map.size*.6,y:1.7,z:Math.cos(angle)*map.size*.6},d:{x:Math.sin(angle+.8),y:0,z:Math.cos(angle+.8)}};});
  const samples=[],candidateCounts=[];
  for(let run=0;run<6;run++){const start=performance.now();for(let i=0;i<5000;i++){const {o,d}=probes[i%probes.length];physics.wallDistance(map,o,d,90);physics.candidates(map,o,null,0,.34);}if(run)samples.push((performance.now()-start)/5000);}
  for(const {o}of probes)candidateCounts.push(physics.candidates(map,o,null,0,.34).length);
  const ticks=[];for(let i=0;i<180;i++){const start=performance.now();sim.tick(1/60);if(i>=60)ticks.push(performance.now()-start);}
  results[mode]={map:map.id,boxes:map.boxes.length,collisionMs:median(samples),nearbyBoxes:Math.round(candidateCounts.reduce((a,b)=>a+b,0)/candidateCounts.length),tickMedianMs:median(ticks)};
 }
 const {CollisionIndex,createFacilityLayout}=await load('campaign-layout.js'),facility=createFacilityLayout(),index=new CollisionIndex(facility.boxes),samples=[];
 for(let run=0;run<6;run++){const start=performance.now();for(let i=0;i<20000;i++)index.near((i%32)*3-48,(Math.floor(i/32)%4)*6-12,2);if(run)samples.push((performance.now()-start)/20000);}
 results.campaign={map:'blackglass',boxes:facility.boxes.length,collisionMs:median(samples),workload:'Nearby facility collision union'};
 return results;
}
if(process.argv[2]==='--measure'){console.log(JSON.stringify(await measure(process.argv[3])));process.exit(0);}
assert.ok(process.env.UPDATE_200_BASELINE,'Set UPDATE_200_BASELINE to release 199');
const run=root=>JSON.parse(execFileSync(process.execPath,[new URL(import.meta.url).pathname,'--measure',root],{encoding:'utf8',maxBuffer:2e6}));
const previous=run(process.env.UPDATE_200_BASELINE),current=run('.'),reductions=Object.fromEntries(Object.keys(current).map(mode=>[mode,Math.round((1-current[mode].collisionMs/previous[mode].collisionMs)*100)]));
const report={previous,current,collisionReductionPercent:reductions,note:'Median identical CPU ray and movement broad-phase workloads in isolated processes. These figures are not measured gameplay FPS or internet latency.'};
await mkdir('test-results/update-200',{recursive:true});await writeFile('test-results/update-200/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
for(const mode of ['ffa','teams'])assert.ok(current[mode].collisionMs<previous[mode].collisionMs*.8,mode+' broad phase should materially improve');
for(const mode of Object.keys(current))assert.ok(current[mode].collisionMs<Math.max(.05,previous[mode].collisionMs*1.5),mode+' collision cost regressed');
