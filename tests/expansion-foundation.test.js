import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {inventory} from '../src/building.js';
import {movePlayer,canStand,invalidateCollision,humanHit,rayBox,worldHit} from '../src/physics.js';
import {predictMovement,predictionCopy} from '../src/guest-movement.js';
import {resetStance,canFight,regionPose} from '../src/stance.js';
import {recordCombatDamage,combatRecap,CombatConfirmation,DamageDirections,RECAP_LIMIT} from '../src/combat-feedback.js';
import {sanitizeSlotPreferences,vacantSlot,targetLoot,stackCapacity,healingSuggestion,weaponComparison} from '../src/inventory-policy.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {buildingTick} from '../src/building.js';
import {armPose,ARM_POSES} from '../src/arms.js';
import {reloadSequence} from '../src/firearm-audio.js';
import {GuestFire} from '../src/guest-fire.js';
import {prepareRevive,downPlayer} from '../src/team-survival.js';

const flat=()=>({id:'flat',theme:'royale',size:100,boxes:[],floorLoot:[],landmarks:[],districts:[]});
function runner(){const p={id:'host',name:'Host',health:100,shield:0,x:0,y:0,z:0,yaw:0,pitch:0,vx:0,vy:0,vz:0,grounded:true,flight:'ground',inventory:inventory(),slot:1,weapon:'sprinter',contestant:true,spectating:false,shieldUntil:0};resetStance(p);p.inventory[1]={id:'sprinter',weapon:true,rarity:0,ammo:30,count:1};return p;}
function room(){const s=new RoyaleSimulation({capacity:4,bots:0,fill:false,seed:142}),p=s.addPlayer('host',{name:'Host'}),a=s.addPlayer('a',{name:'Alpha'}),b=s.addPlayer('b',{name:'Bravo'});Object.assign(s,{phase:'playing',stage:'active',time:100,startedAt:0,alive:3,map:flat(),worldBoxes:[],relays:[],bossCaches:[],chests:[],loot:[]});for(const q of [p,a,b]){const{id,name}=q;Object.assign(q,runner(),{id,name,lastDamage:-100,equipUntil:0,bank:{medium:100,light:100,shells:20,heavy:10,rockets:2},materials:{wood:0,brick:0,metal:0}});}a.x=10;b.x=15;return {s,p,a,b};}
const step=(p,input,map,dt=1/60,predict=false)=>predict?predictMovement(p,input,map,dt,{stage:'active'},100):movePlayer(p,input,map,dt);

