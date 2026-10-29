import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
test('full Royale advances two minutes beyond bus departure without collision-cache stalls',{timeout:45000},()=>{const s=new RoyaleSimulation({fill:true,capacity:48,seed:42});s.addPlayer('host',{name:'Emergency QA'});s.startRound();s.beginBattle();let worst=0;for(let i=0;i<3600;i++){const t=performance.now();s.tick(1/30);worst=Math.max(worst,performance.now()-t);}assert.ok(s.time>=119);assert.equal(s.map.chestCollisionMap,undefined);assert.ok(worst<500,`worst tick ${worst}ms`);console.log({time:s.time,stage:s.stage,worstTickMs:worst});});
