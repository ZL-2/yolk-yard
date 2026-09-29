import {INPUT_RECOVERY} from './input-clock.js';
// Keep ordinary packet jitter lossless, but never replay seconds of stale controls.
export const MAX_INPUT_BACKLOG=6;
// Remote commands represent fixed 60 Hz steps, not replaceable positions.
// Budget is earned from host time, so a burst cannot accelerate a player.
export class RemoteInputBuffer {
  constructor() { this.queue=[]; this.credit=0; this.last=null; }
  push(input) {
    if(this.queue.length>=MAX_INPUT_BACKLOG)this.queue.shift();
    this.queue.push({...input});return true;
  }
  take(dt) {
    this.credit=Math.min(INPUT_RECOVERY,this.credit+dt);
    const steps=[];
    while(this.queue.length&&this.credit+1e-8>=1/60){
      this.credit-=1/60;this.last=this.queue.shift();steps.push(this.last);
    }
    return steps;
  }
}
