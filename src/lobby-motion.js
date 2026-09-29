// Cinematic patrol: one travel clock drives stride, equipment and the conveyor.
// The operator stays framed in the lobby; no gameplay position is changed.
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*v*(v*(v*6-15)+10);};
const beat=(t,start,hold,end)=>smooth((t-start)/1.3)*(1-smooth((t-hold)/(end-hold)));
export const PATROL_SPEED=1.12;
export const PATROL_CYCLE=1.35;
export class LobbyMotion{
 constructor(offset=0){this.time=offset;this.distance=offset*PATROL_SPEED;this.yaw=Math.PI+.10;this.pitch=-.10;this.initialized=false;}
 update(dt){
  dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  this.time+=dt;this.distance+=PATROL_SPEED*dt;
  const t=this.time,c=t%28,phase=this.distance/PATROL_CYCLE*Math.PI*2;
  const left=beat(c,2.5,5.1,7.4),right=beat(c,13,16,18.5),ready=beat(c,8,10.5,12.8),lower=beat(c,21,24,26.6);
  const scan=-left*.42+right*.38+Math.sin(t*.33)*.035;
  const targetYaw=Math.PI+.10+scan*.12,targetPitch=-.10+ready*.065-lower*.13;
  const alpha=1-Math.exp(-dt*5);
  if(!this.initialized){this.yaw=targetYaw;this.pitch=targetPitch;this.initialized=true;}
  this.yaw+=(targetYaw-this.yaw)*alpha;this.pitch+=(targetPitch-this.pitch)*alpha;
  return {yaw:this.yaw,pitch:this.pitch,scan,headPitch:-lower*.04+Math.sin(t*1.7)*.008,
   speed:PATROL_SPEED,phase,distance:this.distance,cycleDistance:PATROL_CYCLE,
   bodyBob:-Math.cos(phase*2)*.018,bodySway:Math.sin(phase)*.012,
   roll:-.025+Math.sin(phase)*.012,grip:ready*.055-lower*.03,
   breath:Math.sin(t*1.7)*.003,lean:Math.sin(phase)*.016,ready,lower,
   weaponYaw:scan*.60,weaponSide:Math.sin(phase)*.007,
   weaponDepth:-ready*.045,weaponBob:Math.cos(phase*2)*.012,
   clip:ready>.25?'patrol-aim':lower>.25?'patrol-low-ready':left+right>.25?'patrol-scan':'patrol-forward'};
 }
}
