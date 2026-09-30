import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {MatchCapacity,matchWorkload} from '../server/realtime/capacity.js';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {safeProfile} from '../src/data.js';
import {VERSION} from '../src/data.js';
const royale={mode:'royale',capacity:32,fill:true,teamSize:1};
function fixture(){const authority={rooms:new Map(),relay:{cpuQuota:{snapshot:()=>({quotaCores:.5})}}};const capacity=new MatchCapacity(authority);return {authority,capacity};}
function room(key,options,humans,bots=Infinity){return {key,sim:{options,phase:'playing',botLimit:bots,players:new Map(Array.from({length:humans},(_,i)=>[i,{bot:false}]))}};}
test('peak battle workload is reserved during warmup and full rooms cannot multiply on a half core',()=>{
 const {authority,capacity}=fixture();assert.equal(capacity.budget,325);
 authority.rooms.set('one',room('one',royale,2));
 assert.equal(matchWorkload(royale,2).bots,30);assert.equal(capacity.used(),280);
 assert.equal(capacity.plan(royale,{key:'two',humans:2}).ok,false);
 assert.equal(capacity.plan({mode:'ffa',capacity:8,bots:0},{key:'arena',humans:1}).ok,true);
 const existing=authority.rooms.get('one');existing.sim.phase='results';assert.ok(capacity.used()<280);
 existing.sim.phase='playing';assert.equal(capacity.used(),280);
});
test('reservations are atomic, count whole parties, expire and release without double-counting claimed members',()=>{
 const {authority,capacity}=fixture(),plan=capacity.plan(royale,{key:'a',humans:4});assert.ok(plan.ok);
 capacity.reserve('party','a',royale,4,plan.botLimit);
 assert.equal(capacity.used(),284);assert.equal(capacity.plan(royale,{key:'b',humans:2}).ok,false);
 const a=room('a',royale,1,plan.botLimit);a.sim.players.get(0).partyId='party';authority.rooms.set('a',a);
 assert.equal(capacity.pending('a'),3);assert.equal(capacity.used(),284);
 capacity.reservations.get('party').expires=Date.now()-1;assert.ok(capacity.used()<284);
 capacity.reserve('next','b',royale,2,30);capacity.release('next');assert.equal(capacity.reservations.size,0);
});
test('public bot limits retain human seats and minimum opposing teams; custom workloads are rejected clearly',()=>{
 const {authority,capacity}=fixture();authority.rooms.set('busy',room('busy',royale,2));
 const options={...royale,teamSize:4};
 assert.equal(capacity.plan(options,{key:'new',humans:4}).ok,false);
 // An eight-contestant team game cannot shed its entire opposing squad.
 assert.equal(capacity.plan(options,{key:'new',humans:4,reduceBots:true}).ok,false);
 authority.rooms.delete('busy');authority.rooms.set('arena',room('arena',{mode:'ffa',capacity:8,fill:true},2));
 const fitted=capacity.plan(options,{key:'new',humans:4,reduceBots:true});assert.ok(fitted.ok);assert.ok(fitted.adjusted);assert.ok(fitted.botLimit>=4);
 assert.equal(options.capacity,32);assert.ok(fitted.cost+capacity.used()<=capacity.budget);
});
test('sustained measured throttling blocks growth and recovers; a short flash does not close admission',t=>{
 const {authority,capacity}=fixture();let periods=0,throttledPeriods=0;
 authority.relay.cpuQuota.snapshot=()=>({quotaCores:.5,periods,throttledPeriods});t.mock.method(process,'cpuUsage',()=>({user:0,system:0}));capacity.sampleAt=0;
 for(let i=1;i<=4;i++){periods+=10;if(i>1)throttledPeriods+=5;capacity.sample(i*1000);}
 assert.equal(capacity.overloaded,true);assert.equal(capacity.plan(royale,{key:'new'}).ok,false);
 for(let i=5;i<=9;i++){periods+=10;capacity.sample(i*1000);}assert.equal(capacity.overloaded,false);
});
test('spectators add traffic cost without reducing the reserved battle bot population',()=>{
 const {authority,capacity}=fixture(),a=room('a',royale,2);authority.rooms.set('a',a);
 const before=capacity.used();for(let i=0;i<10;i++)a.sim.players.set('s'+i,{bot:false,lateSpectator:true});
 assert.equal(capacity.humans(a),2);assert.equal(capacity.used(),before+40);
});
test('whole spectator parties reserve delivery work without replacing bots, and closed rooms release their reservations',()=>{
 const {authority,capacity}=fixture(),a=room('a',royale,2);authority.rooms.set('a',a);const before=capacity.used();
 capacity.reserve('watchers','a',royale,4,30,true);assert.equal(capacity.pending('a'),0);assert.equal(capacity.pending('a',true),4);assert.equal(capacity.used(),before+16);
 a.sim.players.set('s',{bot:false,lateSpectator:true,partyId:'watchers'});assert.equal(capacity.pending('a',true),3);assert.equal(capacity.used(),before+16);
 capacity.releaseRoom('a');assert.equal(capacity.reservations.size,0);assert.equal(capacity.used(),before+4);
});
test('real public matchmaking trims only new filler bots, preserves seats, and releases cancelled reservations',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'});app.relay.cpuQuota.snapshot=()=>({available:true,quotaCores:.5});
 globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 const host=new Network(),newHost=new Network();let social;
 const wait=async fn=>{const until=Date.now()+7000;while(!fn()){assert.ok(Date.now()<until,'Matchmaking timeout');await new Promise(r=>setTimeout(r,10));}};
 try{
  await host.host();await host.createAuthority({mode:'ffa',fill:true,bots:7,capacity:8},safeProfile({name:'Occupied Match'}),'private');
  social=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/social`,{origin:'https://zl-2.github.io'});let hello,launch,party,seq=0;const requests=new Map();
  social.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='hello')hello=m;if(m.type==='launch')launch=m.launch;if(m.type==='party')party=m.party;if(m.request){const waiter=requests.get(m.request);requests.delete(m.request);if(m.error)waiter.reject(Error(m.error));else waiter.resolve(m.result);}});
  await new Promise(r=>social.once('open',r));social.send(JSON.stringify({type:'hello',version:VERSION,profile:safeProfile({name:'Public Queue'})}));await wait(()=>hello&&party);
  const ask=(type,data={})=>new Promise((resolve,reject)=>{const request=++seq;requests.set(request,{resolve,reject});social.send(JSON.stringify({type,request,...data}));});
  await ask('queue',{custom:true,options:royale});assert.equal(launch.hostRun,true);assert.equal(launch.visibility,'private');await ask('cancel');launch=null;
  assert.equal(app.relay.authority.capacity.reservations.size,0);
  await ask('queue',{options:royale});await wait(()=>launch);assert.ok(launch.botLimit<31&&launch.botLimit>=1);assert.equal(launch.options.capacity,32);assert.match(launch.capacityNotice,/Bot fill/);
  const limited=launch.botLimit;await newHost.host(launch.code);await newHost.createAuthority(launch.options,safeProfile({name:'Public Queue'}),'public',launch.ticket);
  const created=app.relay.authority.rooms.get(newHost.peer.id);assert.equal(created.sim.botLimit,limited);assert.equal([...created.sim.players.values()].filter(p=>p.bot).length,limited);
  await ask('cancel');assert.equal(app.relay.authority.capacity.reservations.size,0);assert.equal(app.relay.authority.rooms.size,1);
 }finally{social?.close();host.destroy();newHost.destroy();await app.close();}
});
test('real sockets reject excess custom matches immediately and recover after the occupied room closes',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),nodes=[];
 app.relay.cpuQuota.snapshot=()=>({available:true,quotaCores:.5});
 globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 const make=async name=>{const net=new Network();nodes.push(net);await net.host();return net;};
 try{
  const a=await make('a');await a.createAuthority(royale,safeProfile({name:'Capacity Alpha'}),'private');
  const b=await make('b'),started=performance.now();await assert.rejects(b.createAuthority(royale,safeProfile({name:'Capacity Bravo'}),'private'),/safe match capacity/);assert.ok(performance.now()-started<1500);assert.equal(app.relay.authority.rooms.size,1);
  const r=app.relay.authority.rooms.get(a.peer.id);app.relay.remove(r.hostPeer);assert.equal(app.relay.authority.rooms.size,0);
  await b.createAuthority(royale,safeProfile({name:'Capacity Bravo'}),'private');assert.equal(app.relay.authority.rooms.size,1);
 }finally{for(const n of nodes)n.destroy();await app.close();}
});
test('real rematches and mode changes cannot exceed the budget or start a rejected configuration',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'});app.relay.cpuQuota.snapshot=()=>({available:true,quotaCores:.5});
 globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 const notices=[],a=new Network({onStatus:m=>notices.push(m)}),b=new Network({onStatus:m=>notices.push(m)});
 const wait=async fn=>{const until=Date.now()+7000;while(!fn()){assert.ok(Date.now()<until,'Rematch timeout');await new Promise(r=>setTimeout(r,10));}};
 try{
  await a.host();await a.createAuthority(royale,safeProfile({name:'Rematch Alpha'}),'private');const first=app.relay.authority.rooms.get(a.peer.id);first.sim.phase='results';first.sim.stage='finished';
  await b.host();await b.createAuthority({mode:'ffa',fill:true,bots:7},safeProfile({name:'Rematch Bravo'}),'private');const second=app.relay.authority.rooms.get(b.peer.id);
  a.authorityCommand({type:'start'});await wait(()=>notices.some(n=>/safe match capacity/.test(n)));assert.equal(first.sim.phase,'results');
  const count=notices.length;b.authorityCommand({type:'configure',options:royale});b.authorityCommand({type:'start'});await wait(()=>notices.length>count);await new Promise(r=>setTimeout(r,30));assert.equal(second.sim.options.mode,'ffa');assert.equal(second.sim.phase,'lobby');
  b.destroy();await wait(()=>!app.relay.authority.rooms.has(second.key));a.authorityCommand({type:'start'});await wait(()=>first.sim.phase==='playing');assert.equal(first.sim.stage,'spawn-island');
 }finally{a.destroy();b.destroy();await app.close();}
});
