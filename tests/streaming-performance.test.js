import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {WorldDetails} from '../src/world-streaming.js';import {SnapshotInterest} from '../src/snapshot-interest.js';import {RemotePoses} from '../src/remote-poses.js';import {RenderPool} from '../src/render-pool.js';import {executeRoyaleIntent} from '../src/royale-bot-execution.js';import {updateWorldDamage} from '../src/damage-visuals.js';
test('world residency preserves distant shell, preloads scope direction, unloads details and reapplies damage',()=>{
 const world=new THREE.Group(),cells=[0,300,-300].map((x,i)=>({x,z:0,radius:32,coarse:new THREE.Group(),key:i}));cells.forEach(c=>world.add(c.coarse));let disposed=0;
 const details=new WorldDetails(world,cells,()=>{const group=new THREE.Group();return{group,steps:(function*(){yield;group.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));})()};},g=>{disposed++;g.clear();});
 details.update({x:0,z:0,yaw:-Math.PI/2},{time:0});assert.equal(details.loaded,1);assert.equal(cells[0].coarse.visible,false);assert.equal(cells[1].coarse.visible,true);
 details.update({x:0,z:0,yaw:-Math.PI/2},{time:.3,scoped:true});assert.ok(cells[1].detail,'scope preloads forward distant cell');assert.equal(cells[2].detail,undefined);
 details.update({x:300,z:0,yaw:0},{time:.6});assert.ok(disposed>0);assert.equal(cells[0].coarse.visible,true);
 const geo=new THREE.BoxGeometry().toNonIndexed();geo.setAttribute('color',new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count*3).fill(1),3));const mesh=new THREE.Mesh(geo);mesh.userData.objectRanges=[{id:'wall',start:0,count:geo.attributes.position.count}];world.add(mesh);updateWorldDamage(world,{wall:{destroyed:true}},'destroy');assert.ok(geo.attributes.position.array.every(v=>v===0));
 world.userData.geometryRevision=99;updateWorldDamage(world,{wall:{destroyed:true}},'destroy');assert.ok(geo.attributes.position.array.every(v=>v===0),'streaming does not resurrect damaged old ranges');
});
test('distant poses are sampled while damage, inventory and nearby/scoped targets stay immediate',()=>{
 const interest=new SnapshotInterest(),viewer={id:'human',health:100,x:0,y:0,z:0,team:0},far={id:'bot',bot:true,health:100,x:400,y:0,z:0,yaw:0,pitch:0,vx:4,vy:0,vz:0,team:1,shotSerial:0,inventory:[{id:'pip',ammo:10}],combatState:{bloom:.1}},state={time:1,round:1,options:{mode:'royale',teamSize:1,map:'sunnybreak'},royale:{matchId:'test'},players:[viewer,far]};
 const first=interest.players(state,viewer)[1];state.time+=.05;far.x+=.2;far.health=70;far.inventory[0].ammo=9;const next=interest.players(state,viewer)[1];assert.equal(next.x,first.x);assert.equal(next.health,70);assert.equal(next.inventory[0].ammo,9);assert.equal(next.presentationAt,1);assert.equal(next.combatState,undefined);
 viewer.aim=true;assert.equal(interest.players(state,viewer)[1],far);viewer.aim=false;far.shotSerial++;assert.equal(interest.players(state,viewer)[1].x,far.x,'new shot immediately refreshes shooter pose');far.x=100;assert.equal(interest.players(state,viewer)[1],far,'nearby actor uses full state');
 const poses=new RemotePoses();far.x=400;far.presentationAt=1;poses.receive({...state,time:1});poses.receive({...state,time:1.05,players:[viewer,{...far}]});const render=poses.players(state,viewer,1.15)[1];assert.ok(render.x>=400);assert.equal(render.health,70);
});
test('render pool reuses geometry and remains bounded',()=>{const pool=new RenderPool(2),create=()=>new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),a=pool.acquire('bullet',create),geo=a.geometry;pool.release(a);const b=pool.acquire('bullet',create);assert.equal(b,a);assert.equal(b.geometry,geo);const c=pool.acquire('bullet',create),d=pool.acquire('bullet',create);for(const m of [b,c,d])pool.release(m);assert.equal(pool.diagnostics().free,2);assert.equal(pool.diagnostics().reused,1);});
test('Royale bot execution keeps turning and walking between thoughts, with varied controlled aim',()=>{
 const enemy={id:'target',health:100,x:0,y:0,z:-25},p={id:'bot',health:100,x:0,y:0,z:0,yaw:1,pitch:0,flight:'ground',slot:1,weapon:'sprinter',inventory:[{id:'pickaxe',pickaxe:true},{id:'sprinter',weapon:true,rarity:0}],brain:{target:'target',aimAt:0,nextBurst:0,memory:{target:{...enemy,visible:true,seenAt:0}}}},sim={time:0,options:{difficulty:2},players:new Map([['target',enemy]]),random:(()=>{let n=7;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};})()};const input={slot:1,yaw:1,pitch:0,desiredYaw:0,desiredPitch:0,worldMoveX:1,worldMoveZ:0,combatAim:true,fire:false};let shooting=0,rest=0,errors=[];
 for(let i=0;i<240;i++){sim.time=i/60;p.brain.memory.target.seenAt=sim.time;const out=executeRoyaleIntent(sim,p,input);p.yaw=out.yaw;p.pitch=out.pitch;if(out.fire)p.shotSerial=(p.shotSerial||0)+1;if(i>60){out.fire?shooting++:rest++;errors.push(p.brain.aimErrorX);}assert.ok(Math.hypot(out.forward,out.strafe)>.9);assert.ok(Math.abs(out.yaw-1)<=1.2);}
 assert.ok(Math.abs(p.yaw)<.08);assert.ok(shooting>=3&&shooting<=8&&rest>160);assert.ok(Math.max(...errors)-Math.min(...errors)>.004);enemy.health=0;sim.time+=.01;assert.equal(executeRoyaleIntent(sim,p,input).fire,false);
});
test('stuck Royale goals recover even when another bot consumes the route budget',async()=>{
 const {navigate}=await import('../src/bot-navigation.js'),{RoyaleSimulation}=await import('../src/royale.js'),{skillFor}=await import('../src/bot-config.js');
 const sim=new RoyaleSimulation({capacity:2,bots:0,fill:false,seed:12}),p=sim.addPlayer('host',{name:'Route probe'});sim.startRound();sim.beginBattle();
 Object.assign(p,{x:0,y:0,z:0,inventory:[{id:'pickaxe'}],botPath:[]});const brain={task:{uid:'blocked-loot'},visited:{},pathAt:100,pathGoal:{x:20,y:0,z:0},navRevision:sim.navigationRevision??sim.buildVersion??0,checkAt:0,lastX:0,lastZ:0,decision:10,side:1};
 for(const time of [1,4]){sim.time=time;sim.botPathTick=time;sim.botPathBudget=0;navigate(sim,p,brain,{x:20,y:0,z:0},skillFor(sim));}
 assert.equal(brain.task,null);assert.equal(brain.decision,0);assert.equal(brain.unreachable['blocked-loot'],16);
});
test('finer collision buckets preserve full-scan ray contacts and invalidation',async()=>{
 const {candidates,rayBox,invalidateCollision}=await import('../src/physics.js');let seed=7;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const map={theme:'royale',boxes:Array.from({length:300},()=>({x:random()*160-80,z:random()*160-80,y:random()*5,w:1+random()*20,d:1+random()*20,h:1+random()*12}))};
 for(let i=0;i<500;i++){const o={x:random()*160-80,y:random()*15,z:random()*160-80},a=random()*Math.PI*2,d={x:Math.sin(a),y:random()*.3-.15,z:Math.cos(a)},max=1+random()*200;const hit=boxes=>Math.min(max,...[...boxes].map(b=>rayBox(o,d,b,max)));assert.equal(hit(candidates(map,o,d,max)),hit(map.boxes));}
 const o={x:300,y:0,z:300};assert.equal(candidates(map,o).length,0);map.boxes.push({...o,w:2,d:2,h:3});invalidateCollision(map);assert.equal(candidates(map,o).length,1);
});
