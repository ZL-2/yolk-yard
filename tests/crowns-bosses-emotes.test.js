import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoyaleSimulation} from '../src/royale.js';
import {Simulation} from '../src/simulation.js';
import {BOSSES,MYTHIC_WEAPONS} from '../src/bosses.js';
import {bossInput,useSeasonItem,winchCharges,seasonInteract} from '../src/season-world.js';
import {SEASON} from '../src/season-one.js';
import {attachCrown,bindCrownStore,crownRecord,dropCrown,takeCrown,awardCrowns} from '../src/crowns.js';
import {EMOTES,startEmote,emoteInput} from '../src/emotes.js';
import {visualSoundsAllowed,audibleVisualEvent} from '../src/sound-visuals.js';
import {inventory} from '../src/building.js';
import {weapon,gun} from '../src/data.js';
import {itemInfo} from '../src/royale-data.js';
import {movePlayer,canStand} from '../src/physics.js';
import {ProgressionService} from '../server/realtime/progression.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
function battle(recurring=false){const s=new RoyaleSimulation({capacity:4,bots:3,fill:true,seed:31,recurring}),p=s.addPlayer('host',{name:'Host'});s.startRound();assert.equal(s.beginBattle(),true);Object.assign(p,{flight:'ground',grounded:true,shieldUntil:0,x:0,y:0,z:0});return {s,p};}
function flat(){const {s,p}=battle();s.map={size:256,boxes:[],terrain:null};s.worldBoxes=[];s.relays=[];s.chests=[];s.loot=[];s.players=new Map([[p.id,p]]);s.stage='active';p.lastDamage=-100;p.yaw=0;p.pitch=0;return {s,p};}
test('three bosses have valid supports and patrols, consume no contestant seats and carry personalized Mythics',()=>{
 const {s}=battle();assert.equal([...s.players.values()].filter(p=>p.contestant).length,4);
 for(const def of BOSSES){const b=s.players.get(def.id);assert.ok(b.boss);assert.ok(canStand(s.map,b));assert.equal(b.contestant,false);assert.ok(b.patrol.every(q=>canStand(s.map,q)),def.name+' patrol');assert.equal(b.inventory[1].rarity,5);assert.equal(gun(b).name,MYTHIC_WEAPONS[def.id].name);assert.equal(itemInfo(b.inventory[1]).name,gun(b).name);assert.ok(gun(b).damage>gun({...b,inventory:[null,{id:def.weapon,weapon:true,rarity:4}]}).damage);}
 assert.equal(s.bossCaches.length,2);assert.ok(s.map.traversal.some(t=>t.id==='nyx-lookout-ascender'));assert.ok(s.map.bossSites.every(site=>canStand(s.map,site.cache)));
});
test('each boss drops its own Mythic, special item, correct ammo and key exactly once; no kill/placement credit',()=>{
 const {s,p}=battle(),alive=s.alive;
 for(const [index,def]of BOSSES.entries()){const b=s.players.get(def.id),before=s.loot.length;s.damage(b,p,def.health+def.shield+1,'Test');const drops=s.loot.slice(before),mythic=drops.find(i=>i.weapon);assert.equal(mythic.bossId,def.id);assert.equal(mythic.rarity,5);assert.equal(itemInfo(mythic).name,MYTHIC_WEAPONS[def.id].name);assert.ok(drops.some(i=>i.id===['jumpRig','anchorWinch','veilProjector'][index]));assert.ok(drops.some(i=>i.id===['asterKeycard','rookKeycard','nyxKeycard'][index]));s.damage(b,p,9999,'Test');assert.equal(s.loot.length,before+drops.length);}
 assert.equal(p.kills,0);assert.equal(s.alive,alive);
});
test('Rook telegraphs his winch, a shot interrupts it, and cover blocks pulling',()=>{
 const {s,p}=flat(),def=BOSSES[1],b={id:def.id,bossId:def.id,boss:true,x:0,y:0,z:0,home:{x:0,y:0,z:0},health:650,shield:350,pitch:0,yaw:0,targetId:p.id,scanAt:100,aggroAt:0,abilityAt:0,ammo:[0,8],patrol:[]};s.players.set(b.id,b);Object.assign(p,{x:0,z:-12});s.time=2;assert.equal(bossInput(s,b).fire,undefined);assert.ok(b.bossWindup);s.damage(b,p,5,'Test');assert.equal(b.bossWindup,null);
 b.bossWindup={target:p.id,until:3};s.time=3.1;s.map.boxes=[{x:0,y:0,z:-6,w:3,h:4,d:1}];bossInput(s,b);assert.equal(p.flight,'ground');
 s.map.boxes=[];b.bossWindup={target:p.id,until:3};bossInput(s,b);assert.equal(p.grounded,false);assert.ok(p.vy>0);assert.ok(p.launchVelocity.z>0);
});
test('Nyx telegraphs her relocation before smoke, moves to the marked position and never fires through it',()=>{
 const {s,p}=flat(),b=s.addPlayer('nyx-test',{name:'Nyx Test'},true);Object.assign(b,{boss:true,bossId:'lieutenant-nyx',x:0,y:0,z:0,home:{x:0,y:0,z:0},targetId:p.id,scanAt:100,aggroAt:0,abilityAt:0,lastDamage:1,ammo:[0,6],patrol:[{x:-2,y:0,z:0},{x:2,y:0,z:0}],patrolIndex:0,pitch:0,yaw:0});Object.assign(p,{x:0,z:-15});s.time=2;const input=bossInput(s,b);assert.equal(input.fire,false);assert.equal(s.smokes.length,0);assert.equal(b.patrolIndex,1);assert.deepEqual(b.bossVeil.goal,b.patrol[1]);assert.deepEqual(s.snapshot().players.find(q=>q.id===b.id).bossVeil.goal,b.patrol[1]);s.time+=.7;const relocation=bossInput(s,b);assert.equal(relocation.fire,false);assert.equal(s.smokes.length,1);b.yaw=-Math.PI/2;assert.ok(bossInput(s,b).forward>0);assert.ok(s.smokes[0].until-s.time<=4);bossInput(s,b);assert.equal(s.smokes.length,1);
});
test('keyed boss caches reject missing keys and damage interruptions, consume a key once and conserve rewards',()=>{
 const {s,p}=flat();const cache={id:'rook-hold',key:'rookKeycard',name:'Harbor Hold',x:0,y:0,z:-1,opened:false};s.bossCaches=[cache];s.time=10;
 for(let i=0;i<100;i++)seasonInteract(s,p,{interact:true},1/60);assert.equal(cache.opened,false);assert.equal(s.loot.length,0);
 p.inventory[1]={id:'rookKeycard',count:1};p.lastDamage=s.time;seasonInteract(s,p,{interact:true},1/60);assert.equal(p.cacheProgress,0);p.lastDamage=-100;
 for(let i=0;i<91;i++)seasonInteract(s,p,{interact:true},1/60);assert.equal(cache.opened,true);assert.equal(p.inventory[1],null);assert.ok(s.loot.some(i=>i.weapon&&i.rarity>=3));const n=s.loot.length;seasonInteract(s,p,{interact:true},1/60);assert.equal(s.loot.length,n);
});
test('Anchor Winch needs a real surface, recharges two charges and keeps drops on cooldown; Veil has finite smoke',()=>{
 const {s,p}=flat(),winch={id:'anchorWinch',count:1,charges:2,rechargeAt:0};assert.equal(useSeasonItem(s,p,winch),false);assert.equal(winch.charges,2);
 s.map.boxes=[{x:0,y:0,z:-12,w:4,h:4,d:1}];assert.equal(useSeasonItem(s,p,winch),true);assert.equal(winch.charges,1);assert.equal(p.grounded,false);assert.ok(p.vy>0);s.time+=14;assert.equal(winchCharges(winch,s.time),2);
 assert.equal(useSeasonItem(s,p,{id:'veilProjector'}),true);assert.equal(s.smokes.at(-1).until-s.time,6);
});
test('first victory grants next-match crown; crowned victory increments and unlocks the display once',()=>{
 const {s,p}=battle(true),saved=new Map();bindCrownStore(s,{load:id=>saved.get(id),save:(id,r)=>saved.set(id,r)});attachCrown(s,p,'account');assert.equal(p.crown,false);awardCrowns(s,[p]);assert.equal(p.crown,true);assert.equal(p.crownWins,0);assert.equal(p.crownedVictory,false);assert.equal(p.crownEmoteUnlocked,false);
 s.phase='results';s.startRound();s.beginBattle();assert.equal(p.crown,true);awardCrowns(s,[p]);assert.equal(p.crownedVictory,true);assert.equal(p.crownWins,1);assert.equal(p.crownEmoteUnlocked,true);assert.equal(saved.get('account').owned,true);
});
test('crown transfers without using equipment slots, is unique, drops on elimination and cannot multiply on repeated death',()=>{
 const {s,p}=flat();p.crown=true;p.crownProgress={season:1,wins:2,owned:true,unlocked:true};s.time=20;assert.equal(dropCrown(s,p,{manual:true}),true);assert.equal(p.crown,false);const crown=s.loot.find(i=>i.crown);assert.equal(takeCrown(s,p,crown),false);
 const q=s.addPlayer('guest',{name:'Guest'});Object.assign(q,{x:crown.x,y:crown.y,z:crown.z,flight:'ground',grounded:true,health:100,spectating:false,contestant:true,shieldUntil:0});for(let i=1;i<6;i++)q.inventory[i]={id:'sprinter',weapon:true,ammo:30,rarity:0,count:1};assert.equal(takeCrown(s,q,crown),true);assert.equal(q.inventory.filter(Boolean).length,6);assert.equal(s.loot.filter(i=>i.crown).length,0);s.damage(q,p,999,'Test');assert.equal(q.crown,false);const n=s.loot.filter(i=>i.crown).length;assert.equal(n,1);s.eliminate(q);assert.equal(s.loot.filter(i=>i.crown).length,n);
});
test('bots, spectators and already-crowned players cannot pick crowns; custom practice cannot award season wins',()=>{
 const {s,p}=flat(),crown={id:'victoryCrown',crown:true,uid:999,x:0,y:0,z:0};p.crown=true;assert.equal(takeCrown(s,p,crown),false);p.crown=false;p.downed=true;assert.equal(takeCrown(s,p,crown),false);p.downed=false;p.bot=true;assert.equal(takeCrown(s,p,crown),false);p.bot=false;p.spectating=true;assert.equal(takeCrown(s,p,crown),false);p.spectating=false;awardCrowns(s,[p]);assert.equal(p.crown,false);
});
test('crowns have no movement or damage advantage or slowdown',()=>{
 const map={size:256,boxes:[]},make=crown=>({x:0,y:0,z:0,yaw:0,pitch:0,inventory:inventory(),health:100,flight:'ground',grounded:true,stamina:100,crown});const a=make(false),b=make(true);for(let n=0;n<60;n++){movePlayer(a,{forward:1},map,1/60);movePlayer(b,{forward:1},map,1/60);}assert.equal(a.z,b.z);assert.ok(Math.abs(a.z+5)<.01);
});
test('season resets crown progress and ownership but retains the earned display emote',()=>{
 assert.deepEqual(crownRecord({season:0,wins:33,owned:true,unlocked:true}),{season:SEASON.number,wins:0,owned:false,unlocked:true});assert.equal(crownRecord({season:1,wins:-10}).wins,0);
});
test('crown records persist across a service restart and reconnect by server identity',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ravel-crown-')),path=join(dir,'progress.json'),relay={peers:new Map(),send(){}};
 try{const a=new ProgressionService(relay,{path});await a.ready;const {s,p}=battle(true);bindCrownStore(s,{load:id=>a.account(id).crowns,save:(id,r)=>{a.account(id).crowns=r;}});attachCrown(s,p,'identity');p.crown=true;awardCrowns(s,[p]);await a.close();const b=new ProgressionService(relay,{path});await b.ready;bindCrownStore(s,{load:id=>b.account(id).crowns,save(){}});attachCrown(s,p,'identity');assert.equal(p.crownWins,1);assert.equal(p.crown,true);assert.equal(p.crownEmoteUnlocked,true);await b.close();}finally{await rm(dir,{recursive:true,force:true});}
});
test('crown, emote, Mythic owner and boss cache state survive wire deltas and host recovery',()=>{
 const {s,p}=battle();p.crown=true;p.crownWins=17;p.crownEmoteUnlocked=true;s.playerAction(p.id,'emote-crown');const wire={state:s.snapshot()},encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();assert.deepEqual(decoder.decode(JSON.parse(JSON.stringify(encoder.encode(wire).frame))),JSON.parse(JSON.stringify(wire)));
 const copy=new RoyaleSimulation().restore(s.checkpoint());assert.equal(copy.players.get(p.id).emote.id,'crown');assert.equal(copy.players.get(p.id).crownWins,17);assert.equal(copy.bossCaches.length,2);
});
test('three normal emotes plus the earned Crown Record start only in valid states',()=>{
 assert.equal(EMOTES.length,4);const {s,p}=flat();for(const id of ['salute','shuffle','cheer']){s.time+=1;assert.equal(startEmote(s,p,id),true);assert.equal(p.emote.id,id);}s.time+=1;assert.equal(startEmote(s,p,'crown'),false);p.crownEmoteUnlocked=true;assert.equal(startEmote(s,p,'crown'),true);p.emote=null;
 for(const state of [{flight:'transport'},{flight:'glide'},{downed:true},{spectating:true},{health:0},{traversal:{id:'line'}}]){const q={...p,flight:'ground',health:100,downed:false,spectating:false,traversal:null,...state};assert.equal(startEmote(s,q,'salute'),false);}assert.equal(startEmote(s,p,'fake'),false);
});
test('camera look never stops an emote, body heading stays fixed, meaningful controls and expiry do stop it',()=>{
 const {s,p}=flat();p.yaw=.5;s.time=10;assert.equal(startEmote(s,p,'shuffle'),true);const look=emoteInput(s,p,{yaw:2,pitch:1,slot:p.slot});assert.equal(p.emote.id,'shuffle');assert.equal(look.yaw,.5);
 for(const input of [{forward:1},{strafe:-1},{jump:true},{crouch:true},{sprint:true},{fire:true},{aim:true},{reload:true},{interact:true},{drop:true},{buildMode:true},{editing:true},{slot:1},{swapSlot:2}]){s.time+=1;startEmote(s,p,'shuffle');emoteInput(s,p,input);assert.equal(p.emote,null,JSON.stringify(input));}
 s.time+=1;startEmote(s,p,'salute');s.time+=4.1;emoteInput(s,p,{});assert.equal(p.emote,null);
});
test('damage cancels emotes even when fully absorbed by shield; results allow celebration and preserve movement input',()=>{
 const {s,p}=flat();p.shield=100;s.time=10;startEmote(s,p,'shuffle');s.damage(p,null,5,'Test');assert.equal(p.emote,null);assert.equal(p.health,100);
 s.phase='results';s.time+=1;s.playerAction(p.id,'emote-cheer');assert.equal(p.emote.id,'cheer');s.inputs.set(p.id,{forward:1});s.tick(1/60);assert.equal(p.emote,null);
 const arena=new Simulation();const a=arena.addPlayer('arena',{name:'Arena'});arena.phase='playing';Object.assign(a,{health:100,grounded:true,spectating:false});arena.playerAction(a.id,'emote-salute');assert.equal(a.emote.id,'salute');
});
test('visual sound gating covers Spawn Island and bus and permits landed players; crown events use crown indicators',()=>{
 assert.equal(visualSoundsAllowed({royale:{practice:true}},{flight:'ground'}),false);assert.equal(visualSoundsAllowed({royale:{practice:false}},{flight:'transport'}),false);assert.equal(visualSoundsAllowed({royale:{practice:false}},{flight:'ground'}),true);assert.equal(visualSoundsAllowed({},{flight:'ground'}),true);assert.equal(audibleVisualEvent({type:'royale-cue',cue:'crown-pulse',x:1,z:1}).kind,'crown');assert.equal(audibleVisualEvent({type:'royale-cue',cue:'boss-windup',x:1,z:1}).kind,'boss');
});
