import test from 'node:test';
import assert from 'node:assert/strict';
import {weapon,rng} from '../src/data.js';
import {personality,BOT_PERSONALITIES} from '../src/bot-personality.js';
import {tacticalGoal,searchObjective,keepCommittedTask,commitTask} from '../src/bot-tactics.js';
import {coverPoint} from '../src/bot-cover.js';
import {combatRole} from '../src/bot-team.js';
import {newBrain,observe,selectThreat} from '../src/bot-perception.js';
import {takeBotWork,botWorld} from '../src/bot-work.js';
import {skillFor} from '../src/bot-config.js';
import {botShotGap,steadyBotFire} from '../src/bot-aim.js';
import {executeRoyaleIntent} from '../src/royale-bot-execution.js';
import {dist} from '../src/physics.js';
const skill=skillFor({options:{mode:'royale',difficulty:2}});
function fixture(){
 const p={id:'operator',bot:true,x:0,y:0,z:0,yaw:0,pitch:0,health:100,team:0,joinedOrder:0,weapon:'sprinter',slot:1,flight:'ground',inventory:[{id:'pickaxe',pickaxe:true},{id:'sprinter',weapon:true,rarity:1,ammo:30}]};
 const enemy={id:'opponent',x:0,y:0,z:-22,yaw:0,health:100,team:1,visible:true,seenAt:10,weapon:'sprinter'};
 const sim={time:10,round:1,eventId:0,events:[],random:rng(134),options:{mode:'royale',difficulty:2,teamSize:1},map:{id:'test',size:200,boxes:[]},players:new Map([[p.id,p],[enemy.id,enemy]])};
 const brain=p.brain=newBrain(sim,p);brain.memory[enemy.id]={...enemy};brain.target=enemy.id;return {sim,p,enemy,brain};
}
test('personalities survive reacquisition and only vary choices, not aim or damage',()=>{
 const profiles=new Set();for(let i=0;i<100;i++){const p={id:'bot-'+i},brain={};const first=personality(p,brain);assert.equal(personality(p,{}),first);profiles.add(first.name);assert.equal(first.error,undefined);assert.equal(first.hit,undefined);assert.equal(first.damage,undefined);}
 assert.equal(profiles.size,BOT_PERSONALITIES.length);
});
test('combat commits to an angle, briefly peeks on arrival, then repositions',()=>{
 const {sim,p,enemy,brain}=fixture(),w=weapon('sprinter'),goal=tacticalGoal(sim,p,brain,enemy,w,skill);
 assert.ok(dist(p,goal)>2);sim.time+=.3;enemy.x+=.2;assert.equal(tacticalGoal(sim,p,brain,enemy,w,skill),goal);
 Object.assign(p,goal);sim.time+=.1;assert.equal(tacticalGoal(sim,p,brain,enemy,w,skill),goal);
 sim.time+=.65;const next=tacticalGoal(sim,p,brain,enemy,w,skill);assert.ok(dist(next,goal)>2);
});
test('urgent danger interrupts committed looting, routine replans do not',()=>{
 const {sim,p,brain}=fixture();brain.task={kind:'loot',uid:10,goal:{x:8,y:0,z:0}};commitTask(sim,p,brain);
 assert.equal(keepCommittedTask(sim,p,brain,null),true);assert.equal(keepCommittedTask(sim,p,brain,null,true),false);
 brain.attackedAt=sim.time;assert.equal(keepCommittedTask(sim,p,brain,null),false);
});
test('low health and reload immediately change a combat plan into withdrawal',()=>{
 const {sim,p,brain,enemy}=fixture();tacticalGoal(sim,p,brain,enemy,weapon('sprinter'),skill);p.health=20;sim.time+=.1;
 const away=tacticalGoal(sim,p,brain,enemy,weapon('sprinter'),skill);assert.equal(brain.tactic.kind,'withdraw');assert.ok(dist(away,enemy)>dist(p,enemy));
});
test('search uses the remembered position, checks another angle, then gives up',()=>{
 const {sim,p,brain,enemy}=fixture();const remembered={...enemy,visible:false};enemy.x=150;
 const first=searchObjective(sim,p,brain,remembered);assert.equal(first.goal.x,0);Object.assign(p,first.goal);
 sim.time+=.1;searchObjective(sim,p,brain,remembered);sim.time+=.5;const second=searchObjective(sim,p,brain,remembered);assert.ok(dist(first.goal,second.goal)>3);
 sim.time+=5;assert.equal(searchObjective(sim,p,brain,remembered),null);assert.equal(brain.memory[enemy.id],undefined);
});
test('squads have distinct pressure/flank/support positions and reevaluate a hurt member',()=>{
 const {sim,p,brain,enemy}=fixture();sim.options.teamSize=4;const members=[p];
 for(let i=1;i<4;i++){const mate={...p,id:'mate-'+i,x:i*2,joinedOrder:i,brain:newBrain(sim,p)};sim.players.set(mate.id,mate);members.push(mate);}
 assert.deepEqual(members.map(m=>combatRole(sim,m,m.brain,enemy)),['pressure','flank-left','flank-right','support']);
 p.health=20;sim.time+=1.1;assert.equal(combatRole(sim,p,brain,enemy),'support');assert.equal(combatRole(sim,members[1],members[1].brain,enemy),'pressure');
});
test('cover results are cached, bounded, and invalidated when scenery changes',()=>{
 const {sim,p,enemy}=fixture();sim.map.boxes=[{x:0,y:0,z:-2,w:2,h:3,d:1}];const cover=coverPoint(sim,p,enemy);assert.ok(cover);
 assert.equal(takeBotWork(sim,'cover'),true);assert.equal(takeBotWork(sim,'cover'),false);assert.equal(coverPoint(sim,p,enemy),cover);
 sim.time+=.02;sim.map.boxes=[];sim.navigationRevision=1;assert.equal(coverPoint(sim,p,enemy),null);
});
test('sight budget is bounded and observations never follow an opponent behind a wall',()=>{
 const {sim,p,brain,enemy}=fixture();observe(sim,p,brain,skill);assert.equal(brain.memory[enemy.id].visible,true);
 sim.time+=.3;sim.map.boxes=[{x:0,y:0,z:-5,w:30,h:5,d:1}];enemy.x=2;observe(sim,p,brain,skill);
 assert.equal(brain.memory[enemy.id].visible,false);assert.equal(brain.memory[enemy.id].x,0);
 let grants=0;while(takeBotWork(sim,'sight'))grants++;assert.ok(grants<=31);
});
test('actual shots are paced independently of personality, frame rate and weapon rarity',()=>{
 for(const fps of [30,60,120])for(const id of ['sprinter','doubleyolk','needle','whipper']){
  const p={shotSerial:0},brain={aimAt:0},w=weapon(id),times=[];
  for(let frame=0;frame<fps*8;frame++){const now=frame/fps;if(steadyBotFire(brain,p,w,skill,now,true)){times.push(now);p.shotSerial++;}}
  assert.ok(times[0]>=.65);assert.ok(times.length>=2);
  for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=botShotGap(w,skill)-1e-8,id);
 }
});
test('cached movement brakes at its waypoint and resumes only on a new intent',()=>{
 const {sim,p}=fixture();p.x=2.8;const input={slot:1,yaw:0,pitch:0,worldMoveX:1,worldMoveZ:0,moveTarget:{x:3,y:0,z:0}};
 const out=executeRoyaleIntent(sim,p,input);assert.equal(Math.hypot(out.forward,out.strafe),0);
});
test('AI detail follows living humans and their spectated operator after elimination',()=>{
 const {sim,p}=fixture();sim.players.set('viewer',{id:'viewer',bot:false,health:0,spectating:true,watchingId:p.id});
 assert.ok(botWorld(sim).focus.includes(p));sim.time+=.11;sim.players.get('viewer').watchingId=null;assert.ok(!botWorld(sim).focus.includes(p));
});
test('no target is a stable state and does not restart every objective scan',()=>{
 const {sim,p,brain}=fixture();brain.memory={};brain.target=null;brain.decision=sim.time+2;brain.aimAt=0;
 assert.equal(selectThreat(sim,p,brain,skill),null);assert.equal(brain.decision,sim.time+2);assert.equal(brain.aimAt,0);
});
test('a major observed relocation interrupts a committed combat angle',()=>{
 const {sim,p,brain,enemy}=fixture();const first=tacticalGoal(sim,p,brain,enemy,weapon('sprinter'),skill);
 sim.time+=.1;enemy.x+=12;assert.notEqual(tacticalGoal(sim,p,brain,enemy,weapon('sprinter'),skill),first);assert.equal(brain.tactic.observed.x,enemy.x);
});
