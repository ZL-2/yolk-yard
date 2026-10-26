import {INPUT_RECOVERY} from './input-clock.js';
// Keep ordinary packet jitter lossless, but never replay seconds of stale controls.
export const MAX_INPUT_BACKLOG=6;
export const INPUT_BACKLOG_GRACE=.15;
// Remote commands represent fixed 60 Hz steps, not replaceable positions.
// Budget is earned from host time, so a burst cannot accelerate a player.
export class RemoteInputBuffer {
  constructor() { this.queue=[]; this.credit=0; this.last=null; this.backlogAge=0; this.dropped=0; }
  push(input) {
    if(this.queue.length>=30)this.queue.shift();
    this.queue.push({...input});return true;
  }
  take(dt,recovering=false) {
    this.credit=Math.min(INPUT_RECOVERY,this.credit+dt);
    const budget=Math.floor((this.credit+1e-8)*60);
    // Earned host time drains ordinary jitter in full. If the host has lost
    // time, a FIFO with equal producer/consumer rates otherwise stays late
    // forever. Retire that stale movement after a short grace period; never
    // manufacture simulation credit or move further to catch up.
    this.backlogAge=!recovering&&this.queue.length>budget?this.backlogAge+dt:0;
    if(budget>0&&!recovering&&(this.queue.length>budget+MAX_INPUT_BACKLOG||this.backlogAge+1e-8>=INPUT_BACKLOG_GRACE)){
      const removed=this.queue.splice(0,Math.max(0,this.queue.length-budget));
      this.dropped+=removed.length;this.backlogAge=0;
      // Keep brief action presses when retiring old movement. Latest aim and
      // slot win; held movement is never OR-ed into the current command.
      const next=this.queue[0];
      if(next)for(const old of removed){
        for(const key of ['jump','heliHorn','heliSeat'])next[key] ||= old[key];
        for(const key of ['jumpPress','heliHornPress','heliSeatPress'])next[key]=Math.max(next[key]||0,old[key]||0);
        if(old.slot===next.slot){
          for(const key of ['fire','reload','popper','interact','drop'])next[key] ||= old[key];
          for(const key of ['firePress','reloadPress'])next[key]=Math.max(next[key]||0,old[key]||0);
        }
      }
    }
    const steps=[];
    while(this.queue.length&&this.credit+1e-8>=1/60){
      this.credit-=1/60;this.last=this.queue.shift();steps.push(this.last);
    }
    return steps;
  }
}
