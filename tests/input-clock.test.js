import test from 'node:test';
import assert from 'node:assert/strict';
import {InputClock} from '../src/input-clock.js';
for(const hz of [2,15,30,60,144])test(`input clock preserves one second of movement at ${hz} Hz`,()=>{
 const clock=new InputClock();clock.reset(0);let count=0;
 for(let i=1;i<=hz;i++)count+=clock.take(i*1000/hz);
 assert.equal(count,60);
 assert.equal(clock.take(1000),0);
});
test('input recovery is bounded and hidden/session resets discard stale controls',()=>{
 const clock=new InputClock();clock.reset(0);assert.equal(clock.take(60000),30);
 clock.reset(120000);assert.equal(clock.take(120000),0);
 assert.equal(clock.take(120000+1000/60),1);
 const before=clock.last;assert.equal(clock.take(before-10),0);assert.equal(clock.last,before);
});
