import test from 'node:test';
import assert from 'node:assert/strict';
import {LobbyMusic} from '../src/lobby-music.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fake(){return {paused:true,currentTime:0,volume:0,plays:0,play(){this.paused=false;this.plays++;return Promise.resolve();},pause(){this.paused=true;}};}
test('music waits for gesture, follows volume, pauses hidden/gameplay and restarts on return',async()=>{
 const audio=fake(),m=new LobbyMusic(()=>audio);m.update(true,.016);assert.equal(m.audio,null);
 m.unlock();await flush();assert.equal(audio.paused,false);assert.equal(audio.loop,true);
 for(let i=0;i<120;i++)m.update(true,1/60);assert.ok(Math.abs(audio.volume-.135)<.001);assert.equal(audio.plays,1);
 m.setVolume(0);m.update(true,.016);assert.equal(audio.paused,true);
 m.setVolume(.25);m.update(true,.016);await flush();assert.equal(audio.paused,false);
 audio.currentTime=23;m.update(true,.016,true);assert.equal(audio.paused,true);assert.equal(audio.currentTime,23);
 m.update(true,.016,false);await flush();assert.equal(audio.paused,false);
 m.update(false,.016);assert.equal(audio.paused,true);assert.equal(audio.currentTime,0);
 m.update(true,.016);await flush();assert.equal(audio.paused,false);assert.equal(audio.currentTime,0);
});
test('rejected autoplay remains retryable and never leaks playback into gameplay',async()=>{
 const audio=fake();audio.play=()=>Promise.reject(new Error('gesture required'));const m=new LobbyMusic(()=>audio);
 m.update(true,.016);m.unlock();await flush();assert.equal(m.pending,false);
 audio.play=()=>new Promise(resolve=>{audio.finish=()=>{audio.paused=false;resolve();};});m.unlock();m.update(false,.016);audio.finish();await flush();assert.equal(audio.paused,true);
});
