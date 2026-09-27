const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Pose derives from existing motion snapshots; no animation packets are sent.
export function glidePose(previous,p,dt,time){
 const pose=previous||{yaw:p.yaw,air:0,glide:0,dive:0,pitch:0,roll:0,forward:0,turn:0};
 const step=clamp(dt,0,.05),blend=1-Math.exp(-step*8),flying=['glide','dive','launch'].includes(p.flight);
 pose.air+=(Number(flying)-pose.air)*blend;pose.glide+=(Number(p.flight==='glide')-pose.glide)*(1-Math.exp(-step*7));pose.dive+=(Number(p.flight==='dive')-pose.dive)*blend;
 const turn=clamp(angle(p.yaw-pose.yaw)/Math.max(.016,step),-3,3);pose.turn+=(turn-pose.turn)*blend;pose.yaw+=angle(p.yaw-pose.yaw)*(1-Math.exp(-step*10));
 const forward=-(p.vx||0)*Math.sin(pose.yaw)-(p.vz||0)*Math.cos(pose.yaw),side=(p.vx||0)*Math.cos(pose.yaw)-(p.vz||0)*Math.sin(pose.yaw);
 pose.forward+=(forward-pose.forward)*blend;
 const pitch=(.09+clamp(pose.forward*.005,-.06,.11))*pose.glide+.78*pose.dive;
 const roll=clamp(-pose.turn*.065-side*.006,-.23,.23)*pose.air;
 pose.pitch+=(pitch-pose.pitch)*blend;pose.roll+=(roll-pose.roll)*blend;
 pose.bob=Math.sin(time*2.1+(p.botSeed||0))*.025*pose.air;return pose;
}
