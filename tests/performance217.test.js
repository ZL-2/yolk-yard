import test from 'node:test';
import assert from 'node:assert/strict';
import {SnapshotWork} from '../server/realtime/snapshot-work.js';
import {snapshotBuilds,snapshotDoors} from '../src/build-snapshot.js';
import {RemotePoses} from '../src/remote-poses.js';
import {makeGroundBlaster} from '../src/weapons.js';
import {candidates,wallDistance,removeCollisionBoxes,invalidateCollision} from '../src/physics.js';

test('incremental destruction matches a fresh collision index across rays, cached areas and later additions',()=>{
 const boxes=Array.from({length:96},(_,i)=>({objectId:'w'+i,x:(i%12)*8-44,y:0,z:Math.floor(i/12)*8-28,w:i%9?3:18,d:3,h:6}));
 const map={size:256,boxes},queries=Array.from({length:50},(_,i)=>({o:{x:i*1.7-40,y:3,z:i%7*8-24},d:{x:Math.sin(i),y:0,z:Math.cos(i)}}));
 const check=()=>{const fresh={size:256,boxes:[...map.boxes]};for(const {o,d}of queries){assert.equal(wallDistance(map,o,d,100),wallDistance(fresh,o,d,100));for(const radius of [1,7,20])assert.deepEqual(candidates(map,o,null,0,radius).map(b=>b.objectId).sort(),candidates(fresh,o,null,0,radius).map(b=>b.objectId).sort());}};
 check();removeCollisionBoxes(map,[boxes[0],boxes[35],boxes[60]]);check();removeCollisionBoxes(map,boxes.filter((_,i)=>i%3===0));check();
 map.boxes.push({objectId:'new',x:150,y:0,z:0,w:5,d:5,h:6});invalidateCollision(map);check();assert.equal(wallDistance(map,{x:140,y:3,z:0},{x:1,y:0,z:0},20),7.5);
 removeCollisionBoxes(map,map.boxes.filter(b=>b.objectId==='new'));assert.equal(wallDistance(map,{x:140,y:3,z:0},{x:1,y:0,z:0},20),20);check();
});

test('snapshot work yields to input, coalesces fresh requests, and cancels on shutdown',()=>{
 let now=0;const callbacks=new Map(),sent=[];let serial=0;
 const work=new SnapshotWork({budgetMs:2,now:()=>now,schedule:cb=>{const id=++serial;callbacks.set(id,cb);return id;},cancel:id=>callbacks.delete(id)}),room={};
 const create=label=>function*(){for(let i=0;i<11;i++){sent.push(label+i);now+=1;yield;}};
 work.enqueue(room,create('a'));assert.deepEqual(sent,['a0','a1']);
 work.enqueue(room,create('old'));work.enqueue(room,create('new'));assert.equal(callbacks.size,1);
 while(callbacks.size){const [id,cb]=callbacks.entries().next().value;callbacks.delete(id);sent.push('input');cb();}
 assert.equal(sent.filter(v=>v.startsWith('a')).length,11);assert.ok(!sent.some(v=>v.startsWith('old')));assert.equal(sent.filter(v=>v.startsWith('new')).length,11);assert.ok(sent.filter(v=>v==='input').length>=10);assert.equal(work.jobs.size,0);
 work.enqueue(room,create('c'));work.close();assert.equal(callbacks.size,0);work.enqueue(room,create('d'));assert.equal(work.jobs.size,0);
});

test('damage to one object retains unchanged build snapshots without aliasing mutable edits',()=>{
 const a={id:'a',health:150,path:[0,1]},b={id:'b',health:150},sim={builds:[a,b],worldDamage:{},buildVersion:1,round:1,matchId:'match'};
 const first=snapshotBuilds(sim);sim.worldDamage.wall={health:80};sim.buildVersion++;
 const world=snapshotBuilds(sim);assert.equal(world.builds,first.builds);assert.equal(world.builds[0],first.builds[0]);
 a.health=100;sim.buildVersion++;const damaged=snapshotBuilds(sim);assert.equal(damaged.builds[1],first.builds[1]);assert.equal(first.builds[0].health,150);assert.equal(damaged.builds[0].health,100);
 a.path[0]=2;sim.buildVersion++;const edit=snapshotBuilds(sim);assert.equal(edit.builds[0].path[0],2);assert.equal(first.builds[0].path[0],0);
 sim.builds=[{...a,health:30}];sim.buildVersion=1;sim.round++;assert.equal(snapshotBuilds(sim).builds[0].health,30);
});

test('door snapshots retain identity until a door moves and never mutate old frames',()=>{
 const source={a:{open:false,changedAt:0},b:{open:false,changedAt:0}},first=snapshotDoors(source);assert.equal(snapshotDoors(source),first);
 source.a.open=true;source.a.changedAt=2;source.a.passable=false;const next=snapshotDoors(source);assert.equal(next.b,first.b);assert.equal(first.a.open,false);assert.equal(next.a.open,true);
 source.a.passable=true;const opened=snapshotDoors(source);assert.equal(next.a.passable,false);assert.equal(opened.a.passable,true);
 delete source.b;assert.deepEqual(Object.keys(snapshotDoors(source)),['a']);assert.notEqual(snapshotDoors({...source}),opened);
});

test('remote poses bridge a lost packet briefly, remain bounded, and never extrapolate death or teleport',()=>{
 const actor={id:'b',health:100,x:0,y:0,z:0,vx:5,vy:0,vz:0,yaw:0,pitch:0,grounded:true,flight:'ground'};
 const state=(time,p)=>({time,round:1,phase:'playing',players:[p]});
 const r=new RemotePoses();r.receive(state(1,actor));const next={...actor,x:.25};r.receive(state(1.05,next));
 assert.ok(r.players(state(1.05,next),null,1.2)[0].x>.25);assert.ok(r.players(state(1.05,next),null,2)[0].x<=.625001);
 for(const change of [{health:0},{x:80},{flight:'glide'},{vehicleId:'helicopter'}]){const p={...next,...change};assert.deepEqual(r.players(state(1.05,p),null,1.2)[0],p);}
});

test('distant weapon batches retain weapon identity and share immutable geometry',()=>{
 const a=makeGroundBlaster('sprinter'),b=makeGroundBlaster('sprinter');assert.equal(a.geometry,b.geometry);assert.equal(a.userData.weaponId,'sprinter');assert.ok(a.geometry.attributes.position.count>1000);assert.equal(a.children.length,0);assert.ok(a.geometry.userData.shared);
});

test('private HUD values stay exact for owner and watched player while remote combat stays current',async()=>{
 const {SnapshotInterest}=await import('../src/snapshot-interest.js');
 const a={id:'a',x:0,y:0,z:0,health:100,team:0,ammo:[12],materials:{wood:37},field:{damage:131},inventory:[{id:'sprinter',ammo:12}]},b={...a,id:'b',team:1,x:5,ack:42};
 const state={time:1,round:1,options:{mode:'royale',teamSize:1,map:'sunnybreak'},royale:{matchId:'217'},players:[a,b]},interest=new SnapshotInterest();
 const rows=interest.players(state,a);assert.equal(rows[0],a);assert.equal(rows[1].health,100);assert.deepEqual(rows[1].inventory,b.inventory);for(const key of ['ammo','materials','field','ack'])assert.equal(rows[1][key],undefined);
 assert.equal(interest.players(state,{...a,health:0,watchingId:'b'})[1],b);
});
