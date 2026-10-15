import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import * as T from 'three';
const baseline=process.env.ENVIRONMENT_BASELINE;assert.ok(baseline,'ENVIRONMENT_BASELINE is required');
globalThis.document={createElement:()=>({getContext:()=>({strokeText(){},fillText(){},fillRect(){}})})};
const load=(root,path)=>import(pathToFileURL(resolve(root,path)));
function memory(world){const seen=new Set();let bytes=0,meshes=0,triangles=0;world.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);}if(m.geometry&&!seen.has(m.geometry)){seen.add(m.geometry);for(const a of Object.values(m.geometry.attributes))bytes+=a.array.byteLength;bytes+=m.geometry.index?.array.byteLength||0;}if(m.instanceMatrix)bytes+=m.instanceMatrix.array.byteLength;if(m.instanceColor)bytes+=m.instanceColor.array.byteLength;});return {bytes,meshes,triangles};}
async function run(root){
 const {buildIslandSteps}=await load(root,'src/royale-view.js'),{getMap}=await load(root,'src/maps.js'),{authoredBoxes}=await load(root,'src/building.js'),{worldKit,View}=await load(root,'src/view.js'),original=getMap('sunnybreak'),map={...original,boxes:authoredBoxes(original)},full=new T.Group(),world=new T.Group();
 let start=performance.now();for(const _ of buildIslandSteps(full,{...map,id:'reference-full'},worldKit)){}const fullConstructionMs=performance.now()-start,fullMemory=memory(full);View.prototype.disposeGroup.call({scopeTarget:{texture:null}},full);
 start=performance.now();const steps=buildIslandSteps(world,map,worldKit);let maxStep=0,yields=0;while(true){const then=performance.now(),s=steps.next();maxStep=Math.max(maxStep,performance.now()-then);yields++;if(s.done)break;}const shellConstructionMs=performance.now()-start,shell=memory(world),details=world.userData.details;
 function settle(p,time){for(let i=0;i<1600;i++){details.update(p,{quality:'low',time:time+i/60});world.userData.groundCover?.update(p,{quality:'low',time:time+i/60});if(i>40&&!details.pending&&!details.queue?.some(c=>c.wanted&&!c.detail))break;}}
 settle({x:-53,y:8,z:-30,yaw:0},0);const near=memory(world),resident=details.loaded;settle({x:172,y:9,z:157,yaw:0},40);const travel=memory(world);assert.ok(details.cells.some(c=>c.coarse.visible&&!c.detail));
 const report={full:fullMemory,shell,near,travel,fullConstructionMs,shellConstructionMs,maxYieldMs:maxStep,yields,cells:details.cells.length,resident,groundCover:world.userData.groundCover?.diagnostics()||null};View.prototype.disposeGroup.call({scopeTarget:{texture:null}},world);return report;
}
const old=await run(baseline),current=await run('.'),report={baseline:resolve(baseline),current,previous:old,comparison:{shellMemoryRatio:current.shell.bytes/old.shell.bytes,nearMemoryRatio:current.near.bytes/old.near.bytes,shellConstructionRatio:current.shellConstructionMs/old.shellConstructionMs},note:'Identical scenery workloads, not a claim of device FPS or Internet latency. More detailed near scenery is capped at 30% extra geometry memory; distant shell must not grow.'};
assert.ok(current.shell.bytes<old.shell.bytes*1.05,'Distant-shell memory regression');assert.ok(current.near.bytes<old.near.bytes*1.30,'Near scenery exceeds detail memory allowance');assert.ok(current.full.bytes<old.full.bytes*1.35,'Full-map memory regression');assert.ok(current.shellConstructionMs<old.shellConstructionMs*1.4,'Scenery startup CPU regression');assert.ok(current.maxYieldMs<80,'Construction must remain resumable');assert.ok(current.groundCover.cells<=9&&current.groundCover.draws<=18);
await mkdir('test-results/expansion/environment',{recursive:true});await writeFile('test-results/expansion/environment/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
