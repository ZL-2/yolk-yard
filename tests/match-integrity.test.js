import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {OwnerStore} from '../server/realtime/owner-store.js';
import {FairPlayService} from '../server/realtime/fair-play.js';
import {replayFrame} from '../src/match-replay.js';
const state=(time,phase='playing')=>({time,matchId:'match',phase,options:{mode:'royale',map:'sunnybreak',teamSize:1},players:[{id:'pa',name:'Alpha',x:time,y:1,z:0,health:100,kills:0,contestant:true},{id:'pb',name:'Bravo',x:time+3,y:1,z:0,health:100,kills:0,contestant:true}],events:[],chat:'Never record this',token:'SECRET'});
function setup(path=':memory:'){
 let now=1000000;const db=new OwnerStore({path,now:()=>now,legacyPath:null}),removed=[],sent=[],a={id:'a',profile:{name:'Alpha'}},b={id:'b',profile:{name:'Bravo'}},peers=new Map([['pa',{id:'pa',progressId:'aa'}],['pb',{id:'pb',progressId:'bb'}]]);
 const room={code:'ROOMTEST',key:'address',options:{mode:'royale',map:'sunnybreak',teamSize:1},state:{matchId:'match',time:0,phase:'playing'},host:{peer:'pa',id:'pa'},members:new Map([['pa',{id:'pa',peer:'pa',admission:{memberId:'a',partyId:'a'}}],['pb',{id:'pb',peer:'pb',admission:{memberId:'b',partyId:'b'}}]])};
 const location=u=>({key:'address',listing:{code:room.code},watchId:u.id==='a'?'pa':'pb'}),r={owner:{db,systemEvent(){},disconnectPlayer:id=>removed.push(id)},progression:{accounts:new Map([['aa',{socialId:'a'}],['bb',{socialId:'b'}]])},authority:{roomFor:()=>null},publicHost:{roomFor:p=>room.members.has(p.id)?room:null,roomByAddress:()=>room},hostWatchdog:{rooms:new Map(),owners:new Map()},parties:{users:new Map([['a',a],['b',b]]),store:{identities:new Map([['a',a],['b',b]])},send:(_,m)=>sent.push(m),matchLocation:location},peers,send:(peer,m)=>{if(peer)sent.push(m);},tournament:{events:[{id:'future',phase:'scheduled',event:{name:'Next Cup',teamSize:1,opensAt:8000000,startsAt:8060000}}],event:()=>null}};
 const s=r.fairPlay=new FairPlayService(r,{now:()=>now});return {s,r,db,room,a,b,peers,removed,sent,setNow:n=>now=n,close:async()=>{s.replays.close();s.publicMatches.close();await db.close();}};
}
test('complete match recording retains pre-removal and post-removal frames, markers, privacy, pagination and restart',async()=>{
 const dir=await mkdtemp(tmpdir()+'/replay-'),path=dir+'/owner.sqlite';let h=setup(path);try{
  for(let t=0;t<=12;t+=.5){const frame=replayFrame(state(t,t===12?'results':'playing'));if(t>6)frame.players=frame.players.filter(p=>p.id!=='pb');h.s.replays.capture('ROOMTEST','match',frame,{source:'server simulation',identities:[{id:'a',playerId:'pa',name:'Alpha'},{id:'b',playerId:'pb',name:'Bravo'}]});if(t===6)h.s.replays.mark('ROOMTEST','match',{type:'Removal',players:['b']});}
  const meta=h.s.replays.summary('ROOMTEST','match');assert.equal(meta.status,'complete');assert.equal(meta.first,0);assert.equal(meta.last,12);assert.equal(meta.markers[0].time,6);
  const all=h.s.replays.read({id:meta.id,count:6}).chunks.flatMap(c=>c.frames);assert.equal(all.length,25);assert.ok(all[0].players.some(p=>p.id==='pb'));assert.ok(!all.at(-1).players.some(p=>p.id==='pb'));assert.equal(JSON.stringify(all).includes('SECRET'),false);assert.equal(JSON.stringify(all).includes('Never record'),false);
  h.s.replays.capture('ROOMTEST','match',replayFrame(state(12,'results')),{source:'server simulation'});assert.equal(h.s.replays.read({id:meta.id,count:6}).chunks.flatMap(c=>c.frames).length,25);
  await h.close();h=setup(path);assert.equal(h.s.replays.read({id:meta.id,start:1,count:1}).chunks[0].seq,1);h.setNow(100000000);h.s.replays.sweep();assert.equal(h.s.replays.summary('ROOMTEST','match').status,'complete','Flagged recordings are retained');
 }finally{await h.close();await rm(dir,{recursive:true,force:true});}
});
test('recording gaps and interrupted sessions remain explicit and unflagged recordings expire separately',async()=>{
 const h=setup();try{for(const time of [0,.5,10])h.s.replays.capture('ROOMTEST','match',replayFrame(state(time)),{source:'elected player host'});h.s.replays.close();const meta=h.s.replays.summary('ROOMTEST','match');assert.equal(meta.gaps.length,1);assert.match(meta.gaps[0].reason,/No recorded snapshots/);h.setNow(90000000);h.s.replays.sweep();assert.equal(h.s.replays.summary('ROOMTEST','match'),null);}finally{await h.close();}
});
test('only the elected host can upload public recordings; recordings are explicitly host-supplied',async()=>{
 const h=setup();try{const frame=replayFrame(state(0));h.s.replays.receive(h.peers.get('pb'),{state:frame});assert.equal(h.s.replays.summary('ROOMTEST','match'),null);h.s.replays.receive(h.peers.get('pa'),{state:frame});assert.equal(h.s.replays.summary('ROOMTEST','match').source,'elected player host');h.room.host={peer:'pb',id:'pb'};h.setNow(1001000);h.room.state.time=1;h.s.replays.receive(h.peers.get('pa'),{state:replayFrame(state(1))});assert.equal(h.s.replays.summary('ROOMTEST','match').last,0);}finally{await h.close();}
});
test('control firewall strips authoritative fields, fixes time step and rejects floods without banning for packet jitter',async()=>{
 const h=setup();try{const peer=h.peers.get('pb'),m={type:'input',input:{seq:1,forward:900,health:999,x:3000,dt:5000,shotTime:9999,pitch:400,fire:true}};assert.equal(h.s.integrity.guard(peer,h.peers.get('pa'),m),true);assert.equal(m.input.health,undefined);assert.equal(m.input.x,undefined);assert.equal(m.input.dt,1/60);assert.equal(m.input.forward,1);assert.equal(m.input.pitch,1.48);assert.equal(m.input.shotTime,0);let blocked=0;for(let i=2;i<1000;i++)if(!h.s.integrity.guard(peer,h.peers.get('pa'),{type:'input',input:{seq:i}}))blocked++;assert.ok(blocked>800);assert.deepEqual(h.removed,[]);assert.equal(h.s.status('b').until,null);assert.equal(h.s.integrity.guard(peer,null,{type:'input',input:{seq:NaN}}),false);}finally{await h.close();}
});
for(const cup of [false,true])test(`repeated proven state forgery removes a ${cup?'Cup':'normal-match'} guest; only Cup violations exclude the next Cup`,async()=>{
 const h=setup();try{if(cup)h.r.authority.roomFor=peer=>peer.id==='pb'?{code:'ROOMTEST',eventId:'current-cup',sim:{matchId:'match',time:0}}:null;const peer=h.peers.get('pb');for(const t of [1000000,1001000,1002500]){h.setNow(t);assert.equal(h.s.integrity.guard(peer,h.peers.get('pa'),{type:'state',state:{players:[]}}),false);}assert.deepEqual(h.removed,['b']);assert.equal(h.s.status('b').kind,'cheating');assert.ok(h.s.status('b').until);assert.equal(h.s.status('b').cups.length,cup?1:0);assert.throws(()=>h.s.assertPlay('b'),/suspension/);assert.equal(h.s.overview().cases[0].evidence.rule,'state-forgery-v1');}finally{await h.close();}
});
test('legitimate host state, aim changes and disconnected bursts do not produce cheating punishments',async()=>{
 const h=setup();try{assert.equal(h.s.integrity.guard(h.peers.get('pa'),h.peers.get('pb'),{type:'state',state:{}}),true);for(let i=1;i<400;i++){h.setNow(1000000+i*17);h.s.integrity.guard(h.peers.get('pb'),h.peers.get('pa'),{type:'input',input:{seq:i,yaw:i%2?3:-3,pitch:1,fire:true}});}assert.deepEqual(h.removed,[]);assert.equal(h.s.overview().cases.length,0);}finally{await h.close();}
});
test('death reports verify the recorded eliminator, deduplicate, raise monitoring, retain replay and never punish by report count',async()=>{
 const h=setup();try{const frame=replayFrame(state(20));frame.players[1].health=0;frame.players[1].killerId='pa';h.s.replays.capture('ROOMTEST','match',frame,{source:'elected player host',identities:[{id:'a',playerId:'pa',name:'Alpha'},{id:'b',playerId:'pb',name:'Bravo'}]});const m={matchId:'match',target:'pa',category:'cheating',notes:'Unexpected shots through cover.'};assert.throws(()=>h.s.reports.death(h.b,{...m,target:'pb'}),/eliminator/);assert.throws(()=>h.s.reports.death(h.a,{...m,target:'pb'}),/eliminator/);assert.throws(()=>h.s.reports.death(h.b,{...m,matchId:'older'}),/different match/);assert.equal(h.s.reports.death(h.b,m).ok,true);assert.equal(h.s.reports.death(h.b,m).duplicate,true);assert.equal(h.s.reports.list().length,1);assert.equal(h.s.reports.list()[0].verified,false);assert.ok(h.sent.some(m=>m.type==='fair-play-focus'&&m.players.includes('pa')));assert.equal(h.db.get('SELECT retained FROM match_replays').retained,1);assert.deepEqual(h.removed,[]);assert.equal(h.s.status('a').until,null);}finally{await h.close();}
});
test('a final elimination is reportable after the replay completes and recording errors cannot prevent a committed removal',async()=>{
 const h=setup();try{const frame=replayFrame(state(30,'results'));frame.players[1].health=0;frame.players[1].killerId='pa';h.s.replays.capture('ROOMTEST','match',frame,{source:'elected player host',identities:[{id:'a',playerId:'pa',name:'Alpha'},{id:'b',playerId:'pb',name:'Bravo'}]});assert.equal(h.s.replays.active.size,0);assert.equal(h.s.reports.death(h.b,{matchId:'match',target:'pa',category:'teaming'}).ok,true);
  h.s.replays.mark=()=>{throw Error('Recording unavailable');};h.s.enforce('manual',{players:[{id:'a',name:'Alpha'}],room:'ROOMTEST',matchId:'match',eventId:null,evidence:{source:'owner observation'},notes:[]},{automatic:false,reason:'Verified violation by the owner.'});assert.deepEqual(h.removed,['a']);assert.ok(h.s.status('a').until);assert.deepEqual(h.s.status('a').cups,[]);
 }finally{await h.close();}
});

