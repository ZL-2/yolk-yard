import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {canStand,movePlayer,wallDistance} from '../src/physics.js';
import {inventory,damageObject} from '../src/building.js';
import {rollChest,rollItem} from '../src/royale-loot.js';
import {rng,weapon,WEAPONS,ROYALE_WEAPONS} from '../src/data.js';
import {clearOfRelays,gateBuildFire,ROYALE_BOT_RANGE} from '../src/field-refinement.js';
import {skillFor,BOT_SKILL} from '../src/bot-config.js';
import {stormPriority,chooseObjective} from '../src/bot-objectives.js';
import {spectatorTargets,watchersFor,watcherAction} from '../src/spectator-status.js';
import {audibleVisualEvent,soundBearing} from '../src/sound-visuals.js';
import {publicRoyaleMarkup} from '../src/lobby-ui.js';
import {startLootFall,tickLootMotion} from '../src/loot-motion.js';
const battle=()=>{const s=new RoyaleSimulation({capacity:4,bots:3,fill:true,seed:57}),p=s.addPlayer('host',{name:'Host'});s.startRound();s.beginBattle();return {s,p};};
const flat=()=>{const{s,p}=battle();s.players=new Map([[p.id,p]]);s.map={size:256,boxes:[],terrain:null,relays:[]};s.worldBoxes=[];s.relays=[];s.loot=[];s.chests=[];s.lootVersion++;Object.assign(p,{x:0,y:0,z:0,grounded:true,flight:'ground',spectating:false,health:100,shield:0,shieldUntil:0,lastDamage:-100,slot:1,inventory:inventory(),equipUntil:0});s.stage='active';return {s,p};};
test('every chest gun is Uncommon or better, Epic stays Epic+, all chests include collectable materials',()=>{
 const random=rng(782);for(const source of ['chest','high','supply','epic'])for(let n=0;n<250;n++){
  const contents=rollChest(random,source),gun=contents.find(i=>i.weapon),materials=contents.find(i=>i.resource);
  assert.ok(gun.rarity>=(source==='epic'?3:1));assert.equal(materials.resource,materials.id);assert.equal(materials.count,30);
  for(const i of contents){if(i.id==='mini')assert.equal(i.count,3);if(i.id==='flask')assert.equal(i.count,1);}
 }
 for(let n=0;n<1000;n++){const i=rollItem(random,'ground','utility');if(i.id==='mini')assert.equal(i.count,3);if(i.id==='flask')assert.equal(i.count,1);}
});
test('vault has five ammo reserves, eight barrels span four curated locations, relays remain accessible',()=>{
 const {s}=battle();assert.equal(s.map.shieldBarrels.length,12);assert.equal(new Set(s.map.shieldBarrels.map(p=>p.location)).size,6);
 assert.equal(s.loot.filter(l=>l.ammoType&&Math.abs(l.y-s.map.vault.y)<.3&&Math.abs(l.x-s.map.vault.x)<9&&Math.abs(l.z-s.map.vault.z)<5).length,5);
 assert.equal(s.relays.length,3);for(const r of s.relays){assert.ok(canStand(s.map,r),'operator can reach relay');assert.ok(s.loot.every(i=>clearOfRelays(i,[r])));}
 for(const r of s.relays){const drop=s.dropWeapon(r,'sprinter',2);assert.ok(drop);assert.ok(clearOfRelays(drop,s.relays));}
 const {s:f}=flat();f.relays=[{x:0,y:0,z:0}];const falling={uid:99,id:'sprinter',weapon:true,x:0,y:8,z:0};f.loot.push(falling);startLootFall(f,falling);f.time+=3;tickLootMotion(f);assert.ok(clearOfRelays(falling,f.relays),'loot landing after support destruction clears the relay');
});
test('shield barrels restore nearby operators once, cap shields, exclude distant and downed players, replicate destruction',()=>{
 const {s,p}=battle(),barrel=s.worldBoxes.find(b=>b.harvestType==='shieldBarrel');
 Object.assign(p,{x:barrel.x+1.1,y:barrel.y,z:barrel.z,flight:'ground',health:100,shield:95});
 const far=s.addPlayer('watch',{name:'Watch'},false,true);Object.assign(far,{x:barrel.x+20,y:barrel.y,z:barrel.z,health:100,shield:0,spectating:false,flight:'ground'});
 const downed=s.addPlayer('downed',{name:'Downed'},false,true);Object.assign(downed,{x:barrel.x+1.4,y:barrel.y,z:barrel.z,health:40,shield:0,spectating:false,flight:'ground',downed:true});
 damageObject(s,barrel,10000,p);assert.equal(p.shield,100);assert.equal(far.shield,0);assert.equal(downed.shield,0);assert.equal(downed.health,40);p.shield=0;damageObject(s,barrel,10000,p);assert.equal(p.shield,0);
 const restored=new RoyaleSimulation().restore(s.checkpoint());assert.equal(restored.worldDamage[barrel.objectId].destroyed,true);assert.ok(!restored.map.boxes.some(b=>b.objectId===barrel.objectId));
});
test('raised front access clears the stairwell and reaches Voss door on actual collision',()=>{
 const{s,p}=battle(),b=s.map.buildings[s.map.bossHouse];Object.assign(p,{x:b.x+4.5,y:b.baseY,z:b.z+28,grounded:true,flight:'ground',yaw:0});
 for(let i=0;i<155;i++)movePlayer(p,{forward:1},s.map,1/60);assert.ok(Math.abs(p.y-b.baseY)<.3,'side walkway is supported');
 p.yaw=Math.PI/2;for(let i=0;i<54;i++)movePlayer(p,{forward:1},s.map,1/60);p.yaw=0;
 for(let i=0;i<20;i++)movePlayer(p,{forward:1},s.map,1/60);assert.ok(Math.abs(p.x-b.x)<1.3);assert.ok(p.z<b.z+b.d/2+2.5);assert.ok(Math.abs(p.y-b.baseY)<.3);
});
test('empty public warmup stays unstarted; first human gets 30s, joins inherit it, final departure clears it',()=>{
 const s=new RoyaleSimulation({recurring:true,capacity:48,fill:true,seed:9});s.startRound();s.time+=100;s.advanceWarmupClock(90);assert.equal(s.queueEnds,0);
 const a=s.admitPlayer('a',{name:'A'});s.advanceWarmupClock();assert.equal(s.queueEnds-s.time,30);s.time+=20;s.advanceWarmupClock();const end=s.queueEnds;
 s.admitPlayer('b',{name:'B'});assert.equal(s.queueEnds,end);s.leavePlayer(a.id);assert.equal(s.queueEnds,end);s.leavePlayer('b');assert.equal(s.queueEnds,0);
 s.admitPlayer('c',{name:'C'});s.advanceWarmupClock();assert.equal(s.queueEnds-s.time,30);
 const copy=new RoyaleSimulation().restore(s.checkpoint());assert.equal(copy.queueEnds,s.queueEnds);
 const html=publicRoyaleMarkup({publicMatch:{joinable:true,countdownStarted:false,countdownSeconds:0,availability:{open:true},availableSeats:48,phase:'playing',humanPlayers:0},online:true});assert.match(html,/data-action="public-join"/);assert.match(html,/30s ON FIRST JOIN/);
});
test('tap swaps a full inventory immediately and a held key swaps only once',()=>{
 const{s,p}=flat();for(let i=1;i<=5;i++)p.inventory[i]={id:'sprinter',weapon:true,count:1,rarity:0,ammo:30};s.syncInventory(p);const item=s.dropWeapon({x:1,y:0,z:0},'needle',2);
 s.interact(p,{interact:true},1/60);assert.equal(p.inventory[1].id,'needle');assert.ok(!s.loot.includes(item));assert.equal(p.swapProgress,0);assert.equal(p.inventory[0].id,'pickaxe');
 for(let n=0;n<150;n++){s.time+=1/60;s.interact(p,{interact:true},1/60);}assert.equal(p.inventory[1].id,'needle');assert.equal(s.loot.filter(l=>l.weapon).length,1);
 s.interact(p,{},1/60);s.interact(p,{interact:true},1/60);assert.equal(p.inventory[1].id,'sprinter','release permits the next intentional swap');
});
test('building click cannot fire a gun after switching until release, including semi-auto buffered presses',()=>{
 const{s,p}=flat();p.inventory[1]={id:'pip',weapon:true,count:1,rarity:1,ammo:14};s.syncInventory(p);
 gateBuildFire(p,{buildMode:true,fire:true,firePress:3});p.pendingFireUntil=s.time+1;p.burstLeft=3;
 const held=gateBuildFire(p,{buildMode:false,fire:true,firePress:3});assert.equal(held.fire,false);assert.equal(held.firePress,0);assert.equal(p.pendingFireUntil,0);assert.equal(p.burstLeft,0);
 s.combatInput(p,held);assert.equal(p.inventory[1].ammo,14);gateBuildFire(p,{fire:false});const fresh=gateBuildFire(p,{fire:true,firePress:4});s.combatInput(p,fresh);assert.equal(p.inventory[1].ammo,13);
});
test('public spectator starts with real operators, excludes boss; watcher count uses accepted human intent',()=>{
 const state={options:{mode:'royale',teamSize:1},players:[{id:'viewer',spectating:true,health:0},{id:'bot',bot:true,health:100},{id:'boss',boss:true,bot:true,health:600},{id:'real',health:100,bot:false}]};
 assert.deepEqual(spectatorTargets(state,'viewer').map(p=>p.id),['real','bot']);const sim={players:new Map(state.players.map(p=>[p.id,p]))};watcherAction(sim,state.players[0],'watch:real');assert.equal(watchersFor(state,'real').length,1);state.players[0].connected=false;assert.equal(watchersFor(state,'real').length,0);
});
test('Royale perception and fire range are bounded, storm rotation overrides combat before it is too late',()=>{
 const sim={options:{mode:'royale',difficulty:2},time:100,stage:'active',map:{terrain:null},storm:{active:true,x:0,z:0,radius:100,nextX:0,nextZ:0,nextRadius:40,closing:true,seconds:10}},p={x:90,y:0,z:0,inventory:inventory()};
 const skill=skillFor(sim);assert.ok(skill.vision<=ROYALE_BOT_RANGE.vision);assert.ok(skill.error<BOT_SKILL[1].error*1.1);const rotation=stormPriority(sim,p,skill);assert.equal(rotation.urgent,true);assert.ok(Math.hypot(rotation.goal.x,rotation.goal.z)<40);
 assert.equal(chooseObjective(sim,p,{},skill,{x:92,y:0,z:0,visible:true}).kind,'rotate');
});
test('directional cues match audible categories, orientation and weapon sound radius',()=>{
 assert.equal(soundBearing({x:0,z:0,yaw:0},{x:4,z:0}),Math.PI/2);assert.equal(soundBearing({x:0,z:0,yaw:Math.PI/2},{x:-4,z:0}),0);
 assert.equal(audibleVisualEvent({type:'shot',weapon:'needle',origin:{x:1,z:2}}).range,170);assert.equal(audibleVisualEvent({type:'royale-cue',cue:'chest-open',x:1,z:2}).kind,'chest');assert.equal(audibleVisualEvent({type:'hit'}),null);
});
test('every gun has a unique military display name with unchanged internal IDs and weapon statistics',()=>{
 assert.equal(new Set([...WEAPONS,...ROYALE_WEAPONS].map(w=>w.name)).size,11);for(const w of [...WEAPONS,...ROYALE_WEAPONS]){assert.match(w.name,/[A-Z]+-?\d/);assert.ok(weapon(w.id).damage>0);}
});
