// Capture and jitter-buffer playback run on the audio thread, outside rendering.
class VoiceAudio extends AudioWorkletProcessor {
 constructor(){super();this.frame=new Float32Array(1920);this.used=0;this.active=false;this.streams=new Map();this.port.onmessage=({data:m})=>{
  if(m.type==='capture'){this.active=m.active;this.used=0;}
  if(m.type==='clear'){if(m.id)this.streams.delete(m.id);else this.streams.clear();}
  if(m.type==='volume'){const s=this.streams.get(m.id);if(s)s.gain=m.value;}
  if(m.type==='audio'){
   let s=this.streams.get(m.id);if(!s){s={queue:[],index:0,remaining:0,gain:m.gain,started:false};this.streams.set(m.id,s);}
   if(s.remaining>sampleRate*.2){s.queue=[];s.index=0;s.remaining=0;s.started=false;}
   s.queue.push({samples:m.samples,ratio:m.rate/sampleRate});s.remaining+=m.samples.length*sampleRate/m.rate;s.gain=m.gain;
  }
 };}
 process(inputs,outputs){
  const input=inputs[0]?.[0],out=outputs[0]?.[0];
  if(input&&this.active)for(let i=0;i<input.length;i++){
   this.frame[this.used++]=input[i];
   if(this.used===this.frame.length){this.port.postMessage({type:'frame',samples:this.frame},[this.frame.buffer]);this.frame=new Float32Array(1920);this.used=0;}
  }
  if(out)for(const s of this.streams.values()){
   if(!s.started){if(s.remaining<sampleRate*.055)continue;s.started=true;}
   for(let i=0;i<out.length;i++){
    let q=s.queue[0];if(!q){s.started=false;s.index=0;s.remaining=0;break;}
    const at=Math.floor(s.index),fraction=s.index-at;
    out[i]+=(q.samples[at]*(1-fraction)+(q.samples[at+1]??q.samples[at])*fraction)*s.gain;
    s.index+=q.ratio;s.remaining--;
    if(s.index>=q.samples.length){s.index-=q.samples.length;s.queue.shift();}
   }
  }
  return true;
 }
}
registerProcessor('ravel-voice',VoiceAudio);
