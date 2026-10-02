// One travel clock drives the grounded stride and the moving lobby scenery.
// The upper-body patrol is a continuous, looping sequence of sector checks.
export const PATROL_SPEED=1.12;
export const PATROL_CYCLE=1.35;
export const PATROL_SCAN_CYCLE=31;
const sectors=[.28,.66,.58,-.34,-.72,-.63,.08,.55,.26,-.18,-.61,.1];
const aiming=[.85,.75,.35,.95,.30,.90,.75,.95,.30,.65,.80,.95];
const lowReady=[0,.04,.30,0,.34,0,.04,0,.32,.10,.04,0];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Periodic cubic interpolation keeps angular velocity continuous at each cue
// and at the loop boundary. All channels sample the same authored timeline.
function track(values,time){
 const step=PATROL_SCAN_CYCLE/values.length,x=((time/step)%values.length+values.length)%values.length,i=Math.floor(x),u=x-i;
 const at=n=>values[(n+values.length)%values.length],a=at(i-1),b=at(i),c=at(i+1),d=at(i+2);
 return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u);
}
export class LobbyMotion{
 constructor(offset=0){this.time=offset;this.distance=offset*PATROL_SPEED;}
 update(dt){
  dt=Number.isFinite(dt)?clamp(dt,0,.1):0;
  this.time+=dt;this.distance+=PATROL_SPEED*dt;
  const t=this.time,phase=this.distance/PATROL_CYCLE*Math.PI*2;
  // Eyes lead the rifle, shoulders follow, and the pelvis keeps walking forward.
  const scan=track(sectors,t+.40),rifle=track(sectors,t-.12),body=track(sectors,t-.65);
  const ready=clamp(track(aiming,t-.15),0,1),lower=clamp(track(lowReady,t-.15),0,.45);
  const weaponYaw=rifle*.86+Math.sin(phase)*.010*(1-ready*.75);
  const hipYaw=Math.sin(phase)*.026,spineYaw=body*.20,chestYaw=rifle*.57-Math.sin(phase)*.018;
  const torsoYaw=hipYaw+spineYaw+chestYaw,look=scan*(1-ready*.75)+weaponYaw*ready*.75;
  const bodySway=Math.sin(phase)*.047-Math.sin(phase*2)*.008+body*.027;
  this.yaw=Math.PI+.12+track(sectors,t-.90)*.17+Math.sin(phase)*.013;
  this.pitch=-.125+ready*.112-lower*.25+Math.sin(t*.9)*.014*(1-ready*.8);
  return {yaw:this.yaw,pitch:this.pitch,scan,gazeYaw:look,headYaw:look-torsoYaw,
   spineYaw,chestYaw,hipYaw,headPitch:-ready*.055-lower*.035+Math.sin(t*1.7)*.008,
   headRoll:-ready*.075+Math.sin(phase)*.012,
   speed:PATROL_SPEED,phase,distance:this.distance,cycleDistance:PATROL_CYCLE,
   bodyBob:-Math.cos(phase*2)*.024,bodySway,
   roll:-.035-ready*.045+Math.sin(phase)*.018*(1-ready*.7),grip:ready*.095-lower*.065,
   breath:Math.sin(t*1.7)*.003,lean:Math.sin(phase)*.034+body*.027,ready,lower,
   // Rotate around the inner shoulder instead of swinging the stock away from it.
   weaponYaw,weaponSide:bodySway+.12*Math.cos(torsoYaw)-.19*Math.sin(weaponYaw)-.10,
   weaponDepth:-.12*Math.sin(torsoYaw)-.19*Math.cos(weaponYaw)+.22,
   weaponBob:-Math.cos(phase*2)*.017,
   clip:ready>.72?'patrol-aim':lower>.22?'patrol-low-ready':Math.abs(weaponYaw)>.25?'patrol-scan':'patrol-forward'};
 }
}
