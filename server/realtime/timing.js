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
export function recordTiming(room,phase,kind,ms){
 const timing=roomTiming(room),value=Math.max(0,Math.round(ms));
 const bucket=timing.phases[phase]??={stepMaxMs:0,gapMaxMs:0,broadcastMaxMs:0};
 bucket[kind]=Math.max(bucket[kind],value);
 if(kind==='stepMaxMs'||kind==='gapMaxMs')timing[kind]=Math.max(timing[kind],value);
}
