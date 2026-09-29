import {readFile} from 'node:fs/promises';
import {posix as path} from 'node:path';
// Linux cgroup v2 cpu.max/cpu.stat and v1 CFS bandwidth counters.
// https://docs.kernel.org/admin-guide/cgroup-v2.html
// https://docs.kernel.org/scheduler/sched-bwc.html
export function parseCpuQuota(version,quota,period,stat){
 const fields=Object.fromEntries(stat.trim().split('\n').map(line=>line.trim().split(/\s+/)));
 const [q,p]=version===2?quota.trim().split(/\s+/):[quota.trim(),period.trim()];
 const periodUs=Number(p),quotaUs=q==='max'||q==='-1'?null:Number(q);
 const periods=Number(fields.nr_periods),throttledPeriods=Number(fields.nr_throttled);
 const throttledMs=Number(version===2?fields.throttled_usec:fields.throttled_time)/(version===2?1000:1e6);
 if(!(periodUs>0)||(quotaUs!==null&&!(quotaUs>0))||![periods,throttledPeriods,throttledMs].every(n=>Number.isFinite(n)&&n>=0))return null;
 return {version,quotaCores:quotaUs===null?null:quotaUs/periodUs,periodUs,periods,throttledPeriods,throttledMs};
}
export class CpuQuotaMonitor{
 constructor(read=readFile){this.read=read;this.value={available:false};this.busy=false;}
 async file(name){try{return await this.read(name,'utf8');}catch{return null;}}
 async readGroup(dir,version){
  const values=await Promise.all([this.file(dir+'/cpu.stat'),this.file(dir+(version===2?'/cpu.max':'/cpu.cfs_quota_us')),version===2?Promise.resolve(''):this.file(dir+'/cpu.cfs_period_us')]);
  return values.every(v=>v!==null)?parseCpuQuota(version,values[1],values[2],values[0]):null;
 }
 async start(){
  const membership=(await this.file('/proc/self/cgroup'))||'';
  const groups=membership.split('\n').map(line=>{const [id,controllers,...rest]=line.split(':');return {controllers,path:rest.join(':')};});
  for(const [version,roots]of [[2,['/sys/fs/cgroup']],[1,['/sys/fs/cgroup/cpu','/sys/fs/cgroup/cpu,cpuacct']]]){
   const group=groups.find(g=>version===2?g.controllers==='':g.controllers?.split(',').includes('cpu'));
   for(const root of roots){
    const resolved=path.resolve(root,'.'+(group?.path||'/'));
    const leaf=resolved===root||resolved.startsWith(root+'/')?resolved:root;
    const dirs=[];for(let dir=leaf;;dir=path.dirname(dir)){dirs.push(dir);if(dir===root)break;}
    let selected=null;
    for(const dir of dirs){const sample=await this.readGroup(dir,version);if(!sample)continue;
     if(!selected||(sample.quotaCores!==null&&(selected.sample.quotaCores===null||sample.quotaCores<selected.sample.quotaCores)))selected={dir,sample};
    }
    if(selected){this.dir=selected.dir;this.version=version;this.scope=selected.dir===leaf?'current group':'visible parent/mount group';this.baseline=selected.sample;this.started=performance.now();await this.sample();this.timer=setInterval(()=>void this.sample(),1000);this.timer.unref?.();return;}
   }
  }
 }
 async sample(){
  if(this.busy||!this.dir)return;this.busy=true;
  try{
   const sample=await this.readGroup(this.dir,this.version);if(!sample){this.value={available:false};return;}
   if(['periods','throttledPeriods','throttledMs'].some(k=>sample[k]<this.baseline[k])){this.baseline=sample;this.started=performance.now();}
   this.value={available:true,version:this.version,scope:this.scope,quotaCores:sample.quotaCores,periodUs:sample.periodUs,observedMs:Math.round(performance.now()-this.started),periods:sample.periods-this.baseline.periods,throttledPeriods:sample.throttledPeriods-this.baseline.throttledPeriods,throttledMs:Math.round(sample.throttledMs-this.baseline.throttledMs)};
  }finally{this.busy=false;}
 }
 snapshot(){return {...this.value};}
 close(){clearInterval(this.timer);}
}
