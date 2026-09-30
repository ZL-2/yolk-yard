export const RADIO_LINES={spawn:'ready',deploy:'war_go_go_go',reload:'war_reloading',grenade:'war_fire_in_the_hole',downed:'war_medic'};
const COOLDOWNS={spawn:4,deploy:20,reload:18,grenade:8,downed:15};
// Local operator only: no network messages, remote voices, result announcements or queued chatter.
export class OperatorRadio{
 constructor(sound){this.sound=sound;this.buffers=new Map();this.pending=new Map();this.cooldowns=new Map();this.generation=0;this.active=null;this.previous=null;}
 preload(){for(const line of Object.values(RADIO_LINES))void this.load(line);}
 load(line){
  if(this.buffers.has(line))return Promise.resolve(this.buffers.get(line));
  if(this.pending.has(line))return this.pending.get(line);
  const ctx=this.sound.ctx;if(!ctx||!ctx.decodeAudioData||typeof location==='undefined')return Promise.resolve(null);
  const task=fetch(new URL('audio/voice/'+line+'.ogg',new URL(import.meta.env?.BASE_URL||'./',location.href)),{signal:AbortSignal.timeout(8000)})
   .then(r=>{if(!r.ok)throw Error('voice unavailable');return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).then(b=>{this.buffers.set(line,b);return b;}).catch(()=>null).finally(()=>this.pending.delete(line));
  this.pending.set(line,task);return task;
 }
 async say(kind){
  const s=this.sound,c=s.ctx,line=RADIO_LINES[kind];
  if(!line||!c||c.state!=='running'||!s.enabled||s.volume<=0||s.effectsVolume<=0||this.active||s.clock<(this.cooldowns.get(kind)||0))return;
  this.cooldowns.set(kind,s.clock+COOLDOWNS[kind]);
  const generation=this.generation;this.active={};const buffer=await this.load(line);
  if(generation!==this.generation)return;
  if(!buffer||!s.enabled||c.state!=='running'||s.volume<=0||s.effectsVolume<=0){this.active=null;return;}
  const source=c.createBufferSource(),high=c.createBiquadFilter(),low=c.createBiquadFilter(),gain=c.createGain();
  source.buffer=buffer;high.type='highpass';high.frequency.value=380;low.type='lowpass';low.frequency.value=3400;gain.gain.value=.65*s.effectsVolume;
  source.connect(high).connect(low).connect(gain).connect(s.master);this.active={source,gain};
  s.cue('radio-open',null,.65);source.start(c.currentTime+.09);
  source.onended=()=>{source.disconnect();high.disconnect();low.disconnect();gain.disconnect();if(this.active?.source===source){this.active=null;if(generation===this.generation)s.cue('radio-close',null,.5);}};
 }
 update(state,me,playing){
  if(!playing){if(this.active)this.stop();return;}
  if(!state||!me){this.reset();return;}
  if(this.active?.gain)this.active.gain.gain.value=this.sound.enabled?.65*this.sound.effectsVolume:0;
  const alive=me.health>0&&!me.spectating&&!me.awaitingEntry&&!me.loading&&!me.downed&&state.phase!=='results';
  const previous=this.previous;
  if(alive&&(!previous||!previous.alive)){this.sound.cue('gear-ready',null,.7);this.sound.cue('operator-ready',null,.7);void this.say('spawn');}
  if(alive&&me.flight==='transport'&&previous?.flight!=='transport')void this.say('deploy');
  if(me.downed&&!previous?.downed)void this.say('downed');
  if(!alive&&!me.downed&&this.active)this.stop();
  this.previous={alive,flight:me.flight,downed:!!me.downed};
 }
 event(e,me){if(!me||me.spectating||me.awaitingEntry||me.health<=0||me.downed||e.player!==me.id)return;if(e.type==='reload')void this.say('reload');if(e.type==='launch'&&e.popper)void this.say('grenade');}
 stop(){this.generation++;const source=this.active?.source;this.active=null;try{source?.stop();}catch{}}
 reset(){if(this.previous||this.active){this.stop();this.previous=null;this.cooldowns.clear();}}
}
