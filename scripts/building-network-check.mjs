import assert from 'node:assert/strict';
import {startRealtimeServer} from '../server/realtime/index.js';
import WebSocket from 'ws';
import {Network} from '../src/network.js';
import {RoyaleSimulation} from '../src/royale.js';
import {safeProfile} from '../src/data.js';
import {applyBuildState,damageObject,rebuildMap} from '../src/building.js';
import {wallDistance} from '../src/physics.js';
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
globalThis.window={YOLK_NETWORK:{relay:'ws://127.0.0.1:9002/game'}};
const server=await startRealtimeServer({port:9002,host:'127.0.0.1'});
const sim=new RoyaleSimulation({mode:'royale',bots:31,capacity:32,fill:true});sim.addPlayer('host',safeProfile({name:'Builder Host'}));
let state,actionCount=0;
const host=new Network({getCheckpoint:()=>sim.checkpoint(),getChatState:()=>sim.snapshot(),onJoin:(id,p)=>!!sim.admitPlayer(id,p),onInput:(id,i)=>sim.setInput(id,i,true),onPlayerAction:(id,a)=>{actionCount++;sim.playerAction(id,a);}});
const guest=new Network({onState:s=>{if(s.royale&&!s.royale.builds&&state?.royale)s.royale={...s.royale,builds:state.royale.builds,worldDamage:state.royale.worldDamage};state=s;}});let timer,inputTimer;const wait=async fn=>{const end=Date.now()+15000;while(!fn()){assert.ok(Date.now()<end,'Timed out waiting for build synchronization');await new Promise(r=>setTimeout(r,25));}};
try{
 const code=await host.host();host.broadcast(sim.snapshot());await guest.join(code,safeProfile({name:'Guest Builder'}));sim.startRound();
 sim.map={size:256,theme:'royale',boxes:[]};sim.worldBoxes=[];sim.worldDamage={};sim.builds=[];sim.chests=[];sim.loot=[];
 sim.botInput=p=>({yaw:p.yaw,slot:0});
 for(const p of sim.players.values())Object.assign(p,{x:p.id==='host'?40:p.bot?80:0,y:0,z:p.bot?60:0,yaw:0,pitch:0,health:100,flight:'ground',grounded:true,slot:5,materials:{wood:100,brick:100,metal:100}});
 let seq=0,input={yaw:0,pitch:0,slot:5,buildMode:true,buildType:'wall',buildMaterial:'brick',fire:true};
 timer=setInterval(()=>{sim.tick(1/60);host.broadcast(sim.snapshot());},1000/60);
 inputTimer=setInterval(()=>guest.input({...input,seq:++seq}),1000/60);
 await wait(()=>sim.builds.length===1&&state?.royale?.builds?.length===1);input.fire=false;
 assert.equal(state.players.length,32);assert.equal(state.royale.queueEnds,60);
 const b=sim.builds[0],p=sim.players.get(guest.id);assert.equal(b.owner,guest.id);assert.equal(b.material,'brick');assert.equal(p.materials.brick,90);
 const change=mask=>guest.send({type:'player-action',action:'build-change:'+JSON.stringify({id:b.id,revision:b.revision||0,mask,path:[],yaw:0,pitch:0})});
 change(16);await wait(()=>state.royale.builds[0]?.mask===16);assert.equal(sim.builds[0].mask,16);
 const remote={size:256,boxes:[]};applyBuildState(remote,state.royale);assert.equal(wallDistance(remote,{x:0,y:2,z:0},{x:0,y:0,z:-1},9),9);
 let count=actionCount;change(511);await wait(()=>actionCount>count);assert.equal(b.mask,16);
 change(0);await wait(()=>state.royale.builds[0].mask===0);assert.ok(wallDistance(sim.map,{x:0,y:2,z:0},{x:0,y:0,z:-1},9)<9);
 const hp=b.health;b.owner='host';count=actionCount;change(16);await wait(()=>actionCount>count);assert.equal(b.mask,0);b.owner=guest.id;
 change(18);await wait(()=>state.royale.builds[0].mask===18);input.buildMode=false;p.z=-4;input.interact=true;
 await wait(()=>state.royale.builds[0].doorOpen);input.interact=false;
 applyBuildState(remote,state.royale);assert.equal(wallDistance(remote,{x:0,y:1,z:0},{x:0,y:0,z:-1},9),9);
 sim.worldBoxes=[{objectId:'test-tree',x:4,y:0,z:-4,w:1,h:4,d:1,material:'wood',kind:'tree'}];rebuildMap(sim);const bank=p.materials.wood;damageObject(sim,sim.worldBoxes[0],50,p);await wait(()=>state.players.find(v=>v.id===guest.id).materials.wood>bank);
 damageObject(sim,sim.map.boxes.find(v=>v.buildId),1000);await wait(()=>state.royale.builds.length===0);applyBuildState(remote,state.royale);assert.ok(!remote.boxes.some(v=>v.buildId));
 // Keep the guest's requested material stale during turbo input. Only the host
 // spends and chooses the next usable bank; none of the builds can be free.
 p.materials={wood:10,brick:10,metal:10};Object.assign(input,{buildMode:true,buildMaterial:'wood',fire:true,interact:false});p.z=0;
 for(let n=0;n<3;n++){p.x=n*8;await wait(()=>state.royale.builds.length===n+1);}
 input.fire=false;assert.deepEqual(sim.builds.map(b=>b.material),['wood','brick','metal']);await wait(()=>state.players.find(q=>q.id===guest.id).materials.metal===0);assert.deepEqual(p.materials,{wood:0,brick:0,metal:0});
 input.buildMode=false;p.inventory[5]={id:'mini',count:2,rarity:1};guest.send({type:'player-action',action:'inventory-swap-5-1'});await wait(()=>state.players.find(q=>q.id===guest.id).inventory[1]?.id==='mini');guest.send({type:'player-action',action:'inventory-swap-1-5'});await wait(()=>state.players.find(q=>q.id===guest.id).inventory[5]?.id==='mini');guest.send({type:'player-action',action:'inventory-drop-one-5'});await wait(()=>state.players.find(q=>q.id===guest.id).inventory[5]?.count===1);
 console.log('PASS 32-contestant guest snapshots, shared 60-second countdown, stale-input automatic material fallback and fifth-slot swaps/drops');
 console.log('PASS real relay guest placement, spending, legal/illegal/opponent edits, reset, door collision, harvesting and destruction snapshots');
}finally{clearInterval(timer);clearInterval(inputTimer);guest.destroy();host.destroy();await server.close();}
