// Repeatable host-simulation workload. Timings exclude rendering/networking and
// are comparison data, not a browser FPS guarantee. BOT_SOURCE selects a baseline.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(process.env.BOT_SOURCE||new URL('..',import.meta.url).pathname);
const load=p=>import(pathToFileURL(resolve(root,p)).href);
const [{RoyaleSimulation},{weapon},{inventory},{groundAt}]=await Promise.all([
 load('src/royale.js'),load('src/data.js'),load('src/building.js'),load('src/terrain.js')]);
const stats=values=>{const a=[...values].sort((a,b)=>a-b),at=p=>+(a[Math.min(a.length-1,Math.floor(a.length*p))]||0).toFixed(3);return {mean:+(a.reduce((a,b)=>a+b,0)/a.length).toFixed(3),min:at(0),p50:at(.5),p95:at(.95),p99:at(.99),max:at(1)};};
function arm(s,p,id='sprinter',rarity=1){p.inventory=inventory();p.inventory[1]={id,weapon:true,rarity,ammo:weapon(id).magazine};p.slot=1;p.bank={light:500,medium:500,shells:100,heavy:100,rockets:12};p.materials={wood:0,brick:0,metal:0};s.syncInventory(p);}
function room(seed,capacity=2){
 const s=new RoyaleSimulation({capacity,bots:capacity-1,fill:true,difficulty:2,seed,building:false}),h=s.addPlayer('host',{name:'Host'});s.startRound();s.beginBattle();s.stage='active';s.startedAt=s.time-60;s.supplyAt=9999;
 s.stormSteps=[{index:0,fromX:0,fromZ:0,fromRadius:600,x:0,z:0,radius:600,start:9999,closeAt:10000,end:20000,dps:0}];
 for(const p of [...s.players.values()])if(p.boss)s.players.delete(p.id);
 for(const p of s.players.values())Object.assign(p,{flight:'ground',grounded:true,health:100,shield:100,shieldUntil:0,lastDamage:-100,spectating:false,equipUntil:0});
 return {s,h};
}
function duel(seed,id,distance,moving=false){
 const {s,h}=room(seed),b=[...s.players.values()].find(p=>p.bot);s.map={id:'duel',size:500,boxes:[],floorLoot:[],landmarks:[],districts:[]};s.nav={path:()=>[]};s.worldBoxes=[];s.loot=[];s.chests=[];s.pads=[];s.relays=[];
 s.players.delete(b.id);b.id='opponent-'+seed;s.players.set(b.id,b);
 Object.assign(b,{x:0,y:0,z:0,yaw:0,pitch:0});Object.assign(h,{x:0,y:0,z:-distance,yaw:Math.PI,pitch:0});arm(s,b,id);let longest=0,idle=0,travel=0;
 for(let i=0;i<20*60;i++){
  const x=b.x,z=b.z;s.setInput(h.id,{seq:i+1,yaw:Math.PI,pitch:0,slot:0,strafe:moving?(Math.floor(i/180)%2?1:-1):0});s.tick(1/60);const d=Math.hypot(b.x-x,b.z-z);travel+=d;idle=d<.004?idle+1:0;longest=Math.max(longest,idle);
  if(h.health<=0)return {ttk:(i+1)/60,damage:200,travel,idle:longest/60};
 }
 return {ttk:20,damage:200-h.health-h.shield,travel,idle:longest/60};
}
const duels={};
for(const [id,distance,moving]of [['sprinter',12],['sprinter',28],['doubleyolk',7],['needle',35],['sprinter',28,true],['needle',35,true]]){
 const runs=Array.from({length:12},(_,i)=>duel(191+i*17,id,distance,moving));duels[id+'@'+distance+(moving?'-moving':'')]={ttk:stats(runs.map(r=>r.ttk)),damage:stats(runs.map(r=>r.damage)),longestIdle:stats(runs.map(r=>r.idle)),travel:stats(runs.map(r=>r.travel))};
}
function lobby(seed){
 const {s,h}=room(seed,48),times=[],aiTimes=[];let ai=0,calls=0,paths=0;const input=s.botInput.bind(s),path=s.nav.path.bind(s.nav);
 s.botInput=p=>{const start=performance.now(),result=input(p);ai+=performance.now()-start;calls++;return result;};s.nav={...s.nav,path:(...args)=>{paths++;return path(...args);}};
 for(const [i,p]of [...s.players.values()].entries()){const q=p.botLand||s.map.floorLoot[i%s.map.floorLoot.length];Object.assign(p,{x:q.x,y:q.y??groundAt(s.map,q.x,q.z),z:q.z,slot:0});if(i%2)arm(s,p);}
 for(let i=0;i<1800;i++){s.setInput(h.id,{seq:i+1,slot:0});ai=0;const start=performance.now();s.tick(1/60);times.push(performance.now()-start);aiTimes.push(ai);}
 return {tick:stats(times),ai:stats(aiTimes),calls,paths,alive:[...s.players.values()].filter(p=>p.health>0).length};
}
const report={source:root,duels,...(!process.env.BOT_DUELS_ONLY?{lobbies:[lobby(821),lobby(957),lobby(1183)]}:{})};console.log(JSON.stringify(report,null,2));
if(process.env.BOT_VALIDATE){
 for(const [key,result]of Object.entries(duels)){
  assert.ok(result.ttk.min>=3.5,key+' should leave a response window against full health/shield');
  assert.ok(result.ttk.p95<13,key+' should remain a credible threat');
  assert.ok(result.longestIdle.max<1.2,key+' should not stall in exposed combat');
  assert.ok(result.travel.min>6,key+' should use purposeful movement');
 }
}
