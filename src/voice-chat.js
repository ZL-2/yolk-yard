import {relayURL} from './relay-peer.js';
import workletURL from './voice-worklet.js?url&no-inline';
const defaults={enabled:false,microphone:false,access:'everybody',method:'ptt',key:'Backquote',preferred:'party',volume:.85,input:'',output:'',sensitivity:.012,indicators:true,muted:[],volumes:{}};
const bounded=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
function voiceSettings(stored){
 const s=stored&&typeof stored==='object'?stored:{};
 return {...defaults,access:['everybody','friends','team','off'].includes(s.access)?s.access:defaults.access,method:s.method==='open'?'open':'ptt',key:typeof s.key==='string'&&/^(Key[A-Z]|Digit[0-9]|Backquote|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Minus|Equal|F[1-9]|F1[0-2])$/.test(s.key)?s.key:defaults.key,preferred:['party','team','game'].includes(s.preferred)?s.preferred:'party',volume:bounded(s.volume,0,1,defaults.volume),sensitivity:bounded(s.sensitivity,.003,.08,defaults.sensitivity),input:typeof s.input==='string'?s.input.slice(0,200):'',output:typeof s.output==='string'?s.output.slice(0,200):'',indicators:s.indicators!==false,muted:Array.isArray(s.muted)?s.muted.filter(id=>typeof id==='string').slice(-100):[],volumes:Object.fromEntries(Object.entries(s.volumes&&typeof s.volumes==='object'?s.volumes:{}).slice(-100).map(([id,v])=>[id,bounded(v,0,2,1)]))};
}
export class VoiceChat {
 constructor({party,network,state,bindings=()=>({}),onChange=()=>{}}){
  this.getParty=party;this.getNetwork=network;this.getState=state;this.getBindings=bindings;this.onChange=onChange;let stored;try{stored=JSON.parse(localStorage.getItem('ravel-voice-settings'));}catch{}
  this.settings=voiceSettings(stored);this.settings.enabled=stored?.enabled===true;this.settings.microphone=stored?.microphone===true;
  this.enabled=this.settings.enabled;this.micMuted=true;this.deafened=false;this.channels=[];this.decoders=new Map();this.speaking=new Map();this.status=this.enabled?'Restoring voice…':'Voice off';this.generation=0;this.sequence=0;
  this.timer=setInterval(()=>this.maintain(),1000);this.levelTimer=setInterval(()=>this.onChange(),200);
  this.keydown=e=>{if(e.code===this.settings.key&&!e.repeat&&!e.target.closest?.('input,textarea,select,[contenteditable="true"]')){this.ptt=true;this.captureGate();}};
  this.keyup=e=>{if(e.code===this.settings.key){this.ptt=false;this.captureGate();}};
  this.blur=()=>{this.ptt=false;this.captureGate();};window.addEventListener('keydown',this.keydown);window.addEventListener('keyup',this.keyup);window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.blur);
  // Resume a remembered session on any normal interaction if autoplay is blocked.
  this.unlock=()=>{if(!this.enabled||this.closed)return;if(this.context?.state==='suspended')void this.context.resume().catch(()=>{});};
  document.addEventListener('click',this.unlock);document.addEventListener('keydown',this.unlock);
  queueMicrotask(()=>{if(this.enabled&&!this.closed)void this.enable({restore:true});});
 }
 persist(){try{localStorage.setItem('ravel-voice-settings',JSON.stringify(this.settings));}catch{}}
 save(){this.persist();if(this.settings.access==='off')this.clearAudio();this.sendSettings();this.captureGate();this.onChange();}
 bindKey(code){if(code==='Escape')return;const used=Object.entries(this.getBindings()).find(([,keys])=>keys?.includes(code));if(used){this.error='That key is already assigned to '+used[0]+'. Choose another key.';return;}if(voiceSettings({key:code}).key!==code){this.error='Choose a letter, number, punctuation, or function key.';return;}this.settings.key=code;this.ptt=false;this.error='';this.save();}
 async prepareAudio(){
  if(!this.context){
   const context=this.context=new AudioContext({sampleRate:48000,latencyHint:'interactive'});
   try{await context.audioWorklet.addModule(workletURL);}catch(error){await context.close();this.context=null;throw error;}
   this.node=new AudioWorkletNode(context,'ravel-voice',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
   this.master=context.createGain();this.master.gain.value=this.settings.volume;this.node.connect(this.master).connect(context.destination);
   this.node.port.onmessage=({data:m})=>{if(m.type==='frame')this.encode(m.samples);};
   this.opus=false;
   if(globalThis.AudioEncoder&&globalThis.AudioDecoder)try{
    const config={codec:'opus',sampleRate:48000,numberOfChannels:1,bitrate:24000,opus:{frameDuration:20000,complexity:5,application:'voip',signal:'voice'}};
    if((await AudioEncoder.isConfigSupported(config)).supported&&(await AudioDecoder.isConfigSupported({codec:'opus',sampleRate:48000,numberOfChannels:1})).supported){
     this.encoderConfig=config;this.encoder=new AudioEncoder({output:chunk=>{if(!this.canTransmit())return;const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);this.sendAudio(1,bytes);},error:()=>{this.opus=false;this.error='Voice switched to compatibility audio.';this.sendSettings();}});this.encoder.configure(config);this.opus=true;
    }
   }catch{}
  }
 }
 async audio(){
  if(!this.audioSetup)this.audioSetup=this.prepareAudio().catch(error=>{this.audioSetup=null;throw error;});
  await this.audioSetup;
  if(this.context.state!=='running'){const previous=this.status,waiting='Voice ready · click or press a key to resume audio';this.status=waiting;this.onChange();await this.context.resume();if(this.status===waiting)this.status=previous;}if(this.context.state!=='running')throw Error('Click or press a key to resume voice audio.');
  if(this.settings.output&&this.context.setSinkId)await this.context.setSinkId(this.settings.output);
 }
 async enable({restore=false}={}){if(this.enabling&&this.enablingGeneration===this.generation||this.closed)return;this.enabling=true;this.enabled=true;this.settings.enabled=true;if(!restore&&this.settings.access==='off')this.settings.access='everybody';this.persist();this.error='';this.status='Starting voice…';const generation=this.enablingGeneration=this.generation;try{await this.audio();if(generation!==this.generation||!this.enabled)return;await this.connect();if(generation===this.generation&&this.settings.microphone&&!this.stream&&!this.micPending)await this.microphone();}catch(e){if(generation===this.generation){this.error=e.message;this.status='Voice unavailable';}}finally{if(generation===this.enablingGeneration)this.enabling=false;this.onChange();}}
 disable({remember=true}={}){this.enabled=false;if(remember){this.settings.enabled=false;this.persist();}this.generation++;this.ws?.close();this.ws=null;this.stopMic();this.clearAudio();this.status='Voice off';this.onChange();}
 async connect(){
  const party=this.getParty();if(!this.enabled||!this.node||this.context?.state!=='running'||this.connecting||!party?.ready||this.ws?.readyState===0||this.ws?.readyState===1)return;
  this.connecting=true;const generation=this.generation;this.status='Connecting…';this.onChange();
  try{
   const {token}=await party.request('voice-ticket');if(generation!==this.generation||!this.enabled)return;
   const url=new URL(relayURL());url.pathname='/voice';const ws=this.ws=new WebSocket(url,window.RAVEL_OWNER_SESSION?['ravelfront',`owner.${window.RAVEL_OWNER_SESSION}`]:[]);ws.binaryType='arraybuffer';
   ws.onopen=()=>{if(ws!==this.ws)return;ws.send(JSON.stringify({type:'join',token,...this.wireSettings()}));};
   ws.onmessage=e=>{if(ws!==this.ws)return;if(e.data instanceof ArrayBuffer){this.receiveAudio(e.data);return;}const m=JSON.parse(e.data);if(m.type==='state'){
    const changed=this.channel!==m.channel||this.scope!==m.scope;this.scope=m.scope;this.channel=m.channel;this.channels=m.channels;this.wire=m.wire;this.status='Connected';if(changed){this.resetEncoder();this.ptt=false;this.clearAudio();}
    const audible=new Set(this.members().filter(p=>p.channel===this.channel).map(p=>p.wire));for(const id of this.decoders.keys())if(!audible.has(id))this.clearPeer(id);
    this.captureGate();this.onChange();
   }};
   ws.onerror=()=>{};ws.onclose=e=>{if(ws!==this.ws)return;this.ws=null;this.clearAudio();this.captureGate();if(e.code===4001){this.enabled=false;this.stopMic();this.status='Voice moved to another tab';}else this.status=this.enabled?'Reconnecting…':'Voice off';this.onChange();};
  }catch(e){this.error=e.message;this.status='Reconnecting…';}finally{this.connecting=false;}
 }
 wireSettings(){return {channel:this.channel||this.settings.preferred,preferred:this.settings.preferred,access:this.settings.access,micMuted:this.micMuted||!this.stream,deafened:this.deafened,codec:this.opus?'opus':'pcm',muted:this.settings.muted};}
 sendSettings(){if(this.ws?.readyState===1)this.ws.send(JSON.stringify({type:'settings',...this.wireSettings()}));if(this.master)this.master.gain.value=this.deafened?0:Math.max(0,Math.min(1,this.settings.volume));}
 members(){return this.channels.find(c=>c.id===this.channel)?.members||[];}
 selectChannel(id){if(!this.channels.find(c=>c.id===id)?.available)return;this.resetEncoder();this.channel=id;this.ptt=false;this.clearAudio();this.sendSettings();this.captureGate();this.onChange();}
 resetEncoder(){if(this.encoder?.state==='configured'){this.encoder.reset();this.encoder.configure(this.encoderConfig);}}
 async microphone(){
  if(!this.enabled||this.micPending)return;this.micPending=true;this.error='';const generation=this.micGeneration=(this.micGeneration||0)+1;
  try{
   await this.audio();if(!this.enabled||generation!==this.micGeneration)return;const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true,...(this.settings.input?{deviceId:{exact:this.settings.input}}:{})},video:false});
   if(!this.enabled||generation!==this.micGeneration){stream.getTracks().forEach(t=>t.stop());return;}
   this.stopMic(false);this.stream=stream;this.source=this.context.createMediaStreamSource(stream);this.source.connect(this.node);this.micMuted=false;this.settings.microphone=true;this.persist();
   stream.getAudioTracks()[0].onended=()=>{if(this.stream!==stream)return;this.stopMic();this.error='Microphone disconnected. Choose a device and enable it again.';this.sendSettings();this.onChange();};
  }catch(e){if(generation!==this.micGeneration)return;this.error=e.name==='NotAllowedError'?'Microphone permission was denied. Allow it in your browser site settings, then try again.':e.name==='NotFoundError'?'No microphone found. You can still listen.':e.name==='NotReadableError'?'Microphone is busy or unavailable. Check your device and try again.':e.message;this.micMuted=true;}finally{this.micPending=false;}
  this.sendSettings();this.captureGate();this.onChange();
 }
 stopMic(invalidate=true){if(invalidate)this.micGeneration=(this.micGeneration||0)+1;this.source?.disconnect();this.source=null;this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;this.micMuted=true;this.captureGate();}
 mute(){if(this.micPending){this.stopMic();this.settings.microphone=false;this.persist();this.sendSettings();this.onChange();return;}if(!this.stream)return this.microphone();this.micMuted=!this.micMuted;this.settings.microphone=!this.micMuted;this.persist();this.ptt=false;this.sendSettings();this.captureGate();this.onChange();}
 deafen(){this.deafened=!this.deafened;this.ptt=false;this.clearAudio();this.sendSettings();this.captureGate();this.onChange();}
 canTransmit(){return this.enabled&&this.status==='Connected'&&this.ws?.readyState===1&&!!this.channel&&!!this.stream&&!this.micMuted&&!this.deafened&&this.settings.access!=='off'&&!document.hidden&&(this.settings.method==='open'||this.ptt);}
 captureGate(){const active=this.canTransmit();for(const t of this.stream?.getAudioTracks()||[])t.enabled=!!active;if(this.captureActive!==!!active){this.captureActive=!!active;if(!active){this.resetEncoder();this.level=0;this.lastLoud=0;}this.node?.port.postMessage({type:'capture',active:!!active});}if(!active)this.speaking.delete('self');}
 encode(samples){
  if(!this.canTransmit())return;let power=0;for(const v of samples)power+=v*v;this.level=Math.sqrt(power/samples.length);const now=performance.now();
  if(this.level>this.settings.sensitivity)this.lastLoud=now;
  if(now-(this.lastLoud||0)>220)return;
  this.speaking.set('self',now+300);
  const useOpus=this.opus&&this.members().every(p=>p.self||p.codec==='opus');
  if(useOpus&&this.encoder.state==='configured'&&this.encoder.encodeQueueSize<4){
   const data=new AudioData({format:'f32-planar',sampleRate:48000,numberOfFrames:samples.length,numberOfChannels:1,timestamp:(this.audioTime||0),data:samples});this.audioTime=(this.audioTime||0)+40000;this.encoder.encode(data);data.close();
  }else{
   const pcm=new Int16Array(640);for(let i=0;i<pcm.length;i++){const v=(samples[i*3]+samples[i*3+1]+samples[i*3+2])/3;pcm[i]=Math.round(Math.max(-1,Math.min(1,v))*32767);}this.sendAudio(0,new Uint8Array(pcm.buffer));
  }
 }
 sendAudio(codec,bytes){if(!this.canTransmit()||this.ws.bufferedAmount>8192)return;const frame=new Uint8Array(bytes.length+6);frame[0]=codec;new DataView(frame.buffer).setUint32(2,++this.sequence,true);frame.set(bytes,6);this.ws.send(frame);}
 receiveAudio(buffer){
  if(!this.enabled||this.deafened||this.settings.access==='off'||!this.node||buffer.byteLength<11)return;
  const view=new DataView(buffer),wire=view.getUint32(0,true),codec=view.getUint8(4),seq=view.getUint32(6,true),member=this.members().find(p=>p.wire===wire&&p.channel===this.channel);
  if(!member||member.self||this.settings.muted.includes(member.id))return;
  const gain=Math.max(0,Math.min(2,this.settings.volumes[member.id]??1));this.speaking.set(wire,performance.now()+350);
  if(codec===0){const pcm=new Int16Array(buffer,10),samples=new Float32Array(pcm.length);for(let i=0;i<pcm.length;i++)samples[i]=pcm[i]/32768;this.play(wire,samples,16000,gain);}
  else if(codec===1&&this.opus){
   let decoder=this.decoders.get(wire);if(!decoder){decoder=new AudioDecoder({output:data=>{const samples=new Float32Array(data.numberOfFrames);data.copyTo(samples,{planeIndex:0,format:'f32-planar'});const rate=data.sampleRate;data.close();const current=this.members().find(p=>p.wire===wire&&p.channel===this.channel);if(current&&!this.deafened&&!this.settings.muted.includes(current.id))this.play(wire,samples,rate,this.settings.volumes[current.id]??1);},error:()=>this.clearPeer(wire)});decoder.configure({codec:'opus',sampleRate:48000,numberOfChannels:1});this.decoders.set(wire,decoder);}
   if(decoder.state==='configured'&&decoder.decodeQueueSize<8)decoder.decode(new EncodedAudioChunk({type:'key',timestamp:seq*20000,data:new Uint8Array(buffer,10)}));
  }
 }
 play(id,samples,rate,gain){this.node?.port.postMessage({type:'audio',id,samples,rate,gain},[samples.buffer]);}
 clearPeer(id){const d=this.decoders.get(id);if(d&&d.state!=='closed')d.close();this.decoders.delete(id);this.node?.port.postMessage({type:'clear',id});this.speaking.delete(id);}
 clearAudio(){for(const id of this.decoders.keys())this.clearPeer(id);this.node?.port.postMessage({type:'clear'});this.speaking.clear();}
 mutePlayer(id){const set=new Set(this.settings.muted);set.has(id)?set.delete(id):set.add(id);this.settings.muted=[...set].slice(-100);const p=this.members().find(p=>p.id===id);if(p)this.clearPeer(p.wire);this.save();}
 async devices(){try{return await navigator.mediaDevices.enumerateDevices();}catch{return [];}}
 async maintain(){
  const party=this.getParty(),net=this.getNetwork(),state=this.getState();
  // Browser hosts also publish the authoritative roster for other players' voice.
  if((this.enabled||net?.ready&&net.isHost)&&party?.ready&&!this.contextPending){
   const peer=net?.peer,host=net?.aliasPeer||peer,m=net?.ready&&state&&peer?.resume?{peer:peer.id,proof:peer.resume.resume,host:host?.id,hostId:net.id,...(net.isHost?{roster:state.players.filter(p=>!p.bot&&!p.boss&&!p.henchman).map(p=>({id:p.id,team:p.team,squad:p.zSquad,spectator:!!p.friendSpectator||p.contestant===false}))}:{})}:{};
   this.contextPending=true;party.request('voice-context',m).catch(()=>{}).finally(()=>{this.contextPending=false;});
  }
  if(this.enabled){await this.connect();if(this.ws?.readyState===1)this.ws.send(JSON.stringify({type:'ping',at:Date.now()}));}
 }
 close(){this.closed=true;this.disable({remember:false});clearInterval(this.timer);clearInterval(this.levelTimer);this.encoder?.close();this.context?.close();window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.blur);document.removeEventListener('click',this.unlock);document.removeEventListener('keydown',this.unlock);}
}
