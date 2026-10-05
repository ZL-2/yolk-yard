import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {BOSSES} from '../src/bosses.js';
import {initializeBossAwareness,scanBossAwareness,alertBossToDamage,bossAlertVisual,BOSS_AWARENESS} from '../src/boss-awareness.js';
import {BOSS_VOICE_CLIPS,BOSS_VOICE_BANKS,BOSS_VOICE_RULES,requestBossVoice,bossCombatVoice,bossVoiceTick} from '../src/boss-voice.js';
import {bossVoiceAllowed,bossVoiceSpatial,BossVoiceAudio} from '../src/boss-voice-audio.js';
import {Sound} from '../src/audio.js';
import {RoyaleSimulation} from '../src/royale.js';import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
function encounter(def=BOSSES[0]){
 const boss={id:def.id,bossId:def.id,boss:true,health:def.health,spectating:false,flight:'ground',x:0,y:0,z:0,yaw:0,home:{x:0,y:0,z:0}},player={id:'human',contestant:true,health:100,spectating:false,flight:'ground',x:0,y:0,z:-12};
 const sim={time:100,round:1,options:{seed:22},eventId:0,events:[],map:{size:256,boxes:[]},players:new Map([[boss.id,boss],[player.id,player]]),emit(type,data){const e={id:++this.eventId,time:this.time,type,...data};this.events.push(e);return e;}};
 initializeBossAwareness(sim,boss);const scan=()=>scanBossAwareness(sim,boss,def,()=>false);return {sim,boss,player,scan};
}
test('all three bosses progress unaware → yellow question/suspicion → red confirmed alert',()=>{
 for(const def of BOSSES){const {sim,boss,scan}=encounter(def);assert.equal(bossAlertVisual(boss,sim.time),null);scan();assert.equal(boss.bossAlert,'suspicious');const mark=bossAlertVisual(boss,sim.time);assert.equal(mark.symbol,'?');assert.equal(mark.color,'#ffd447');assert.ok(mark.fill>0&&mark.fill<1);
  for(let i=0;i<12&&boss.bossAlert!=='alerted';i++){sim.time+=.2;scan();}assert.equal(boss.bossAlert,'alerted',def.name);assert.equal(boss.bossSuspicion,1);assert.equal(bossAlertVisual(boss,sim.time).symbol,'!');assert.equal(bossAlertVisual(boss,sim.time).color,'#ff303c');assert.ok(sim.events.some(e=>e.type==='boss-voice'&&e.cue==='alerted'));
 }
});
test('perception requires range, forward cone, line of sight and smoke visibility; ignores spectators and bus riders',()=>{
 for(const change of [{z:50},{spectating:true},{flight:'transport'},{health:0},{contestant:false}]){const {boss,player,scan}=encounter();Object.assign(player,change);scan();assert.equal(boss.bossAlert,'unaware');}
 const {sim,boss,scan}=encounter();sim.map.boxes=[{x:0,y:0,z:-5,w:10,d:1,h:5}];scan();assert.equal(boss.bossAlert,'unaware');sim.map.boxes=[];scanBossAwareness(sim,boss,BOSSES[0],()=>true);assert.equal(boss.bossAlert,'unaware');
});
test('shots behind a boss trigger investigation, not shooting through walls or immediate confirmed targeting',()=>{
 const {sim,boss,player,scan}=encounter();player.z=12;sim.emit('shot',{player:player.id,origin:{x:0,y:1.55,z:12}});scan();assert.equal(boss.bossAlert,'suspicious');assert.equal(boss.targetId,null);assert.equal(boss.bossPerception.lastKnown.z,12);assert.ok(boss.bossSuspicion<1);
 sim.time+=.4;scan();assert.equal(boss.bossAlert,'suspicious','heard position is investigated after shot ends');sim.time+=8;scan();assert.equal(boss.bossAlert,'unaware');
});
test('damage identifies the attacker immediately; losing sight searches last known position then returns to patrol',()=>{
 const {sim,boss,player,scan}=encounter();player.z=12;alertBossToDamage(sim,boss,player);assert.equal(boss.bossAlert,'alerted');assert.equal(boss.targetId,player.id);player.spectating=true;sim.time+=BOSS_AWARENESS.forgetSeconds+.1;scan();assert.equal(boss.bossAlert,'searching');assert.equal(boss.targetId,null);assert.equal(bossAlertVisual(boss,sim.time).symbol,'?');assert.equal(boss.bossPerception.lastKnown.z,12);sim.time+=8;scan();assert.equal(boss.bossAlert,'unaware');assert.equal(boss.bossPerception.lastKnown,null);
});
test('brief cover breaks cannot complete suspicion; home leash resets alert and markers vanish on death',()=>{
 const {sim,boss,player,scan}=encounter();scan();const fill=boss.bossSuspicion;player.health=0;sim.time+=.4;scan();assert.ok(boss.bossSuspicion<fill);boss.x=100;sim.time+=.2;scan();assert.equal(boss.bossAlert,'unaware');boss.bossAlert='alerted';boss.health=0;assert.equal(bossAlertVisual(boss,sim.time),null);
});
test('Rook retains visible recent-attacker grappler pursuit without extending passive sight or piercing cover',()=>{
 const def=BOSSES.find(b=>b.ability==='winch'),{sim,boss,player,scan}=encounter(def);player.z=-45;scan();assert.equal(boss.bossAlert,'unaware');
 boss.attackerId=player.id;boss.attackerAt=sim.time;alertBossToDamage(sim,boss,player);sim.time+=.2;scan();assert.equal(boss.bossAlert,'alerted');assert.equal(boss.targetId,player.id);
 boss.x=def.leash+1;boss.pursuitUntil=sim.time+2;player.x=boss.x;sim.time+=.2;scan();assert.equal(boss.targetId,player.id,'active pursuit may temporarily cross the home leash');
 sim.map.boxes=[{x:boss.x,y:0,z:-20,w:10,d:1,h:5}];sim.time+=.2;scan();assert.equal(boss.targetId,null,'recent damage cannot grant sight through cover');
 sim.map.boxes=[];boss.x=0;player.x=0;boss.attackerAt=sim.time-11;sim.time+=.2;scan();assert.equal(boss.targetId,null,'extended range expires with recent-attacker memory');
});
test('server-owned shuffled voice bags exhaust alternatives before reuse, without immediate repeats',()=>{
 const {sim,boss}=encounter();const clips=[];for(let i=0;i<8;i++){sim.time+=40;assert.equal(requestBossVoice(sim,boss,'patrol',{chance:false}),true);clips.push(sim.events.at(-1).clip);}
 assert.equal(new Set(clips.slice(0,4)).size,4);assert.equal(new Set(clips.slice(4)).size,4);for(let i=1;i<clips.length;i++)assert.notEqual(clips[i],clips[i-1]);
});
test('quiet lines cannot overlap; detection interrupts idle once; repeated fire does not retry chance every frame',()=>{
 const {sim,boss}=encounter();assert.equal(requestBossVoice(sim,boss,'idle',{chance:false}),true);assert.equal(requestBossVoice(sim,boss,'patrol',{chance:false}),false);sim.time+=.5;assert.equal(requestBossVoice(sim,boss,'alerted',{chance:false}),true);sim.time+=1;assert.equal(requestBossVoice(sim,boss,'alerted',{chance:false}),false);sim.time+=20;bossCombatVoice(sim,boss);const next=boss.bossVoice.combatAt,count=sim.events.length;for(let i=0;i<30;i++)bossCombatVoice(sim,boss);assert.equal(sim.events.length,count);assert.equal(boss.bossVoice.combatAt,next);
});
test('voice scheduling uses finite bounded intervals and does not change loot RNG or speak after death',()=>{
 const {sim,boss}=encounter();sim.random=()=>{throw Error('Do not consume shared loot RNG');};sim.time=1000;bossVoiceTick(sim,boss);assert.ok(boss.bossVoice.nextAt>=1020&&boss.bossVoice.nextAt<=1036);boss.health=0;assert.equal(requestBossVoice(sim,boss,'alerted'),false);
});
test('clip atlas is bounded, non-overlapping, locally served; every cue resolves a known clip',()=>{
 let end=0;for(const c of Object.values(BOSS_VOICE_CLIPS)){assert.ok(c.offset>=end);assert.ok(c.duration>0&&c.duration<3);assert.ok(c.start>=0&&c.end<=43.14);end=c.offset+c.duration;}
 for(const [cue,bank]of Object.entries(BOSS_VOICE_BANKS)){assert.ok(BOSS_VOICE_RULES[cue]);for(const id of bank)assert.ok(BOSS_VOICE_CLIPS[id]);}
 assert.ok(statSync(new URL('../public/audio/boss-voices.mp3',import.meta.url)).size<200000);assert.ok(readFileSync(new URL('../src/season-world.js',import.meta.url),'utf8').includes('scanBossAwareness'));
});
test('boss audio is disabled in warmup, on transport, outside matches; ground players and spectators at ground can hear it',()=>{
 const state={royale:{practice:false}};assert.equal(bossVoiceAllowed(state,{flight:'ground'}),true);assert.equal(bossVoiceAllowed(state,{flight:'ground'},false),false);assert.equal(bossVoiceAllowed({royale:{practice:true}},{flight:'ground'}),false);assert.equal(bossVoiceAllowed(state,{flight:'transport'}),false);assert.equal(bossVoiceAllowed({}, {flight:'ground'}),false);
});
test('Sound delivers spectator voice cues at the currently watched player rather than the eliminated player',()=>{
 const watched={id:'watched',x:12,flight:'ground'},spectator={id:'viewer',spectating:true,flight:'out'},state={players:[watched,spectator]},event={type:'boss-voice'};let heard;
 const sound={listener:{...watched,x:0},bossAudio:{event:(e,s,listener)=>{assert.equal(e,event);assert.equal(s,state);heard=listener;return 'scheduled';}}};
 assert.equal(Sound.prototype.event.call(sound,event,spectator,state),'scheduled');assert.equal(heard,watched,'use the latest watched coordinates, not the previous frame');
 Sound.prototype.event.call(sound,event,watched,state);assert.equal(heard,watched);state.players=[spectator];Sound.prototype.event.call(sound,event,spectator,state);assert.equal(heard,spectator,'missing watched player remains phase-gated');
});
test('voice gain falls with 3D distance, is silent beyond range, pans left/right and muffles behind scenery',()=>{
 const listener={x:0,y:0,z:0,yaw:0},source={x:2,y:1.55,z:0};assert.equal(bossVoiceSpatial(listener,source,36).gain,1);assert.ok(bossVoiceSpatial(listener,{...source,x:20},36).gain<.5);assert.equal(bossVoiceSpatial(listener,{...source,x:36},36).gain,0);assert.equal(bossVoiceSpatial(listener,{...source,x:0,y:50},36).gain,0);assert.ok(bossVoiceSpatial(listener,source,36).pan>0);assert.ok(bossVoiceSpatial(listener,{...source,x:-2},36).pan<0);const wall=bossVoiceSpatial(listener,source,36,true);assert.equal(wall.gain,.23);assert.ok(wall.cutoff<bossVoiceSpatial(listener,source,36).cutoff);
});
function audioRig(){
 const node=()=>({gain:{value:0,setTargetAtTime(){}},pan:{value:0,setTargetAtTime(){}},frequency:{setTargetAtTime(){}},playbackRate:{value:1},connect(){return this;},disconnect(){},start(){this.started=true;},stop(){this.onended?.();}});
 const sound={ctx:{currentTime:0,createBufferSource:node,createBiquadFilter:node,createGain:node,createStereoPanner:node},master:node(),enabled:true,volume:1,effectsVolume:1,clock:0,voices:new Set()},audio=new BossVoiceAudio(sound);
 audio.buffer={};const boss={id:'warden-aster',bossId:'warden-aster',boss:true,health:600,x:2,y:0,z:0},listener={id:'human',x:0,y:0,z:0,yaw:0,flight:'ground'},state={round:1,time:100,players:[boss],royale:{practice:false,matchId:'one'}};
 audio.update(state,listener,true,{size:256,boxes:[]});return {audio,sound,boss,listener,state,event:{id:1,time:100,type:'boss-voice',player:boss.id,bossId:boss.id,cue:'alerted',clip:'contact-b',x:2,y:1.55,z:0}};
}
test('client deduplicates events, enforces clip whitelist and overlap priorities, stops voices on match exit',async()=>{
 const {audio,state,listener,event}=audioRig();await audio.event(event,state,listener);assert.equal(audio.debug.plays,1);await audio.event(event,state,listener);assert.equal(audio.debug.plays,1);await audio.event({...event,id:2,clip:'quiet-a'},state,listener);assert.equal(audio.debug.plays,1);await audio.event({...event,id:3,cue:'combat',clip:'combat-a'},state,listener);assert.equal(audio.debug.plays,1);audio.update(state,listener,false);assert.equal(audio.active.size,0);assert.equal(audio.sound.voices.size,0);
});
test('client cancels pending decode on departure, rejects stale events and respects effects mute',async()=>{
 const rig=audioRig(),{audio,state,listener,event,sound}=rig;let finish;audio.buffer=null;audio.load=()=>new Promise(r=>finish=r);const pending=audio.event(event,state,listener);audio.update(state,listener,false);finish({});await pending;assert.equal(audio.debug.plays,0);audio.buffer={};audio.update(state,listener,true);await audio.event({...event,id:2,time:95},state,listener);assert.equal(audio.debug.plays,0);sound.effectsVolume=0;await audio.event({...event,id:3},state,listener);assert.equal(audio.debug.plays,0);
});
test('authority snapshot/delta and host migration preserve awareness and voice bags without sending private schedules',()=>{
 const s=new RoyaleSimulation({seed:31,bots:1,capacity:4});s.addPlayer('human',{name:'Human'});s.startRound();assert.equal(s.beginBattle(),true);const b=s.players.get(BOSSES[0].id);b.bossAlert='suspicious';b.bossSuspicion=.4;b.bossAlertAt=s.time;const e=new SnapshotEncoder(),d=new SnapshotDecoder();d.decode(e.encode({state:s.snapshot(),checkpoint:s.checkpoint()}).frame);b.bossAlert='alerted';b.bossSuspicion=1;s.time+=.5;requestBossVoice(s,b,'alerted',{chance:false});const packet=d.decode(e.encode({state:s.snapshot(),checkpoint:s.checkpoint()}).frame);const visible=packet.state.players.find(p=>p.id===b.id);assert.equal(visible.bossAlert,'alerted');assert.equal(visible.bossSuspicion,1);assert.equal(visible.bossVoice,undefined);const restored=new RoyaleSimulation({seed:31});restored.restore(s.checkpoint());assert.deepEqual(restored.players.get(b.id).bossVoice,b.bossVoice);assert.equal(restored.players.get(b.id).bossAlert,'alerted');assert.equal(requestBossVoice(restored,restored.players.get(b.id),'alerted',{chance:false}),false);
});
