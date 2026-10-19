import test from 'node:test';
import assert from 'node:assert/strict';
import {ShaderPreparation} from '../src/shader-preparation.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('stalled shader preparation releases rendering at its deadline',async()=>{
 const errors=[],gate=new ShaderPreparation({timeout:15,onError:e=>errors.push(e.message)});
 gate.start(()=>new Promise(()=>{}));assert.ok(gate.pending);
 await new Promise(r=>setTimeout(r,30));assert.equal(gate.pending,null);assert.match(errors[0],/timed out/);
});
test('leaving cancels preparation immediately and late completion cannot clear a new match',async()=>{
 const gate=new ShaderPreparation();let finish;
 gate.start(()=>new Promise(r=>finish=r));gate.cancel();assert.equal(gate.pending,null);
 const next=gate.start(()=>new Promise(()=>{}));finish();await flush();assert.equal(gate.pending,next);gate.cancel();
});
test('successful, rejected and synchronously failed preparation all release rendering',async()=>{
 const errors=[],gate=new ShaderPreparation({onError:e=>errors.push(e.message)});
 gate.start(()=>Promise.resolve());await flush();assert.equal(gate.pending,null);
 gate.start(()=>Promise.reject(Error('rejected')));await flush();assert.equal(gate.pending,null);
 gate.start(()=>{throw Error('sync');});assert.equal(gate.pending,null);assert.deepEqual(errors,['rejected','sync']);
});
