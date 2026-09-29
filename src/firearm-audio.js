// Original deterministic sound design, synthesized as pressure/noise transients.
// Each design has different envelopes, action timing and spectral structure;
// none uses a sampled commercial game sound or a pitch-shifted shared recording.
export const FIREARM_SOUNDS={
 sprinter:{duration:.27,body:118,crack:.72,bass:.36,tail:.10,decay:19,action:.067,metal:.19,bands:[.17,.53,.30],seed:31},
 scatter:{duration:.49,body:68,crack:.91,bass:.65,tail:.24,decay:11,action:.16,metal:.10,bands:[.48,.41,.11],pellets:5,seed:47},
 needle:{duration:.65,body:49,crack:1,bass:.75,tail:.28,decay:8,action:.34,metal:.26,bands:[.33,.32,.35],seed:73},
 zipper:{duration:.17,body:196,crack:.51,bass:.19,tail:.035,decay:36,action:.038,metal:.28,bands:[.10,.45,.45],seed:101},
 thumper:{duration:.72,body:39,crack:.32,bass:.78,tail:.34,decay:7,action:.21,metal:.17,bands:[.61,.31,.08],rocket:true,seed:131},
 anchor:{duration:.38,body:92,crack:.88,bass:.48,tail:.17,decay:13,action:.094,metal:.23,bands:[.24,.51,.25],seed:157},
 duet:{duration:.22,body:156,crack:.7,bass:.29,tail:.08,decay:26,action:.049,metal:.22,bands:[.16,.62,.22],seed:181},
 pip:{duration:.20,body:215,crack:.76,bass:.23,tail:.055,decay:29,action:.042,metal:.31,bands:[.09,.38,.53],seed:211},
 peeper:{duration:.46,body:76,crack:.84,bass:.50,tail:.21,decay:12,action:.19,metal:.32,bands:[.30,.37,.33],seed:239},
 doubleyolk:{duration:.43,body:84,crack:.92,bass:.61,tail:.15,decay:14,action:.29,metal:.36,bands:[.38,.48,.14],pellets:3,seed:269},
 comet:{duration:.35,body:430,crack:.38,bass:.27,tail:.14,decay:14,action:.14,metal:.08,bands:[.12,.59,.29],energy:true,seed:293},
};
export function synthesizeShot(id,sampleRate=44100,variation=0){
 const p=FIREARM_SOUNDS[id]||FIREARM_SOUNDS.sprinter,out=new Float32Array(Math.ceil(p.duration*sampleRate));let seed=p.seed+variation*7919,low=0,mid=0,peak=0;
 for(let i=0;i<out.length;i++){
  const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=seed/2147483648-1;
  low+=Math.min(1,1800/sampleRate)*(white-low);mid+=Math.min(1,11000/sampleRate)*(white-mid);
  const lowBand=low*4,midBand=(mid-low)*2.4,highBand=white-mid;
  const blast=(p.bands[0]*lowBand+p.bands[1]*midBand+p.bands[2]*highBand)*p.crack*Math.exp(-t*p.decay)*Math.min(1,t/.0007);
  const pressure=Math.sin(2*Math.PI*p.body*(t-.26*t*t))*p.bass*Math.exp(-t*(p.decay*.78));
  const crack=highBand*Math.exp(-t*280)*.4;
  const tail=(midBand*.65+lowBand*.35)*p.tail*Math.exp(-t*6)*(1-Math.exp(-t*80));
  const a=t-p.action,action=a>0?(highBand*.65+Math.sin(a*Math.PI*2600)*.35)*p.metal*Math.exp(-a*120):0;
  let value=blast+pressure+crack+tail+action;
  if(p.pellets)for(let k=1;k<=p.pellets;k++){const q=t-k*.0027;if(q>0)value+=highBand*.10*Math.exp(-q*200);}
  if(p.rocket)value+=lowBand*Math.sin(Math.min(1,t/.24)*Math.PI/2)*.3*Math.exp(-t*5);
  if(p.energy)value+=Math.sin(2*Math.PI*(780*t-620*t*t)+Math.sin(t*150)*2)*.18*Math.exp(-t*11);
  value=Math.tanh(value*1.1)*.78*Math.min(1,(p.duration-t)/.025);out[i]=value;peak=Math.max(peak,Math.abs(value));
 }
 return out;
}
export function reloadSequence(id,duration){
 const shell=['scatter','doubleyolk'].includes(id),bolt=['needle','peeper'].includes(id),launcher=id==='thumper',pistol=id==='pip';
 if(shell)return [{cue:'reload-out',at:.02,scale:.8},{cue:'reload-in',at:duration*.3,scale:.75},{cue:'reload-in',at:duration*.56,scale:.8},{cue:'pump-action',at:duration*.86,scale:1}];
 return [{cue:launcher?'launcher-open':'reload-out',at:.01,scale:pistol?.7:1},{cue:id==='comet'?'cell-seat':'reload-in',at:duration*.64,scale:pistol?.8:1},{cue:bolt?'bolt-action':'reload-bolt',at:duration*.87,scale:launcher?.7:.85}];
}
