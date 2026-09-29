import test from 'node:test';import assert from 'node:assert/strict';import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';import {Network} from '../src/network.js';import {safeProfile} from '../src/data.js';
const until=async(fn)=>{const end=Date.now()+10000;while(!fn()){assert.ok(Date.now()<end,'Authority timeout');await new Promise(r=>setTimeout(r,20));}};
test('real sockets: server owns movement, teams, damage, revives, private markers and room continuity',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),nodes=[];
 globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 function node(name){const n={state:null,errors:[]};n.net=new Network({onState:s=>n.state=s,onError:e=>n.errors.push(e)});n.profile=safeProfile({name});nodes.push(n);return n;}
 try{
  const host=node('Field Alpha'),mate=node('Field Bravo'),enemy=node('Field Charlie');const code=await host.net.host();
  await host.net.createAuthority({mode:'royale',map:'sunnybreak',capacity:4,bots:0,fillBots:false,teamSize:2},host.profile,'public');
  await mate.net.join(code,mate.profile);await enemy.net.join(code,enemy.profile);await until(()=>enemy.state&&mate.state);
  const room=app.relay.authority.rooms.get(host.net.peer.id),sim=room.sim;assert.equal(host.state.network.authority,'server');assert.ok(sim.queueEnds-sim.time<=30);
  const h=sim.players.get('host'),m=sim.players.get(mate.net.id),e=sim.players.get(enemy.net.id);h.team=m.team=0;e.team=1;
  sim.beginBattle();sim.map={id:'yard',size:256,theme:'royale',boxes:[],terrain:null};sim.chests=[];sim.loot=[];
  for(const [i,p]of [h,m,e].entries())Object.assign(p,{x:i===2?30:i*1.5,y:0,z:0,flight:'ground',grounded:true,shieldUntil:0,shield:0});
  host.net.input({seq:1,crouch:true,dt:1/60});mate.net.input({seq:1,crouch:true,dt:1/60});await until(()=>h.crouching&&m.crouching);
  await until(()=>mate.state.players.find(p=>p.id==='host')?.crouching);assert.equal(host.state.players.find(p=>p.id===m.id).crouching,true);
  host.net.authorityCommand({type:'damage',target:e.id,amount:10000});mate.net.authorityCommand({type:'state',state:{players:[]}});await new Promise(r=>setTimeout(r,80));assert.equal(e.health,100);
  mate.net.send({type:'player-action',action:'ping-'+JSON.stringify({kind:'map',x:5,z:5,team:1})});await until(()=>host.state.royale.markers.length===1);assert.equal(enemy.state.royale.markers.length,0);
  sim.damage(h,e,200,'Sprinter');await until(()=>mate.state.players.find(p=>p.id==='host')?.downed);assert.equal(e.kills,0);
  // Only the server fixture accelerates time; clients have no fixture/control endpoint.
  for(let i=0;i<670;i++){sim.setInput(m.id,{seq:i+2,interact:true,dt:1/60},true);sim.tick(1/60);}assert.equal(h.downed,false);assert.equal(h.health,30);
  const socket=mate.net.peer.socket;socket.terminate();await until(()=>mate.net.peer.socket!==socket&&!mate.net.peer.reconnecting);await until(()=>mate.state.players.find(p=>p.id==='host')?.health===30);
  host.net.destroy();await until(()=>mate.net.isHost);assert.equal(room.owner,m.id);assert.equal(app.relay.authority.rooms.get(room.key),room);
  const late=node('Field Delta');await late.net.join(code,late.profile);await until(()=>late.state);assert.equal(late.state.network.authority,'server');assert.equal(late.state.network.hostId,m.id);
  assert.deepEqual(nodes.flatMap(n=>n.errors),[]);
 }finally{for(const n of nodes)n.net.destroy();await app.close();}
});
test('FFA and Team Scramble use server-owned entry, room controls and combat state',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),nets=[];
 globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 try{for(const mode of ['ffa','teams']){
  const host=new Network(),guest=new Network();nets.push(host,guest);const code=await host.host();await host.createAuthority({mode,map:'yard',bots:0},safeProfile({name:'Arena Captain'}),'private');await guest.join(code,safeProfile({name:'Arena Guest'}));
  const sim=app.relay.authority.rooms.get(host.peer.id).sim;guest.authorityCommand({type:'start'});await new Promise(r=>setTimeout(r,80));assert.equal(sim.phase,'lobby');host.authorityCommand({type:'start'});await until(()=>sim.phase==='playing');
  host.send({type:'player-action',action:mode==='teams'?'team-entry-0':'rejoin'});guest.send({type:'player-action',action:mode==='teams'?'team-entry-1':'rejoin'});await until(()=>[...sim.players.values()].every(p=>p.health>0));
  for(const n of [host,guest])n.input({seq:1,crouch:true,dt:1/60});await until(()=>[...sim.players.values()].every(p=>p.crouching));assert.equal([...sim.players.values()].some(p=>p.downed),false);
  host.destroy();guest.destroy();
 }}finally{for(const n of nets)n.destroy();await app.close();}
});
