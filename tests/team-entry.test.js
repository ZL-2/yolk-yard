import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
test('retired Team Scramble normalizes to FFA and ignores legacy team entry actions',()=>{
 const s=new Simulation({mode:'teams',bots:0});const p=s.addPlayer('p',{name:'Player'});s.startRound();assert.equal(s.options.mode,'ffa');const team=p.team;
 for(const action of ['team-entry-0','team-entry-1']){s.playerAction(p.id,action);assert.equal(p.team,team);assert.equal(p.spawnRequested,false);}
});
test('Royale party teams are assigned by admission and cannot be changed by client entry actions',()=>{
 const s=new RoyaleSimulation({teamSize:2,capacity:4,bots:0}),h=s.addPlayer('host',{name:'Host'});s.assignTeam(h,{teamSize:2,partyId:'pair',partySize:2});s.startRound();
 const p=s.admitPlayer('mate',{name:'Mate'},{teamSize:2,partyId:'pair',partySize:2});assert.ok(p);assert.equal(p.team,h.team);const team=p.team;
 for(const action of ['team-entry-0','team-entry-1']){s.playerAction(p.id,action);assert.equal(p.team,team);}s.setProfile(p.id,{name:'Renamed'});assert.equal(p.team,team);
});
test('No Fill Royale teammates are not silently assigned to a different solo entrant',()=>{
 const s=new RoyaleSimulation({teamSize:2,teamFill:false,capacity:4,bots:0}),h=s.addPlayer('host',{name:'Host'});s.startRound();const p=s.admitPlayer('solo',{name:'Solo'},{teamSize:2,partyId:'solo',partySize:1,teamFill:false});assert.notEqual(p.team,h.team);
});
