import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {safeProfile} from '../src/data.js';
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
globalThis.window={YOLK_NETWORK:{relay:'ws://127.0.0.1:9013/game'}};
const server=await startRealtimeServer({port:9013,host:'127.0.0.1'}),sim=new RoyaleSimulation({capacity:4,bots:0,fill:false,seed:910});sim.addPlayer('host',safeProfile({name:'Island Host'}));
let state,lateState,timer,inputTimer,seq=0,input={};
const merge=(s,old)=>{if(s.royale&&old?.royale)for(const key of ['loot','chests','builds','worldDamage'])if(!s.royale[key])s.royale[key]=old.royale[key];return s;};
const host=new Network({getCheckpoint:()=>sim.checkpoint(),getChatState:()=>sim.snapshot(),onJoin:(id,p)=>!!sim.admitPlayer(id,p),onInput:(id,i)=>sim.setInput(id,i,true),onPlayerAction:(id,a)=>sim.playerAction(id,a)});
const guest=new Network({onState:s=>state=merge(s,state)}),late=new Network({onState:s=>lateState=merge(s,lateState)});
const wait=async fn=>{const end=Date.now()+15000;while(!fn()){assert.ok(Date.now()<end,'Island synchronization timed out');await new Promise(r=>setTimeout(r,25));}};
try{
 const code=await host.host();host.broadcast(sim.snapshot());await guest.join(code,safeProfile({name:'Island Guest'}));sim.startRound();
 timer=setInterval(()=>{sim.tick(1/60);host.broadcast(sim.snapshot());},1000/60);inputTimer=setInterval(()=>guest.input({...input,seq:++seq}),1000/60);
 await wait(()=>state?.royale?.loot?.length>100);assert.deepEqual(state.royale.loot,sim.snapshot().royale.loot);assert.deepEqual(state.royale.chests,sim.snapshot().royale.chests);
 const chest=sim.chests.find(c=>c.y===sim.map.buildings[0].baseY),p=sim.players.get(guest.id),h=sim.players.get('host');assert.ok(chest);
 Object.assign(p,{x:chest.x,y:chest.y,z:chest.z,health:100,flight:'ground',grounded:true});Object.assign(h,{x:chest.x+1,y:chest.y,z:chest.z,health:100,flight:'ground',grounded:true});
 const reward=chest.contents[0].id;input={interact:true,slot:5};await wait(()=>chest.opened&&state.royale.chests.find(c=>c.id===chest.id)?.opened);input.interact=false;
 const before=sim.loot.length;assert.equal(sim.openChest(h,chest),false);assert.equal(sim.loot.length,before);
 const target=sim.loot.filter(i=>i.id===reward&&Math.hypot(i.x-chest.x,i.z-chest.z)<4).at(-1);assert.ok(target);Object.assign(p,{x:target.x,y:target.y,z:target.z});Object.assign(h,{x:target.x,y:target.y,z:target.z});
 // A fresh interaction arrives from the non-host; both attempts hit one authority.
 await new Promise(r=>setTimeout(r,100));input.interact=true;await wait(()=>p.inventory.some(i=>i?.id===reward));input.interact=false;assert.equal(sim.takeLoot(h,target),false);assert.ok(!sim.loot.includes(target));
 await wait(()=>guest.lastCheckpoint?.simulation?.lootVersion===sim.lootVersion);const restored=new RoyaleSimulation(sim.options).restore(guest.lastCheckpoint.simulation);
 assert.ok(!restored.loot.some(i=>i.uid===target.uid));assert.equal(restored.chests.find(c=>c.id===chest.id).opened,true);assert.deepEqual(restored.players.get(guest.id).inventory,p.inventory);
 const layout=JSON.stringify(sim.snapshot().royale.loot);await late.join(code,safeProfile({name:'Island Observer'}));await wait(()=>lateState?.royale?.loot?.length>100);assert.equal(JSON.stringify(sim.snapshot().royale.loot),layout);assert.equal(lateState.players.find(p=>p.id===late.id).spectating,true);assert.deepEqual(lateState.royale.loot,state.royale.loot);
 sim.phase='results';sim.startRound();await wait(()=>state.round===2&&lateState.round===2);assert.ok(state.royale.chests.every(c=>!c.opened));assert.notEqual(JSON.stringify(state.royale.loot),layout);assert.deepEqual(state.royale.loot,lateState.royale.loot);
 console.log('PASS real WebSocket host/guest loot identity, remote chest search, duplicate rejection, immediate recovery ownership, late spectator join and fresh synchronized rematch');
}finally{clearInterval(timer);clearInterval(inputTimer);late.destroy();guest.destroy();host.destroy();await server.close();}
