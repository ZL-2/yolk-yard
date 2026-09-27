// A slow render or a suspended guest tab is not evidence that its host left.
// Check transport replies independently from the simulation's snapshot cadence.
export class HostHeartbeat {
  constructor(now = 0,{silence=10000,grace=4000}={}) { this.lastContact = now; this.lastPoll = now; this.suspectSince = null; this.silence=silence;this.grace=grace; }
  contact(now) { this.lastContact = now; this.suspectSince = null; }
  expired(now) {
    const delayed = now - this.lastPoll > 6000;
    this.lastPoll = now;
    if (delayed) { this.contact(now); return false; }
    if (now - this.lastContact <= this.silence) { this.suspectSince = null; return false; }
    // Keep the channel open for two additional ping opportunities. Replies may
    // be queued behind a costly frame or a large world checkpoint.
    this.suspectSince ??= now;
    return now - this.suspectSince >= this.grace;
  }
}
