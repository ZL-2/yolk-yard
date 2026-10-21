import {synthesizeShot} from './firearm-audio.js';

export class CampaignAudio{
 constructor(){this.sources=new Set();this.volume=.65;this.radio=true;}
 async start(){
  if(this.ctx){await this.ctx.resume();return;}
  const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
  const c=this.ctx=new Context(),master=this.master=c.createGain();master.gain.value=this.volume;master.connect(c.destination);this.buffers=new Map();
  for(const [name,id]of [['rifle','zipper'],['pistol','pip'],['enemy','sprinter']]){const pcm=synthesizeShot(id,c.sampleRate,2),b=c.createBuffer(1,pcm.length,c.sampleRate);b.copyToChannel(pcm,0);this.buffers.set(name,b);}
  const noise=c.createBuffer(1,c.sampleRate*3,c.sampleRate),d=noise.getChannelData(0);let low=0;
  for(let i=0;i<d.length;i++){low+=(Math.random()*2-1-low)*.08;d[i]=low;}this.noise=noise;
  const rain=c.createBufferSource();rain.buffer=noise;rain.loop=true;const filter=c.createBiquadFilter();filter.type='highpass';filter.frequency.value=950;const gain=c.createGain();gain.gain.value=.24;rain.connect(filter).connect(gain).connect(master);rain.start();this.sources.add(rain);
  this.drone=c.createGain();this.drone.gain.value=.021;this.drone.connect(master);
  for(const frequency of [43.65,65.41,87.4]){const o=c.createOscillator();o.type='sine';o.frequency.value=frequency;o.connect(this.drone);o.start();this.sources.add(o);}
 }
 setVolume(value){this.volume=value;if(this.master)this.master.gain.setTargetAtTime(value,this.ctx.currentTime,.05);}
 tone(frequency=800,duration=.08,volume=.12,delay=0){
  if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type='sine';o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(this.master);o.start(t);o.stop(t+duration+.01);this.sources.add(o);o.onended=()=>{this.sources.delete(o);o.disconnect();g.disconnect();};
 }
 sound(name,volume=1,pan=0){
  if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,source=c.createBufferSource(),g=c.createGain(),p=c.createStereoPanner();source.buffer=this.buffers.get(name)||this.noise;source.playbackRate.value=name==='step'?2.2:name==='explosion'?.5:1+(Math.random()-.5)*.04;g.gain.value=volume*(name==='step'?.16:name==='explosion'?1.8:.55);p.pan.value=Math.max(-1,Math.min(1,pan));source.connect(g).connect(p).connect(this.master);const now=c.currentTime;
  if(name==='step'||name==='click'||name==='explosion'){const duration=name==='explosion'?1.6:name==='step'?.12:.045;g.gain.exponentialRampToValueAtTime(.001,now+duration);source.start();source.stop(now+duration);}else source.start();
  this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();g.disconnect();p.disconnect();};
 }
 speak(text){
  this.tone(920,.06,.06);this.tone(1250,.04,.04,.08);
  if(!this.radio||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
  window.speechSynthesis.cancel();const line=new SpeechSynthesisUtterance(text);const voices=window.speechSynthesis.getVoices();line.voice=voices.find(v=>/en-(GB|US)/i.test(v.lang)&&/Daniel|David|Google UK English Male/i.test(v.name))||voices.find(v=>v.lang.startsWith('en'))||null;line.lang='en-GB';line.rate=.96;line.pitch=.83;line.volume=this.volume*.8;window.speechSynthesis.speak(line);
 }
 intensity(value){if(this.drone)this.drone.gain.setTargetAtTime(.018+value*.028,this.ctx.currentTime,1.5);}
 helicopter(level){
  if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx;
  if(!this.rotor){const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),pcm=buffer.getChannelData(0);let low=0;for(let i=0;i<pcm.length;i++){const t=i/c.sampleRate;low+=(Math.random()*2-1-low)*.035;pcm[i]=(low*2+Math.sin(t*Math.PI*92)*.1)*(.2+.8*Math.pow(Math.max(0,Math.sin(t*Math.PI*36)),3));}const source=c.createBufferSource();source.buffer=buffer;source.loop=true;const gain=c.createGain();gain.gain.value=0;source.connect(gain).connect(this.master);source.start();this.sources.add(source);this.rotor={source,gain,level:0};}
  if(Math.abs(this.rotor.level-level)>.03){this.rotor.level=level;this.rotor.gain.gain.setTargetAtTime(level*.7,c.currentTime,.5);}
 }
 pause(){window.speechSynthesis?.cancel();void this.ctx?.suspend();}
 resetMission(){window.speechSynthesis?.cancel();if(this.rotor){this.rotor.source.stop();this.rotor.source.disconnect();this.rotor.gain.disconnect();this.sources.delete(this.rotor.source);this.rotor=null;}}
 dispose(){window.speechSynthesis?.cancel();for(const s of this.sources)try{s.stop();s.disconnect();}catch{}this.sources.clear();void this.ctx?.close();this.ctx=null;this.rotor=null;}
}
