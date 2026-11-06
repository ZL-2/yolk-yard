import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {applyOwnerGameplay} from '../src/owner-gameplay.js';
import {movePlayer} from '../src/physics.js';

test('owner gameplay validates targets before changing state and powers survive recovery',()=>{
 const s=new Simulation({mode:'ffa'}),a=s.addPlayer('owner',{name:'Owner'}),b=s.addPlayer('target',{name:'Target'});
 s.startRound();s.matchId='owner-test';const run=(action,more={})=>applyOwnerGameplay(s,{matchId:s.matchId,action,players:[b.id],operator:a.id,...more});
 b.health=12;assert.throws(()=>run('restore',{players:[b.id,'missing']}));assert.equal(b.health,12);
 run('restore');assert.equal(b.health,100);assert.equal(b.shield,100);
 run('god');s.damage(b,a,999,'Test');assert.equal(b.health,100);
 run('freeze');const x=b.x,z=b.z;movePlayer(b,{forward:1,yaw:0},s.map,.1);assert.equal(b.x,x);assert.equal(b.z,z);assert.equal(s.fire(b),false);
 run('unfreeze');run('fly');movePlayer(b,{jump:true},s.map,.1);assert.ok(b.ownerEffects.fly);
 const restored=new Simulation().restore(s.checkpoint());assert.deepEqual(restored.players.get(b.id).ownerEffects,b.ownerEffects);
 run('reset');assert.deepEqual(b.ownerEffects,{});
 assert.throws(()=>run('weapon',{weapon:'made-up',rarity:5}));
 assert.throws(()=>run('restore',{matchId:'old'}));
 s.spawn(b);assert.equal(b.ownerEffects,undefined);
});

test('owner teleport rejects a blocked destination and actions require alive targets',()=>{
 const s=new Simulation(),a=s.addPlayer('a',{name:'Owner'}),b=s.addPlayer('b',{name:'Target'});
 s.startRound();for(const p of [a,b])Object.assign(p,{health:100,spectating:false,flight:'ground'});s.matchId='teleport-test';const command={matchId:s.matchId,action:'bring',players:[b.id],operator:a.id};
 s.map={size:30,boxes:[{x:a.x,y:-100,z:a.z,w:200,h:300,d:200}]};
 const before=[b.x,b.y,b.z];assert.throws(()=>applyOwnerGameplay(s,command),/landing/);assert.deepEqual([b.x,b.y,b.z],before);
 b.health=0;assert.throws(()=>applyOwnerGameplay(s,{...command,action:'heal'}),/living/);
});

test('owner HTTP authorization, matched target resolution, audit and replay are enforced',async()=>{
 const {fixture}=await import('./helpers/public-match.js');
 const {randomUUID}=await import('node:crypto');
 const code='89271406539284756012',f=await fixture({serverOptions:{ownerCode:code}});
 try{
  const base='http://127.0.0.1:'+f.app.server.address().port;
  const post=async(path,body)=>{const r=await fetch(base+'/owner/'+path,{method:'POST',headers:{Origin:'https://zl-2.github.io','Content-Type':'text/plain'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  const token=(await post('login',{code})).data.token,sim=new Simulation(),p=sim.addPlayer('actor',{name:'Target'});
  sim.startRound();Object.assign(p,{health:12,spectating:false,flight:'ground'});sim.matchId='api-match';
  const service=f.app.owner.match,roster=[{id:'identity',playerId:p.id,name:p.name,present:true}];
  service.context=body=>{if(body.matchId!==sim.matchId)throw Error('Match changed');return {code:'TEST',matchId:sim.matchId,roster,authority:{sim}};};
  service.overview=()=>({roster,cases:[]});
  const body={token,action:'game-heal',players:['identity'],matchId:sim.matchId,code:'TEST',reason:'Owner requested full health',requestId:randomUUID()};
  assert.equal((await post('match',{...body,token:null})).status,401);assert.equal(p.health,12);
  assert.equal((await post('match',body)).status,200);assert.equal(p.health,100);
  p.health=20;assert.equal((await post('match',body)).status,200);assert.equal(p.health,20,'retry does not reapply the command');
  assert.equal((await post('match',{...body,action:'game-god'})).status,409);
  assert.equal(service.history('TEST',sim.matchId)[0].action,'game-heal');
  const eventId='owner-match:'+body.requestId,row=service.db.get('SELECT data FROM events WHERE id=?',eventId),data=JSON.parse(row.data);
  data.result.queued=true;service.db.run('UPDATE events SET data=? WHERE id=?',JSON.stringify(data),eventId);
  service.context=()=>({code:'TEST',matchId:sim.matchId,roster:[{id:'host',host:true}]});
  const receipt={...body,ok:true};
  assert.throws(()=>service.gameplayResult({id:'outsider'},receipt),/host/);
  service.gameplayResult({id:'host'},receipt);
  assert.equal(JSON.parse(service.db.get('SELECT data FROM events WHERE id=?',eventId).data).result.applied,true);
 }finally{await f.close();}
});
