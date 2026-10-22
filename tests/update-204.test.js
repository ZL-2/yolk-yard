import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Simulation} from '../src/simulation.js';
import {weapon} from '../src/data.js';
import {leanAmount} from '../src/stance.js';
import {SnapshotInterest} from '../src/snapshot-interest.js';
import {SnapshotEncoder,SnapshotDecoder,SnapshotBatch} from '../src/snapshot-codec.js';
import {RelayPeer} from '../src/relay-peer.js';
import {CombatParticles,visibleShot} from '../src/combat-particles.js';
import {updateWorldDamage} from '../src/damage-visuals.js';
import {updateBuildingView} from '../src/building-view.js';

test('lag compensation reads collision fields only and reuses one pose per target per shot',()=>{
 const s=new Simulation({mode:'ffa',bots:0,seed:3}),a=s.addPlayer('a',{name:'A',weapon:'scatter'}),b=s.addPlayer('b',{name:'B'});s.startRound();s.map={...s.map,size:500,boxes:[]};s.time=10;
 Object.assign(a,{x:0,y:0,z:10,health:100,grounded:true,yaw:0,pitch:0,aim:true,shieldUntil:0,ammo:[100,10],accuracyState:[{spread:0},{}],executedShotTime:9.9});
 Object.assign(b,{x:0,y:0,z:0,health:1000,grounded:true,shieldUntil:0,spectating:false});s.remoteInputs.set('a',{});
 s.poseHistory=new Map([['b',[{time:9.9,x:0,y:0,z:0,health:1000,grounded:true,lean:.7,yaw:0,flight:'ground'}]]]);
 Object.defineProperty(b,'expensiveInventory',{enumerable:true,get(){throw Error('A hit test must not copy unrelated player fields');}});
 const pose=s.shotPose(b,a,weapon('scatter'));assert.equal(pose.lean,.7);assert.equal(pose.inventory,undefined);assert.equal(pose.accuracyState,undefined);
 let rewinds=0;const original=s.shotPose;s.shotPose=function(...args){rewinds++;return original.apply(this,args);};
 assert.equal(s.fire(a),true);assert.equal(rewinds,1,'all shotgun pellets and camera/muzzle paths share a target pose');assert.equal(s.events.findLast(e=>e.type==='shot').shots.length,10);
});

test('history stores effective lean so seated and airborne actors cannot expose a phantom head',()=>{
 const s=new Simulation({mode:'ffa',bots:0}),p=s.addPlayer('p');s.startRound();s.remoteInputs.set('shooter',{});
 for(const blocked of [{vehicleId:'atv'},{swimming:true},{grounded:false},{building:true},{use:{id:'mini'}}]){
  Object.assign(p,{health:100,flight:'ground',lean:1,grounded:true,vehicleId:null,swimming:false,building:false,use:null,...blocked});s.time+=.1;s.recordPoses();
  assert.equal(s.poseHistory.get('p').at(-1).lean,0);const pose=s.shotPose(p,{id:'shooter',executedShotTime:s.time},{hitscan:true});assert.equal(leanAmount(pose),0);
 }
});

test('each recipient retains exact prediction while sharing compact opponents and immediate damage',()=>{
 const rows=['a','b','c'].map((id,i)=>({id,health:100,x:i+.1234567,y:.7654321,z:0,yaw:.11223344,pitch:.876543,team:i,ack:40+i,combatState:{bloom:.17},inventory:[{id:'sprinter',ammo:17}]}));
 const state={time:1,round:1,options:{mode:'royale',teamSize:1,map:'sunnybreak'},royale:{matchId:'204'},players:rows},interest=new SnapshotInterest(),a=interest.players(state,rows[0]),b=interest.players(state,rows[1]);
 assert.equal(a[0],rows[0]);assert.equal(b[1],rows[1]);assert.equal(a[2],b[2]);assert.equal(a[1].combatState,undefined);assert.equal(a[1].ack,undefined);assert.deepEqual(a[1].inventory,rows[1].inventory);
 for(const key of ['x','y','z'])assert.ok(Math.abs(a[1][key]-rows[1][key])<=.0005);assert.ok(Math.abs(a[1].yaw-rows[1].yaw)<=.00005);
 const watching=interest.players(state,{...rows[0],watchingId:'b',health:0});assert.equal(watching[1],rows[1]);
 const next={...state,time:1.01,players:rows.map(p=>p.id==='c'?{...p,health:42,inventory:[{id:'sprinter',ammo:16}]}:p)};
 const update=interest.players(next,rows[0]);assert.equal(update[2].health,42);assert.equal(update[2].inventory[0].ammo,16);assert.equal(update[0].ack,40);
});

