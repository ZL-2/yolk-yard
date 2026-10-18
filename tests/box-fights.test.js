import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxFightSimulation} from '../src/box-fights.js';
import {BOX_RULES as R,constrainBoxMovement} from '../src/box-fight-rules.js';
import {buildingTick,editBuilding,validPlacement,damageObject,applyBuildState} from '../src/building.js';
import {matchOptions} from '../src/match-options.js';
import {publicMatchOptions,publicPoolKey} from '../src/public-royale.js';
import {rewardFrame} from '../src/rewards.js';
import {predictionCopy,predictMovement} from '../src/guest-movement.js';

function setup(options={},count=2){const s=new BoxFightSimulation({fill:false,...options});s.addPlayer('a',{name:'Alpha'});s.addPlayer('b',{name:'Bravo'});for(let i=2;i<count;i++)s.addPlayer(String.fromCharCode(97+i),{name:'Player '+i});s.startRound();return s;}
function advance(s,seconds){for(let i=0;i<Math.ceil(seconds*30);i++)s.tick(1/30);}
function fight(s){s.boxEnd=s.time;s.tick(1/30);assert.equal(s.boxStage,'fight');}
function kill(s,victim,attacker){s.damage(s.players.get(victim),s.players.get(attacker),10000,'scatter');s.tick(1/30);}

