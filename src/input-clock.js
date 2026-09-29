// Input time is independent of rendering. Recovery is bounded to half a second;
// a hidden tab or longer stall must not replay minutes of stale controls.
export const INPUT_RECOVERY = .5;
export class InputClock {
 constructor(){this.last=null;this.remainder=0;}
 reset(now){this.last=now;this.remainder=0;}
 take(now){
  if(this.last===null){this.reset(now);return 0;}
  now=Math.max(now,this.last); // rAF timestamps can precede a timer callback.
  const elapsed=Math.max(0,(now-this.last)/1000);this.last=now;
  this.remainder=Math.min(INPUT_RECOVERY,this.remainder+elapsed);
  const steps=Math.min(30,Math.floor((this.remainder+1e-8)*60));
  this.remainder=Math.max(0,this.remainder-steps/60);return steps;
 }
}