test('combat recap accounts shield and health exactly once across multiple attackers',()=>{
 const{s,p,a,b}=room();p.shield=100;s.damage(p,a,60,'Rifle',false,'a1');s.time+=1;s.damage(p,b,60,'SMG',false,'b1');s.time+=1;s.damage(p,a,80,'Rifle',true,'a2');
 assert.equal(p.health,0);assert.equal(p.recap.totalDamage,200);assert.equal(p.recap.damage,80);assert.equal(p.recap.attackers,2);assert.equal(p.recap.critical,true);assert.equal(p.recap.sources.length,2);assert.equal(p.recap.sources[0].damage,140);
 assert.equal(s.events.filter(e=>e.type==='hit'&&e.shieldBreak).length,1);assert.equal(a.kills,1);assert.equal(b.assists,1);
});
test('shield-only damage contributes to assists, and old shield damage does not',()=>{
 for(const elapsed of [2,13]){const{s,p,a,b}=room();p.shield=100;s.damage(p,b,20,'SMG');assert.equal(p.health,100);s.time+=elapsed;s.damage(p,a,1000,'Rifle');assert.equal(b.assists||0,elapsed<12?1:0);}
});
test('death recap identifies the finishing damage source while preserving original knock credit',()=>{
 for(const source of ['Pistol','Bleed out']){const{s,p,a,b}=room();p.downed=true;p.knockedBy=b.id;p.health=40;s.damage(p,source==='Pistol'?a:null,50,source);assert.equal(b.kills,1);assert.equal(a.kills,0);assert.equal(p.killerId,b.id);assert.equal(p.recap.name,source==='Pistol'?a.name:'Bleed out');assert.equal(p.recap.distance,source==='Pistol'?10:0);assert.equal(p.recap.weapon,source);assert.equal(p.recap.damage,40);}
});
test('history expires, coalesces storm ticks, bounds sources and rejects invalid damage',()=>{
 const p=runner(),a={id:'a',name:'Alpha'};for(let i=0;i<1800;i++)recordCombatDamage(p,null,1/60,'Storm',i/60);assert.ok(p.combatHistory.length<=RECAP_LIMIT);assert.ok(Math.abs(combatRecap(p,30,{}).totalDamage-12)<=1,'continuous storm does not retain damage older than the recap window');
 for(let i=0;i<80;i++)recordCombatDamage(p,{...a,id:'a'+i},2,'Rifle',10+i/10);assert.ok(p.combatHistory.length<=RECAP_LIMIT);
 assert.equal(combatRecap(p,40,{}).totalDamage,0);
 const{s,p:q,a:r}=room();for(const amount of [NaN,Infinity,-Infinity,-1,0])s.damage(q,r,amount,'Forged');assert.equal(q.health,100);assert.equal(q.shield,0);
 resetStance(p);assert.deepEqual(p.combatHistory,[]);assert.equal(p.recap,null);
});
test('recap and history survive wire snapshots and migration without exposing per-tick history',()=>{
 const{s,p,a}=room();s.damage(p,a,10,'Rifle');const restored=new RoyaleSimulation().restore(s.checkpoint());assert.deepEqual(restored.players.get(p.id).combatHistory,p.combatHistory);
 s.damage(p,a,1000,'Rifle');const packet=new SnapshotDecoder().decode(JSON.parse(JSON.stringify(new SnapshotEncoder().encode({state:s.snapshot()}).frame))).state;
 const guest=packet.players.find(q=>q.id===p.id);assert.deepEqual(guest.recap,p.recap);assert.equal(guest.combatHistory,undefined);
});
test('confirmation prioritizes shield breaks, knocks and eliminations over split hit events',()=>{
 const f=new CombatConfirmation(),hit={type:'hit',player:'me',target:'other',amount:20,shotId:'shot',id:1};
 f.accept(hit,'me',100);f.accept({...hit,id:2,shield:true,shieldBreak:true},'me',100);assert.equal(f.takeSound(),'break');
 f.accept({...hit,type:'elimination',id:3},'me',100);f.accept({...hit,id:4,precision:true},'me',100);assert.equal(f.kind,'elimination');assert.equal(f.takeSound(),'elimination');
 f.accept({...hit,id:4,precision:true},'me',105);assert.equal(f.takeSound(),null,'replayed damage does not repeat sound');
 f.accept({...hit,player:'other',target:'me'},'me',110);assert.equal(f.takeSound(),null);
 f.accept({...hit,type:'knocked',id:8},'me',300);assert.equal(f.kind,'knock');f.reset();assert.equal(f.until,0);
});
test('direction indicators reuse five nodes, merge split hits, and clear on departure',()=>{
 const root={nodes:[],ownerDocument:{createElement:()=>({dataset:{},style:{}})},append(n){this.nodes.push(n);}},v=new DamageDirections(root);
 for(let i=0;i<60;i++){v.hit({player:'a'+i,sourceX:i,sourceZ:2,shield:i%2===0},i*10);v.update(runner(),0,i*10);}
 assert.equal(root.nodes.length,5);assert.equal(v.rows.length,5);v.hit({player:'a59',sourceX:59,sourceZ:2,shieldBreak:true},600);assert.equal(v.rows.length,5);assert.equal(v.rows.at(-1).kind,'break');
 v.update(runner(),0,3000);assert.ok(root.nodes.every(n=>n.hidden));v.reset();assert.equal(v.rows.length,0);
});

