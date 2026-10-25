// Presentation-only jitter buffer. The same target time is used for shot timing.
const continuous=(a,b)=>a&&b&&a.health>0&&b.health>0&&a.flight===b.flight&&a.vehicleId===b.vehicleId&&a.vehicleSeat===b.vehicleSeat&&a.zVehicle===b.zVehicle&&Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<=12;
export class RemotePoses {
 constructor(){this.samples=[];this.key=null;this.delay=.1;this.jitter=0;this.arrival=null;}
 receive(state,arrival){
  const key=`${state.royale?.matchId}:${state.round}:${state.phase}`;
  if(this.key!==key||state.time<(this.samples.at(-1)?.time??state.time)){this.samples=[];this.key=key;this.delay=.1;this.jitter=0;this.arrival=null;}
  const previous=this.samples.at(-1);
  if(Number.isFinite(arrival)&&previous&&state.time>previous.time&&this.arrival!==null){
   const cadence=state.time-previous.time,gap=(arrival-this.arrival)/1000;
   if(gap>=0&&gap<1){this.jitter+=(Math.abs(gap-cadence)-this.jitter)*.15;const target=Math.max(.06,Math.min(.16,cadence*1.6+this.jitter*2));this.delay+=(target-this.delay)*(target>this.delay?.3:.04);}
  }
  if(!this.samples.length||state.time>this.samples.at(-1).time){
   this.samples.push({time:state.time,players:new Map((state.players||[]).map(p=>[p.id,p]))});
   if(this.samples.length>8)this.samples.shift();if(Number.isFinite(arrival))this.arrival=arrival;
  }
 }
 targetTime(time){const latest=this.samples.at(-1)?.time;return Math.min(latest===undefined?time:latest+(this.samples.length>1?.075:0),Math.max(this.samples[0]?.time??time,time-this.delay));}
 players(state,local,time){
  const target=this.targetTime(time);
  let a=this.samples[0],b=a;
  for(const s of this.samples){b=s;if(s.time>=target)break;a=s;}
  return (state.players||[]).map(p=>{
   if(p.id===local?.id)return local;
   if(p.presentationAt!==undefined&&p.health>0){
    let older=null,newer=null,olderTime=0,newerTime=0;
    for(const sample of this.samples){const row=sample.players.get(p.id);if(!row)continue;const stamp=row.presentationAt??sample.time;if(stamp<=target){older=row;olderTime=stamp;}else{newer=row;newerTime=stamp;break;}}
    if(older){if(!continuous(older,p)||newer&&!continuous(older,newer))return p;const pose={...p};if(newer&&newerTime>olderTime){const f=Math.max(0,Math.min(1,(target-olderTime)/(newerTime-olderTime)));for(const axis of ['x','y','z','pitch'])pose[axis]=older[axis]+(newer[axis]-older[axis])*f;pose.lean=(older.lean||0)+((newer.lean||0)-(older.lean||0))*f;pose.yaw=older.yaw+Math.atan2(Math.sin(newer.yaw-older.yaw),Math.cos(newer.yaw-older.yaw))*f;}
     else{const age=Math.max(0,Math.min(.12,target-olderTime));pose.x=older.x+(older.vx||0)*age;pose.y=older.y+(older.vy||0)*age;pose.z=older.z+(older.vz||0)*age;pose.yaw=older.yaw;pose.pitch=older.pitch;}
     return pose;
    }
   }
   const previous=a?.players.get(p.id),next=b?.players.get(p.id);
   if(!continuous(previous,next)||!continuous(next,p))return p;
   const f=b.time>a.time?Math.max(0,Math.min(1,(target-a.time)/(b.time-a.time))):1;
   const pose={...p};
   for(const axis of ['x','y','z','pitch'])pose[axis]=previous[axis]+(next[axis]-previous[axis])*f;
   pose.lean=(previous.lean||0)+((next.lean||0)-(previous.lean||0))*f;
   const angle=Math.atan2(Math.sin(next.yaw-previous.yaw),Math.cos(next.yaw-previous.yaw));
   pose.yaw=previous.yaw+angle*f;
   // Bridge one missing packet using known velocity. Bound the prediction and
   // never detach passengers or interpolate through a traversal/teleport.
   if(target>b.time&&!p.vehicleId&&!p.zVehicle&&!p.mantle&&!p.traversal){const age=Math.min(.075,target-b.time),speed=Math.hypot(next.vx||0,next.vy||0,next.vz||0),dt=Math.min(age,.75/Math.max(1,speed));pose.x+=(next.vx||0)*dt;pose.y+=(next.grounded?0:next.vy||0)*dt;pose.z+=(next.vz||0)*dt;}
   return pose;
  });
 }
}