test('shared serialization preserves Unicode, sparse world retention, checkpoints and reset baselines',()=>{
 const enc=new SnapshotEncoder(),dec=new SnapshotDecoder(),checkpoint={simulation:{players:[{id:'a',inventory:[{id:'sprinter',ammo:17}]}]}},state={time:1,players:[{id:'a',name:'界 🦅',inventory:[null,{ammo:17}]}],royale:{loot:[{uid:'item',x:2}],builds:[],chests:[],worldDamage:{}}};
 for(let i=0;i<4;i++){
  if(i===3)enc.reset();const batch=new SnapshotBatch(),message={type:'state',state:{...state,time:i+1,...(i===1?{royale:{}}:{})},...(i===0||i===3?{checkpoint}:{})},encoded=enc.encode(message,batch),serialized=JSON.parse(batch.serialize(encoded.frame,'snapshot-v1'));
  assert.deepEqual(serialized,JSON.parse(JSON.stringify(encoded)));const decoded=dec.decode(serialized.frame);assert.equal(decoded.state.time,i+1);assert.equal(decoded.state.players[0].name,'界 🦅');
  if(i===1)assert.equal(decoded.state.royale.loot,undefined);else assert.equal(decoded.state.royale.loot[0].uid,'item');
  if(i===0||i===3)assert.equal(decoded.checkpoint.simulation.players[0].inventory[0].ammo,17);
 }
});

function transport(protocol=1){
 const frames=[],peer=Object.assign(Object.create(RelayPeer.prototype),{queue:[],queueBytes:0,queuedSizes:new WeakMap(),queuedWork:new WeakMap(),snapshotWork:new WeakMap(),connections:new Map([['a',{compact:true,queuedBytes:0}],['b',{compact:true,queuedBytes:0}]]),unacked:new Map(),wireCommands:new Map(),sentTimes:new Map(),deferredControls:[],commandSeq:0,sentBytes:0,sentPackets:0,byteEncoder:new TextEncoder(),protocol,encodeBudgetMs:0,socket:{readyState:1,bufferedAmount:0,send:raw=>frames.push(raw)}});return {peer,frames};
}
const frame=(channel,time)=>({type:'data',channel,data:{type:'state',state:{time,round:1,players:[{id:'a',x:time}],events:[{id:time}]}}});
test('network encoding yields between recipients and newer snapshots retain all events and baselines',()=>{
 const {peer,frames}=transport();try{
  peer.enqueue(frame('a',1));peer.enqueue(frame('b',1));assert.equal(frames.length,0,'enqueue must not synchronously encode a room');peer.flush();
  assert.equal(frames.length,1);assert.equal(peer.queue.length,1);assert.ok(peer.queueBytes>0);assert.equal(peer.connections.get('a').queuedBytes,0);
  peer.enqueue(frame('b',2));peer.flush();assert.equal(peer.queueBytes,0);assert.equal(peer.connections.get('b').queuedBytes,0);
  const dec=new SnapshotDecoder(),first=dec.decode(JSON.parse(frames[1]).messages[0].data.frame);assert.equal(first.state.time,2);assert.deepEqual(first.state.events,[{id:1},{id:2}]);
  peer.enqueue(frame('b',3));peer.flush();assert.equal(dec.decode(JSON.parse(frames[2]).messages[0].data.frame).state.time,3);
 }finally{clearTimeout(peer.flushTimer);}
});
test('prepared batches survive blocked commands and reconnect replay byte-for-byte',()=>{
 const {peer,frames}=transport(2),message={type:'batch',messages:[{type:'data',channel:'a',data:{name:'界 🦅',action:'fire'}}]},raw=JSON.stringify(message);
 try{peer.socket.bufferedAmount=100000;peer.control(message,false,raw);assert.equal(frames.length,0);assert.equal(peer.deferredControls.length,1);peer.socket.bufferedAmount=0;peer.drainControls();
  assert.deepEqual(JSON.parse(frames[0]),{...message,seq:1});assert.equal(peer.unackedBytes,Buffer.byteLength(frames[0]));
  peer.message({type:'ready',id:'same',protocol:2,resume:'token',resumed:true});assert.equal(frames[1],frames[0]);
  peer.message({type:'command-ack',seq:1});assert.equal(peer.unackedBytes,0);assert.equal(peer.wireCommands.size,0);
 }finally{clearTimeout(peer.flushTimer);}
});

