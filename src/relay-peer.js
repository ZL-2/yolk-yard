import {MAX_HUMANS,MAX_SPECTATORS} from './royale-phases.js';
import {mergeRelayMessage} from './relay-queue.js';
import {SnapshotEncoder,SnapshotDecoder} from './snapshot-codec.js';
import {HostHeartbeat} from './host-heartbeat.js';
import {RelaySnapshotWork} from './relay-snapshot-work.js';
import {RELAY_RECONNECT_MS,RELAY_CONNECT_MS,relayRetryDelay} from './relay-recovery.js';
// Peer-shaped, ordered WebSocket transport; the game rules stay in Network.
// Explicit peer configuration retains the local WebRTC development path.
export const relayURL=()=>globalThis.window?.YOLK_NETWORK?.relay||'';
function progressToken(){try{let token=localStorage.getItem('ravelfront-progress-token');if(!/^[a-f0-9]{32}$/.test(token||'')){token=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');localStorage.setItem('ravelfront-progress-token',token);}return token;}catch{return undefined;}}
class Events {
 constructor(){this.events=new Map();}
 on(type,fn){if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn);return this;}
 emit(type,value){for(const fn of this.events.get(type)||[])fn(value);}
}
class RelayConnection extends Events {
 constructor(owner,peer,channel){super();this.owner=owner;this.peer=peer;this.channel=channel;this.open=false;this.closed=false;this.queuedBytes=0;const self=this;this.dataChannel={get bufferedAmount(){const shared=self.owner.socket?.bufferedAmount||0;return self.queuedBytes+(shared>1048576?shared:0);}};}
 send(data){if(['hello','welcome'].includes(data.type))data={...data,relayCodec:1};return this.open&&!this.closed?this.owner.enqueue({type:'data',channel:this.channel,data}):false;}
 opened(){if(this.closed||this.open)return;this.open=true;this.emit('open');}
 finish(){if(this.closed)return;this.closed=true;this.open=false;this.owner.connections.delete(this.channel);this.emit('close');}
 close(){if(this.closed)return;this.owner.enqueue({type:'close',channel:this.channel});this.owner.flush();this.finish();}
}
export class RelayPeer extends Events {
 constructor(id,registration={}){
  super();this.registration=registration;this.id=id;this.destroyed=false;this.disconnected=false;this.connections=new Map();this.waiters=new Map();this.queue=[];this.queueBytes=0;this.requestId=0;this.deferredControls=[];this.commandSeq=0;this.unacked=new Map();this.cursor=0;this.protocol=1;this.retryAttempt=0;this.connectUntil=Date.now()+RELAY_CONNECT_MS;this.unackedBytes=0;this.wireCommands=new Map();
  // Defer errors so Network can attach listeners before anything fires.
  queueMicrotask(()=>this.start());
  this.sentTimes=new Map();this.receivedBytes=0;this.sentBytes=0;this.relayLatency=null;this.sentPackets=0;this.receivedPackets=0;this.byteEncoder=new TextEncoder();this.queuedSizes=new WeakMap();this.queuedWork=new WeakMap();this.snapshotWork=new WeakMap();
 }
 get bufferedAmount(){return (this.socket?.bufferedAmount||0)+this.queueBytes;}
 sendRaw(ws,raw,bytes){
  if(ws?.readyState!==1)return false;
  try{ws.send(raw);this.sentBytes+=bytes??this.byteEncoder.encode(raw).byteLength;this.sentPackets++;return true;}
  catch{try{ws.close();}catch{}return false;}
 }
 commandBlocked(){return this.rotating||this.socket?.readyState!==1||this.socket.bufferedAmount>65536||this.unacked.size>=32||(this.unackedBytes||0)>524288;}
 scheduleFlush(){if(!this.destroyed&&!this.flushTimer&&(this.queue.length||this.deferredControls?.length))this.flushTimer=setTimeout(()=>{this.flushTimer=null;this.flush();},20);}
 retry(initial=false){
  const now=Date.now();this.rotating=true;this.reconnecting=!initial;
  if(!initial&&!this.reconnectUntil)this.reconnectUntil=now+RELAY_RECONNECT_MS;
  const until=initial?this.connectUntil:this.reconnectUntil;
  if(now>=until)return false;
  if(!this.reconnectDeadline)this.reconnectDeadline=setTimeout(()=>this.failConnection(),until-now);
  const delay=Math.min(until-now,relayRetryDelay(this.retryAttempt++));this.retryAt=now+delay;
  this.emit(initial?'connecting':'reconnecting');clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>this.start(),delay);return true;
 }
 failConnection(){
  if(this.destroyed)return;this.disconnected=true;this.emit('error',{type:'socket-closed'});
  for(const conn of [...this.connections.values()])conn.finish();this.emit('disconnected');this.destroy();
 }
 start(){
  if(this.destroyed||this.socket&&this.socket.readyState<2)return;
  this.rotating=true;this.resumeConfirmed=false;
  try{this.socket=new WebSocket(relayURL(),globalThis.window?.RAVEL_OWNER_SESSION?['ravelfront',`owner.${window.RAVEL_OWNER_SESSION}`]:[]);}catch{this.emit('error',{type:'socket-error'});return;}
  const ws=this.socket;this.transportHeartbeat=new HostHeartbeat(Date.now(),{silence:18000,grace:0});
  ws.addEventListener('open',()=>{if(ws!==this.socket||this.destroyed)return;this.sendRaw(ws,JSON.stringify({type:'register',...this.registration,progressToken:progressToken(),...(this.id?{id:this.id}:{}),...this.resume,...(this.protocol===2?{cursor:this.cursor}:{})}));});
  ws.addEventListener('message',event=>{
   if(ws!==this.socket)return;this.transportHeartbeat.contact(Date.now());this.receivedBytes+=this.byteEncoder.encode(event.data).byteLength;this.receivedPackets++;let data;try{data=JSON.parse(event.data);}catch{return this.destroy();}
   for(const m of Array.isArray(data)?data:[data]){
    if(m.relaySeq){
     if(m.relaySeq<=this.cursor){this.acknowledge();continue;}
     if(m.relaySeq!==this.cursor+1){ws.close();return;}
     this.message(m);this.cursor=m.relaySeq;this.acknowledge();
    }else this.message(m);
   }
  });
  // Browsers deliver close after error. Retry there once, with the close reason.
  ws.addEventListener('error',()=>{});
  ws.addEventListener('close',event=>{
   if(this.destroyed||ws!==this.socket)return;
   const reasons=['Host duties transferred','Host unresponsive for 10 seconds','No active player available to host','Server stopping','Server restarting','Connection too slow','Rate limit','Command sequence','Invalid relay message','Expired resume','Register first','Public host stopped advancing','Public host transferred','Reconnect grace expired','Invalid public host state','Invalid frame'];
   this.emit('transport-close',{code:Number.isInteger(event.code)?event.code:0,reason:reasons.includes(event.reason)?event.reason:'unspecified'});
   clearInterval(this.heartbeat);
   const fatal=event.reason==='Host duties transferred'||event.code===1008||['Expired resume','Command sequence','Invalid frame','Invalid relay message'].includes(event.reason);
   if(!fatal&&((this.protocol===2&&this.resume)||!this.openedOnce)&&this.retry(!this.openedOnce))return;
   this.failConnection();
  });
  clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{if(this.transportHeartbeat.expired(Date.now()))ws.close();else this.control({type:'heartbeat'});},3000);
 }
 control(message,draining=false,prepared=null){
  if(prepared){this.preparedControls??=new WeakMap();this.preparedControls.set(message,prepared);}
  if(this.destroyed)return false;
  if(this.protocol===2&&['heartbeat','ack'].includes(message.type))return this.sendRaw(this.socket,JSON.stringify(message));
  if((this.commandBlocked()||!draining&&this.deferredControls?.length)&&!['register','rotate'].includes(message.type)){
   if(message.type==='heartbeat')return false;
   this.deferredControls??=[];
   if(message.type==='publish')this.deferredControls=this.deferredControls.filter(m=>m.type!=='publish');
   if(this.deferredControls.length>=128){this.failConnection();return false;}
   this.deferredControls.push(message);this.scheduleFlush();return true;
  }
  if(this.socket?.readyState!==1)return false;
  const preparedBody=this.preparedControls?.get(message);
  if(this.protocol===2){message={...message,seq:++this.commandSeq};this.unacked.set(message.seq,message);this.sentTimes.set(message.seq,performance.now());}
  const raw=preparedBody?preparedBody.slice(0,-1)+(this.protocol===2?',\"seq\":'+message.seq:'')+'}':JSON.stringify(message);
  const bytes=this.byteEncoder.encode(raw).byteLength;
  if(this.protocol===2){this.wireCommands??=new Map();this.wireCommands.set(message.seq,{raw,bytes});this.unackedBytes=(this.unackedBytes||0)+bytes;}
  return this.sendRaw(this.socket,raw,bytes);
 }
 drainControls(){
  while(this.deferredControls?.length&&!this.commandBlocked())this.control(this.deferredControls.shift(),true);
 }
 acknowledge(){if(!this.ackTimer)this.ackTimer=setTimeout(()=>{this.ackTimer=null;this.control({type:'ack',seq:this.cursor});},16);}
 finishRecovery(){
  if(!this.reconnecting||!this.resumeConfirmed||[...this.unacked.keys()].some(seq=>seq<=this.recoverySeq))return;
  this.reconnecting=false;this.reconnectUntil=null;clearTimeout(this.reconnectDeadline);this.reconnectDeadline=null;this.emit('reconnected');
 }
 message(m){
  if(!m||typeof m!=='object')return;
  if(m.type==='deployment'){this.emit('deployment',m.deployment);return;}
  if(m.type==='authority-frame'){this.authorityDecoder??=new SnapshotDecoder();const message=this.authorityDecoder.decode(m.frame);if(message){this.authorityReset=false;this.emit('authority-state',message.state);}else if(!this.authorityReset){this.authorityReset=true;this.control({type:'authority-command',command:{type:'snapshot-reset'}});}return;}
  if(['authority-ready','authority-owner','authority-notice','authority-error'].includes(m.type)){this.emit(m.type,m);return;}
  if(m.type==='host-demoted'){this.id=m.id;this.emit(m.type,m);return;}
  if(['reward','afk','afk-enforce','rank-cosmetic','host-transfer'].includes(m.type)){this.emit(m.type,m);return;}
  if(m.type==='command-ack'){const sent=this.sentTimes.get(m.seq);if(sent!==undefined)this.relayLatency=performance.now()-sent;for(const seq of this.unacked.keys())if(seq<=m.seq){this.unacked.delete(seq);this.sentTimes.delete(seq);this.unackedBytes=Math.max(0,(this.unackedBytes||0)-(this.wireCommands?.get(seq)?.bytes||0));this.wireCommands?.delete(seq);}this.drainControls();this.finishRecovery();this.flush();return;}
  if(m.type==='alive'){this.resumeConfirmed=true;this.finishRecovery();return;}
  if(m.type==='rotate-request'){this.flush();this.rotating=true;this.control({type:'rotate'});return;}
  if(m.type==='rotated'){this.resume={resume:m.resume,cursor:m.cursor,parts:m.parts};this.start();return;}
  if(m.type==='ready'){
   this.id=m.id;this.rotating=false;this.openedOnce=true;this.retryAttempt=0;this.retryAt=null;if(!m.resumed){clearTimeout(this.reconnectDeadline);this.reconnectDeadline=null;}
   if(m.protocol===2){
    this.protocol=2;this.resume={resume:m.resume};
    for(const message of this.unacked.values())this.sendRaw(this.socket,this.wireCommands?.get(message.seq)?.raw||JSON.stringify(message));
   }
   this.drainControls();
   if(m.resumed){this.flush();this.recoverySeq=this.commandSeq;this.control({type:'heartbeat'});}else this.emit('open',this.id);return;}
  if(m.type==='rooms'){const waiter=this.waiters.get(m.request);if(waiter){this.waiters.delete(m.request);waiter.resolve(m.rooms);}return;}
  if(m.type==='error'){
   // A failed election candidate belongs to its channel. Its error must not
   // become a peer-wide fatal error after the next candidate is promoted.
   if(m.channel){const conn=this.connections.get(m.channel);if(conn){conn.emit('error',{type:m.error});conn.finish();}return;}
   this.emit('error',{type:m.error});return;
  }
  if(m.type==='incoming'){
   if(this.connections.size>=MAX_HUMANS+MAX_SPECTATORS)return this.enqueue({type:'close',channel:m.channel});
   const conn=new RelayConnection(this,m.peer,m.channel);this.connections.set(m.channel,conn);
   this.emit('connection',conn);
   if(!conn.closed){this.enqueue({type:'accept',channel:m.channel});this.flush();conn.opened();}return;
  }
  const conn=this.connections.get(m.channel);if(!conn)return;
  if(m.type==='opened')conn.opened();
  else if(m.type==='data'&&!conn.closed){
   if(['hello','welcome'].includes(m.data?.type)&&m.data.relayCodec===1)conn.compact=true;
   if(m.data?.type==='snapshot-reset'){conn.encoder?.reset();conn.royaleVersion=null;conn.buildVersion=null;return;}
   let data=m.data;
   if(data?.type==='snapshot-v1'){
    conn.decoder??=new SnapshotDecoder();data=conn.decoder.decode(data.frame);
    if(!data){if(!conn.resetRequested){conn.resetRequested=true;conn.send({type:'snapshot-reset'});}return;}
    conn.resetRequested=false;
   }
   conn.emit('data',data);
  }
  else if(m.type==='closed')conn.finish();
 }
 connect(peer){
  const channel=crypto.randomUUID(),conn=new RelayConnection(this,peer,channel);this.connections.set(channel,conn);
  this.control({type:'connect',target:peer,channel});return conn;
 }
 enqueue(message){
  if(this.destroyed)return false;
  // Merge only compatible adjacent updates, retaining world data and action edges.
  const index=this.queue.findLastIndex(item=>item.channel===message.channel);
  const last=this.queue[index],merged=mergeRelayMessage(last,message);
  const replacedBytes=merged?this.queuedSizes.get(last):0;
  if(merged)message=merged;
  const connection=this.connections.get(message.channel),frame=message.data?.state?.network;
  let work;
  if(connection?.compact&&message.data?.type==='state'&&frame){work=this.snapshotWork.get(frame);if(!work){work=new RelaySnapshotWork();this.snapshotWork.set(frame,work);}this.queuedWork.set(message,work);}
  const bytes=work?work.measure(message):JSON.stringify(message).length;this.queuedSizes.set(message,bytes);
  // Backpressure on one uplink must never destroy the host and all its guests.
  // Snapshot callers retain their cursors/checkpoint until the send succeeds.
  if(this.queueBytes-replacedBytes+bytes>1_800_000){
   if(message.data?.type==='state')return false;
   // Reliable traffic cannot be silently lost. End only its congested channel.
   if(connection){this.discardChannel(message.channel);this.control({type:'batch',messages:[{type:'close',channel:message.channel}]});connection.finish();return false;}
   this.emit('error',{type:'server-error'});this.destroy();return false;
  }
  if(merged){this.queue.splice(index,1);this.queueBytes-=replacedBytes;if(connection)connection.queuedBytes-=replacedBytes;}
  this.queue.push(message);this.queueBytes+=bytes;const conn=this.connections.get(message.channel);if(conn)conn.queuedBytes+=bytes;
  // Never encode a room inside the animation/input callback that enqueued it.
  if(!this.flushTimer)this.flushTimer=setTimeout(()=>this.flush(),this.queue.length>=64||this.queueBytes>200000?0:8);
  return true;
 }
 discardChannel(channel){this.queue=this.queue.filter(m=>{if(m.channel!==channel)return true;this.queueBytes-=this.queuedSizes.get(m);return false;});const conn=this.connections.get(channel);if(conn)conn.queuedBytes=0;}
 flush(drain=false){
  if(this.destroyed)return;
  clearTimeout(this.flushTimer);this.flushTimer=null;this.drainControls();
  if(!this.queue.length){this.scheduleFlush();return;}
  if(this.commandBlocked()||this.deferredControls?.length){this.scheduleFlush();return;}
  const started=performance.now(),budget=drain?Infinity:this.encodeBudgetMs??4;
  let batch=[],parts=[],bytes=64,processed=0;
  const send=()=>this.control({type:'batch',messages:batch},false,'{"type":"batch","messages":['+parts.join(',')+']}');
  while(this.queue.length&&(drain||processed<64)){
   const message=this.queue.shift(),conn=this.connections.get(message.channel),queued=this.queuedSizes.get(message)||0;
   this.queueBytes-=queued;if(conn)conn.queuedBytes=Math.max(0,conn.queuedBytes-queued);processed++;
   let raw;
   if(conn?.compact&&message.data?.type==='state'){
    conn.encoder??=new SnapshotEncoder();const work=this.queuedWork.get(message)?.batch;message.data=conn.encoder.encode(message.data,work);
    if(work)raw='{"type":"data","channel":'+JSON.stringify(message.channel)+',"data":'+work.serialize(message.data.frame,'snapshot-v1')+'}';
   }
   raw??=JSON.stringify(message);const size=this.byteEncoder.encode(raw).byteLength+1;
   if(size>1_800_000){this.discardChannel(message.channel);this.control({type:'batch',messages:[{type:'close',channel:message.channel}]});conn?.finish();continue;}
   if(bytes+size>1_800_000){send();batch=[];parts=[];bytes=64;}
   batch.push(message);parts.push(raw);bytes+=size;
   // Preserve whole frames and baselines, then yield to input/render tasks.
   // Unencoded snapshots remain coalescible with newer state and all events.
   if(performance.now()-started>=budget||this.commandBlocked())break;
  }
  if(batch.length)send();
  if(this.queue.length&&!this.flushTimer)this.flushTimer=setTimeout(()=>this.flush(),this.commandBlocked()?20:0);
 }

 publish(room){this.control({type:'publish',room});}
 list(){
  const request=++this.requestId;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiters.delete(request);reject(Error('The room directory did not respond.'));},10000);this.waiters.set(request,{resolve:rooms=>{clearTimeout(timer);resolve(rooms);},reject:()=>{clearTimeout(timer);reject(Error('The room directory disconnected.'));}});this.control({type:'list',request});});
 }
 destroy(){
  if(this.destroyed)return;this.flush(true);this.destroyed=true;clearTimeout(this.flushTimer);clearTimeout(this.ackTimer);clearInterval(this.heartbeat);clearTimeout(this.reconnectTimer);clearTimeout(this.reconnectDeadline);
  if(this.protocol===2&&this.socket?.readyState===1)this.sendRaw(this.socket,JSON.stringify({type:'bye'}));
  for(const waiter of this.waiters.values())waiter.reject();this.waiters.clear();
  for(const conn of [...this.connections.values()])conn.finish();
  this.queue=[];this.queueBytes=0;this.deferredControls=[];this.unacked.clear();this.wireCommands?.clear();this.unackedBytes=0;this.sentTimes.clear();this.socket?.close();
 }
}
