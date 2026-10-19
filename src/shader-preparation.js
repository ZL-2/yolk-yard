// Shader prewarming is an optimization, never an unbounded admission barrier.
export class ShaderPreparation {
 constructor({timeout=8000,onError=error=>console.warn('Shader prewarming skipped:',error)}={}){this.timeout=timeout;this.onError=onError;this.pending=null;}
 cancel(){this.pending?.finish();}
 start(compile){
  this.cancel();
  const job={finish:()=>{clearTimeout(job.timer);if(this.pending===job)this.pending=null;}};
  this.pending=job;
  job.timer=setTimeout(()=>{if(this.pending!==job)return;job.finish();this.onError(new Error('Shader prewarming timed out; using normal rendering.'));},this.timeout);
  try{Promise.resolve(compile()).then(job.finish,error=>{if(this.pending===job){job.finish();this.onError(error);}});}catch(error){job.finish();this.onError(error);}
  return job;
 }
}
