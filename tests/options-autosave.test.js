import test from 'node:test';
import assert from 'node:assert/strict';
import {OptionsAutosave} from '../src/lobby-options.js';

test('rapid edits are serialized and only the newest waiting choice is sent',async()=>{
 const calls=[],done=[],statuses=[];
 const saver=new OptionsAutosave(s=>{calls.push(s);return new Promise(resolve=>done.push(resolve));},s=>statuses.push(s));
 const first=saver.save({scoreLimit:3});saver.save({scoreLimit:5});saver.save({scoreLimit:7});
 assert.deepEqual(calls,[{scoreLimit:3}]);done.shift()();await Promise.resolve();
 assert.deepEqual(calls,[{scoreLimit:3},{scoreLimit:7}]);done.shift()();assert.equal(await first,true);
 assert.equal(statuses.at(-1),'Changes saved');assert.equal(await saver.flush(),true);
});
test('failed saves are reported and a later edit can recover',async()=>{
 const statuses=[];let fail=true;const saver=new OptionsAutosave(async()=>{if(fail)throw Error('Connection interrupted');},(s,error)=>statuses.push([s,error]));
 assert.equal(await saver.save({teamSize:2}),false);assert.equal(await saver.flush(),false);
 assert.deepEqual(statuses.at(-1),['Connection interrupted',true]);fail=false;
 assert.equal(await saver.save({teamSize:4}),true);assert.equal(statuses.at(-1)[0],'Changes saved');
});
test('a queued newer choice survives an earlier failed save',async()=>{
 let reject;const calls=[];const saver=new OptionsAutosave(s=>{calls.push(s);return calls.length===1?new Promise((_,r)=>reject=r):Promise.resolve();});
 const finished=saver.save({access:'public'});saver.save({access:'private'});reject(Error('Temporary failure'));
 assert.equal(await finished,true);assert.deepEqual(calls,[{access:'public'},{access:'private'}]);
});
