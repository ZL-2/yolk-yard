// Editor gestures produce one validated document change for the whole selection.
export function transformSelection(records,{origin,position,rotation=0,scale=[1,1,1]}){
 const solid=records.some(r=>r.collision),angle=solid?Math.round(rotation/90)*90:rotation;
 const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const factors=scale.map((value,axis)=>Math.max(Math.max(...records.map(r=>.1/r.scale[axis])),Math.min(value,Math.min(...records.map(r=>8/r.scale[axis])))));
 return records.map(r=>{
  const x=(r.position[0]-origin[0])*factors[0],z=(r.position[2]-origin[2])*factors[2];
  return {...r,position:[position[0]+x*c+z*s,position[1]+(r.position[1]-origin[1])*factors[1],position[2]-x*s+z*c],rotation:r.rotation+angle,scale:r.scale.map((v,i)=>v*factors[i])};
 });
}

export function cameraTranslation(direction,right,{forward=0,strafe=0,vertical=0,speed=35,dt=0}){
 const delta=direction.map((v,i)=>v*forward+right[i]*strafe+(i===1?vertical:0)),length=Math.hypot(...delta);
 return length?delta.map(v=>v/length*speed*dt):[0,0,0];
}
