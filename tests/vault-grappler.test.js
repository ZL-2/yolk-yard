import test from 'node:test';import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';import {inventory} from '../src/building.js';
import {frontierInteract,setDoor,keycardRoute} from '../src/frontier-world.js';
import {vaultOpen} from '../src/vaults.js';import {canStand,movePlayer,wallDistance} from '../src/physics.js';
import {GRAPPLER,grappleAim,startGrapple,grappleHookPoint} from '../src/grappler.js';import {useSeasonItem,bossInput} from '../src/season-world.js';
import {crownsEnabled,bindCrownStore,attachCrown,awardCrowns,dropCrown,takeCrown} from '../src/crowns.js';
import {fallDamage} from '../src/airborne.js';import {chooseObjective,usefulLoot} from '../src/bot-objectives.js';import {recoverySlot} from '../src/bot-recovery.js';
import {skillFor} from '../src/bot-config.js';import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {gun,rng} from '../src/data.js';import {WEAPON_RARITIES} from '../src/weapon-rarities.js';import {rollItem} from '../src/royale-loot.js';import {publicWindow} from '../src/season-one.js';
import {Group} from 'three';import {RoyaleView} from '../src/royale-view.js';
function battle(recurring=false){const s=new RoyaleSimulation({capacity:4,bots:3,seed:31,recurring}),p=s.addPlayer('host',{name:'Host'});s.startRound();s.beginBattle();s.stage='active';s.time=20;Object.assign(p,{health:100,shield:0,shieldUntil:0,flight:'ground',grounded:true,vy:0,yaw:0,pitch:0,lastDamage:-100});return {s,p};}
function flat(){const{s,p}=battle();s.players=new Map([[p.id,p]]);s.map={size:256,boxes:[],theme:'royale'};s.worldBoxes=[];s.relays=[];s.loot=[];s.chests=[];s.storm={active:false};Object.assign(p,{x:0,y:0,z:0,slot:1,inventory:inventory()});p.inventory[1]={id:'sprinter',weapon:true,rarity:1,count:1,ammo:30};s.syncInventory(p);return {s,p};}
function brain(){return {memory:{},lootMemory:{},unreachable:{},visited:{},attackedAt:-100,assistUntil:0};}
test('private and training crowns cannot gain, lose or transfer persistent ownership',()=>{
 for(const recurring of [false,true]){const{s,p}=battle(recurring),record={season:1,wins:7,owned:true,unlocked:true};p.crownProgress={...record};attachCrown(s,p,'account');assert.equal(crownsEnabled(s),false);assert.equal(p.crown,false);p.crown=true;assert.equal(dropCrown(s,p),false);p.crown=false;assert.equal(takeCrown(s,p,{crown:true}),false);awardCrowns(s,[p]);assert.deepEqual(p.crownProgress,record);}
 const{s,p}=battle(true),saved=[];bindCrownStore(s,{load:()=>({season:1,wins:7,owned:true,unlocked:true}),save:(_,v)=>saved.push(v)});attachCrown(s,p,'account');assert.equal(p.crown,true);awardCrowns(s,[p]);assert.equal(p.crownWins,8);assert.equal(saved.length,1);
 s.options.training=true;assert.equal(dropCrown(s,p),false);assert.equal(saved.length,1);
});
test('public availability never closes at night or across daylight-saving boundaries',()=>{for(const t of ['2026-10-05T00:30:00Z','2026-11-01T06:00:00Z','2026-12-25T08:00:00Z'])assert.equal(publicWindow(Date.parse(t)).open,true);});
test('all three vaults have independent physical gates, keys and four guaranteed chests',()=>{
 const{s,p}=battle();assert.equal(s.vaults.length,3);
 for(const v of s.map.vaults){assert.ok(canStand(s.map,v.reader),v.id+' reader');const door=s.map.doors.find(d=>d.id===v.doorId),chests=s.chests.filter(c=>c.vaultId===v.id);assert.equal(chests.length,4);assert.equal(chests.filter(c=>c.epic).length,2);assert.equal(setDoor(s,door,true,p),false);
  Object.assign(p,v.reader);p.inventory[2]={id:'incorrectKey',count:1};for(let i=0;i<22;i++)frontierInteract(s,p,{interact:true},.1);assert.equal(vaultOpen(s,v.id),false);
  Object.assign(p,{x:chests[0].x,y:chests[0].y,z:chests[0].z});assert.equal(s.openChest(p,chests[0]),false,'even an inside-room request cannot bypass the lock');Object.assign(p,v.reader);p.inventory[2]={id:v.key,count:1};p.slot=2;assert.ok(keycardRoute(s.map,s.snapshot().royale,p));
  p.lastDamage=s.time;frontierInteract(s,p,{interact:true},.1);assert.equal(p.vaultProgress,0);p.lastDamage=-100;for(let i=0;i<21;i++)frontierInteract(s,p,{interact:true},.1);
  assert.equal(vaultOpen(s,v.id),true);assert.equal(s.doors[v.doorId].open,true);assert.equal(p.inventory[2],null);Object.assign(p,{x:chests[0].x,y:chests[0].y,z:chests[0].z});assert.equal(s.openChest(p,chests[0]),true);assert.equal(s.openChest(p,chests[0]),false);
 }
 const copy=new RoyaleSimulation().restore(s.checkpoint());assert.deepEqual(copy.vaults,s.vaults);assert.equal(copy.vault,copy.vaults[0]);
});
test('grappler crosshair ray and shot agree; misses animate, cooldown persists and Mythic never runs out',()=>{
 const{s,p}=flat(),item={id:'anchorWinch',count:1};assert.equal(grappleAim(s.map,p,wallDistance).valid,false);assert.equal(useSeasonItem(s,p,item),true);assert.equal(p.grapple.valid,false);assert.equal(useSeasonItem(s,p,item),false);
 for(let i=0;i<150;i++)movePlayer(p,{},s.map,1/60);assert.equal(p.z,0);assert.equal(p.grapple,null);s.time+=GRAPPLER.cooldown;s.map.boxes=[{x:0,y:0,z:-15,w:5,h:5,d:1}];assert.equal(grappleAim(s.map,p,wallDistance).valid,true);assert.equal(useSeasonItem(s,p,item),true);
 for(let i=0;i<60;i++)movePlayer(p,{},s.map,1/60);assert.ok(p.z<-10&&p.z>-14.2,'pulls toward surface and stops outside wall');assert.ok(canStand(s.map,p));assert.equal(p.fall?.immune||false,false);assert.equal(item.charges,undefined);
 s.time+=2;p.inventory[1]=item;p.slot=1;p.use=null;p.equipUntil=0;s.beginUse(p);assert.ok(p.use,'normal fire input can start an unlimited Grappler');s.finishUse(p);assert.equal(p.grapple.phase,'hook');
 p.inventory[1]=item;const ready=item.readyAt;s.dropSlot(p,1);assert.equal(s.loot.find(i=>i.id==='anchorWinch').readyAt,ready);
});
test('grappler travel sweeps collisions, resets prior fall height only on a real latch and grants no glider immunity',()=>{
 const{s,p}=flat();Object.assign(p,{y:6,grounded:false,fall:{apex:45,immune:false,source:'normal'}});startGrapple(p,{origin:{x:0,y:7.7,z:0},anchor:{x:0,y:7.7,z:-8},length:8,valid:true},s.time);
 for(let i=0;i<10;i++)movePlayer(p,{},s.map,1/60);assert.equal(p.fall.source,'grapple');assert.ok(p.fall.apex<7);assert.equal(p.redeploy,false);assert.equal(p.forceGlider,false);assert.ok(fallDamage({distance:30,immune:p.fall.immune})>=100);
 s.map.boxes=[{x:0,y:0,z:-4,w:3,h:20,d:.15}];for(let i=0;i<120;i++)movePlayer(p,{},s.map,1/60);assert.ok(p.z>-3.61,'thin cover added in flight cannot be tunneled through');
});
test('the returning plunger tracks the shooter after moving away from the launch point',()=>{
 const g={origin:{x:0,y:2,z:0},anchor:{x:0,y:2,z:-30},phase:'return',returnAt:1,elapsed:1+GRAPPLER.returnTime},moved={x:12,y:8,z:-20},end=grappleHookPoint(g,moved);for(const axis of ['x','y','z'])assert.ok(Math.abs(end[axis]-moved[axis])<1e-8);g.elapsed=1;assert.deepEqual(grappleHookPoint(g,moved),g.anchor);
});
test('Rook visibly equips the grappler for his ability and restores the shotgun after the plunger returns',()=>{
 const rv=Object.assign(Object.create(RoyaleView.prototype),{view:{disposeGroup:g=>g.clear()},flightPose:()=>({air:0}),itemModel:()=>{const g=new Group(),cup=new Group();cup.name='grappler-plunger';g.add(cup);return g;}}),model=new Group();model.userData.held=new Group();model.userData.blaster=new Group();const p={boss:true,health:100,flight:'ground',pitch:0,slot:1,inventory:[null,{id:'doubleyolk',weapon:true}],bossWindup:{until:1}};
 rv.animateActor(model,p,0);assert.equal(model.userData.held.visible,false);assert.equal(model.userData.utilityKey,'anchorWinch');const cup=model.userData.utility.getObjectByName('grappler-plunger');assert.equal(cup.visible,true);p.bossWindup=null;p.grapple={phase:'pull'};rv.animateActor(model,p,1);assert.equal(cup.visible,false);p.grapple.phase='return';rv.animateActor(model,p,2);assert.equal(cup.visible,false);p.grapple=null;rv.animateActor(model,p,3);assert.equal(model.userData.held.visible,true);assert.equal(model.userData.utility,null);
});
test('Rook grapples himself toward an out-of-shotgun-range attacker without moving the attacker',()=>{
 const{s,p}=flat(),b=s.addPlayer('rook-test',{name:'Rook'},true);Object.assign(b,{boss:true,bossId:'marshal-rook',spectating:false,x:0,y:0,z:0,home:{x:0,y:0,z:0},grounded:true,flight:'ground',vy:0,health:650,shield:350,bossAlert:'alerted',bossSuspicion:1,targetId:p.id,scanAt:100,aggroAt:0,abilityAt:0,ammo:[0,8],patrol:[]});Object.assign(p,{z:-20});bossInput(s,b);assert.ok(b.bossWindup);s.time+=1;bossInput(s,b);for(let i=0;i<75;i++)movePlayer(b,{},s.map,1/60);assert.ok(b.z<-12);assert.equal(p.z,-20);assert.equal(p.grapple,null);assert.equal(p.grounded,true);
});
test('regular bots keep recovering beyond old health/shield thresholds and seek recovery supplies with a full inventory',()=>{
 const{s,p}=flat();p.bot=true;p.health=90;p.shield=75;p.inventory[2]={id:'medkit',count:1};p.inventory[3]={id:'flask',count:1};let b=brain();assert.equal(chooseObjective(s,p,b,skillFor(s),null).slot,2);p.slot=2;p.use={id:'medkit',slot:2};s.finishUse(p);assert.equal(p.health,100);assert.equal(chooseObjective(s,p,b,skillFor(s),null).slot,3);p.slot=3;p.use={id:'flask',slot:3};s.finishUse(p);assert.equal(p.shield,100);assert.notEqual(chooseObjective(s,p,b,skillFor(s),null).kind,'heal');
 p.health=95;p.shield=90;for(let i=1;i<6;i++)p.inventory[i]={id:'sprinter',weapon:true,ammo:30,rarity:i%4,count:1};const heal=s.dropLoot({x:2,y:0,z:0},{id:'splash',count:1});assert.ok(usefulLoot(p,heal)>0);assert.equal(chooseObjective(s,p,brain(),skillFor(s),null).uid,heal.uid);p.inventory[2]={id:'bandage',count:5};p.inventory[3]={id:'mini',count:3};assert.equal(recoverySlot(p),-1,'capped supplies cannot create a futile heal loop');
});
test('grappler and every vault replicate through real wire deltas and recovery without aliasing prediction state',()=>{
 const{s,p}=battle();startGrapple(p,{origin:{x:0,y:2,z:0},anchor:{x:0,y:2,z:-10},length:10,valid:true},s.time);const enc=new SnapshotEncoder(),dec=new SnapshotDecoder();let state=dec.decode(JSON.parse(JSON.stringify(enc.encode({state:s.snapshot()}).frame))).state;
 s.vaults[1].open=true;p.grapple.elapsed=.15;state=dec.decode(JSON.parse(JSON.stringify(enc.encode({state:s.snapshot()}).frame))).state;assert.equal(state.royale.vaults[1].open,true);assert.equal(state.players.find(q=>q.id===p.id).grapple.elapsed,.15);const cloned=structuredClone(state.players.find(q=>q.id===p.id));cloned.grapple.anchor.x=99;assert.equal(p.grapple.anchor.x,0);
 const copy=new RoyaleSimulation().restore(s.checkpoint());assert.equal(copy.players.get(p.id).grapple.elapsed,.15);assert.equal(copy.vaults[1].open,true);
});
test('each gun family uses explicit damage, reload and magazine tiers; shotgun Mythic versus Uncommon is twelve damage',()=>{
 for(const [id,t]of Object.entries(WEAPON_RARITIES))for(let rarity=0;rarity<t.damage.length;rarity++){const w=gun({slot:1,inventory:[null,{id,weapon:true,rarity}]});assert.equal(w.damage*w.pellets,t.damage[rarity]);assert.equal(w.reload,t.reload[rarity]);assert.equal(w.magazine,t.magazine[rarity]);}
 assert.equal(WEAPON_RARITIES.doubleyolk.damage[5]-WEAPON_RARITIES.doubleyolk.damage[1],12);const random=rng(882);for(let i=0;i<200;i++){const item=rollItem(random,'chest','weapon');assert.equal(item.ammo,gun({slot:1,inventory:[null,item]}).magazine);}
});
