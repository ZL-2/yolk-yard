import {randomUUID} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
const RETENTION=7*86400000;
export const ISSUE_MESSAGES={
 'server-delay':'Match updates are taking longer than expected.',
 'cpu-pressure':'The match server is hitting its CPU allowance and may deliver uneven updates.',
 'client-rendering':'Low frame rates are being reported across multiple matches.',
 'client-connection':'Delayed updates or high latency are being reported across multiple matches.'
};
// Only bounded numeric observations are retained. No player identifiers enter public history.
export class ServiceStatus{
 constructor(relay,{now=Date.now,path=process.env.RAVEL_STATUS_PATH||'/tmp/ravelfront-status.json',automatic=true}={}){
  this.relay=relay;this.now=now;this.path=path;this.reports=new Map();this.active=new Map();this.candidates=new Map();this.history=[];this.notice=null;this.previousCpu=null;this.lastTick=now();this.ready=this.restore();
  if(automatic){this.timer=setInterval(()=>this.tick(),5000);this.timer.unref?.();}
 }
 async restore(){if(!this.path)return;try{const data=JSON.parse(await readFile(this.path,'utf8'));const now=this.now();this.history=(data.history||[]).filter(i=>i&&Object.hasOwn(ISSUE_MESSAGES,i.kind)&&typeof i.id==='string'&&Number.isFinite(i.startedAt)&&Number.isFinite(i.detectedAt)&&i.detectedAt<=now&&now-i.detectedAt<RETENTION).slice(-100);for(const i of this.history){i.scope??=['server-delay','cpu-pressure'].includes(i.kind)?'widespread':'unverified';if(!i.endedAt&&i.scope==='widespread')this.active.set(i.kind,{...i,goodSince:null});else if(!i.endedAt)i.endedAt=now;}if(this.active.size){const first=[...this.active.values()].sort((a,b)=>a.startedAt-b.startedAt)[0];this.notice=data.notice&&Number.isFinite(data.notice.startedAt)?data.notice:{id:first.id,startedAt:first.startedAt};}}catch{}}
 persist(){if(!this.path)return;const body=JSON.stringify({history:this.history,notice:this.notice});this.saving=(this.saving||Promise.resolve()).then(async()=>{try{await writeFile(this.path+'.tmp',body,{mode:0o600});await rename(this.path+'.tmp',this.path);}catch{console.error('Service incident history could not be saved');}});}
 report(peer,m){
  const now=this.now();if(!peer.ws||!this.relay.authority?.roomFor(peer)||peer.lastStatusReport!=null&&now-peer.lastStatusReport<4000)return;
  if(!m||![m.fps,m.rtt,m.gap].every(n=>Number.isFinite(n)&&n>=0)||m.fps>1000||m.rtt>60000||m.gap>60000)return;
  peer.lastStatusReport=now;this.reports.set(peer,{at:now,fps:m.fps,rtt:m.rtt,gap:m.gap,room:this.relay.authority.roomFor(peer)});
 }
 observe(kind,bad,now=this.now()){
  const incident=this.active.get(kind);
  if(bad){
   if(incident){incident.goodSince=null;return;}
   const first=this.candidates.get(kind);if(first===undefined){this.candidates.set(kind,now);return;}
   if(now-first<15000)return;
   const item={id:randomUUID(),scope:'widespread',kind,startedAt:first,detectedAt:now,message:ISSUE_MESSAGES[kind],endedAt:null};
   this.active.set(kind,{...item,goodSince:null});this.notice??={id:randomUUID(),startedAt:first};this.history.push(item);this.history=this.history.filter(i=>now-i.detectedAt<RETENTION).slice(-100);this.persist();
  }else{
   this.candidates.delete(kind);if(!incident)return;
   incident.goodSince??=now;
   if(now-incident.goodSince<60000)return;
   const stored=this.history.find(i=>i.id===incident.id);if(stored)stored.endedAt=now;
   this.active.delete(kind);if(!this.active.size)this.notice=null;this.persist();
  }
 }
 tick(){
  const now=this.now(),gap=now-this.lastTick;this.lastTick=now;
  for(const [peer,r]of this.reports)if(now-r.at>15000||!peer.ws||this.relay.authority?.roomFor(peer)!==r.room)this.reports.delete(peer);
  const reports=[...this.reports.values()],cpu=this.relay.cpuQuota?.snapshot(),prev=this.previousCpu;
  const periods=cpu?.available&&prev?.available?cpu.periods-prev.periods:0;
  const throttled=periods>0&&(cpu.throttledPeriods-prev.throttledPeriods)/periods>=.3;
  this.previousCpu=cpu;
  const playing=!!this.relay.authority?.rooms.size;
  this.observe('cpu-pressure',playing&&throttled,now);
  this.observe('server-delay',playing&&gap>5500,now);
  const widespread=predicate=>{const bad=reports.filter(predicate);return bad.length>=3&&bad.length>=reports.length*.5&&new Set(bad.map(r=>r.room)).size>=2;};
  this.observe('client-rendering',widespread(r=>r.fps>0&&r.fps<30),now);
  this.observe('client-connection',widespread(r=>r.rtt>180||r.gap>400),now);
 }
 snapshot(){const now=this.now();return {serverTime:now,notice:this.notice?{...this.notice,scope:'widespread',message:this.active.size===1?[...this.active.values()][0].message:'Multiple performance issues are affecting matches: '+[...this.active.keys()].map(k=>({'server-delay':'slow updates','cpu-pressure':'server CPU pressure','client-rendering':'low frame rates','client-connection':'connection delays'})[k]).join(', ')+'.'}:null,active:[...this.active.values()].map(({goodSince,...i})=>i),history:this.history.map(i=>({...i})),historyPersistent:!!this.path,monitoring:{confirmationSeconds:15,recoverySeconds:60,minimumAffectedPlayers:3,minimumAffectedMatches:2,minimumAffectedReportFraction:.5,emailCheckIntervalMinutes:60}};}
 async close(){clearInterval(this.timer);await this.saving;}
}
