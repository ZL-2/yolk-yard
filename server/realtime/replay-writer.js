import {Worker} from 'node:worker_threads';
// One ordered writer owns replay compression and disk work. Requests remain
// readable in memory until committed; bounded backpressure never blocks a tick.
export class ReplayWriter {
 constructor(path,onError){
  this.pending=new Map();this.serial=0;this.bytes=0;this.onError=onError;this.path=path;
 }
 start(){if(this.worker)return;const path=this.path;
  this.worker=new Worker(new URL('./replay-writer-worker.js',import.meta.url),{workerData:{path}});
  this.worker.on('message',message=>{
   const task=this.pending.get(message.id);if(!task)return;
   if(message.error){this.error=message.error;this.onError?.(message.error);task.failed=true;}else{this.pending.delete(message.id);this.bytes-=task.bytes;}
   task.resolve();if(![...this.pending.values()].some(t=>!t.failed))this.worker.unref();
  });
  this.worker.on('error',error=>this.fail(error.message));
  this.worker.on('exit',()=>{if([...this.pending.values()].some(t=>!t.failed))this.fail('Replay writer exited before saving its buffer');});
  this.worker.unref();
 }
 fail(message){this.error=message;this.onError?.(message);for(const t of this.pending.values()){t.failed=true;t.resolve();}}
 enqueue(data,bytes=0){
  if(this.error||this.bytes+bytes>32*1024*1024||this.pending.size>=128)return false;
  this.start();const id=++this.serial;let resolve;const done=new Promise(r=>resolve=r);
  this.pending.set(id,{...data,bytes,done,resolve});this.bytes+=bytes;this.worker.ref();
  try{this.worker.postMessage({id,...data});return true;}catch(error){this.pending.delete(id);this.bytes-=bytes;resolve();this.fail(error.message);return false;}
 }
 async drain(){await Promise.all([...this.pending.values()].map(t=>t.done));if(this.error)throw Error(this.error);}
 async close(){try{await this.drain();}finally{await this.worker?.terminate();}}
}