test('preferred slots are bounded and never reorder an occupied manual loadout',()=>{
 const p=runner();p.pickupPreferences=sanitizeSlotPreferences({shotgun:2,rifle:99,healing:4,mobility:'3',extra:1});
 assert.deepEqual(p.pickupPreferences,{shotgun:2,rifle:0,healing:4,mobility:0});assert.equal(vacantSlot(p,{id:'scatter',weapon:true}),2);p.inventory[2]={id:'mini',count:3};assert.equal(vacantSlot(p,{id:'scatter',weapon:true}),3);
 const{s,p:q}=room();s.playerAction(q.id,'inventory-preferences:'+JSON.stringify({shotgun:5,healing:4}));assert.equal(q.pickupPreferences.shotgun,5);
 s.playerAction(q.id,'inventory-preferences:{');assert.equal(q.pickupPreferences.shotgun,5);
});
test('pickup merges all partial stacks without swapping a weapon and retains overflow',()=>{
 const{s,p}=room();p.inventory[2]={id:'mini',count:4};p.inventory[3]={id:'mini',count:5};p.inventory[4]={id:'medkit',count:2};p.inventory[5]={id:'flask',count:3};
 const gun=p.inventory[1],item=s.dropLoot(p,{id:'mini',count:6,rarity:1});assert.equal(stackCapacity(p,item),3);assert.equal(s.takeLoot(p,item),true);assert.equal(p.inventory[2].count,6);assert.equal(p.inventory[3].count,6);assert.equal(p.inventory[1],gun);assert.equal(item.count,3);assert.ok(s.loot.includes(item));
});
test('new guns use empty preferred slots and full inventories still swap exactly once',()=>{
 const{s,p}=room();p.pickupPreferences={shotgun:4};const item=s.dropLoot(p,{id:'scatter',weapon:true,count:1,ammo:6,rarity:2});assert.equal(s.takeLoot(p,item),true);assert.equal(p.inventory[4].id,'scatter');assert.equal(s.loot.includes(item),false);
 for(let i=2;i<=5;i++)p.inventory[i]??={id:'mini',count:6};const replacement=s.dropLoot(p,{id:'zipper',weapon:true,count:1,ammo:30,rarity:1});assert.equal(s.takeLoot(p,replacement),true);assert.equal(p.inventory[1].id,'zipper');assert.equal(s.loot.filter(i=>i.id==='sprinter').length,1);
});
test('oversized loot stacks fill multiple empty slots without deleting excess',()=>{
 const{s,p}=room();p.pickupPreferences={healing:4};const item=s.dropLoot(p,{id:'mini',count:30,rarity:1});s.takeLoot(p,item);for(let i=2;i<=5;i++)assert.equal(p.inventory[i].count,6);assert.equal(item.count,6);assert.ok(s.loot.includes(item));
});
test('inventory synchronization reuses simulation arrays without aliasing snapshots',()=>{
 const{s,p}=room();s.syncInventory(p);const ammo=p.ammo,reserve=p.reserve,snapshot=s.snapshot().players.find(q=>q.id===p.id);p.inventory[1].ammo=4;p.bank.medium=90;s.syncInventory(p);assert.equal(p.ammo,ammo);assert.equal(p.reserve,reserve);assert.equal(p.ammo[1],4);assert.equal(p.reserve[1],90);assert.equal(snapshot.ammo[1],30);assert.equal(snapshot.reserve[1],100);
});
test('crosshair targeting is deterministic, honors visibility and prefers aimed loot over side clutter',()=>{
 const p=runner(),front={uid:'front',x:0,y:0,z:-2},side={uid:'side',x:1,y:0,z:0},back={uid:'back',x:0,y:0,z:1};
 assert.equal(targetLoot([side,back,front],p),front);assert.equal(targetLoot([front,side,back],p,i=>i!==front),side);
 const identical={...front,uid:'a'};assert.equal(targetLoot([front,identical],p),identical);assert.equal(targetLoot([identical,front],p),identical);
});
test('loot comparisons use live rarity balance and healing help respects item caps and combat',()=>{
 const p=runner();p.health=60;p.shield=50;p.lastDamage=0;p.inventory[2]={id:'bandage',count:2};p.inventory[3]={id:'mini',count:2};
 assert.deepEqual(healingSuggestion(p,10),{slot:2,label:'Health available'});p.health=80;assert.equal(healingSuggestion(p,10),null);p.inventory[4]={id:'flask',count:2};assert.equal(healingSuggestion(p,10).slot,4);p.lastDamage=9;assert.equal(healingSuggestion(p,10),null);
 const compare=weaponComparison({id:'scatter',weapon:true,rarity:4},{id:'scatter',weapon:true,rarity:1});assert.ok(compare.stats.damage>compare.previous.damage);assert.ok(compare.stats.reload<compare.previous.reload);
});
test('splash healing advice describes the missing vital and pickaxe selection explains a cancelled use',()=>{
 const{s,p}=room();p.inventory[1]=null;p.inventory[2]={id:'splash',count:2};p.health=60;p.shield=100;p.lastDamage=-100;assert.deepEqual(healingSuggestion(p,s.time),{slot:2,label:'Health available'});p.health=100;p.shield=60;assert.deepEqual(healingSuggestion(p,s.time),{slot:2,label:'Shield available'});
 p.use={id:'medkit'};s.playerAction(p.id,'inventory-select-0');assert.equal(p.use,null);assert.equal(p.slot,0);assert.equal(s.events.at(-1).cue,'use-cancel');assert.equal(s.events.at(-1).reason,'swap');
});
test('item cancellation explains damage, sprint and swapping without cancelling storm use',()=>{
 const{s,p,a}=room();p.health=50;p.inventory[1]={id:'medkit',count:2};s.beginUse(p);s.damage(p,null,1,'Storm');assert.ok(p.use);s.damage(p,a,1,'Rifle');assert.equal(s.events.at(-2)?.reason||s.events.find(e=>e.cue==='use-cancel')?.reason,'damage');
 s.beginUse(p);s.cancelUse(p,'sprint');assert.equal(s.events.at(-1).reason,'sprint');s.beginUse(p);s.cancelUse(p,'arbitrary');assert.equal(s.events.at(-1).reason,'action');
});
test('search keeps its reachable chest while aim changes and completes once',()=>{
 const{s,p}=room();const a={id:'a',x:0,y:0,z:-2,opened:false,contents:[]},b={id:'b',x:2,y:0,z:0,opened:false,contents:[]};s.chests=[a,b];
 for(let i=0;i<3;i++)s.interact(p,{interact:true},.1);assert.equal(p.chestId,'a');p.yaw=-Math.PI/2;for(let i=0;i<6;i++)s.interact(p,{interact:true},.1);assert.equal(a.opened,true);assert.equal(b.opened,false);assert.equal(s.events.filter(e=>e.cue==='chest-open').length,1);
});

