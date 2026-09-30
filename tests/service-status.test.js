import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {ServiceStatus} from '../server/realtime/service-status.js';
import {elapsedClock} from '../src/lobby-status.js';
import {startRealtimeServer} from '../server/realtime/index.js';
test('confirmed incidents preserve their start, deduplicate, recover and survive a process restart',async()=>{
 const dir=await mkdtemp('/tmp/ravel-status-test-');let time=100000;
 const monitor=new ServiceStatus({}, {now:()=>time,path:dir+'/state.json',automatic:false});await monitor.ready;
 try{
  monitor.observe('cpu-pressure',true);time+=10000;monitor.observe('cpu-pressure',true);assert.equal(monitor.snapshot().active.length,0);
  time+=5000;monitor.observe('cpu-pressure',true);const first=monitor.snapshot().active[0];assert.equal(first.startedAt,100000);
  time+=10000;monitor.observe('cpu-pressure',true);assert.equal(monitor.snapshot().history.length,1);assert.equal(monitor.snapshot().active[0].id,first.id);
  await monitor.close();const restored=new ServiceStatus({}, {now:()=>time,path:dir+'/state.json',automatic:false});await restored.ready;
  assert.equal(restored.snapshot().active[0].startedAt,100000);restored.observe('cpu-pressure',false);time+=59999;restored.observe('cpu-pressure',false);assert.equal(restored.snapshot().active.length,1);
  time++;restored.observe('cpu-pressure',false);assert.equal(restored.snapshot().active.length,0);assert.equal(restored.snapshot().history[0].endedAt,time);await restored.close();
 }finally{await monitor.close();await rm(dir,{recursive:true,force:true});}
});
test('reports require a match, valid bounded numbers and sustained observations',async()=>{
 let time=100000;const room={},otherRoom={},relay={authority:{rooms:new Map([['match',room],['other',otherRoom]]),roomFor:p=>p.inMatch?(p.room||room):null}},monitor=new ServiceStatus(relay,{now:()=>time,path:null,automatic:false});await monitor.ready;
 const peer={ws:{},inMatch:true};
 monitor.report({ws:{}},{fps:10,rtt:0,gap:0});assert.equal(monitor.reports.size,0);
 monitor.report(peer,{fps:NaN,rtt:0,gap:0});assert.equal(monitor.reports.size,0);
 for(let i=0;i<4;i++){monitor.report(peer,{fps:20,rtt:40,gap:600});monitor.tick();time+=5000;}
 assert.equal(monitor.snapshot().active.length,0,'A single player must not create a widespread notice');
 const peers=[peer,{ws:{},inMatch:true,room}];
 for(let i=0;i<4;i++){for(const p of peers)monitor.report(p,{fps:20,rtt:40,gap:600});monitor.tick();time+=5000;}
 assert.deepEqual(monitor.snapshot().active.map(i=>i.kind),['client-rendering','client-connection']);assert.equal(monitor.snapshot().notice.scope,'widespread');
 const publicData=JSON.stringify(monitor.snapshot());assert.ok(!publicData.includes('inMatch')&&!publicData.includes('ws'));
 monitor.report(peer,{fps:60,rtt:20,gap:50});time+=60000;monitor.tick();assert.equal(monitor.reports.size,0);await monitor.close();
});
test('clock handles hours and clock skew without negative durations',()=>{
 assert.equal(elapsedClock(0,3661000),'01:01:01');assert.equal(elapsedClock(5000,0),'00:00:00');
});
test('public service status is readable cross-origin and contains no credentials',async()=>{
 const app=await startRealtimeServer({host:'127.0.0.1',port:0,origins:['http://localhost:5199']});
 try{
  const response=await fetch(`http://127.0.0.1:${app.server.address().port}/status`,{headers:{Origin:'http://localhost:5199'}});
  assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'http://localhost:5199');const data=await response.json();assert.ok(Array.isArray(data.history)&&Array.isArray(data.active));assert.equal(data.monitoring.emailAlertsEnabled,false);assert.equal(data.monitoring.minimumAffectedPlayers,2);assert.ok(!JSON.stringify(data).includes('token'));
 }finally{await app.close();}
});

test('one shared clock continues as issue types change and persists across restart',async()=>{
 const dir=await mkdtemp('/tmp/ravel-shared-clock-');let time=100000;const options={now:()=>time,path:dir+'/status.json',automatic:false};
 const monitor=new ServiceStatus({},options);await monitor.ready;
 try{monitor.observe('cpu-pressure',true);time+=15000;monitor.observe('cpu-pressure',true);const first=monitor.snapshot().notice;
 time+=5000;monitor.observe('server-delay',true);time+=15000;monitor.observe('server-delay',true);monitor.observe('cpu-pressure',false);time+=60000;monitor.observe('cpu-pressure',false);
 assert.equal(monitor.snapshot().notice.id,first.id);assert.equal(monitor.snapshot().notice.startedAt,first.startedAt);assert.equal(monitor.snapshot().active.length,1);
 await monitor.close();const restored=new ServiceStatus({},options);await restored.ready;assert.equal(restored.snapshot().notice.startedAt,first.startedAt);assert.equal(restored.snapshot().notice.id,first.id);
 restored.observe('server-delay',false);time+=60000;restored.observe('server-delay',false);assert.equal(restored.snapshot().notice,null);await restored.close();
 }finally{await monitor.close();await rm(dir,{recursive:true,force:true});}
});


test('server issues need two connected humans and ignore virtual hosts',async()=>{
 let time=100000,periods=0;const peers=new Map([['one',{ws:{}}],['virtual',{ws:{},virtualRoom:true}]]);
 const relay={peers,authority:{rooms:new Map()},cpuQuota:{snapshot:()=>({available:true,periods:periods+=100,throttledPeriods:periods})}};
 const monitor=new ServiceStatus(relay,{now:()=>time,path:null,automatic:false});await monitor.ready;
 for(let i=0;i<5;i++){monitor.tick();time+=5000;}
 assert.equal(monitor.snapshot().active.length,0);
 peers.set('two',{ws:{}});
 for(let i=0;i<4;i++){monitor.tick();time+=5000;}
 assert.equal(monitor.snapshot().active[0].kind,'cpu-pressure');await monitor.close();
});

test('two affected players qualify even when most reports are healthy',async()=>{
 let time=100000;const room={},relay={authority:{roomFor:()=>room}},monitor=new ServiceStatus(relay,{now:()=>time,path:null,automatic:false});await monitor.ready;
 const peers=Array.from({length:8},()=>({ws:{}}));
 for(let i=0;i<4;i++){peers.forEach((p,j)=>monitor.report(p,{fps:j<2?20:60,rtt:j<2?200:20,gap:0}));monitor.tick();time+=5000;}
 assert.deepEqual(monitor.snapshot().active.map(i=>i.kind),['client-rendering','client-connection']);await monitor.close();
});
