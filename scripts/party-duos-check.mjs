import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {VERSION,safeProfile} from '../src/data.js';
import {wonRoyale} from '../src/teams.js';
const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),url=`ws://127.0.0.1:${app.server.address().port}`,clients=[],games=[];
globalThis.window={YOLK_NETWORK:{relay:url+'/game'}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
const wait=async(fn)=>{const until=Date.now()+12000;while(!fn()){assert.ok(Date.now()<until,'Party check timed out');await new Promise(r=>setTimeout(r,15));}};
async function social(name){const c={profile:safeProfile({name}),requests:new Map(),serial:0,invites:[],launches:[]},ws=new globalThis.WebSocket(url+'/social');c.ws=ws;clients.push(c);
 ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:c.profile})));
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='hello'){c.id=m.id;c.token=m.token;}if(m.type==='party')c.party=m.party;if(m.type==='invite')c.invites.push(m.invite);if(m.type==='launch')c.launches.push(m.launch);if(m.type==='reply'){const p=c.requests.get(m.request);if(p){clearTimeout(p.timer);c.requests.delete(m.request);m.error?p.reject(Error(m.error)):p.resolve(m.result);}}});
 c.ask=(type,fields={})=>new Promise((resolve,reject)=>{const request=++c.serial,timer=setTimeout(()=>reject(Error('No party reply')),12000);c.requests.set(request,{resolve,reject,timer});ws.send(JSON.stringify({...fields,type,request}));});await wait(()=>c.party);return c;
}
function game(c,sim){const g={sim,state:null,errors:[]};g.net=new Network({onJoin:(id,p,a)=>!!sim?.admitPlayer(id,p,a),onRoster:ids=>sim?.setConnectedHumans(ids),onLeave:id=>sim?.leavePlayer(id),getCheckpoint:()=>sim?.checkpoint(),getChatState:()=>sim?.snapshot()||g.state,onState:s=>{g.state=s;},onError:e=>g.errors.push(e)});games.push(g);return g;}
try{
 const a=await social('Party Leader'),b=await social('Party Teammate'),c=await social('Party Solo');
 await a.ask('invite',{id:b.id});await wait(()=>b.invites.length);await b.ask('decline',{id:b.invites[0].id});assert.notEqual(a.party.id,b.party.id);
 await new Promise(r=>setTimeout(r,1510));await a.ask('invite',{id:b.id});await wait(()=>b.invites.length===2);await b.ask('accept',{id:b.invites[1].id});await wait(()=>a.party.members.length===2);
 assert.equal(a.party.id,b.party.id);assert.equal(a.party.selection.teamSize,2);
 await assert.rejects(b.ask('select',{mode:'ffa'}),/leader/);await assert.rejects(a.ask('select',{mode:'royale',teamSize:1}),/Duos/);
 await a.ask('select',{mode:'royale',teamSize:2,duoFill:true});await b.ask('ready',{value:true});
 await a.ask('queue',{custom:true,visibility:'private',options:{capacity:8,fill:true,bots:7}});await wait(()=>a.launches.length);
 const launch=a.launches[0],sim=new RoyaleSimulation(launch.options),host=sim.addPlayer('host',a.profile);sim.assignTeam(host,launch.admission);
 const ga=game(a,sim);await ga.net.host(launch.code);sim.startRound();ga.net.setVisibility('private');ga.net.broadcast(sim.snapshot());ga.net.publishRoom();await a.ask('host-ready',{id:launch.id});await wait(()=>b.launches.length);
 const gb=game(b);await gb.net.join(launch.code,b.profile,b.launches[0].ticket);await a.ask('joined',{id:launch.id});await b.ask('joined',{id:launch.id});await wait(()=>a.party.state==='playing');ga.net.broadcast(sim.snapshot());await wait(()=>gb.state?.royale);
 const mate=sim.players.get(gb.net.id);assert.equal(mate.team,host.team);assert.equal(sim.players.size,8);assert.equal(gb.state.royale.humanContestants,2);assert.equal(gb.state.royale.botContestants,6);assert.equal(gb.state.royale.queueEnds,sim.queueEnds);
 assert.equal(new Set([...sim.players.values()].map(p=>p.team)).size,4,'bots reconcile into full Duos');
 console.log('PASS live relay invite/decline/accept, leader controls, ready state, private custom party admission, bot replacement and shared countdown');
 await c.ask('select',{mode:'royale',teamSize:2,duoFill:false});await c.ask('queue',{code:launch.code,options:{fill:true}});await wait(()=>c.launches.length);
 const gc=game(c);await gc.net.join(launch.code,c.profile,c.launches[0].ticket);await c.ask('joined',{id:c.launches[0].id});const solo=sim.players.get(gc.net.id);assert.equal(solo.duoFill,false);assert.equal([...sim.players.values()].filter(p=>p.team===solo.team).length,1);
 sim.advanceWarmupClock(60);assert.equal(sim.stage,'battle-bus');ga.net.broadcast(sim.snapshot());await wait(()=>gb.state?.royale.stage==='battle-bus'&&gc.state?.royale.stage==='battle-bus');
 assert.equal(sim.events.filter(e=>e.type==='round').length,1);assert.equal(sim.players.get(gb.net.id).team,host.team);
 for(const p of sim.players.values())p.flight='ground';mate.shield=100;sim.damage(mate,host,200,'friendly');assert.equal(mate.shield,100);assert.equal(mate.health,100);
 sim.damage(mate,solo,500,'Test');assert.equal(mate.place,0);assert.equal(mate.spectating,true);assert.equal(sim.phase,'playing');
 for(const p of sim.players.values())if(p.team!==host.team)sim.damage(p,host,500,'Test');sim.finish();assert.equal(sim.phase,'results');assert.equal(host.place,1);assert.equal(mate.place,1);assert.ok(wonRoyale(sim.snapshot(),mate.id));
 ga.net.broadcast(sim.snapshot());await wait(()=>gb.state?.phase==='results');assert.ok(wonRoyale(gb.state,gb.net.id));assert.deepEqual(games.flatMap(g=>g.errors),[]);
 await a.ask('returned');await b.ask('leave');await wait(()=>a.party.members.length===1);assert.notEqual(a.party.id,b.party.id);
 console.log('PASS No Fill, shared Bus, friendly fire protection, teammate spectating, team victory/placement, party return and leave');
}finally{games.forEach(g=>g.net.destroy());clients.forEach(c=>c.ws.close());await app.close();}
