// Cinematic locomotion, independent of pointer input. The model stays centered;
// stride phase comes from travelled distance, with slow authored scan/grip beats.
export class LobbyMotion{
 constructor(){this.time=0;this.yaw=Math.PI+.18;this.pitch=-.10;}
 update(dt){
  this.time+=Math.min(.1,dt);const t=this.time;
  const scan=Math.sin(t*.23)*.17+Math.sin(t*.11+.8)*.08;
  this.yaw+=(Math.PI+.18+scan*.38-this.yaw)*(1-Math.exp(-dt*2));
  this.pitch+=(-.09+Math.sin(t*.31)*.045-this.pitch)*(1-Math.exp(-dt*2.5));
  return {yaw:this.yaw,pitch:this.pitch,scan,roll:-.035+Math.sin(t*.39)*.016,speed:.96+Math.sin(t*.18)*.055,grip:Math.max(0,Math.sin(t*.45))**12*.025};
 }
}
