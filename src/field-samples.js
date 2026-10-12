export const FIELD_SAMPLES=Object.freeze({
 elimination:{file:'field-elimination.mp3',volume:.55,radius:38,cap:2,category:'effects'},
 step:{file:'field-footstep.mp3',volume:.21,radius:26,cap:8,category:'effects'},
 birds:{file:'field-birds.mp3',volume:.30,radius:65,cap:1,category:'ambience'},
});

export function birdLocation(map,listener){
 if(!map||!listener||listener.flight&&listener.flight!=='ground'||listener.health<=0)return null;
 const habitat=map.districts?.find(p=>['woods','farm','crater'].includes(p.id)&&Math.hypot(listener.x-p.x,listener.z-p.z)<65);
 if(!habitat)return null;
 // Roofs and recessed vaults should not sound like open woodland.
 if(map.buildings?.some(b=>Math.abs(listener.x-b.x)<b.w/2&&Math.abs(listener.z-b.z)<b.d/2&&listener.y<b.baseY+b.h))return null;
 if(map.vaults?.some(v=>Math.abs(listener.x-v.x)<(v.width||18)/2&&Math.abs(listener.z-v.z)<(v.depth||18)/2&&listener.y<v.y+4))return null;
 return {x:listener.x+(habitat.x-listener.x)*.35+8,y:listener.y+4,z:listener.z+(habitat.z-listener.z)*.35-6};
}

export class FieldSamples{
 constructor(sound){this.sound=sound;this.buffers=new Map();this.active=new Map();this.loading=null;this.attempted=false;this.debug={plays:{},loads:0};}
 load(){
  if(this.loading)return this.loading;if(this.attempted||!this.sound.ctx)return Promise.resolve();
  this.attempted=true;const ctx=this.sound.ctx;
  this.loading=Promise.all(Object.entries(FIELD_SAMPLES).map(async([id,rule])=>{
   try{this.debug.loads++;const r=await fetch(new URL('audio/'+rule.file,document.baseURI));if(!r.ok)return;const buffer=await ctx.decodeAudioData(await r.arrayBuffer());this.buffers.set(id,buffer);}catch{/* Procedural cues remain available offline. */}
  })).finally(()=>{this.loading=null;});return this.loading;
 }
 play(id,position=null,scale=1,rate=1){
  const s=this.sound,rule=FIELD_SAMPLES[id],buffer=this.buffers.get(id);
  if(!rule||!buffer)return false;
  // A loaded sample consumes the cue even when muted/limited (no fallback stacking).
  if(!s.ctx||!s.enabled||s.volume<=0||s.voices.size>=56)return true;
  const voices=this.active.get(id)||new Set();if(voices.size>=rule.cap)return true;
  const spatial=s.spatial(position?{...position,radius:rule.radius}:null),volume=rule.volume*scale*spatial.gain*(rule.category==='ambience'?s.ambienceVolume:s.effectsVolume);
  if(volume<.0002)return true;
  const c=s.ctx,source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();
  source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=volume;pan.pan.value=spatial.pan;
  source.connect(gain).connect(pan).connect(s.master);s.voices.add(source);voices.add(source);this.active.set(id,voices);
  source.onended=()=>{s.voices.delete(source);voices.delete(source);source.disconnect();gain.disconnect();pan.disconnect();};source.start();
  this.debug.plays[id]=(this.debug.plays[id]||0)+1;return true;
 }
 stop(){for(const voices of this.active.values())for(const source of voices)try{source.stop();}catch{}this.active.clear();}
}
