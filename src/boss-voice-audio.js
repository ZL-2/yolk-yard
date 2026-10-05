import {wallDistance} from './physics.js';
import {BOSS_VOICE_CLIPS,BOSS_VOICE_BANKS,BOSS_VOICE_RULES,BOSS_VOICE_PROFILES} from './boss-voice.js';
export function bossVoiceAllowed(state,listener,playing=true){return !!playing&&!!state?.royale&&!state.royale.practice&&listener?.flight==='ground';}
export function bossVoiceSpatial(listener,position,range,occluded=false){
 const dx=position.x-listener.x,dy=position.y-((listener.y||0)+1.55),dz=position.z-listener.z,d=Math.hypot(dx,dy,dz);
 const fade=d<=4?1:d>=range?0:Math.pow(1-(d-4)/(range-4),1.65);
 return {gain:fade*(occluded?.23:1),pan:Math.max(-.95,Math.min(.95,(dx*Math.cos(listener.yaw||0)-dz*Math.sin(listener.yaw||0))/Math.max(1,d))),cutoff:occluded?1000:Math.max(2400,6500-d*55),distance:d};
}
export class BossVoiceAudio{
 constructor(sound){this.sound=sound;this.active=new Map();this.seen=new Set();this.buffer=null;this.loading=null;this.generation=0;this.checkAt=0;this.debug={plays:0,last:null};}
 load(){
  if(this.buffer)return Promise.resolve(this.buffer);if(this.loading)return this.loading;
  const ctx=this.sound.ctx;if(!ctx)return Promise.resolve(null);
  this.loading=fetch(new URL('audio/boss-voices.mp3',document.baseURI)).then(r=>{if(!r.ok)throw Error('Boss audio unavailable');return r.arrayBuffer();}).then(bytes=>ctx.decodeAudioData(bytes)).then(buffer=>this.buffer=buffer).catch(()=>null).finally(()=>this.loading=null);return this.loading;
 }
 stop(){this.generation++;for(const voice of this.active.values())try{voice.source.stop();}catch{}this.active.clear();}
 stopVoice(id){const v=this.active.get(id);if(v)try{v.source.stop();}catch{}this.active.delete(id);}
 async event(e,state,listener){
  const rule=BOSS_VOICE_RULES[e.cue],clip=BOSS_VOICE_CLIPS[e.clip],s=this.sound;
  if(e.type!=='boss-voice'||!rule||!clip||!BOSS_VOICE_BANKS[e.cue].includes(e.clip)||![e.x,e.y,e.z,e.time].every(Number.isFinite)||this.seen.has(e.id)||!bossVoiceAllowed(state,listener)||!s.ctx||!s.enabled||s.volume<=0||s.effectsVolume<=0||s.voices.size>=56)return;
  this.seen.add(e.id);if(this.seen.size>240)this.seen.delete(this.seen.values().next().value);
  this.state=state;this.listener=listener;
  if((state.time||0)-e.time>1.25)return;
  const initial=bossVoiceSpatial(listener,e,rule.range);if(initial.gain<=.001)return;
  const generation=this.generation,buffer=await this.load();if(!buffer||generation!==this.generation||!bossVoiceAllowed(this.state,this.listener,this.playing)||!s.enabled||s.volume<=0||s.effectsVolume<=0||s.voices.size>=56)return;
  const actor=this.state.players?.find(p=>p.id===e.player);if(!actor?.boss||actor.health<=0)return;
  const old=this.active.get(e.player);if(old&&old.priority>=rule.priority)return;if(old)this.stopVoice(e.player);
  if(this.active.size>=2){const lowest=[...this.active.values()].sort((a,b)=>a.priority-b.priority)[0];if(lowest.priority>=rule.priority)return;this.stopVoice(lowest.player);}
  const profile=BOSS_VOICE_PROFILES[e.bossId]||BOSS_VOICE_PROFILES['warden-aster'],age=Math.max(0,(this.state.time||0)-e.time);
  if(age>1.25||age*profile.rate>=clip.duration)return;
  const c=s.ctx,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=buffer;source.playbackRate.value=profile.rate;filter.type='lowpass';gain.gain.value=0;
  source.connect(filter).connect(gain).connect(pan).connect(s.master);
  const v={source,filter,gain,pan,player:e.player,priority:rule.priority,range:rule.range,volume:profile.volume,position:e};this.active.set(e.player,v);s.voices.add(source);this.position(v,actor);
  source.onended=()=>{if(this.active.get(e.player)===v)this.active.delete(e.player);s.voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();};
  source.start(c.currentTime,clip.offset+age*profile.rate,clip.duration-age*profile.rate);this.debug.plays++;this.debug.last={player:e.player,cue:e.cue,clip:e.clip};
 }
 position(v,actor){
  const listener=this.listener,map=this.map;if(!listener)return;
  const pos=actor?{x:actor.x,y:actor.y+1.55,z:actor.z}:v.position,from={x:listener.x,y:listener.y+1.55,z:listener.z},dx=pos.x-from.x,dy=pos.y-from.y,dz=pos.z-from.z,len=Math.hypot(dx,dy,dz);
  const occluded=!!map&&len>.5&&wallDistance(map,from,{x:dx/len,y:dy/len,z:dz/len},len)<len-.35;
  const spatial=bossVoiceSpatial(listener,pos,v.range,occluded),c=this.sound.ctx;
  v.gain.gain.setTargetAtTime(this.sound.enabled?spatial.gain*v.volume*this.sound.effectsVolume:0,c.currentTime,.045);v.pan.pan.setTargetAtTime(spatial.pan,c.currentTime,.045);v.filter.frequency.setTargetAtTime(spatial.cutoff,c.currentTime,.045);
 }
 update(state,listener,playing,map){
  this.state=state;this.listener=listener;this.playing=playing;this.map=map;
  const key=(state?.royale?.matchId||'')+':'+(state?.round||0),allowed=bossVoiceAllowed(state,listener,playing);
  if(this.worldKey!==key){this.stop();this.seen.clear();this.worldKey=key;}
  if(!allowed){if(this.allowed||this.active.size)this.stop();this.allowed=false;return;}this.allowed=true;
  if(!this.sound.ctx||this.sound.clock<this.checkAt)return;this.checkAt=this.sound.clock+.1;
  for(const [id,v]of this.active){const p=state.players?.find(p=>p.id===id);if(!p||p.health<=0)this.stopVoice(id);else this.position(v,p);}
  if(!this.buffer&&!this.loading&&!this.retryAt&&state.players?.some(p=>p.boss&&p.health>0&&Math.hypot(p.x-listener.x,p.z-listener.z)<80))this.load().then(b=>{if(!b)this.retryAt=this.sound.clock+20;});
  if(this.retryAt&&this.sound.clock>=this.retryAt)this.retryAt=0;
 }
}
