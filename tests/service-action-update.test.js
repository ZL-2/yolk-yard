import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BoxFightSimulation} from '../src/box-fights.js';
import {ZoneWarsSimulation} from '../src/zone-wars.js';
import {checkpointWorldKey} from '../src/action-network.js';
import {problemText} from '../src/problem-reports.js';
import {updateEditView} from '../src/building-view.js';
import {rewardFrame} from '../src/rewards.js';
const match=(options={})=>{const s=new BoxFightSimulation({teamSize:1,scoreLimit:5,...options});s.addPlayer('a',{name:'Alpha'});s.addPlayer('b',{name:'Bravo'});s.startRound();return s;};
test('1v1 departures award a series exactly once in preparation, combat and between rounds',()=>{
 for(const stage of ['prepare','fight','intermission'])for(const recurring of [false,true]){const s=match({recurring});if(s.boxStage==='waiting')s.beginBoxRound();s.boxStage=stage;const team=s.players.get('b').team;s.leavePlayer('a');assert.equal(s.phase,'results');assert.equal(s.seriesWinner,team);assert.equal(s.roundReason,'forfeit');assert.equal(rewardFrame(s.snapshot(),'b',{}).winnerTeam,team);const events=s.events.length;s.leavePlayer('a');s.tick(1/60);assert.equal(s.events.length,events);assert.equal(s.players.get('b').kills,0);}
});
test('waiting rooms, spectators, reconnect suspension, team matches and Zone Wars do not award 1v1 forfeits',()=>{
 const waiting=new BoxFightSimulation();waiting.addPlayer('a',{name:'Alpha'});waiting.addPlayer('b',{name:'Bravo'});waiting.leavePlayer('a');assert.notEqual(waiting.phase,'results');
 const s=match();s.suspendPlayer('a');assert.equal(s.phase,'playing');s.addPlayer('watcher',{name:'Watcher'},false,true);s.leavePlayer('watcher');assert.equal(s.phase,'playing');
 const team=match({teamSize:2});team.leavePlayer('a');assert.notEqual(team.phase,'results');
 const zone=new ZoneWarsSimulation();zone.addPlayer('a',{name:'Alpha'});zone.addPlayer('b',{name:'Bravo'});zone.startRound();zone.leavePlayer('a');assert.notEqual(zone.phase,'results');
});
test('recovery checkpoint ignores 120 construction/damage-only updates but includes every ownership and result transition',()=>{
 const s=match(),state=s.snapshot();state.royale.builds=[{id:1,owner:'a',health:100,revision:0,mask:0}];const before=checkpointWorldKey(state);
 for(let i=0;i<120;i++){state.royale.builds[0].health++;state.royale.buildVersion++;assert.equal(checkpointWorldKey(state),before);}
 for(const change of [v=>v.royale.lootVersion++,v=>v.royale.builds[0].revision++,v=>v.royale.worldDamage.wall={destroyed:true},v=>v.players[0].health=0,v=>v.phase='results']){const key=checkpointWorldKey(state);change(state);assert.notEqual(checkpointWorldKey(state),key);}
});
test('edit hover reuses all tile geometry instead of allocating and disposing on pointer movement',()=>{
 const rv={root:new T.Group(),view:{disposeGroup(){throw Error('Hover disposed geometry');}}},c={editDraft:{id:1,type:'wall',x:0,y:0,z:0,rotation:0,mask:0,path:[]},editValid:false,editHover:0};updateEditView(rv,c);const group=rv.editOverlay,geometries=group.children.map(m=>m.geometry);
 for(let i=0;i<100;i++){c.editHover=i%9;updateEditView(rv,c);assert.equal(rv.editOverlay,group);assert.deepEqual(group.children.map(m=>m.geometry),geometries);}for(const m of group.children){m.geometry?.dispose();m.material?.dispose();}
});
test('support payloads include useful bounded diagnostics without URL or credentials',()=>{
 const value=problemText({title:'Disconnected',message:'Host lost',build:'abc',mode:'zonewars',screen:'game',room:'ABCDEFGH',token:'secret',url:'https://example.com/?token=secret'},'x'.repeat(2000));assert.ok(value.length<=1000);assert.match(value,/Host lost/);assert.match(value,/zonewars/);assert.doesNotMatch(value,/secret|https:/);
});
