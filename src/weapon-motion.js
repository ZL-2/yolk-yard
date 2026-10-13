const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
// Presentation only: sights, recoil, camera and authoritative hit rays are
// untouched. One reusable output and bounded spring integration per frame.
export function weaponMotion(state,p,dt,time,aim=0,settings={},key='') {
  if(state.key!==key||!state.ready){Object.assign(state,{key,ready:true,yaw:p.yaw||0,pitch:p.pitch||0,grounded:p.grounded,vy:0,phase:0,speed:0,swayX:0,swayY:0,side:0,land:0,landVelocity:0});}
  dt=clamp(dt,0,.05);const blend=1-Math.exp(-dt*12),speed=Math.hypot(p.vx||0,p.vz||0);
  state.speed+=(Math.min(12,speed)-state.speed)*blend;
  state.phase+=state.speed*dt*(p.sprinting?3:4.1);
  const yaw=p.yaw||0,pitch=p.pitch||0;
  state.swayX+=(clamp(angle(yaw-state.yaw)/Math.max(.001,dt)*-.005,-.025,.025)-state.swayX)*blend;
  state.swayY+=(clamp((pitch-state.pitch)/Math.max(.001,dt)*.004,-.02,.02)-state.swayY)*blend;
  state.side+=(((p.vx||0)*Math.cos(yaw)-(p.vz||0)*Math.sin(yaw))-state.side)*blend;
  if(p.grounded&&!state.grounded)state.landVelocity-=clamp(-state.vy*.075,0,.85);
  // Small substeps keep the spring stable even at 20 FPS.
  const steps=Math.max(1,Math.ceil(dt/.016)),h=dt/steps;
  for(let i=0;i<steps;i++){state.landVelocity+=(-state.land*145-state.landVelocity*17)*h;state.land=clamp(state.land+state.landVelocity*h,-.06,.03);}
  state.yaw=yaw;state.pitch=pitch;state.vy=p.vy||0;state.grounded=p.grounded;
  const motion=settings.reducedMotion?0:settings.weaponMotion??1,bob=settings.reducedMotion?0:settings.headBob??1,ads=1-aim*.94,walk=Math.min(1,state.speed/3)*(p.grounded?1:0),out=state.out??={};
  out.x=(state.swayX+Math.sin(state.phase)*.009*walk*bob)*ads*motion;
  out.y=(state.swayY+state.land+Math.cos(state.phase*2)*.008*walk*bob+Math.sin(time*1.65)*.0018*(1-walk))*ads*motion;
  out.z=Math.abs(state.land)*.4*ads*motion;
  out.roll=clamp(-state.side*.005+state.swayX*.65,-.05,.05)*ads*motion;
  out.pitch=state.land*1.5*ads*motion;
  return out;
}
