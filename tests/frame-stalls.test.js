import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GuestActions} from '../src/guest-actions.js';
import {RenderBudget} from '../src/render-budget.js';
import {GpuFrameTimer} from '../src/gpu-frame-timer.js';
import {SnapshotEncoder,SnapshotDecoder,SnapshotBatch} from '../src/snapshot-codec.js';
import {SnapshotInterest} from '../src/snapshot-interest.js';
import {TeamingMonitor} from '../src/teaming-monitor.js';
import {rebuildMap,applyBuildState} from '../src/building.js';
import {candidates,rayBox,updateCollisionBoxes} from '../src/physics.js';
import {bakeSteps} from '../src/royale-view.js';
const state={time:10,round:1,options:{mode:'royale',map:'sunnybreak'},royale:{matchId:'stalls'}};
const player=()=>({id:'p',health:60,shield:0,flight:'ground',slot:1,ack:0,ammo:[0,2],reserve:[0,100],inventory:[{id:'pickaxe',pickaxe:true},{id:'sprinter',weapon:true}],reloadEnd:0,equipUntil:0});
test('reload and item use animate before the reply, retain local time on acceptance, and reconcile denial without changing resources',()=>{
 for(const kind of ['reload','use']){
  const a=new GuestActions(),p=player();if(kind==='use')p.inventory[1]={id:'bandage',count:2};const original=structuredClone(p);
  assert.ok(a.input(state,p,{seq:1,slot:1,...(kind==='reload'?{reload:true}:{fire:true})},10,1000));
  let v=a.present(p,10.05,1050);assert.ok(kind==='reload'?v.reloadEnd>10:v.use?.start===10);assert.deepEqual(p,original);
  const accepted={...p,ack:1,...(kind==='reload'?{reloadStarted:10.1,reloadEnd:12}:{use:{id:'bandage',slot:1,start:10.1,end:12.6}})};
  a.receive({...state,time:10.1},accepted,1100);v=a.present(accepted,10.15,1150);assert.equal(kind==='reload'?v.reloadStarted:v.use.start,10);
  a.receive({...state,time:10.2},{...p,ack:2},1200);assert.equal(a.action,null);assert.equal(a.present(p,10.2,1200),p);
 }
});
test('predictive actions obey draw, ammo, health caps, cooldown, cancellation and reconnect boundaries',()=>{
 const a=new GuestActions(),p=player();
 a.input(state,{...p,reserve:[0,0]},{seq:1,slot:1,reload:true},10,1000);assert.equal(a.action,null);
 a.reset();a.input(state,{...p,equipUntil:11},{seq:1,slot:1,reload:true},10,1000);assert.equal(a.action,null);
 a.reset();a.input(state,p,{seq:1,slot:1,reload:true},10,1000);assert.ok(a.action);a.input(state,p,{seq:2,slot:1,buildMode:true},10.1,1100);assert.equal(a.action,null);
 a.reset();p.inventory[1]={id:'bandage',count:2};a.input(state,{...p,health:100},{seq:1,slot:1,fire:true},10,1000);assert.equal(a.action,null);
 a.reset();a.input(state,p,{seq:1,slot:1,fire:true},10,1000);assert.ok(a.action);a.receive({...state,round:2},p,1100);assert.equal(a.action,null);
 a.reset();p.slot=0;const before=structuredClone(p);a.input(state,p,{seq:1,slot:0,fire:true},10,1000);assert.equal(a.present(p,10,1000).swingAt,10);
 a.input(state,p,{seq:2,slot:0,fire:true},10.1,1100);assert.equal(a.action.start,10);assert.deepEqual(p,before);
 a.receive(state,{...p,ack:2,swingAt:10.05},1150);assert.equal(a.present(p,10.2,1200).swingAt,10);
 a.present(p,12,3000);assert.equal(a.action,null);
});
test('CPU stalls preserve resolution; GPU pressure adapts and an ineffective fallback probe rolls back',()=>{
 const cpu=new RenderBudget(),gpu=new RenderBudget(),unknown=new RenderBudget();
 for(let t=0;t<15000;t+=35){cpu.sample(t,{quality:'high',cpuMs:30,gpuMs:3});gpu.sample(t,{quality:'high',cpuMs:2,gpuMs:35});unknown.sample(t,{quality:'high',cpuMs:2});}
 assert.equal(cpu.scale,1);assert.equal(cpu.shadows,true);assert.ok(gpu.scale<1);assert.equal(unknown.scale,1);assert.equal(unknown.shadows,true);
 for(let t=15017;t<30000;t+=1000/60)gpu.sample(t,{gpuMs:5,cpuMs:2});assert.equal(gpu.scale,1);
});
test('GPU timing never reads an unavailable result and discards disjoint measurements',()=>{
 let available=false,disjoint=false,reads=0,deleted=0;const ext={GPU_DISJOINT_EXT:1,TIME_ELAPSED_EXT:2},gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getExtension:()=>ext,isContextLost:()=>false,getParameter:()=>disjoint,createQuery:()=>({}),beginQuery(){},endQuery(){},deleteQuery(){deleted++;},getQueryParameter(q,key){if(key===3)return available;assert.ok(available);reads++;return 20000000;}};
 const timer=new GpuFrameTimer({getContext:()=>gl});timer.begin();timer.end();assert.equal(timer.poll(),null);assert.equal(reads,0);available=true;assert.equal(timer.poll(),20);timer.begin();timer.end();disjoint=true;assert.equal(timer.poll(),null);assert.equal(deleted,2);
});
test('incremental collision edits reuse static solids and match full scans after edits, destruction and index growth',()=>{
 const world=Array.from({length:100},(_,i)=>({objectId:'world-'+i,x:i%10*8-40,y:0,z:Math.floor(i/10)*8-40,w:1,h:3,d:1})),map={size:100,boxes:world.slice(),authored:world},sim={map,worldBoxes:world,worldDamage:{},builds:[],doors:{},time:0};
 const remote={...map,boxes:world.slice()};
 for(let n=0;n<45;n++){
  sim.builds=[{id:'edited',type:n%2?'wall':'stairs',x:n-25,y:0,z:0,rotation:n%4,mask:0,material:'wood'}];if(n===20)sim.worldDamage['world-3']={destroyed:true};rebuildMap(sim);candidates(map,{x:0,y:1,z:0});
  applyBuildState(remote,{matchId:'m',round:1,buildVersion:n,builds:sim.builds,worldDamage:sim.worldDamage,doors:{}});
  assert.equal(map.boxes.find(b=>b.objectId==='world-1'),world[1]);assert.deepEqual(new Set(remote.boxes.map(b=>JSON.stringify(b))),new Set(map.boxes.map(b=>JSON.stringify(b))));
  for(let i=0;i<8;i++){const o={x:-70,y:1,z:i-4},d={x:1,y:0,z:0},hit=bs=>Math.min(180,...bs.map(b=>rayBox(o,d,b,180)));assert.equal(hit(candidates(map,o,d,180)),hit(map.boxes));}
 }
 const extra={x:300,y:0,z:300,w:2,h:4,d:2};updateCollisionBoxes(map,[],[extra]);assert.ok(candidates(map,{x:300,y:0,z:300}).includes(extra));updateCollisionBoxes(map,[extra]);assert.ok(!candidates(map,{x:300,y:0,z:300}).includes(extra));
});
test('sliced fair-play evaluation reproduces complete evidence at one sampling instant',()=>{
 const flags=[[],[]],monitors=flags.map(out=>new TeamingMonitor({identity:id=>id,onFlag:f=>out.push(structuredClone(f))})),players=new Map(Array.from({length:12},(_,i)=>['p'+i,{id:'p'+i,x:0,y:0,z:i,health:100,team:i,contestant:true,connected:true,flight:'ground'}]));
 const sim={players,time:20,elapsed:20,phase:'playing',stage:'active',options:{mode:'royale',teamSize:1},storm:{radius:1000},accessible:()=>true};
 for(let time=20;time<180;time+=2){sim.time=sim.elapsed=time;for(const p of players.values())p.x=time;
  if(time===50||time===110)for(const m of monitors)for(const id of ['p0','p1'])m.combat({type:'hit',time,player:id,target:'p11',amount:35},sim);
  monitors[0].sample(sim,{budgetMs:Infinity});let clock=0;monitors[1].sample(sim,{budgetMs:1,now:()=>++clock});assert.ok(monitors[1].work);
  while(monitors[1].work)monitors[1].sample(sim,{budgetMs:1,now:()=>++clock});
 }
 assert.deepEqual(flags[1],flags[0]);assert.ok(flags[0].some(f=>f.evidence.enforce));
 sim.phase='results';monitors[1].sample(sim);assert.equal(monitors[1].pairs.size,0);
});
test('shared actor baselines restore full owner and watched inventory without leaking another owner or losing deltas',()=>{
 const interest=new SnapshotInterest(),decoders=[new SnapshotDecoder(),new SnapshotDecoder()],encoders=[new SnapshotEncoder(),new SnapshotEncoder()];
 for(let tick=0;tick<4;tick++){
  const players=[0,1].map(i=>({...player(),id:'p'+i,x:tick+i,y:0,z:0,ack:tick,ammo:[0,3+tick+i],inventory:[{id:'pickaxe',pickaxe:true},{id:'sprinter',weapon:true,ammo:3+tick+i}]})),s={...state,time:10+tick/20,players},batch=new SnapshotBatch();
  for(let i=0;i<2;i++){const rows=interest.players(s,players[i],{privatePlayers:false}),message={type:'authority-state',state:{...s,players:rows},localPlayers:{[players[i].id]:players[i]}},encoded=encoders[i].encode(message,batch),frame=JSON.parse(batch.serialize(encoded.frame)).frame,decoded=decoders[i].decode(frame);
   assert.equal(decoded.state.players[i].ammo[1],3+tick+i);assert.equal(decoded.state.players[1-i].ammo,undefined);assert.equal(decoded.state.players[1-i].inventory[1].ammo,undefined);assert.equal(decoded.state.players[1-i].x,tick+1-i);assert.equal(decoded.localPlayers,undefined);
   decoded.state.players[i].inventory[1].ammo=999;
  }
 }
});
test('bounded geometry batches preserve every vertex and destruction range',()=>{
 const group=new THREE.Group(),material=new THREE.MeshLambertMaterial({color:0xffffff}),geo=new THREE.BoxGeometry();let total=0;
 for(let i=0;i<800;i++){const m=new THREE.Mesh(geo,material);m.position.x=i;m.userData.objectId='box-'+i;group.add(m);total+=36;}
 for(const _ of bakeSteps(group,false,true)){}let baked=0,ranges=0;for(const m of group.children){baked+=m.geometry.attributes.position.count;ranges+=m.userData.objectRanges.length;assert.ok(m.geometry.attributes.position.count<8300);}
 assert.equal(baked,total);assert.equal(ranges,800);assert.ok(group.children.length>1);
});
