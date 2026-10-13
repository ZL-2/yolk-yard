import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {initializeOperations,tickOperations,advanceOrder,safeSupplyPoint,spawnSupply,OPERATIONS} from '../src/field-operations.js';
import {resetFieldRecord} from '../src/field-record.js';
import {tickHealing} from '../src/progressive-healing.js';
import {stormAt} from '../src/royale-data.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {invalidateCollision} from '../src/physics.js';
import {scoreScene,AdaptiveScore} from '../src/adaptive-score.js';
import {bulletPass} from '../src/sound-spatial.js';
import {weaponMotion} from '../src/weapon-motion.js';

function battle(flat=true){
 const s=new RoyaleSimulation({capacity:4,bots:0,seed:149}),p=s.addPlayer('pilot',{name:'Pilot'}),enemy=s.addPlayer('enemy',{name:'Rival'});
 s.startRound();assert.equal(s.beginBattle(),true);s.stage='active';s.time=10;
 if(flat)s.map={id:'flat',theme:'royale',size:200,boxes:[],districts:[]};
 for(const [i,a]of [p,enemy].entries())Object.assign(a,{x:i*40,y:0,z:0,health:100,shield:0,grounded:true,flight:'ground',spectating:false,connected:true,shieldUntil:0,equipUntil:0});
 return {s,p,enemy};
}
function uplink(s){s.operations.uplink={id:1,name:'Test station',x:0,y:0,z:0,status:'active',progress:0,team:null,expiresAt:s.time+95,lastOccupied:s.time};s.operations.sequence=1;s.operations.nextAt=1000;return s.operations.uplink;}
function step(s,seconds){for(let i=0;i<Math.round(seconds*4);i++){s.time+=.25;tickOperations(s);}}

