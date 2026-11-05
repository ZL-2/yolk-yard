import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/public-match.js';
import {TOURNAMENT} from '../src/tournament.js';
for(const size of [1,2,3,4])for(const count of [0,7,8]){
 test(`every cup requires eight ready humans, team size ${size}, count ${count}`,async()=>{
  const opensAt=Date.parse('2026-12-10T17:00:00Z');
  const event={...TOURNAMENT,id:'minimum-'+size+'-'+count,teamSize:size,opensAt,lockAt:opensAt-180000,startsAt:opensAt+60000};
  let now=opensAt;
  const f=await fixture({serverOptions:{tournamentOptions:{events:[event],now:()=>now,autoStart:false}}});
  try{
   const t=f.app.relay.tournament;t.tick();const sim=t.room.sim;
   for(let n=0;n<count;n++){const p=sim.addPlayer('ready-'+n,{name:'Ready '+n});Object.assign(p,{bot:false,connected:true,loading:false,contestant:true,team:n%2});}
   // Loading clients, bots and spectators must not satisfy the minimum.
   for(const [id,extra]of [['loading',{loading:true}],['bot',{bot:true}],['watcher',{contestant:false,lateSpectator:true}],['offline',{connected:false}]]){
    const p=sim.addPlayer(id,{name:id});Object.assign(p,{connected:true,loading:false,contestant:true,...extra});
   }
   now=event.startsAt;t.tick();
   assert.equal(t.phase,count<8?'cancelled':'running');
   if(count<8){assert.equal(t.locked,false);assert.match(t.state.message,/Not enough players.*8 required/);assert.deepEqual(t.state.results,[]);t.tick();assert.equal(t.phase,'cancelled');}
  }finally{await f.close();}
 });
}