test('Box rules normalize private formats, public pools, loadouts and human-only seats',()=>{
 const p=publicMatchOptions({mode:'boxfight',teamSize:3,scoreLimit:1,boxFormat:'ffa',building:false});assert.equal(p.capacity,6);assert.equal(p.scoreLimit,5);assert.equal(p.boxFormat,'teams');assert.equal(p.building,true);assert.notEqual(publicPoolKey(p),publicPoolKey({...p,teamSize:2}));
 const o=matchOptions({mode:'boxfight',boxFormat:'ffa',teamSize:4,fill:false,bots:7});assert.equal(o.capacity,8);assert.equal(o.bots,0);
 const s=setup(),a=s.players.get('a'),b=s.players.get('b');for(const p of [a,b]){assert.equal(p.health,100);assert.equal(p.shield,100);assert.equal(p.materials.wood,500);assert.equal(p.inventory[1].id,'scatter');assert.equal(p.inventory[2].id,'sprinter');assert.equal(p.inventory[3].count,2);assert.equal(p.bank.shells,60);}assert.notEqual(a.team,b.team);
});
test('prep protects health, world and spawn sides; host and prediction share limits',()=>{
 const s=setup(),a=s.players.get('a'),b=s.players.get('b');s.damage(a,b,999,'scatter');assert.equal(a.health+a.shield,200);assert.equal(s.fire(a),false);assert.equal(s.map.boxPrep,true);
 const predicted=predictionCopy(a);predicted.z=10;constrainBoxMovement(predicted,s.map,true);assert.equal(predicted.z,-2.45);const bad={type:'wall',x:0,y:0,z:4,rotation:0,material:'wood'};assert.match(validPlacement(bad,s.map,[],[],a),/your side/);
 const wall=s.map.boxes.find(b=>b.objectId==='box-north');damageObject(s,wall,10000,a);assert.notEqual(s.worldDamage['box-north']?.destroyed,true);
 fight(s);assert.equal(s.map.boxPrep,false);assert.ok(!s.map.boxes.some(b=>b.objectId==='box-divider'));s.damage(a,b,25,'scatter');assert.equal(a.shield,75);
});
test('actual builds and owner edits work; ceiling and opposing ownership are enforced',()=>{
 const s=setup(),a=s.players.get('a'),b=s.players.get('b');Object.assign(a,{x:0,z:-6,yaw:0,pitch:0});buildingTick(s,a,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});assert.equal(s.builds.length,1);assert.equal(a.materials.wood,490);const piece=s.builds[0];
 const action='build-change:'+JSON.stringify({id:piece.id,mask:18,path:[],revision:0,yaw:0,pitch:0});assert.equal(editBuilding(s,a,action),true);assert.equal(piece.mask,18);assert.equal(piece.revision,1);Object.assign(b,{x:a.x,z:a.z,yaw:0,pitch:0});assert.equal(editBuilding(s,b,action),false);assert.equal(editBuilding(s,a,action),false,'Stale edits rejected');
 assert.match(validPlacement({type:'wall',x:0,y:8,z:-4,rotation:0,material:'wood'},s.map,[]),/Outside/);
 const client=new BoxFightSimulation(s.options).map;applyBuildState(client,s.snapshot().royale);assert.equal(client.boxPrep,true);assert.ok(client.boxes.some(b=>b.buildId===piece.id));
});
test('team elimination bypasses DBNO, prevents friendly damage, and applies bounded siphon',()=>{
 const s=setup({teamSize:2},4),a=s.players.get('a'),mate=[...s.players.values()].find(p=>p.id!==a.id&&p.team===a.team),enemy=s.players.get('b');fight(s);s.damage(a,mate,999,'scatter');assert.equal(a.health+a.shield,200);
 a.health=60;a.shield=30;a.materials.wood=450;s.damage(enemy,a,999,'scatter');assert.equal(enemy.health,0);assert.equal(enemy.downed,false);assert.equal(enemy.spectating,true);assert.equal(a.health,100);assert.equal(a.shield,40);assert.equal(a.materials.wood,500);assert.equal(a.boxRoundKills,1);s.damage(enemy,a,999,'scatter');assert.equal(a.shield,40);s.playerAction(enemy.id,'respawn');assert.equal(enemy.health,0);
});
test('round transition resets construction, gear and inputs; alternates sides and wins the series',()=>{
 const s=setup({scoreLimit:2}),a=s.players.get('a');const z=a.z;buildingTick(s,a,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});fight(s);kill(s,'b','a');assert.equal(s.boxStage,'intermission');assert.equal(s.roundWins[a.team],1);const cp=predictionCopy(a);predictMovement(cp,{forward:1,yaw:0},s.map,.1,s.snapshot().royale,s.time);assert.equal(cp.z,a.z);
 s.boxEnd=s.time;s.tick(1/30);assert.equal(s.boxRound,2);assert.equal(s.boxStage,'prepare');assert.equal(s.builds.length,0);assert.equal(a.z,-z);assert.equal(a.health+a.shield,200);assert.equal(a.materials.wood,500);assert.equal(a.kills,1);assert.equal(s.players.get('b').spectating,false);
 fight(s);kill(s,'b','a');assert.equal(s.phase,'results');assert.equal(s.seriesWinner,a.team);assert.equal(s.roundHistory.length,2);assert.equal(s.startRound(),true);assert.equal(s.boxRound,1);assert.deepEqual(s.roundWins,{});
});
test('simultaneous eliminations draw once; storm resolves camping within the round limit',()=>{
 const s=setup();fight(s);s.damage(s.players.get('a'),null,999,'Storm');s.damage(s.players.get('b'),null,999,'Storm');s.tick(1/30);assert.equal(s.roundWinner,null);assert.equal(s.roundHistory.length,1);assert.deepEqual(s.roundWins,{});
 const storm=setup();fight(storm);advance(storm,99);assert.ok(storm.roundHistory.length>=1);assert.ok(storm.events.some(e=>e.type==='box-cue'&&e.cue==='storm'));
 const capped=setup({scoreLimit:3});fight(capped);capped.roundWins={0:1};capped.boxRound=22;capped.endBoxRound(null,'time');assert.equal(capped.phase,'results');assert.equal(capped.seriesWinner,0,'A sole leading team wins the bounded series after repeated draws');
});
test('late humans spectate the active round and join an empty seat at the next boundary',()=>{
 const s=setup({teamSize:2});fight(s);const p=s.admitPlayer('late',{name:'Late Arrival'},{partyId:'late',partySize:1});assert.ok(p);assert.equal(s.players.size,3);assert.equal(p.health,0);assert.equal(p.waitingRound,true);s.tick(1/30);assert.equal(s.boxStage,'fight');assert.ok([...s.players.values()].every(p=>!p.bot));assert.ok(s.admitPlayer('fourth',{name:'Fourth Player'}));assert.equal(s.admitPlayer('overflow',{name:'No Room'}),null);s.endBoxRound(0);s.boxEnd=s.time;s.tick(1/30);assert.equal(s.players.size,4);assert.equal(p.health,100);assert.equal(p.spectating,false);assert.equal(p.waitingRound,false);
});
test('parties fit one team, oversized private parties can split, incomplete parties wait together',()=>{
 const s=new BoxFightSimulation({teamSize:2,fill:true});const a=s.addPlayer('a',{name:'Leader'});s.assignTeam(a,{partyId:'pair',partySize:2});s.startRound();assert.equal(a.health,0);const b=s.admitPlayer('b',{name:'Partner'},{partyId:'pair',partySize:2});assert.equal(a.team,b.team);assert.notEqual(a.teamSlot,b.teamSlot);s.addPlayer('c',{name:'Opponent'});s.beginBoxRound();assert.equal(a.health,100);assert.equal(b.health,100);
 const duel=new BoxFightSimulation({teamSize:1,fill:false});for(const id of ['one','two']){const p=duel.addPlayer(id,{name:id});duel.assignTeam(p,{partyId:'friends',partySize:2});}duel.startRound();assert.equal(duel.boxStage,'prepare');assert.equal(new Set([...duel.players.values()].map(p=>p.team)).size,2);
});
test('checkpoint restoration preserves round, edited structures, inventory, storm and series identity',()=>{
 const s=setup({boxArena:'rotate'}),a=s.players.get('a');Object.assign(a,{x:0,z:-6,yaw:0,pitch:0});buildingTick(s,a,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});editBuilding(s,a,'build-edit-18-'+s.builds[0].id);fight(s);a.inventory[1].ammo=2;s.roundWins={0:2,1:1};s.boxStarted=s.time-50;s.tick(1/30);
 const copy=new BoxFightSimulation(s.options).restore(s.checkpoint());assert.equal(copy.matchId,s.matchId);assert.equal(copy.boxStage,'fight');assert.deepEqual(copy.roundWins,s.roundWins);assert.equal(copy.builds[0].mask,18);assert.equal(copy.players.get('a').inventory[1].ammo,2);assert.deepEqual(copy.storm,s.storm);assert.equal(copy.map.id,s.map.id);assert.ok(!copy.map.boxes.some(b=>b.objectId==='box-divider'));copy.tick(1/30);assert.equal(copy.boxRound,1);
});
test('FFA opponents, map rotation and public series restart retain distinct rewards identity',()=>{
 const s=setup({boxFormat:'ffa',scoreLimit:1,boxArena:'rotate',recurring:true});s.tick(1/30);s.time=s.queueEnds;s.tick(1/30);fight(s);kill(s,'b','a');assert.equal(s.seriesWinner,'a');const frame=rewardFrame(s.snapshot(),'a',{});assert.equal(frame.mode,'boxfight');assert.equal(frame.round,1);assert.equal(frame.winnerId,'a');const id=s.matchId;s.time=s.publicRestartAt;s.tick(1/30);assert.notEqual(s.matchId,id);assert.equal(s.boxStage,'waiting');
 const rotate=setup({boxArena:'rotate'});fight(rotate);rotate.endBoxRound(0);rotate.beginBoxRound();fight(rotate);rotate.endBoxRound(0);rotate.beginBoxRound();assert.equal(rotate.map.id,'box-relay');
});
test('one player or one team waits without creating bots or awarding wins',()=>{
 for(const recurring of [false,true]){const s=new BoxFightSimulation({teamSize:2,fill:true,bots:7,recurring});const p=s.addPlayer('a',{name:'Human'});s.startRound();advance(s,30);assert.equal(s.players.size,1);assert.equal(s.boxRound,0);assert.equal(s.boxStage,'waiting');assert.equal(s.queueEnds,0);assert.deepEqual(s.roundWins,{});assert.equal(s.addPlayer('bot',{name:'Legacy bot'},true),null);s.addBots();assert.equal(s.players.size,1);const q=s.addPlayer('b',{name:'Opponent'});s.tick(1/30);assert.ok(s.queueEnds>s.time);s.time=s.queueEnds;s.tick(1/30);assert.equal(s.boxStage,'prepare');s.leavePlayer(q.id);s.tick(1/30);assert.equal(s.boxStage,'waiting');assert.equal(p.health,100);assert.equal(s.queueEnds,0);assert.deepEqual(s.roundWins,{});}
});
test('disconnect after a round leaves a human-only waiting room until opponents return',()=>{
 const s=setup({teamSize:2});fight(s);kill(s,'b','a');const wins={...s.roundWins};s.leavePlayer('b');s.boxEnd=s.time;s.tick(1/30);assert.equal(s.boxStage,'waiting');advance(s,20);assert.deepEqual(s.roundWins,wins);assert.equal(s.players.size,1);s.admitPlayer('new',{name:'Next Opponent'});s.tick(1/30);s.time=s.queueEnds;s.tick(1/30);assert.equal(s.boxStage,'prepare');assert.equal(s.players.get('new').health,100);
});

test('a party survivor can continue future rounds after a teammate leaves',()=>{
 const s=new BoxFightSimulation({teamSize:2});for(const [id,partyId] of [['a','one'],['b','two'],['c','one'],['d','two']]){const p=s.addPlayer(id,{name:'Operator '+id});s.assignTeam(p,{partyId,partySize:2});}s.startRound();fight(s);s.endBoxRound(0);s.leavePlayer('c');s.boxEnd=s.time;s.tick(1/30);assert.equal(s.boxStage,'prepare');assert.equal(s.players.get('a').health,100);assert.equal(s.players.size,3);assert.ok([...s.players.values()].every(p=>!p.bot));
});
