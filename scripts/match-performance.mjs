import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
async function measure(root){
 const mod=path=>import(pathToFileURL(resolve(root,'src',path))),{ZoneWarsSimulation}=await mod('zone-wars.js'),{BoxFightSimulation}=await mod('box-fights.js'),{RoyaleSimulation}=await mod('royale.js'),{rebuildMap}=await mod('building.js'),{movePlayer,wallDistance}=await mod('physics.js');
 const sample=(fn,count)=>{const runs=[];for(let j=0;j<6;j++){const start=performance.now();for(let i=0;i<count;i++)fn(i);if(j)runs.push((performance.now()-start)/count);}return median(runs);},results={};
 for(const [mode,Type,count]of [['zonewars',ZoneWarsSimulation,16],['boxfight',BoxFightSimulation,8],['royaleDuos',RoyaleSimulation,48]]){
  const sim=new Type({mode:mode==='royaleDuos'?'royale':mode,teamSize:2,boxFormat:'ffa',capacity:count,bots:0,fill:false,seed:194});
  for(let i=0;i<count;i++)sim.addPlayer('p'+i,{name:'Pilot '+i});sim.startRound();if(mode==='royaleDuos')sim.beginBattle();else{sim.boxEnd=sim.time;sim.tick(1/30);}
  const players=[...sim.players.values()];for(const p of players){p.flight='ground';p.grounded=true;}
  const width=mode==='boxfight'?8:20;
  sim.builds=Array.from({length:mode==='boxfight'?220:500},(_,i)=>({id:'build-'+i,type:i%3?'wall':'stairs',material:'wood',x:(i%width-width/2)*4,y:Math.floor(i/(width*width))*4,z:(Math.floor(i/width)%width-width/2)*4,rotation:i%4,owner:'p0',team:-1,health:150,maxHealth:150,constructionRemaining:0,repairRemaining:0,revision:0,created:0,mask:0,path:[]}));sim.buildVersion++;rebuildMap(sim);
  const snapshotMs=sample(()=>sim.snapshot(),450);
  const player=players[0],movementMs=sample(i=>{Object.assign(player,{x:.5,z:.5,y:6,vy:0,grounded:true,spectating:false,health:100});movePlayer(player,{yaw:.5,forward:.5,slot:player.slot},sim.map,1/60,i/60);wallDistance(sim.map,{x:.5,y:7.6,z:.5},{x:.7,y:0,z:.7},120);},2500);
  results[mode]={players:players.length,buildings:sim.builds.length,snapshotMs,movementAndSightMs:movementMs};
 }
 return results;
}
if(process.argv[2]==='--measure'){console.log(JSON.stringify(await measure(process.argv[3])));process.exit(0);}
assert.ok(process.env.MATCH_BASELINE,'MATCH_BASELINE must name the previous production checkout');
const run=root=>JSON.parse(execFileSync(process.execPath,[new URL(import.meta.url).pathname,'--measure',root],{encoding:'utf8',maxBuffer:1024*1024})),previous=run(process.env.MATCH_BASELINE),current=run('.');
const reductions=Object.fromEntries(Object.keys(current).map(mode=>[mode,{snapshotPercent:Math.round((1-current[mode].snapshotMs/previous[mode].snapshotMs)*100),movementAndSightPercent:Math.round((1-current[mode].movementAndSightMs/previous[mode].movementAndSightMs)*100)}]));
const report={previous,current,reductions,note:'Identical built-up matches in isolated processes; CPU work per snapshot and movement/sight query, not an FPS or Internet-ping guarantee.'};await mkdir('test-results/match194',{recursive:true});await writeFile('test-results/match194/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
for(const mode of Object.keys(current))assert.ok(current[mode].snapshotMs<previous[mode].snapshotMs*.85,mode+' snapshot workload should materially improve');
assert.ok(current.boxfight.movementAndSightMs<previous.boxfight.movementAndSightMs*.85,'Box fight collision should materially improve');