test('mantling and low vaulting complete through shared host/guest collision at several frame rates',()=>{
 for(const height of [.8,1.5])for(const dt of [1/60,1/30,1/20]){
  const map=flat();map.boxes=[{x:0,y:0,z:height<1?-1.3:-1.4,w:3,h:height,d:height<1? .4:2}];
  const p=runner(),guest=structuredClone(p);for(let i=0;i<Math.ceil(.55/dt);i++){const input={forward:i===0?1:0,jump:i===0};step(p,input,map,dt);step(guest,input,map,dt,true);assert.ok(canStand(map,p));assert.equal(guest.z,p.z);assert.equal(guest.y,p.y);if(i===0)assert.equal(p.mantle?.kind,height<1?'vault':'mantle');}
  assert.equal(p.mantle,null);assert.ok(p.z<-.5);assert.equal(p.fall?.immune||false,false);assert.equal(canFight(p),true);
 }
});
test('mantle rejects blocked headroom, tall walls, revives and Mythic motion, with no wall teleport',()=>{
 for(const scenario of ['ceiling','tall','revive','shadowstep']){
  const p=runner(),map=flat();map.boxes=[{x:0,y:0,z:-1,w:3,h:scenario==='tall'?3:1.4,d:.5}];
  if(scenario==='ceiling')map.boxes.push({x:0,y:2,z:-.8,w:4,h:1,d:5});if(scenario==='revive')p.reviving='friend';if(scenario==='shadowstep')p.shadowstep={remaining:0};
  step(p,{jump:true,forward:1},map);assert.ok(!p.mantle,scenario);assert.ok(p.z>-.5,scenario);
 }
 const p=runner(),map=flat();map.boxes=[{x:0,y:0,z:-1.4,w:3,h:1.5,d:2}];step(p,{jump:true,forward:1},map);assert.ok(p.mantle);assert.equal(canFight(p),false);
 map.boxes.push({x:0,y:2,z:-1,w:4,h:2,d:4});invalidateCollision(map);for(let i=0;i<40;i++)step(p,{},map);assert.ok(!p.mantle);assert.ok(p.z>=0);assert.ok(canStand(map,p));
});
test('jump buffer catches a near-ground press but expires and does not auto-bunnyhop',()=>{
 const p=runner(),map=flat();Object.assign(p,{grounded:false,y:.01,vy:-1});step(p,{jump:true},map);assert.equal(p.grounded,true);step(p,{jump:false},map);assert.ok(p.vy>0);
 for(let i=0;i<120;i++)step(p,{jump:true},map);assert.equal(p.grounded,true);assert.equal(p.jumpBuffer,0);
 const q=runner();Object.assign(q,{grounded:false,y:5,vy:0});step(q,{jump:true},map);for(let i=0;i<120;i++)step(q,{},map);assert.equal(q.grounded,true);assert.equal(q.vy,0);
});
test('mantle snapshot and checkpoint resume without changing the path',()=>{
 const{s,p}=room();s.map.boxes=[{x:0,y:0,z:-1.4,w:3,h:1.5,d:2}];step(p,{jump:true,forward:1},s.map);assert.ok(p.mantle);
 const guest=new SnapshotDecoder().decode(JSON.parse(JSON.stringify(new SnapshotEncoder().encode({state:s.snapshot()}).frame))).state.players.find(q=>q.id===p.id),restored=new RoyaleSimulation().restore(s.checkpoint()).players.get(p.id);
 for(let i=0;i<40;i++){step(p,{},s.map);step(guest,{},s.map);step(restored,{},s.map);}for(const q of [guest,restored])for(const k of ['x','y','z','grounded'])assert.equal(q[k],p[k]);
});
test('snapshots own mantle progress independently from later simulation steps',()=>{
 const{s,p}=room();s.map.boxes=[{x:0,y:0,z:-1.4,w:3,h:1.5,d:2}];step(p,{jump:true,forward:1},s.map);const snapshot=s.snapshot().players.find(q=>q.id===p.id),elapsed=snapshot.mantle.elapsed;step(p,{},s.map);assert.equal(snapshot.mantle.elapsed,elapsed);assert.notEqual(snapshot.mantle,p.mantle);assert.notEqual(snapshot.mantle.to,p.mantle.to);
});
test('production guest copies cannot mutate authoritative traversal during reconciliation',()=>{
 const{s,p}=room();s.map.boxes=[{x:0,y:0,z:-1.4,w:3,h:1.5,d:2}];step(p,{jump:true,forward:1},s.map);const authoritative=s.snapshot().players.find(q=>q.id===p.id),before=structuredClone(authoritative),guest=predictionCopy(authoritative);for(let i=0;i<20;i++)step(guest,{},s.map,1/60,true);assert.deepEqual(authoritative,before);assert.notEqual(guest.y,authoritative.y);assert.notEqual(guest.ammo,authoritative.ammo);
});
test('guest fire cannot show a shot that the host forbids during a mantle',()=>{
 const{s,p}=room();s.syncInventory(p);p.mantle={kind:'mantle'};const f=new GuestFire(),input={seq:1,slot:1,fire:true,yaw:0,pitch:0};assert.equal(f.step(p,input,100,100,1),null);assert.equal(s.fire(p),false);p.mantle=null;assert.ok(f.step(p,{...input,seq:2},101,101,1));
});
test('revive cannot start during traversal, explains cancelled healing, and knock clears a mantle immediately',()=>{
 const{s,p,a,b}=room();s.options.teamSize=2;p.team=a.team=0;b.team=1;Object.assign(a,{x:1.5,downed:true,health:100,reviveBlockedUntil:0});
 for(const key of ['mantle','grapple','shadowstep','traversal']){p[key]={};p.use={id:'medkit'};assert.equal(prepareRevive(s,p,{interact:true}),false,key);assert.equal(p.reviving,null);assert.ok(p.use);p[key]=null;}
 assert.equal(prepareRevive(s,p,{interact:true}),true);assert.equal(p.reviving,a.id);assert.equal(p.use,null);assert.equal(s.events.at(-1).cue,'use-cancel');assert.equal(s.events.at(-1).reason,'revive');
 p.mantle={kind:'mantle'};downPlayer(s,p,b,'Rifle',false,'knock');assert.equal(p.mantle,null);assert.equal(p.downed,true);
});
test('build input buffers briefly through cooldown, never across mode changes or expiry',()=>{
 for(const scenario of ['buffer','expired','changed','released']){const{s,p}=room();p.slot=0;p.materials.wood=100;p.nextBuild=s.time+.1;const input={buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true};buildingTick(s,p,input);assert.equal(s.builds.length,0);s.time+=scenario==='expired'?.3:.12;if(scenario==='released')buildingTick(s,p,{...input,buildMode:false,fire:false});buildingTick(s,p,{...input,fire:false,...(scenario==='changed'?{buildType:'floor'}:{})});assert.equal(s.builds.length,scenario==='buffer'?1:0,scenario);assert.equal(p.materials.wood,scenario==='buffer'?90:100);}
});
test('empty reload action differs visibly, retains authoritative duration, and resets hands',()=>{
 const{s,p}=room();for(const ammo of [0,5]){p.inventory[1].ammo=ammo;s.syncInventory(p);p.reloadEnd=0;assert.equal(s.reload(p),true);assert.equal(p.reloadEmpty,ammo===0);assert.equal(s.snapshot().players.find(q=>q.id===p.id).reloadEmpty,ammo===0);assert.equal(s.events.at(-1).duration,p.reloadDuration);}
 for(const id of ['sprinter','zipper','pip','scatter','needle']){assert.notDeepEqual(armPose(id,.86,true).right,armPose(id,.86,false).right);assert.deepEqual(armPose(id,1,true).right,ARM_POSES[id].right);assert.deepEqual(armPose(id,-1,true),armPose(id,-1,false));}
 for(const id of ['sprinter','peeper','scatter']){const empty=reloadSequence(id,2,true),tactical=reloadSequence(id,2,false);assert.equal(empty.length,tactical.length+1);assert.ok(empty.at(-1).at<2);assert.ok(!tactical.some(e=>/bolt|pump/.test(e.cue)));}
});
test('radius-expanded slab tests and scalar face normals preserve exact contact geometry',()=>{
 const b={x:0,y:0,z:0,w:2,h:3,d:2},map={...flat(),theme:'arena',boxes:[b]};
 for(const axis of ['x','y','z'])for(const sign of [-1,1])for(const radius of [0,.06,.3]){const o={x:0,y:1,z:0},d={x:0,y:0,z:0};o[axis]=sign*6;d[axis]=-sign;const expanded={...b,w:b.w+2*radius,d:b.d+2*radius,y:b.y-radius,h:b.h+2*radius};assert.ok(Math.abs(rayBox(o,d,b,20,radius)-rayBox(o,d,expanded,20))<1e-12);const hit=worldHit(map,o,d,20,radius);if(axis!=='y'||sign>0)assert.equal(hit.normal[axis],sign);}
 const p=runner(),head={region:'head',x:0,y:1.68,z:0,rx:.157,ry:.18,rz:.155},out={};assert.deepEqual(regionPose(head,p,out),regionPose(head,p));assert.equal(regionPose(head,p,out),out);assert.equal(humanHit({x:0,y:1.68,z:-4},{x:0,y:0,z:1},p).region,'head');
});