test('host handoffs authorize the proven alias and owner without granting a recovering guest state authority',async()=>{
 const h=setup();try{
  const address='yolk-yard-v87-ABCD2345',alias={id:address},owner=h.peers.get('pa'),guest=h.peers.get('pb');h.peers.set(address,alias);h.room.host={peer:owner.id,address,id:owner.id};h.r.publicHost.roomFor=p=>p.id===address||h.room.members.has(p.id)?h.room:null;
  assert.equal(h.s.integrity.guard(alias,guest,{type:'snapshot-v1',frame:{}}),true);assert.equal(h.s.integrity.guard(owner,guest,{type:'welcome'}),true);assert.equal(h.s.integrity.guard(guest,owner,{type:'state'}),false);
  h.r.publicHost.roomFor=()=>null;owner.hostReady={address};alias.hostOwner=owner.id;
  assert.equal(h.s.integrity.guard(owner,guest,{type:'state'}),true,'Authenticated private ownership works before publication');assert.equal(h.s.integrity.guard(guest,owner,{type:'state'}),false);
  h.r.hostWatchdog.owners.set(owner.id,{peer:alias});delete owner.hostReady;assert.equal(h.s.integrity.guard(owner,guest,{type:'state'}),true,'Restored private ownership does not require a fresh client-ready message');
  alias.hostOwner=guest.id;assert.equal(h.s.integrity.guard(owner,guest,{type:'state'}),false,'A revoked private owner loses state authority');assert.deepEqual(h.removed,[]);
 }finally{await h.close();}
});

test('large built-world recordings split into readable bounded chunks without dropping match frames',async()=>{
 const h=setup();try{for(let time=0;time<=5;time+=.5){const snapshot=state(time,time===5?'results':'playing');snapshot.royale={matchId:'match',builds:Array.from({length:4096},(_,id)=>({id,x:id,y:0,z:0,type:'wall',material:'m'.repeat(100),owner:'p'.repeat(100),health:100}))};h.s.replays.capture('ROOMTEST','match',replayFrame(snapshot),{source:'server simulation'});}
  const meta=h.s.replays.summary('ROOMTEST','match'),record=h.s.replays.read({id:meta.id,count:6});assert.equal(meta.status,'complete');assert.ok(meta.chunks>=3);assert.equal(record.chunks.flatMap(c=>c.frames).length,11);assert.equal(record.chunks.at(-1).frames.at(-1).builds.length,4096);
 }finally{await h.close();}
});
