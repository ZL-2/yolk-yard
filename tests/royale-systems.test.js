import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {SPAWN_ISLAND} from '../src/spawn-island.js';
import {groundAt} from '../src/terrain.js';
import {canStand} from '../src/physics.js';
import {buildingTick,solvePlacement,validPlacement,pieceBoxes,rebuildMap,inventory,applyBuildState} from '../src/building.js';
import {selectMaterial} from '../src/building-rules.js';
import {normalizeBindings,assignBinding,wheelIntent,inventoryActionForSlot} from '../src/keybinds.js';
import {selectThreat} from '../src/bot-perception.js';
import {skillFor} from '../src/bot-config.js';
import {warmupInput} from '../src/bots.js';
import {makeStorm,STORM_STEPS} from '../src/royale-data.js';
import {MAX_CONTESTANTS,MAX_HUMANS,WARMUP_SECONDS} from '../src/royale-phases.js';
const piece=(type='stairs',x=0,y=0,z=0)=>({id:'b',type,x,y,z,rotation:0,mask:0,material:'wood',owner:'p'});
const player=(extra={})=>({id:'p',health:100,x:0,y:0,z:0,yaw:0,pitch:0,grounded:true,flight:'ground',materials:{wood:10,brick:10,metal:10},...extra});
function fixture(){const p=player(),sim={map:{size:256,theme:'royale',boxes:[]},worldBoxes:[],builds:[],worldDamage:{},players:new Map([[p.id,p]]),options:{mode:'royale'},time:0,buildId:0,buildVersion:0,emit(){}};return {p,sim};}
test('turbo builds spend once, preserve explicit choice, wrap materials and stop when all banks are short',()=>{
 assert.equal(selectMaterial({wood:99,brick:99,metal:99},'metal'),'metal');
 assert.equal(selectMaterial({wood:20,brick:5,metal:0},'brick'),'wood');
 assert.equal(selectMaterial({wood:9,brick:9,metal:9},'metal'),null);
 const {sim,p}=fixture(),input={buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true};
 for(let n=0;n<4;n++){p.x=n*8;sim.time=n;buildingTick(sim,p,input);}
 assert.deepEqual(sim.builds.map(b=>b.material),['wood','brick','metal']);assert.deepEqual(p.materials,{wood:0,brick:0,metal:0});
 p.materials={wood:20,brick:20,metal:20};p.x=40;sim.time=5;input.buildMaterial='metal';buildingTick(sim,p,input);assert.equal(sim.builds.at(-1).material,'metal');assert.equal(p.materials.wood,20);
 const before=sim.builds.length,bank={...p.materials};sim.time+=1;buildingTick(sim,p,input);assert.equal(sim.builds.length,before);assert.deepEqual(p.materials,bank);
});
test('connected solver follows ramp top while moving, floor attachments, heading and host/guest parity',()=>{
 const ramp=piece(),map={size:256,theme:'royale',boxes:pieceBoxes(ramp)};
 for(const z of [.8,0,-.8,-1.6])for(const type of ['floor','stairs','wall']){
  const p=player({z,y:2-z}),result=solvePlacement(p,type,0,'wood',map,[ramp],[p]);
  assert.equal(result.reason,'',`${type}/${z}: ${result.reason}`);if(type!=='wall'||z> -1.5)assert.equal(result.piece.y,4,`${type}/${z}`);assert.ok(result.piece.z<0);
  const remote={size:256,theme:'royale',boxes:[]};applyBuildState(remote,{matchId:'test',round:1,builds:[ramp],worldDamage:{}});
  assert.deepEqual(solvePlacement(p,type,0,'wood',remote,[ramp],[p]),result);
 }
 const floor=piece('floor',0,4,0),upper={...map,boxes:pieceBoxes(floor)},p=player({y:4.16});
 for(const type of ['wall','stairs','roof']){const q=solvePlacement(p,type,0,'wood',upper,[floor],[p]);assert.equal(q.reason,'',type);assert.ok(Math.abs(q.piece.y-4)<.01);}
 const wall=piece('wall',0,0,-2),side=player({x:2.6,z:0,yaw:-Math.PI/2});
 const q=solvePlacement(side,'wall',0,'wood',{...map,boxes:pieceBoxes(wall)},[wall],[side]);assert.equal(q.reason,'');assert.equal(q.piece.rotation,3);
 for(let rotation=0;rotation<4;rotation++)assert.equal(solvePlacement(player(),'wall',rotation,'wood',{...map,boxes:[]},[],[]).piece.rotation,rotation);
});
test('decorative clutter permits building, solid structures and unsupported/underground cells do not',()=>{
 const floor=piece('floor',0,0,-4),tiny={x:0,y:0,z:-4,w:.3,h:.4,d:.3,kind:'prop',buildBlocking:false};
 const map={size:256,theme:'royale',boxes:[tiny]};assert.equal(validPlacement(floor,map,[]),'');
 const blocked={...map,boxes:[{...tiny,w:5,h:5,d:5,buildBlocking:true}]};assert.equal(validPlacement(floor,blocked,[]),'Blocked');
 assert.equal(validPlacement({...floor,y:30},map,[]),'Needs support');
 const hill={...map,terrain:{size:256,n:2,cell:512,max:6,heights:new Float32Array([6,6,6,6])}};assert.equal(validPlacement(floor,hill,[]),'Inside terrain');
});
test('wheel edit/reset coexist through contexts without removing weapon scrolling or unrelated actions',()=>{
 let b=normalizeBindings();b=assignBinding(b,'buildEdit',0,'WheelDown').bindings;b=assignBinding(b,'buildReset',0,'WheelDown').bindings;b=normalizeBindings(b);
 for(const k of ['nextSlot','buildEdit','buildReset'])assert.ok(b[k].includes('WheelDown'));
 assert.equal(wheelIntent(b,'WheelDown',{royale:true,eligible:true}),'reset-confirm');
 assert.equal(wheelIntent(b,'WheelDown',{royale:true,editing:true}),'reset-confirm');
 assert.equal(wheelIntent(b,'WheelDown',{royale:true}),'scroll');
 assert.equal(wheelIntent(b,'WheelUp',{royale:true,editing:true}),'consume');
 assert.equal(wheelIntent(b,'WheelDown',{}),'scroll');assert.equal(b.fire[0],'Mouse0');
 assert.deepEqual([0,1,2,3,4,5].map(inventoryActionForSlot),['pickaxe','primary','sidearm','slot3','slot4','slot5']);assert.equal(b.slot6,undefined);
});
test('active close threat interrupts distant engagement without nearest-only target flicker',()=>{
 const p={...player(),weapon:'sprinter',slot:0},sim={players:new Map(),options:{mode:'ffa',difficulty:2},time:10},brain={target:'far',targetUntil:11,memory:{}};
 const far={id:'far',x:0,z:-60,y:0,visible:true,confidence:1,updated:10,seenAt:10,health:100,weapon:'sprinter'};
 const close={...far,id:'close',z:-8,engagedAt:10,damageAt:10,damage:15,weapon:'scatter'};brain.memory={far,close};
 assert.equal(selectThreat(sim,p,brain,skillFor(sim)).id,'close');
 brain.memory.other={...close,id:'other',z:-7.9};sim.time+=.1;assert.equal(selectThreat(sim,p,brain,skillFor(sim)).id,'close');
 delete brain.memory.other;close.visible=false;close.confidence=.1;close.updated=3;close.damage=0;close.damageAt=close.engagedAt=0;sim.time=13;assert.equal(selectThreat(sim,p,brain,skillFor(sim)).id,'far');
});
test('all 61 foundations clear terrain, structural floor tiles do not overlap, forty warmup spawns fit',()=>{
 for(const b of ROYALE_MAP.buildings)for(const dx of [-b.w/2,0,b.w/2])for(const dz of [-b.d/2,0,b.d/2])assert.ok(groundAt(ROYALE_MAP,b.x+dx,b.z+dz)<b.baseY-.09,`${b.poi} ground clips floor`);
 const floor=ROYALE_MAP.boxes.filter(b=>b.color==='floor');
 for(let i=0;i<floor.length;i++)for(let j=i+1;j<floor.length;j++){const a=floor[i],b=floor[j];if(Math.abs(a.y+a.h-b.y-b.h)>.001)continue;assert.ok(!(Math.abs(a.x-b.x)<(a.w+b.w)/2-.005&&Math.abs(a.z-b.z)<(a.d+b.d)/2-.005),`Overlapping floors ${a.objectId}/${b.objectId}`);}
 assert.ok(SPAWN_ISLAND.spawns.length>=MAX_CONTESTANTS);for(const [x,z]of SPAWN_ISLAND.spawns)assert.ok(canStand(SPAWN_ISLAND,{x,z,y:groundAt(SPAWN_ISLAND,x,z)},.6));
 const ids=ROYALE_MAP.boxes.map(b=>[b.x,b.y,b.z,b.w,b.h,b.d].join(','));assert.equal(new Set(ids).size,ids.length);
});
test('32 filled seats, finite 60-second host countdown, admission cap, practice isolation and valid fifth-slot operations',()=>{
 const s=new RoyaleSimulation({capacity:32,fill:true,bots:31,seed:42}),p=s.addPlayer('host',{name:'Host'});s.startRound();
 assert.equal(s.players.size,32);assert.equal(s.queueEnds-s.time,WARMUP_SECONDS);
 let maxFiring=0,practice=0;
 // Exercise the scheduled practice windows without running 60 seconds of physics.
 for(let time=0;time<60;time+=.1){s.time=time;let firing=0;for(const bot of s.players.values())if(bot.bot){const i=warmupInput(s,bot);if(i.fire)firing++;}maxFiring=Math.max(maxFiring,firing);practice+=firing;}
 assert.ok(maxFiring<=3);assert.ok(practice>0);s.damage(p,[...s.players.values()][1],100,'Sprinter');assert.equal(p.health,100);assert.equal(p.kills,0);
 s.time=59.5;s.tick(1/30);assert.equal(s.stage,'starting');assert.equal(s.snapshot().royale.queueEnds,60);
 for(let i=1;i<MAX_HUMANS;i++)assert.ok(s.admitPlayer('human-'+i,{name:'Guest '+i}));assert.equal(s.admitPlayer('overflow',{name:'Overflow'}),null);assert.equal(s.players.size,32);
 s.time=60;s.tick(1/60);assert.equal(s.stage,'battle-bus');assert.equal(s.alive,32);assert.equal(p.inventory.slice(1).filter(Boolean).length,0);assert.deepEqual(p.materials,{wood:0,brick:0,metal:0});
 const spectator=s.admitPlayer('watch',{name:'Watcher'});assert.ok(spectator.spectating);assert.equal(s.alive,32);
 Object.assign(p,{flight:'ground',x:-230,y:0,z:-230});s.map={...s.map,terrain:null,boxes:[]};s.worldBoxes=[];p.inventory=inventory();p.inventory[5]={id:'mini',count:4};s.playerAction(p.id,'inventory-select-5');assert.equal(p.slot,5);s.playerAction(p.id,'inventory-swap-5-1');assert.equal(p.inventory[1].id,'mini');s.playerAction(p.id,'inventory-swap-1-5');s.playerAction(p.id,'inventory-drop-one-5');assert.equal(p.inventory[5].count,3);s.dropSlot(p,5);assert.equal(p.inventory[5],null);assert.equal(p.inventory[0].id,'pickaxe');
 const restored=new RoyaleSimulation().restore(s.checkpoint());assert.equal(restored.options.capacity,32);assert.equal(restored.stage,s.stage);assert.equal(restored.alive,s.alive);
});
test('larger opening circle preserves nested boundaries and tightens later phases',()=>{
 const s=makeStorm(()=>.6);assert.equal(s[0].closeAt,140);assert.equal(s[0].end,205);assert.equal(s[0].radius,225);
 for(const p of s)assert.ok(Math.hypot(p.x-p.fromX,p.z-p.fromZ)+p.radius<=p.fromRadius+.001);
 assert.equal(s.at(-1).end,526);assert.ok(STORM_STEPS.at(-1).close<STORM_STEPS[0].close);
});
