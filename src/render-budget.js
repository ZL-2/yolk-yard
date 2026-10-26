import {fpsLimit} from './frame-pacing.js';

// Wall-clock sampling must stay independent of the simulation's capped dt.
// Change resolution slowly enough to avoid oscillation, but react to sustained
// heavy frames within seconds. DOM text and input/simulation clocks stay native.
export class RenderBudget {
 constructor(){this.reset();}
 reset(){this.shadows=true;this.scale=1;this.average=1000/60;this.lastAt=null;this.windowAt=null;this.goodSince=null;this.pressure=false;this.samples=0;this.gpuAverage=null;this.cpuAverage=0;this.probe=null;this.probeAfter=0;}
 sample(now,{quality='medium',limit=60,active=true,gpuMs=null,cpuMs=0}={}){
  const previous=this.scale,budget=1000/Math.min(60,fpsLimit(limit)||60),elapsed=this.lastAt===null?budget:now-this.lastAt;this.lastAt=now;
  if(!active||elapsed>2000||elapsed<=0){this.windowAt=now;this.goodSince=null;this.samples=0;return false;}
  this.average+=(Math.min(250,elapsed)-this.average)*.15;this.samples++;this.cpuAverage+=(cpuMs-this.cpuAverage)*.15;if(Number.isFinite(gpuMs))this.gpuAverage=this.gpuAverage===null?gpuMs:this.gpuAverage+(gpuMs-this.gpuAverage)*.15;
  this.pressure=this.samples>3&&this.average>budget*1.22;
  if(this.windowAt===null)this.windowAt=now;
  if(now-this.windowAt<500||this.samples<4)return false;
  this.windowAt=now;
  const measuredGPU=Number.isFinite(gpuMs),gpuPressure=measuredGPU&&this.gpuAverage>budget*.9;
  const cpuPressure=this.cpuAverage>budget*.7;
  if(this.probe&&now-this.probe.at>=1500){
   if(this.average>this.probe.average*.92||cpuPressure){this.scale=this.probe.scale;this.probeAfter=now+8000;}
   this.probe=null;
  }
  if(this.pressure){
   this.goodSince=null;
   // CPU stalls cannot be fixed by blurring the image. Without timer-query
   // support, allow one small probe and retain it only if frame time improves.
   if(gpuPressure||!measuredGPU&&!cpuPressure&&!this.probe&&now>=this.probeAfter){
    const floor=quality==='high'?.72:quality==='low'?.6:.65;
    if(!measuredGPU){this.probe={at:now,average:this.average,scale:this.scale};this.probeAfter=now+1500;}
    this.scale=Math.max(floor,this.scale-(measuredGPU&&this.average>budget*1.8?.08:.04));
    if(measuredGPU&&this.scale<=floor+.001&&this.gpuAverage>budget*2)this.shadows=false;
   }
  }
  else if(this.average<budget*1.07){this.goodSince??=now;if(now-this.goodSince>3000)this.scale=Math.min(1,this.scale+.02);if(now-this.goodSince>6000&&this.scale>.9)this.shadows=true;}
  else this.goodSince=null;
  this.scale=Math.round(this.scale*100)/100;return previous!==this.scale;
 }
}

// One bounded shadow volume follows the camera. Quantize its anchor in light
// space to whole texels: sunlight remains stable while moving across the island.
export function shadowAnchor(position,resolution=1024,extent=42){
 const step=extent*2/resolution,dx=-15,dy=38,dz=18,horizontal=Math.hypot(dx,dz),length=Math.hypot(dx,dy,dz);
 const rx=dz/horizontal,rz=-dx/horizontal,ux=-dy*dx/(length*horizontal),uy=horizontal/length,uz=-dy*dz/(length*horizontal);
 const x=position.x||0,y=position.y||0,z=position.z||0,side=x*rx+z*rz,up=x*ux+y*uy+z*uz;
 const sideShift=Math.round(side/step)*step-side,upShift=Math.round(up/step)*step-up;
 return {x:x+sideShift*rx+upShift*ux,y:y+upShift*uy,z:z+sideShift*rz+upShift*uz};
}