test('hot drops upgrade two authored chests, retain floor rarity and change across seeds',()=>{
 const {s}=battle(false),hot=s.operations.hotspot;assert.ok(hot?.name);const upgraded=s.chests.filter(c=>c.hot);assert.equal(upgraded.length,2);
 for(const c of upgraded){assert.equal(c.poi,hot.id);assert.ok(c.epic&&!c.vaultId);assert.ok(c.contents[0].rarity>=3);assert.equal(c.contents.at(-1).id,'flask');}
 assert.ok(s.loot.filter(l=>l.weapon).every(l=>l.rarity<=2));
 const choices=new Set();for(let i=0;i<12;i++){initializeOperations(s);choices.add(s.operations.hotspot.id);}assert.ok(choices.size>2);
});
test('14-second uplinks pause under contention and award a single cache and participant medal',()=>{
 const {s,p,enemy}=battle(),u=uplink(s);step(s,5);const progress=u.progress;assert.ok(progress>=5&&progress<6);
 enemy.x=2;step(s,3);assert.equal(u.progress,progress);assert.equal(u.contested,true);
 enemy.x=40;step(s,10);assert.equal(u.status,'secured');assert.equal(p.field.uplinks,1);assert.equal(p.field.medals.find(m=>m.id==='uplink').count,1);
 step(s,3);assert.equal(s.chests.filter(c=>c.operation).length,1);assert.equal(s.events.filter(e=>e.type==='uplink-secured').length,1);
});
test('enemy takeover drains ownership first; empty areas decay after a grace period',()=>{
 const {s,p,enemy}=battle(),u=uplink(s);step(s,4);p.x=40;enemy.x=0;step(s,1);assert.equal(u.team,p.id);assert.ok(u.progress<4);
 step(s,3);assert.equal(u.team,enemy.id);assert.ok(u.progress>0);enemy.x=40;const held=u.progress;step(s,2);assert.equal(u.progress,held);step(s,5);assert.equal(u.progress,0);
});
test('wall cover, downed operators, vehicles, disconnections and spectators cannot capture',()=>{
 const {s,p}=battle(),u=uplink(s);p.x=4;s.map.boxes=[{x:2,y:0,z:0,w:.2,h:4,d:20}];step(s,1);assert.equal(u.progress,0);
 s.map.boxes=[];invalidateCollision(s.map);
 for(const patch of [{downed:true},{vehicleId:'atv'},{connected:false},{spectating:true},{grounded:false},{flight:'glide'}]){Object.assign(p,patch);step(s,1);assert.equal(u.progress,0);Object.assign(p,{downed:false,vehicleId:null,connected:true,spectating:false,grounded:true,flight:'ground'});}
 step(s,1);assert.ok(u.progress>0);
});
test('squad capture shares credit without multiplying capture speed',()=>{
 const {s,p,enemy}=battle();s.options.teamSize=2;p.team=enemy.team=0;enemy.x=2;const u=uplink(s);step(s,5);assert.ok(u.progress<6);step(s,10);assert.equal(p.field.uplinks,1);assert.equal(enemy.field.uplinks,1);
});
test('uplinks expire in the storm and new objectives use a bounded scan cadence',()=>{
 const {s,p}=battle(),u=uplink(s);tickOperations(s);const value=u.progress;for(let i=0;i<100;i++)tickOperations(s);assert.equal(u.progress,value);
 s.storm={active:true,x:100,z:100,radius:10};step(s,.5);assert.equal(s.operations.uplink,null);assert.equal(p.field.uplinks,0);
});
test('orders award capped supplies once, deliver a completion weapon, and ignore training',()=>{
 const {s,p}=battle();p.inventory[1]={id:'sprinter',weapon:true,count:1,ammo:10,rarity:1};p.bank.medium=999;p.materials.wood=990;
 advanceOrder(s,p,'scavenge',3);const n=s.loot.length;advanceOrder(s,p,'scavenge',3);assert.equal(s.loot.length,n);assert.equal(p.field.orders,1);assert.ok(p.bank.medium<999);assert.equal(p.materials.wood,999);
 advanceOrder(s,p,'damage',250);advanceOrder(s,p,'explore',3);assert.equal(p.field.orders,3);assert.equal(p.field.xp,700);assert.ok(s.loot.some(l=>l.weapon&&l.rarity>=3));
 initializeOperations(s);s.options.training=true;advanceOrder(s,p,'damage',999);assert.equal(p.field.orders,0);
});
test('district exploration counts unique districts and excludes flight',()=>{
 const {s,p}=battle();s.map.districts=[{id:'one',x:0,z:0},{id:'two',x:100,z:0},{id:'three',x:-100,z:0}];step(s,1);step(s,1);assert.equal(p.fieldOrders.find(o=>o.id==='explore').value,1);
 p.x=100;p.flight='glide';step(s,1);assert.equal(p.fieldOrders.find(o=>o.id==='explore').value,1);p.flight='ground';step(s,1);p.x=-100;step(s,1);assert.equal(p.fieldOrders.find(o=>o.id==='explore').complete,true);
});
test('supply drops predict the landing storm and do not spawn in the final tiny circle',()=>{
 const {s}=battle(false);s.elapsed=250;const future=stormAt(s.stormSteps,s.elapsed+35);
 for(let i=0;i<8;i++){const spot=safeSupplyPoint(s);assert.ok(spot);assert.ok(Math.hypot(spot.x-future.x,spot.z-future.z)<future.radius-12);}
 assert.equal(spawnSupply(s),true);assert.equal(s.chests.at(-1).landAt,s.time+18);assert.ok(s.chests.at(-1).contents[0].rarity>=3);
 s.elapsed=10000;assert.equal(safeSupplyPoint(s),null);assert.equal(spawnSupply(s),false);
});
test('trigger accuracy deduplicates pellets and shield/body hits, excludes friendlies and warmup',()=>{
 const {s,p,enemy}=battle();s.emit('shot',{player:p.id,shotId:17});s.emit('shot',{player:p.id,shotId:17});
 for(let i=0;i<8;i++)s.emit('hit',{player:p.id,target:enemy.id,amount:5,shotId:17,precision:true});assert.equal(p.field.shots,1);assert.equal(p.field.hits,1);assert.equal(p.field.critical,1);assert.equal(p.field.damage,40);
 s.options.teamSize=2;p.team=enemy.team=0;s.emit('hit',{player:p.id,target:enemy.id,amount:40,shotId:18});assert.equal(p.field.damage,40);s.stage='spawn-island';s.emit('shot',{player:p.id,shotId:19});assert.equal(p.field.shots,1);
});
test('combat medals honor first strike, eight-second chains and capped repeat rewards',()=>{
 const {s,p,enemy}=battle();p.health=20;enemy.x=50;
 for(let i=0;i<8;i++){s.emit('elimination',{player:p.id,target:enemy.id});s.time++;}
 assert.equal(p.field.medals.find(m=>m.id==='first').count,1);assert.equal(p.field.medals.find(m=>m.id==='double').count,1);assert.equal(p.field.medals.find(m=>m.id==='triple').count,1);assert.equal(p.field.medals.find(m=>m.id==='clutch').count,5);
 resetFieldRecord(p);s.fieldFirstElim=null;enemy.bot=true;s.emit('elimination',{player:enemy.id,target:p.id});s.emit('elimination',{player:p.id,target:enemy.id});assert.ok(!p.field.medals.some(m=>m.id==='first'));
});
test('trauma kit setup can cancel freely; interrupted recovery consumes exactly one kit',()=>{
 const {s,p,enemy}=battle();p.slot=1;p.health=20;p.inventory[1]={id:'medkit',count:2};s.beginUse(p);s.time+=.8;tickHealing(s,p);s.cancelUse(p);assert.equal(p.health,20);assert.equal(p.inventory[1].count,2);
 s.beginUse(p);s.time+=3.5;tickHealing(s,p);assert.equal(p.health,70);assert.equal(p.inventory[1].count,1);assert.equal(p.field.healing,50);
 s.damage(p,enemy,10,'Rifle');assert.equal(p.use,null);assert.equal(p.health,60);assert.equal(p.inventory[1].count,1);
});
test('shield flask partial recovery survives cancel, full recovery cleans the slot, malformed timers cannot heal',()=>{
 const {s,p}=battle();p.slot=1;p.shield=0;p.inventory[1]={id:'flask',count:1};s.beginUse(p);s.time+=2.4;tickHealing(s,p);assert.ok(Math.abs(p.shield-25)<1e-8);s.cancelUse(p);assert.equal(p.inventory[1],null);assert.ok(Math.abs(p.shield-25)<1e-8);
 p.inventory[1]={id:'flask',count:1};p.shield=90;s.beginUse(p);s.time+=4;s.finishUse(p);assert.equal(p.shield,100);assert.equal(p.inventory[1],null);assert.equal(p.use,null);
 p.health=50;p.inventory[1]={id:'medkit',count:1};p.use={id:'medkit',slot:1};tickHealing(s,p);assert.equal(p.health,50);assert.equal(p.use,null);assert.equal(p.inventory[1].count,1);
});
test('orders, capture ownership and partial healing survive detached wire deltas and host recovery',()=>{
 const {s,p}=battle(false);p.slot=1;p.health=20;p.inventory[1]={id:'medkit',count:2};s.beginUse(p);s.time+=2;tickHealing(s,p);const health=p.health;uplink(s);s.operations.uplink.progress=4;advanceOrder(s,p,'scavenge',2);
 const enc=new SnapshotEncoder(),dec=new SnapshotDecoder(),wire=dec.decode(JSON.parse(JSON.stringify(enc.encode({state:s.snapshot(),checkpoint:s.checkpoint()}).frame)));
 const row=wire.state.players.find(o=>o.id===p.id);assert.equal(row.fieldOrders[0].value,2);assert.equal(row.use.consumed,true);row.field.medals.push({id:'fake'});wire.state.royale.operations.uplink.progress=99;assert.equal(p.field.medals.length,0);assert.equal(s.operations.uplink.progress,4);
 const restored=new RoyaleSimulation().restore(s.checkpoint()),q=restored.players.get(p.id);restored.time+=1;tickHealing(restored,q);assert.equal(q.health,health+20);assert.equal(q.inventory[1].count,1);assert.equal(restored.operations.uplink.progress,4);
 p.field.damage=75;const delta=dec.decode(JSON.parse(JSON.stringify(enc.encode({state:s.snapshot()}).frame)));assert.equal(delta.state.players.find(o=>o.id===p.id).field.damage,75);
 s.phase='results';s.startRound();assert.equal(s.operations,null);s.beginBattle();assert.equal(p.field.damage,0);assert.equal(p.fieldOrders[0].value,0);
});
test('near misses require a forward ear-level passing trajectory and respect hitscan obstruction',()=>{
 const ear={x:0,y:0,z:0},shot={origin:{x:1,y:1.5,z:-20},shots:[{vx:0,vy:0,vz:100}]};assert.ok(bulletPass(shot,ear));
 assert.equal(bulletPass({...shot,shots:[{vx:0,vy:0,vz:-100}]},ear),null);assert.equal(bulletPass({...shot,origin:{x:8,y:1.5,z:-20}},ear),null);assert.equal(bulletPass({...shot,shots:[{end:{x:1,y:1.5,z:-5}}]},ear),null);
});
test('adaptive score selects match scenes, reserves combat headroom, and stops on pause/mute',()=>{
 const p={health:100,x:0,z:0,flight:'ground'},state={phase:'playing',royale:{stage:'active',alive:20,operations:{uplink:null}}};
 assert.equal(scoreScene(state,p,0,10),'exploration');state.royale.operations.uplink={status:'active',x:10,z:0};assert.equal(scoreScene(state,p,0,10),'objective');assert.equal(scoreScene(state,p,12,10),'combat');state.royale.alive=4;assert.equal(scoreScene(state,p,0,10),'final');p.flight='dive';assert.equal(scoreScene(state,p,0,10),'deployment');state.royale.stage='spawn-island';assert.equal(scoreScene(state,p,0,10),'silent');
 const levels=[],s={clock:0,ctx:{currentTime:0},volume:1,musicVolume:.4,enabled:true,voices:new Set(),scoreBus:{gain:{setTargetAtTime:v=>levels.push(v)}},layer(){return {stop(){this.stopped=true;}};}},score=new AdaptiveScore(s);state.royale.stage='active';
 for(let i=0;i<500;i++){s.clock=s.ctx.currentTime=i/60;score.update(state,p,true);assert.ok(score.voices.size<=12);}score.activity();score.update(state,p,true);assert.equal(levels.at(-1),.4*.22);const voices=[...score.voices];score.update(state,p,false);assert.ok(voices.every(v=>v.stopped));assert.equal(score.scene,'silent');s.musicVolume=0;score.update(state,p,true);assert.equal(score.voices.size,0);
 s.musicVolume=.3;s.voices=new Set(Array.from({length:36},(_,i)=>i));score.update(state,p,true);assert.equal(score.voices.size,0);
});
test('weapon motion blends landing and turning, remains bounded at low FPS and honors reduced motion',()=>{
 const s={},p={yaw:0,pitch:0,vx:5,vz:-5,vy:-12,grounded:false};weaponMotion(s,p,1/60,0,0,{},'one');p.grounded=true;
 const land=weaponMotion(s,p,1/60,1,0,{},'one');assert.ok(land.y<0);p.yaw=2;
 for(let i=0;i<200;i++){const m=weaponMotion(s,p,.1,i,0,{},'one');assert.ok(Object.values(m).every(v=>Number.isFinite(v)&&Math.abs(v)<.15));}
 const none=weaponMotion(s,p,.016,10,0,{reducedMotion:true},'one');assert.ok(Object.values(none).every(v=>v===0));
 const fresh=weaponMotion(s,{...p,vx:0,vz:0},.016,0,1,{},'two');assert.ok(Math.abs(fresh.y)<.002);
});
