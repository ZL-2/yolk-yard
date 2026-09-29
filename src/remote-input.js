import {INPUT_RECOVERY} from './input-clock.js';
// Keep ordinary packet jitter lossless, but never replay seconds of stale controls.
export const MAX_INPUT_BACKLOG=6;
// Remote commands represent fixed 60 Hz steps, not replaceable positions.
// Budget is earned from host time, so a burst cannot accelerate a player.
export class RemoteInputBuffer {
  constructor() { this.queue=[]; this.credit=0; this.last=null; }
  push(input) {
    if(this.queue.length>=30)this.queue.shift();
    this.queue.push({...input});return true;
  }
  take(dt,recovering=false) {
    this.credit=Math.min(INPUT_RECOVERY,this.credit+dt);
    const budget=Math.floor((this.credit+1e-8)*60);
    if(!recovering&&this.queue.length>budget+MAX_INPUT_BACKLOG)this.queue.splice(0,this.queue.length-budget-MAX_INPUT_BACKLOG);
    const steps=[];
    while(this.queue.length&&this.credit+1e-8>=1/60){
      this.credit-=1/60;this.last=this.queue.shift();steps.push(this.last);
    }
    return steps;
  }
}
