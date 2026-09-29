// Authored, planted weapon-ready idle. No gameplay inputs, random frame noise,
// or locomotion: all channels share a smooth clock and hands retain their grip.
const tau=Math.PI*2;
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*v*(v*(v*6-15)+10);};
const beat=(t,start,hold,end)=>smooth((t-start)/1.1)*(1-smooth((t-hold)/(end-hold)));
export class LobbyMotion{
 constructor(offset=0){this.time=offset;this.yaw=Math.PI+.18;this.pitch=-.10;this.initialized=false;}
 update(dt){
  dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;this.time+=dt;const t=this.time,c=t%24;
  // Look to each side, briefly bring the weapon up, then settle to low ready.
  // Quintic envelopes have zero velocity and acceleration at every endpoint.
  const left=beat(c,2,4.8,6.5),right=beat(c,10,12.7,14.5),ready=beat(c,6.8,8.9,10.4),check=beat(c,17,19.5,21.5);
  const breath=Math.sin(t*1.7),shift=Math.sin(t*.36+.4);
  const scan=-left*.30+right*.25+Math.sin(t*.47)*.035;
  const targetYaw=Math.PI+.18+scan*.30;
  const targetPitch=-.12-ready*.015-check*.22;
  const alpha=1-Math.exp(-dt*5);
  if(!this.initialized){this.yaw=targetYaw;this.pitch=targetPitch;this.initialized=true;}
  this.yaw+=(targetYaw-this.yaw)*alpha;this.pitch+=(targetPitch-this.pitch)*alpha;
  return {yaw:this.yaw,pitch:this.pitch,scan,headPitch:-check*.085+breath*.007,
   roll:-.035+shift*.018+check*.05,speed:0,grip:ready*.06-check*.025,
   breath:breath*.004,weight:shift*.018,lean:shift*.022,ready,check,
   weaponYaw:scan*.24,weaponSide:shift*.008,weaponDepth:-ready*.035,
   clip:ready>.25?'sight-check':check>.25?'low-ready':left+right>.25?'scan':'ready-idle'};
 }
}
