import test from 'node:test';
import assert from 'node:assert/strict';
import {OperatorRadio,RADIO_LINES} from '../src/operator-radio.js';
test('personal spawn, transport and downed transitions do not repeat on snapshots or pause',()=>{
 const cues=[],lines=[],radio=new OperatorRadio({cue:id=>cues.push(id)});radio.say=id=>lines.push(id);
 const me={id:'me',health:100},state={phase:'playing'};
 radio.update(state,{...me,awaitingEntry:true},true);assert.equal(lines.length,0);
 radio.update(state,me,true);radio.update(state,me,true);assert.deepEqual(lines,['spawn']);assert.deepEqual(cues,['gear-ready','operator-ready']);
 radio.update(state,me,false);radio.update(state,me,true);assert.equal(lines.length,1);
 radio.update(state,{...me,flight:'transport'},true);radio.update(state,{...me,flight:'transport'},true);assert.equal(lines.at(-1),'deploy');
 radio.update(state,{...me,downed:true},true);radio.update(state,{...me,downed:true},true);assert.equal(lines.filter(x=>x==='downed').length,1);
 radio.update(state,{...me,health:0,spectating:true},true);radio.update(state,{...me,spectating:true},true);assert.equal(lines.filter(x=>x==='spawn').length,1);
});
test('reload and grenade callouts exclude other players, spectators and result lines',()=>{
 const lines=[],radio=new OperatorRadio({});radio.say=id=>lines.push(id);const me={id:'me',health:100};
 radio.event({type:'reload',player:'other'},me);radio.event({type:'reload',player:'me'},{...me,spectating:true});radio.event({type:'launch',player:'me',popper:false},me);
 assert.equal(lines.length,0);radio.event({type:'reload',player:'me'},me);radio.event({type:'launch',player:'me',popper:true},me);assert.deepEqual(lines,['reload','grenade']);
 assert.deepEqual(Object.keys(RADIO_LINES),['spawn','deploy','reload','grenade','downed']);
});
test('voice playback is bounded, honors mute and discards late loads after leaving',async()=>{
 const nodes=[];const node=()=>{const n={frequency:{},gain:{},connect(){return this;},disconnect(){},start(){n.started=true;},stop(){n.stopped=true;}};nodes.push(n);return n;};
 const s={clock:0,enabled:true,volume:1,effectsVolume:1,ctx:{state:'running',currentTime:0,createBufferSource:node,createBiquadFilter:node,createGain:node},master:{},cue(){}};
 const radio=new OperatorRadio(s);radio.load=async()=>({});await radio.say('reload');const source=radio.active.source;await radio.say('grenade');assert.equal(radio.active.source,source);source.onended();await radio.say('reload');assert.equal(radio.active,null);
 s.clock=20;s.effectsVolume=0;await radio.say('reload');assert.equal(radio.active,null);s.effectsVolume=1;
 let resolve;radio.load=()=>new Promise(r=>resolve=r);const pending=radio.say('spawn');radio.reset();resolve({});await pending;assert.equal(radio.active,null);
 assert.equal(nodes.filter(n=>n.started).length,1);
});
