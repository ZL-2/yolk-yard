import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {readFileSync} from 'node:fs';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {VERSION,safeProfile} from '../src/data.js';
const base='https://yolk-yard-relay.onrender.com',front='https://zl-2.github.io/yolk-yard',expected=process.env.GITHUB_SHA||process.env.RAVEL_VERIFY_BUILD,version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version;
const delay=ms=>new Promise(r=>setTimeout(r,ms)),users=[],games=[],errors=[];
const get=async url=>{const r=await fetch(url.endsWith('/version.json')?url+'?t='+Date.now():url,{signal:AbortSignal.timeout(12000),cache:'no-store'});assert.ok(r.ok,'Live endpoint unavailable');return r.json();};
async function wait(fn,label,ms=18000){const end=Date.now()+ms;while(!await fn()){assert.ok(Date.now()<end,label);await delay(30);}}
globalThis.window={YOLK_NETWORK:{relay:base.replace('https:','wss:')+'/game'}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io',agent:globalThis.RAVEL_SOCKET_AGENT});}};
async function user(name){
 const u={profile:safeProfile({name}),launches:[],pending:new Map(),serial:0},ws=new globalThis.WebSocket(base.replace('https:','wss:')+'/social');u.ws=ws;users.push(u);
 ws.on('error',e=>errors.push(e.message));ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:u.profile})));
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='hello')u.id=m.id;if(m.type==='party')u.party=m.party;if(m.type==='invite')u.invite=m.invite;if(m.type==='launch')u.launches.push(m.launch);if(m.type==='reply'){const p=u.pending.get(m.request);if(p){clearTimeout(p.timer);u.pending.delete(m.request);m.error?p.reject(Error(m.error)):p.resolve(m.result);}}});
 u.ask=(type,data={})=>new Promise((resolve,reject)=>{const request=++u.serial,timer=setTimeout(()=>{u.pending.delete(request);reject(Error('Live Social timeout: '+type));},12000);u.pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({type,...data,request}));});await wait(()=>u.party,'Live Social connection');return u;
}
let clock,sim;
async function launch(u){const l=u.launches.at(-1),g={};g.net=new Network({onState:s=>g.state=s,onError:e=>errors.push(e),getCheckpoint:()=>sim?.checkpoint(),getState:()=>sim?.snapshot(),onJoin:(id,p,a)=>!!sim?.admitPlayer(id,p,a),onLeave:id=>sim?.leavePlayer(id),onRoster:ids=>sim?.setConnectedHumans(ids),onPlayerAction:(id,a)=>sim?.playerAction(id,a),onInput:(id,i)=>sim?.setInput(id,i,true)});games.push(g);
 if(l.host){assert.equal(l.hostRun,true);assert.equal(l.visibility,'private');await g.net.host(l.code);sim=new RoyaleSimulation(l.options);const p=sim.addPlayer('host',u.profile);sim.assignTeam(p,l.admission);sim.startRound();g.net.setVisibility('private');g.net.broadcast(sim.snapshot());clock=setInterval(()=>{for(let i=0;i<3;i++)sim.tick(1/60);g.state=sim.snapshot();g.net.broadcast(g.state);},50);await u.ask('host-ready',{id:l.id});}
 else await g.net.join(l.code,u.profile,l.ticket);await u.ask('joined',{id:l.id});await wait(()=>g.state,'Live private state');return g;
}
try{
 let health,published;const end=Date.now()+300000;
 while(true){try{[health,published]=await Promise.all([get(base+'/health'),get(front+'/version.json')]);if(health.build===published.build&&(!expected||health.build===expected)&&health.gameVersion===VERSION&&published.appVersion===version&&health.deployment?.updating===false&&health.socialAvailable)break;}catch{}assert.ok(Date.now()<end,'Game and relay did not finish publishing');await delay(2000);}
 const before=health.capacity.rooms,tag=Date.now().toString(36).slice(-5),a=await user('QA Captain '+tag),b=await user('QA Mate '+tag),c=await user('QA Watch '+tag);
 await a.ask('invite',{id:b.id});await wait(()=>b.invite,'Live invite');await b.ask('accept',{id:b.invite.id});await b.ask('ready',{value:true});
 await a.ask('select',{mode:'royale',teamSize:4,teamFill:true});await b.ask('ready',{value:true});await a.ask('queue',{options:{capacity:8,fill:true,bots:6}});const host=await launch(a);await wait(()=>b.launches.length,'Live party launch');const mate=await launch(b);assert.equal(host.net.serverAuthority,undefined);assert.equal(sim.players.get('host').team,sim.players.get(mate.net.id).team);
 assert.ok(sim.beginBattle());assert.equal([...sim.players.values()].filter(p=>p.bot&&p.team===sim.players.get('host').team).length,2,'missing squad positions receive bot teammates');
 await c.ask('friend-send',{id:a.id});await a.ask('friend-accept',{id:c.id});assert.ok((await c.ask('social')).friends.find(p=>p.id===a.id)?.spectatable);await c.ask('spectate-friend',{id:a.id});await wait(()=>c.launches.length,'Live spectate launch');const viewer=await launch(c);await wait(()=>viewer.state.players.find(p=>p.id===viewer.net.id)?.friendSpectator,'Live spectator role');
 const watcher=sim.players.get(viewer.net.id);assert.equal(watcher.watchId,'host');assert.equal(watcher.health,0);assert.equal(watcher.contestant,false);viewer.net.send({type:'player-action',action:'rejoin'});await delay(250);assert.equal(watcher.health,0);
 const after=await get(base+'/health');assert.notEqual(mate.net.serverAuthority,true);assert.notEqual(viewer.net.serverAuthority,true);assert.equal(after.customMatches,'private-host');assert.equal(after.royaleMatches,'private-host');assert.deepEqual(after.serverModes,['ffa','teams']);assert.equal(after.teamBotRevision,1);assert.equal(after.friendSpectating,true);assert.equal(after.deployment.updating,false);assert.deepEqual(errors,[]);
 await c.ask('friend-remove',{id:a.id});console.log(JSON.stringify({result:'PASS',build:health.build,version,protocol:VERSION,privateHost:true,partyLaunch:true,botTeammates:2,friendSpectating:true,updateReady:true,serverRoomsBefore:before,serverRoomsAfter:after.capacity.rooms,socialStorage:after.socialStorage}));
}finally{clearInterval(clock);for(const g of games)g.net.destroy();if(users[2]?.ws.readyState===1&&users[0]?.id)await users[2].ask('friend-remove',{id:users[0].id}).catch(()=>{});for(const u of users){if(u.party&&u.ws.readyState===1)await u.ask('returned').catch(()=>{});u.ws.close();}}
