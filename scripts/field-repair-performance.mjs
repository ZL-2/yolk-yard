import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import * as T from 'three';
const baseline=process.env.REPAIR_BASELINE;if(process.argv[2]!=='--measure')assert.ok(baseline,'REPAIR_BASELINE must name the previous production checkout');
const load=(root,file)=>import(pathToFileURL(resolve(root,file))),median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
async function measure(root){
 const [{buildDetailedTerrain,terrainDetailDiagnostics},{ROYALE_MAP},{RoyaleSimulation},{makeArms,updateArms},{makeBlaster}]=await Promise.all(['src/terrain-detail.js','src/royale-map.js','src/royale.js','src/arms.js','src/weapons.js'].map(p=>load(root,p)));
 const times=[];let terrain;
 for(let run=0;run<4;run++){const world=new T.Group(),start=performance.now();for(const _ of buildDetailedTerrain(world,ROYALE_MAP)){}times.push(performance.now()-start);terrain=terrainDetailDiagnostics(world);world.traverse(m=>m.geometry?.dispose());terrain.material?.dispose?.();world.userData.terrainEnvironment.material.dispose();}
 const rigs=Array.from({length:12},()=>({rig:makeArms('sprinter'),gun:makeBlaster('sprinter')}));
 const reload=[];for(let run=0;run<4;run++){const start=performance.now();for(let frame=0;frame<120;frame++)for(const r of rigs)updateArms(r.rig,(frame%100)/100,r.gun,0,1,null,true);if(run)reload.push((performance.now()-start)/120);}
 const sim=new RoyaleSimulation({mode:'royale',capacity:48,bots:47,fill:true,seed:172}),p=sim.addPlayer('host',{name:'Performance Captain'});sim.startRound();sim.beginBattle();p.shieldUntil=100000;p.lastActive=0;
 const tick=[];for(let i=0;i<420;i++){const start=performance.now();sim.tick(1/60);if(i>=120)tick.push(performance.now()-start);}
 const snapshots=[];for(let run=0;run<3;run++){const start=performance.now();for(let i=0;i<300;i++)sim.snapshot();snapshots.push((performance.now()-start)/300);}
 return {terrainColdMs:times[0],terrainRepeatMs:median(times.slice(1)),terrainGeometryBytes:terrain.geometryBytes,roadControlBytes:terrain.controlBytes,terrainTriangles:terrain.triangles,reload12ActorsMs:median(reload),simulationMedianMs:median([...tick]),simulationP95Ms:[...tick].sort((a,b)=>a-b)[Math.floor(tick.length*.95)],snapshotMs:median(snapshots),actors:sim.players.size};
}
if(process.argv[2]==='--measure'){console.log(JSON.stringify(await measure(process.argv[3])));process.exit(0);}
const isolated=root=>JSON.parse(execFileSync(process.execPath,[new URL(import.meta.url).pathname,'--measure',root],{encoding:'utf8',maxBuffer:4*1024*1024}));
const previous=isolated(baseline),current=isolated('.'),report={previous,current,terrainRepeatReductionPercent:Math.round((1-current.terrainRepeatMs/previous.terrainRepeatMs)*100),note:'Identical desktop CPU workloads in separate processes; CI timings are not a device FPS guarantee. Road resolution doubles in each axis for 4 MiB additional mask memory; geometry and triangles stay unchanged.'};
assert.equal(current.terrainGeometryBytes,previous.terrainGeometryBytes);assert.equal(current.terrainTriangles,previous.terrainTriangles);assert.ok(current.terrainRepeatMs<previous.terrainRepeatMs*.5,'Repeat terrain construction should improve by at least half');assert.ok(current.simulationP95Ms<Math.max(12,previous.simulationP95Ms*1.5),'Authority tick budget regressed');assert.ok(current.reload12ActorsMs<Math.max(15,previous.reload12ActorsMs*1.5),'Reload CPU budget regressed');assert.ok(current.snapshotMs<Math.max(4,previous.snapshotMs*1.5),'Snapshot CPU budget regressed');
await mkdir('test-results/field-repair',{recursive:true});await writeFile('test-results/field-repair/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