test('dense impacts and explosions have fixed geometry capacity and expire without reallocating meshes',()=>{
 const group=new T.Group(),fx=new CombatParticles(group),eye={x:0,y:0,z:0},impact={x:0,y:0,z:-4,normal:{x:0,y:0,z:1},surface:'metal'},meshes=[...group.children];
 for(let i=0;i<1000;i++){fx.impact(impact,eye);fx.burst({...impact,type:'explosion'},eye);}fx.update(0);assert.equal(group.children.length,3);assert.equal(fx.diagnostics().sparks,384);assert.equal(fx.diagnostics().marks,256);assert.equal(fx.diagnostics().bursts,384);
 fx.update(3);assert.ok(group.children.every(m=>m.count===0&&!m.visible));assert.deepEqual(group.children,meshes);
 fx.impact({...impact,x:400},eye);assert.equal(fx.diagnostics().sparks,0);fx.impact({...impact,x:400},eye,750);assert.equal(fx.diagnostics().sparks,6,'scoped distant hits remain visible');fx.clear();assert.equal(fx.diagnostics().marks,0);
});
test('distant muzzle flashes are culled but incoming tracers crossing the view are retained',()=>{
 const eye={x:0,y:0,z:0},event={origin:{x:300,y:0,z:0},shots:[{end:{x:-300,y:0,z:0}}]};assert.equal(visibleShot(event,eye),true);
 assert.equal(visibleShot({...event,shots:[{end:{x:400,y:0,z:0}}]},eye),false);assert.equal(visibleShot({...event,shots:[]},eye,750),true);
});

test('damaging one world object uploads only its vertex range and skips unchanged stages',()=>{
 const world=new T.Group(),geometry=new T.BufferGeometry(),position=new T.Float32BufferAttribute([1,2,3,4,5,6,7,8,9,10,11,12],3),color=new T.Float32BufferAttribute(new Array(12).fill(1),3);geometry.setAttribute('position',position);geometry.setAttribute('color',color);const mesh=new T.Mesh(geometry);mesh.userData.objectRanges=[{id:'hit',start:1,count:2}];world.add(mesh);
 updateWorldDamage(world,{hit:{destroyed:true}},1);assert.deepEqual(Array.from(position.array),[1,2,3,0,0,0,0,0,0,10,11,12]);assert.deepEqual(position.updateRanges,[{start:3,count:6}]);assert.deepEqual(color.updateRanges,[{start:3,count:6}]);
 position.clearUpdateRanges();color.clearUpdateRanges();const version=position.version;updateWorldDamage(world,{hit:{destroyed:true}},2);assert.equal(position.version,version);assert.deepEqual(position.updateRanges,[]);
 updateWorldDamage(world,{},3);assert.deepEqual(Array.from(position.array),[1,2,3,4,5,6,7,8,9,10,11,12]);
});
test('remote construction defers mesh allocation until visible and retains current damage when approached',()=>{
 let allocations=0,disposed=0;const root=new T.Group(),rv={root,kit:{block(parent,x,y,z,w,h,d,color){allocations++;const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial({color}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;}},view:{world:new T.Group(),disposeGroup(g){disposed++;g.clear();}}},piece={id:'wall',type:'wall',x:400,y:0,z:0,material:'wood',rotation:0,health:150,maxHealth:150,created:0,lastDamage:0},state={time:1,players:[],royale:{matchId:'204',round:1,buildVersion:0,builds:[piece]}},p={x:0,z:0,slot:1,health:100,flight:'ground'};
 updateBuildingView(rv,state,p);assert.equal(allocations,0);assert.equal(rv.buildMeshes.size,0);piece.health=30;piece.lastDamage=.9;p.x=400;updateBuildingView(rv,state,p);assert.ok(allocations>0);const cached=rv.buildMeshes.get('wall');assert.equal(cached.mesh.visible,true);const count=allocations;
 p.x=0;updateBuildingView(rv,state,p);assert.equal(cached.mesh.visible,false);assert.equal(allocations,count);state.royale.builds=[];updateBuildingView(rv,state,p);assert.equal(rv.buildMeshes.size,0);assert.equal(disposed,1);
});
