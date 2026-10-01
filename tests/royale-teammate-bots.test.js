import test from 'node:test';import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {safeProfile,weapon} from '../src/data.js';
import {invalidateCollision,dist} from '../src/physics.js';
import {chooseObjective,usefulLoot} from '../src/bot-objectives.js';
import {newBrain} from '../src/bot-perception.js';
import {BOT_SKILL,ROYALE_TEAM_BOT} from '../src/bot-config.js';
function room(){
 const s=new RoyaleSimulation({capacity:4,teamSize:2,teamFill:false,fill:false,bots:0,difficulty:1,seed:31});
 const h=s.addPlayer('human',safeProfile({name:'Captain'})),e=s.addPlayer('enemy',safeProfile({name:'Opponent'}));s.startRound();const b=s.addPlayer('mate',safeProfile({name:'Buddy'}),true);assert.ok(s.beginBattle());
 s.map={id:'flat-bot-test',size:1000,boxes:[],spawns:[[0,0]],floorLoot:[]};s.nav={path:()=>[]};s.worldBoxes=[];s.worldDamage={};s.loot=[];s.chests=[];s.pads=[];s.stage='active';s.time=0;s.startedAt=-60;s.stormSteps=[{index:0,fromX:0,fromZ:0,fromRadius:500,x:0,z:0,radius:500,start:9999,closeAt:10000,end:20000,dps:0}];
 for(const [i,p]of [h,b,e].entries()){Object.assign(p,{x:i===2?200:i*1.5,y:0,z:0,flight:'ground',grounded:true,health:100,shield:0,shieldUntil:0,spectating:false,contestant:true,team:i===2?1:0,teamSlot:i===1?1:0,brain:null,materials:{wood:0,brick:0,metal:0},slot:1});p.inventory[1]={id:'cluck',weapon:true,ammo:weapon('cluck').magazine,rarity:0};s.syncInventory(p);}
 return {s,h,b,e};
}
const step=(s,seconds,inputs={})=>{for(let i=0;i<seconds*60;i++){for(const [id,input]of Object.entries(inputs))s.setInput(id,{seq:i+1,dt:1/60,...input});s.tick(1/60);}};
test('bot teammates regroup and track moving humans rather than independent distant POIs',()=>{
 const {s,h,b}=room();b.x=50;let input=s.botInput(b);assert.equal(b.brain.task.kind,'follow');assert.ok(Math.abs(input.forward)+Math.abs(input.strafe)>0);step(s,7);assert.ok(dist(h,b)<18,JSON.stringify({h:h.x,b:b.x}));
 h.x=65;h.z=15;step(s,9);assert.ok(dist(h,b)<20);assert.equal(b.brain.followId,h.id);
});
test('downed bots remain still beside a reviver and complete the normal ten-second revive',()=>{
 const {s,h,b,e}=room();s.damage(b,e,200,'Sprinter');const initial={x:b.x,z:b.z};
 for(let i=0;i<650;i++){s.setInput(h.id,{seq:i+1,interact:true,dt:1/60});s.tick(1/60);if(b.downed)assert.ok(Math.hypot(b.x-initial.x,b.z-initial.z)<.01);}
 assert.equal(b.downed,false);assert.equal(b.health,30);assert.equal(h.revives,1);
});
test('human rescue immediately overrides cached combat and is prioritized over a nearer downed bot',()=>{
 const {s,h,b,e}=room();e.x=20;s.botInput(b);s.damage(h,e,200,'Sprinter');const input=s.botInput(b);assert.equal(input.interact,true);assert.equal(input.fire,false);assert.ok(Math.abs(input.forward)===0);step(s,11);assert.equal(h.downed,false);assert.equal(h.health,30);assert.equal(b.revives,1);
 h.x=65;s.damage(h,e,200,'Sprinter');const other=s.addPlayer('second-bot',safeProfile({name:'Second Buddy'}),true);Object.assign(other,{x:b.x+1,y:0,z:b.z,team:b.team,downed:true,health:100,flight:'ground',contestant:true});
 const rescue=s.botInput(b);assert.equal(rescue.interact,false);assert.ok(Math.abs(rescue.forward)+Math.abs(rescue.strafe)>0);assert.equal(h.downed,true);
});
test('looting stays near the human teammate and materials remain valuable beyond the old threshold',()=>{
 const {s,h,b}=room(),brain=b.brain=newBrain(s,b);b.materials.wood=150;assert.equal(usefulLoot(b,{resource:'wood'}),30);
 s.loot=[{uid:1,id:'wood',resource:'wood',count:50,x:60,y:0,z:0}];brain.lootMemory[1]={uid:1,at:s.time};h.x=0;
 assert.equal(chooseObjective(s,b,brain,BOT_SKILL[0],null).kind,'follow');assert.equal(ROYALE_TEAM_BOT.totalMaterials,300);
});
for(const [material,kind]of [['wood','tree'],['brick','rock'],['metal','barrels']])test('bots actually harvest and carry '+material+' through normal pickaxe rules',()=>{
 const {s,h,b}=room();h.x=-12;b.x=-4;b.z=0;const box={x:0,y:0,z:0,w:1,h:3,d:1,objectId:'resource-'+material,material,kind:material==='wood'?'tree':'prop',harvestType:kind};s.map.boxes=[box];s.worldBoxes=[box];invalidateCollision(s.map);
 step(s,12);assert.ok(b.materials[material]>0,'No '+material+' earned');assert.ok(s.events.some(e=>e.type==='harvest'&&e.player===b.id));assert.ok(b.materials[material]<=180);
});
