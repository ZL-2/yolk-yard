import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {ATV,tickVehicles,seatPlayer} from '../src/vehicles.js';
import {spawnHelicopter} from '../src/helicopter.js';
import {ramDamage,ramPlayers} from '../src/vehicle-impact.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {groundAt} from '../src/terrain.js';
import {rebuildMap} from '../src/building.js';
import {fallDamage} from '../src/airborne.js';
import {thirdPersonActive,weaponCameraAllowed,cameraPose} from '../src/perspective.js';
import {predictionCopy,predictMovement} from '../src/guest-movement.js';
import {isBreakable} from '../src/building-rules.js';
import {harvestObjective} from '../src/bot-objectives.js';
import {navigate} from '../src/bot-navigation.js';
import {newBrain} from '../src/bot-perception.js';
import {skillFor} from '../src/bot-config.js';
const flat={id:'flat',theme:'royale',size:1000,boxes:[],terrain:null,helipad:{x:0,y:0,z:0,yaw:0}};
function battle(){
 const s=new RoyaleSimulation({capacity:4,bots:0,fill:false,seed:202}),p=s.addPlayer('driver',{name:'Driver'}),target=s.addPlayer('target',{name:'Target'});s.startRound();s.beginBattle();s.stage='active';s.time=10;s.startedAt=-100;s.map={...flat,boxes:[]};s.worldBoxes=[];s.worldDamage={};s.builds=[];s.vehicles=[];s.chests=[];s.operations=null;s.players=new Map([[p.id,p],[target.id,target]]);s.botInput=()=>({});s.nav={path:()=>[]};
 for(const q of [p,target])Object.assign(q,{health:100,shield:100,flight:'ground',grounded:true,vy:0,x:q===p?30:0,y:0,z:0,yaw:0,pitch:0,spectating:false,contestant:true,connected:true,loading:false,shieldUntil:0,lastInput:s.time,deaths:0});
 s.stormSteps=s.stormSteps.map(v=>({...v,start:1e9,closeAt:1e9,end:2e9}));return {s,p,target};
}
function vehicle(s,p,type,speed,boost=false){
 const v=type==='helicopter'?spawnHelicopter(s.map):{id:'atv',x:0,y:0,z:0,yaw:0,pitch:0,roll:0,speed:0,vx:0,vy:0,vz:0,health:ATV.health,boost:100,seats:[null,null],grounded:true,revision:0};
 Object.assign(v,{speed,vz:-speed,boosting:boost});if(type==='helicopter')Object.assign(v,{y:.1,grounded:false,rotor:1,boostTime:boost?1:0,boostCooldown:boost?5:0});
 v.seats[0]=p.id;p.vehicleId=v.id;p.vehicleSeat=0;seatPlayer(p,v);s.vehicles=[v];s.inputs.set(p.id,{forward:1,yaw:0,sprint:boost});return v;
}
test('normal and boosted vehicle contact scale damage and launch, without repeated tick damage',()=>{
 for(const type of ['atv','helicopter']){
  const hits=[];for(const [speed,boost]of type==='atv'?[[8.5,false],[15.5,true]]:[[25,false],[35,true]]){
   const {s,p,target}=battle(),v=vehicle(s,p,type,speed,boost);target.z=type==='atv'?-1.85:-2.6;
   tickVehicles(s,.05);const damage=200-target.health-target.shield;assert.ok(damage>0,type+' moving contact');assert.ok(target.vy>0);assert.ok(target.launchVelocity.z<0);hits.push(damage);
   tickVehicles(s,.05);assert.equal(200-target.health-target.shield,damage,'same contact cannot tick damage');
  }assert.ok(hits[1]>hits[0],type+' boost is stronger');assert.equal(hits[1],type==='atv'?40:50);
 }
});
test('ramming skips stationary craft, departing contact, teammates, riders and intervening cover',()=>{
 for(const kind of ['stationary','departing','team','rider','cover']){
  const {s,p,target}=battle(),v=vehicle(s,p,'atv',15.5,true);target.z=-1.8;
  const before={...v};v.z=-.6;
  if(kind==='stationary'){v.z=before.z;before.vz=0;}
  if(kind==='departing'){target.z=1;}
  if(kind==='team'){s.options.teamSize=2;p.team=target.team=0;}
  if(kind==='rider')target.vehicleId=v.id;
  if(kind==='cover')s.map.boxes=[{x:0,y:0,z:-1.4,w:4,h:4,d:.1}];
  ramPlayers(s,v,before,p,.05);assert.equal(target.health+target.shield,200,kind);
 }
 assert.equal(ramDamage({type:'helicopter'},3),0);
});
test('boost breaks contacted fully built metal and keeps momentum; protected and unrelated walls stay intact',()=>{
 for(const type of ['helicopter','atv']){
  const {s,p,target}=battle();target.x=100;const v=vehicle(s,p,type,type==='helicopter'?35:15.5,true);
  s.builds=[{id:'wall',type:'wall',x:0,y:0,z:-4,rotation:0,material:'metal',health:500,maxHealth:500},{id:'nearby',type:'wall',x:7,y:0,z:-4,rotation:0,material:'metal',health:500,maxHealth:500}];rebuildMap(s);
  for(let i=0;i<12;i++){s.time+=1/60;p.lastInput=s.time;tickVehicles(s,1/60);}
  assert.ok(!s.builds.some(b=>b.id==='wall'),type+' destroys contact');assert.equal(s.builds.find(b=>b.id==='nearby')?.health,500);assert.ok(v.z<-3,type+' continues through');
  const protectedWall={objectId:'protected',x:0,y:0,z:v.z-3,w:20,h:30,d:.2,indestructible:true};s.worldBoxes=[protectedWall];rebuildMap(s);
  for(let i=0;i<30;i++){s.time+=1/60;p.lastInput=s.time;tickVehicles(s,1/60);}assert.equal(s.worldDamage.protected,undefined);assert.ok(v.z>protectedWall.z);
 }
});
test('ordinary NPC falls bypass shield, including distant guards above removed supports',()=>{
 for(const kind of ['boss','henchman']){
  const {s,p,target}=battle();p.x=200;target.x=0;Object.assign(target,{bot:true,boss:kind==='boss',henchman:kind==='henchman',bossId:'warden-aster',contestant:false,connected:false,home:{x:0,y:25,z:0},health:600,shield:400,maxHealth:600,maxShield:400,grounded:true,y:25,vy:0,flight:'ground',fall:null,landing:null,guardNextAt:0});
  s.players.set('observer',{...p,id:'observer',x:500});
  // Deliberately no floor at y=25 and no contestant near this district.
  for(let i=0;i<240&&!target.landing&&target.health===600;i++)s.tick(1/60);
  const amount=fallDamage({distance:25,immune:false,normalY:1});assert.equal(target.health,600-amount,kind);assert.equal(target.shield,400);assert.equal(target.y,0);assert.ok(target.grounded);
 }
});
test('helipad deck has physical clearance above every terrain triangle in its footprint',()=>{
 const site=ROYALE_MAP.helipad,deck=ROYALE_MAP.boxes.find(b=>b.kind==='helipad');assert.equal(deck.y+deck.h,site.y);
 let clearance=Infinity;for(let x=site.x-18;x<=site.x+18;x+=.5)for(let z=site.z-18;z<=site.z+18;z+=.5)clearance=Math.min(clearance,site.y-groundAt(ROYALE_MAP,x,z));assert.ok(clearance>=.25,{clearance});
 assert.equal(spawnHelicopter(ROYALE_MAP).y,site.y);
});
test('stuck bots only breach breakable obstacles, and invalidate protected harvest and breach tasks',()=>{
 for(const protectedFlag of [false,true]){
  const {s,p}=battle();Object.assign(p,{x:0,y:0,z:0,bot:true});const wall={objectId:'wall',x:0,y:0,z:-1.5,w:6,h:4,d:.4,material:'wood',indestructible:protectedFlag};s.map.boxes=[wall];s.worldBoxes=[wall];
  const brain=p.brain=newBrain(s,p);Object.assign(brain,{checkAt:0,lastX:0,lastZ:0,pathAt:100,pathGoal:{x:0,y:0,z:-10}});
  navigate(s,p,brain,{x:0,y:0,z:-10},skillFor(s));assert.equal(!!brain.breach,!protectedFlag);
  if(!protectedFlag){assert.ok(harvestObjective(s,p,wall));wall.indestructible=true;assert.equal(harvestObjective(s,p,wall),null);navigate(s,p,brain,{x:0,y:0,z:-10},skillFor(s));assert.equal(brain.breach,null);}
 }
 assert.equal(isBreakable({objectId:'vault',vaultId:'x'}),false);assert.equal(isBreakable({objectId:'edge',kind:'boundary'}),false);
});
test('ATV passenger perspective and scope match prediction and return to the selected view',()=>{
 const {s,p}=battle(),v=vehicle(s,p,'atv',0);v.seats=[null,p.id];p.vehicleSeat=1;seatPlayer(p,v);p.inventory[1]={id:'needle',weapon:true,rarity:2,ammo:1};p.slot=1;p.reloadEnd=0;s.syncInventory(p);
 let seq=0;for(const perspective of ['first','third'])for(const aim of [false,true]){
  const input={seq:++seq,perspective,aim,slot:1,yaw:1,pitch:0},predicted=predictionCopy(p);s.setInput(p.id,input);s.tick(1/60);predictMovement(predicted,input,s.map,1/60,{vehicles:[v]},s.time);
  assert.equal(weaponCameraAllowed(p),true);assert.equal(thirdPersonActive(p),perspective==='third'&&!aim);assert.equal(thirdPersonActive(predicted),thirdPersonActive(p));assert.deepEqual(cameraPose(s.map,p),cameraPose(s.map,predicted));
 }
 p.vehicleSeat=0;assert.equal(weaponCameraAllowed(p),false);
});
test('boost exhaust follows both predicted and remote boost state, then stops on engine failure',async()=>{
 const {makeHelicopter,animateHelicopter}=await import('../src/helicopter-model.js'),m=makeHelicopter({detail:2}),other=makeHelicopter({detail:2});
 animateHelicopter(m,{rotor:1,boosting:true},1,1/60);const flame=m.getObjectByName('heli-boost');assert.equal(flame.visible,true);assert.equal(flame.children.length,2);assert.equal(other.getObjectByName('heli-boost').visible,false);
 animateHelicopter(m,{rotor:1,boosting:true,falling:true},2,1/60);assert.equal(flame.visible,false);
});
