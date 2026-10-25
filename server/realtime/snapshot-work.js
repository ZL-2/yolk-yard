// Snapshot delivery must not monopolize the authority's 60 Hz input/simulation
// loop. Keep one active iterator and one request for the freshest state per room.
export class SnapshotWork {
 constructor({budgetMs=2,now=()=>performance.now(),schedule=setImmediate,cancel=clearImmediate,onSlice=null}={}){Object.assign(this,{budgetMs,now,schedule,cancel,onSlice});this.jobs=new Map();this.closed=false;}
 enqueue(room,create){
  if(this.closed)return;
  const existing=this.jobs.get(room);if(existing){existing.latest=create;return;}
  this.jobs.set(room,{iterator:create(),latest:null,timer:null});this.flush(room,this.budgetMs);
 }
 flush(room,budget=this.budgetMs){
  const job=this.jobs.get(room);if(!job)return;
  if(job.timer!==null){this.cancel(job.timer);job.timer=null;}
  const start=this.now(),cpu=this.onSlice?process.cpuUsage():null;
  try{do{
   if(job.iterator.next().done){
    if(!job.latest){this.jobs.delete(room);return;}
    const create=job.latest;job.latest=null;job.iterator=create();
   }
  }while(this.now()-start<budget);
  }catch(error){this.jobs.delete(room);throw error;}finally{if(this.onSlice){const usage=process.cpuUsage(cpu);this.onSlice(room,this.now()-start,(usage.user+usage.system)/1000);}}
  job.timer=this.schedule(()=>{job.timer=null;this.flush(room);});job.timer?.unref?.();
 }
 close(){this.closed=true;for(const job of this.jobs.values())if(job.timer!==null)this.cancel(job.timer);this.jobs.clear();}
}
