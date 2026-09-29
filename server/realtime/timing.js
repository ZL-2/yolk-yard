// Fixed labels and bounded aggregates only; no identities or gameplay content.
export function timingPhase(sim){
 if(['spawn-island','starting','waiting'].includes(sim.stage))return 'spawn';
 if(sim.stage==='battle-bus')return 'bus';
 if(['drop','active'].includes(sim.stage))return 'battle';
 return sim.phase==='playing'?'battle':'lobby';
}
export function roomTiming(room){
 const key=`${room.sim.matchId||''}:${room.sim.round||0}`;
 if(room.timingKey!==key){room.timingKey=key;room.timing={stepMaxMs:0,gapMaxMs:0,phases:{}};}
 if(Number.isFinite(room.sim.departureMs))room.timing.departureMs=room.sim.departureMs;
 return room.timing;
}
export function recordTiming(room,phase,kind,ms,cpuMs){
 const timing=roomTiming(room),value=Math.max(0,Math.round(ms));
 const bucket=timing.phases[phase]??={stepMaxMs:0,gapMaxMs:0,broadcastMaxMs:0};
 // Pair CPU with the SAME slowest wall-time sample, not a separate maximum.
 const cpuKey=kind==='stepMaxMs'?'stepCpuAtMaxMs':kind==='broadcastMaxMs'?'broadcastCpuAtMaxMs':null;
 if(value>bucket[kind]||(value===bucket[kind]&&cpuKey&&bucket[cpuKey]===undefined)){
  bucket[kind]=value;
  if(cpuKey&&Number.isFinite(cpuMs))bucket[cpuKey]=Math.max(0,Math.round(cpuMs*10)/10);
 }

 if(kind==='stepMaxMs'||kind==='gapMaxMs')timing[kind]=Math.max(timing[kind],value);
}

export function startTiming(){return {wall:performance.now(),cpu:process.cpuUsage()};}
export function finishTiming(start){
 const wallMs=performance.now()-start.wall,cpu=process.cpuUsage(start.cpu);
 return {wallMs,cpuMs:(cpu.user+cpu.system)/1000};
}
