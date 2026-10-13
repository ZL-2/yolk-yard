import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {startRealtimeServer} from '../server/realtime/index.js';
import {Network} from '../src/network.js';
import {safeProfile} from '../src/data.js';
import {inventory} from '../src/building.js';
import {initializeOperations,tickOperations} from '../src/field-operations.js';
import {tickHealing} from '../src/progressive-healing.js';
import {RoyaleSimulation} from '../src/royale.js';
const temp=await mkdtemp(tmpdir()+'/ravel-frontline-');process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';
const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),nets=[],errors=[];
globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
async function wait(fn,label){const end=Date.now()+12000;while(!fn()){assert.ok(Date.now()<end,label);await new Promise(r=>setTimeout(r,20));}}
let s,clock,ga;
function client(name){const c={profile:safeProfile({name})};c.net=new Network({onState:state=>c.state=state,onError:e=>errors.push(e),getState:()=>s?.snapshot(),getCheckpoint:()=>s?.checkpoint(),onJoin:(id,p,a)=>!!s?.admitPlayer(id,p,a),onInput:(id,i)=>s?.setInput(id,i,true),onPlayerAction:(id,a)=>s?.playerAction(id,a),onLeave:id=>s?.leavePlayer(id)});nets.push(c.net);return c;}
async function broadcast(predicate,label){ga.state=s.snapshot();ga.net.broadcast(ga.state);await wait(predicate,label);}
try{
 ga=client('Frontline Pilot');const gb=client('Frontline Rival'),observer=client('Frontline Observer'),code=await ga.net.host();
 s=new RoyaleSimulation({capacity:4,bots:0,fill:false,seed:149});s.addPlayer('host',ga.profile);s.startRound();ga.net.setVisibility('private');ga.net.broadcast(s.snapshot());
 clock=setInterval(()=>{ga.state=s.snapshot();ga.net.broadcast(ga.state);},60);
 await gb.net.join(code,gb.profile);await observer.net.join(code,observer.profile);await wait(()=>s.players.size===3,'Three peers');
 assert.equal(s.beginBattle(),true);s.stage='active';s.map={theme:'royale',size:250,boxes:[],districts:[]};s.loot=[];s.chests=[];s.time=10;
 for(const p of s.players.values())Object.assign(p,{x:150,y:0,z:150,flight:'ground',grounded:true,shieldUntil:0,equipUntil:0});
 const p=s.players.get(ga.net.id),enemy=s.players.get(gb.net.id);p.x=p.z=0;enemy.x=2;enemy.z=0;
 initializeOperations(s);const u=s.operations.uplink={id:1,name:'Network station',x:0,y:0,z:0,status:'active',progress:0,team:null,expiresAt:105,lastOccupied:10};s.operations.nextAt=1000;s.operations.sequence=1;
 const step=n=>{for(let i=0;i<n*4;i++){s.time+=.25;tickOperations(s);}};
 step(2);assert.equal(u.progress,0);assert.equal(u.contested,true);
 await broadcast(()=>[ga,gb].every(g=>g.state?.royale.operations?.uplink?.contested),'Contested ring for both clients');
 enemy.x=100;step(7);await broadcast(()=>ga.state.royale.operations?.uplink?.progress>=7,'Replicated partial capture');
 const restored=new RoyaleSimulation().restore(s.checkpoint());assert.equal(restored.operations.uplink.progress,u.progress);
 step(8);assert.equal(u.status,'secured');await broadcast(()=>[ga,gb].every(g=>g.state?.royale.operations?.uplink?.status==='secured'),'Shared capture and cache');
 assert.equal(ga.state.players.find(o=>o.id===p.id).field.uplinks,1);assert.equal(gb.state.players.find(o=>o.id===enemy.id).field.uplinks,0);assert.ok(ga.state.royale.chests.some(c=>c.operation));
 p.inventory=inventory();p.inventory[1]={id:'medkit',count:2};p.slot=1;p.health=20;s.syncInventory(p);
 gb.net.input({seq:1,fire:true,slot:1});await wait(()=>s.inputs.get(enemy.id)?.seq===1,'Use command reaches authority');s.beginUse(p);s.time+=3;tickHealing(s,p);
 await broadcast(()=>[ga,gb,observer].every(g=>g.state?.players.find(o=>o.id===p.id)?.health===60),'Partial healing reaches local client');assert.equal(gb.state.players.find(o=>o.id===p.id).inventory[1].count,1);
 s.cancelUse(p,'damage');s.damage(p,enemy,10,'Rifle');await broadcast(()=>[ga,gb,observer].every(g=>g.state?.players.find(o=>o.id===p.id)?.health===50),'Interrupted recovery stays applied');assert.equal(ga.state.players.find(o=>o.id===p.id).use,null);
 const xp=p.field.xp;gb.net.send({type:'player-action',action:'field-order-damage'});await new Promise(r=>setTimeout(r,100));assert.equal(p.field.xp,xp,'Clients cannot award themselves field rewards');assert.deepEqual(errors,[]);
 console.log('PASS Frontline real sockets: contested capture, progress, cache, per-player medals, recovery checkpoint, partial healing, interruption, and rejected forged rewards.');
}finally{clearInterval(clock);nets.forEach(n=>n.destroy());await app.close();await rm(temp,{recursive:true,force:true});}
