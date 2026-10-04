import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {safeProfile} from '../src/data.js';
const temp=await mkdtemp(tmpdir()+'/ravel-map-network-');
process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';
const app=await startRealtimeServer({host:'127.0.0.1',port:0,mapPath:temp+'/maps.json'}),nets=[];
globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){const end=Date.now()+12000;while(!fn()){assert.ok(Date.now()<end,label);await pause(20);}}
let sim,clock;
function client(name){const c={profile:safeProfile({name}),errors:[]};c.net=new Network({onState:s=>c.state=s,onError:e=>c.errors.push(e),getState:()=>sim?.snapshot(),getCheckpoint:()=>sim?.checkpoint(),onJoin:(id,p,a)=>!!sim?.admitPlayer(id,p,a),onInput:(id,i)=>sim?.setInput(id,i,true),onPlayerAction:(id,a)=>sim?.playerAction(id,a),onLeave:id=>sim?.leavePlayer(id)});nets.push(c.net);return c;}
const layout=(id,x)=>({format:1,mapId:id,objects:[{id:'network-wall',kind:'wall',name:'Network wall',position:[x,id==='sunnybreak'?50:3.2,0],rotation:0,scale:[1,1,1],collision:true}]});
try{
 await app.mapStore.update('sunnybreak',layout('sunnybreak',0),0,true);
 await app.mapStore.update('hatchery-atoll',layout('hatchery-atoll',40),0,true);
 const host=client('Workshop Host'),guest=client('Workshop Guest'),observer=client('Workshop Observer'),code=await host.net.host();
 sim=new RoyaleSimulation({capacity:4,bots:0,fill:false,teamSize:1,seed:8});sim.addPlayer('host',host.profile);sim.startRound();host.net.setVisibility('private');host.state=sim.snapshot();host.net.broadcast(host.state);
 clock=setInterval(()=>{sim.tick(1/60);host.state=sim.snapshot();host.net.broadcast(host.state);},1000/60);
 await guest.net.join(code,guest.profile);await observer.net.join(code,observer.profile);
 await wait(()=>[guest,observer].every(c=>c.state?.mapLayouts?.['hatchery-atoll']?.objects[0]?.position[0]===40),'Guests receive warmup layout');
 assert.equal(sim.beginBattle(),true);await wait(()=>[guest,observer].every(c=>c.state?.options.map==='sunnybreak'&&c.state.mapLayouts['sunnybreak'].objects[0].position[0]===0),'Guests receive pinned battle layout');
 await app.mapStore.update('sunnybreak',layout('sunnybreak',30),1,true);await pause(150);
 assert.equal(sim.map.editorObjects[0].position[0],0);assert.equal(guest.state.mapLayouts['sunnybreak'].objects[0].position[0],0);
 const restored=new RoyaleSimulation().restore(sim.checkpoint());assert.equal(restored.map.editorObjects[0].position[0],0,'Host migration retains old layout');
 const fresh=new RoyaleSimulation({capacity:4,bots:0,fill:false,seed:8});fresh.addPlayer('host',host.profile);fresh.addPlayer('second',guest.profile);fresh.startRound();assert.equal(fresh.beginBattle(),true);assert.equal(fresh.map.editorObjects[0].position[0],30,'New match gets published layout');
 const late=client('Workshop Late');await late.net.join(code,late.profile);await wait(()=>late.state?.mapLayouts?.['sunnybreak']?.objects[0].position[0]===0,'Late entrant gets running layout');
 assert.ok([host,guest,observer,late].every(c=>!c.errors.length));
 const publicMaps=await fetch(`http://127.0.0.1:${app.server.address().port}/maps`).then(r=>r.json());assert.equal(publicMaps.layouts['sunnybreak'].objects[0].position[0],30);
 await mkdir('test-results/map-editor',{recursive:true});await writeFile('test-results/map-editor/network.json',JSON.stringify({sockets:4,warmupAndBattle:true,pinnedDuringPublish:true,hostRecovery:true,newMatchPublished:true,lateEntrantPinned:true},null,2));
 console.log('PASS map editor: four sockets, warmup/battle replication, live publishing pins running games, late entrants and restored hosts retain the layout, new matches load the published map.');
}finally{clearInterval(clock);for(const net of nets)net.destroy();await app.close();await rm(temp,{recursive:true,force:true});}
