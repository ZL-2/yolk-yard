// A nearby muzzle is not a near miss. Only rounds actually passing the ear
// receive a flyby; backwards, distant and wall-stopped shots remain silent.
export function bulletPass(event,listener) {
  if(!event.origin||!listener)return null;
  const ear={x:listener.x,y:listener.y+(listener.crouching?.8:1.5),z:listener.z};
  for(const shot of event.shots||[]) {
    const end=shot.end,dx=end?end.x-event.origin.x:shot.vx,dy=end?end.y-event.origin.y:shot.vy,dz=end?end.z-event.origin.z:shot.vz;
    const length=Math.hypot(dx,dy,dz);if(!Number.isFinite(length)||length<.01)continue;
    const ux=dx/length,uy=dy/length,uz=dz/length,t=(ear.x-event.origin.x)*ux+(ear.y-event.origin.y)*uy+(ear.z-event.origin.z)*uz;
    if(t<2||t>(end?length:100))continue;
    const point={x:event.origin.x+ux*t,y:event.origin.y+uy*t,z:event.origin.z+uz*t};
    if(Math.hypot(ear.x-point.x,ear.y-point.y,ear.z-point.z)<1.8)return point;
  }
  return null;
}
