// Separate-process CPU measurement: WebSocket client cost is excluded.
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {Network} from '../src/network.js';
import {safeProfile} from '../src/data.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),rows=[];
const seconds=Number(process.env.RAVEL_CAPACITY_SECONDS)||8;
const cases=[['idle',0,0,0],['ffa',2,0,1],['ffa',2,6,1],['teams',2,6,1],['royale',2,30,1],['royale',16,16,1],['royale',2,30,2]].filter(row=>!process.env.RAVEL_CAPACITY_CASE||row.join(':')===process.env.RAVEL_CAPACITY_CASE);
const roots=[...(process.env.RAVEL_COMPARE_ROOT?[['before',resolve(process.env.RAVEL_COMPARE_ROOT)]]:[]),['after',fileURLToPath(new URL('../',import.meta.url))]];
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
for(const [version,root]of roots)for(const [mode,humans,bots,roomCount]of cases){
 const temp=mkdtempSync(resolve(tmpdir(),'ravel-capacity-')),child=fork(new URL('./capacity-server.mjs',import.meta.url),{silent:true,env:{...process.env,RAVEL_TEST_ROOT:root,SOCIAL_STORE_PATH:resolve(temp,'social.json')}});let stderr='';child.stderr.on('data',d=>stderr+=d);
 const message=type=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(type+' timed out: '+stderr)),30000);const listener=value=>{if(value.type===type){clearTimeout(timer);child.off('message',listener);resolve(value);}};child.on('message',listener);});
 const ready=await message('ready');globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${ready.port}/game`}};
 const nodes=[],samples=[];let inputTimer,seq=0;
 const make=()=>{const sample={count:0,last:0,gaps:[],errors:[]};samples.push(sample);const net=new Network({onState:()=>{const now=performance.now();if(sample.last)sample.gaps.push(now-sample.last);sample.last=now;sample.count++;},onError:error=>sample.errors.push(error)});nodes.push(net);return net;};
 try{
  for(let room=0;room<roomCount;room++){const host=make(),code=await host.host();await host.createAuthority({mode,bots,capacity:mode==='royale'?humans+bots:8,fill:false,difficulty:2,minutes:60,scoreLimit:1000},safeProfile({name:'Host '+room}),'private');for(let i=1;i<humans;i++)await make().join(code,safeProfile({name:'Guest '+room+' '+i}));if(mode!=='royale')host.authorityCommand({type:'start'});}
  inputTimer=setInterval(()=>{seq++;for(const net of nodes)net.input({seq,dt:1/60,forward:Math.sin(seq/90)>0?1:-1,strafe:Math.cos(seq/120),yaw:seq/100,pitch:0,fire:seq%3!==0,reload:seq%240===0,slot:mode==='royale'?1:0});},1000/60);
  await sleep(500);if(mode!=='royale')for(const net of nodes)net.send({type:'player-action',action:'respawn'});
  const phased=message('phased');child.send({type:'phase'});await phased;await sleep(1000);
  for(const sample of samples){sample.count=0;sample.last=0;sample.gaps=[];}
  const begun=message('begun');child.send({type:'begin'});await begun;await sleep(seconds*1000);
  const ended=message('result');child.send({type:'end'});const result=await ended,gaps=samples.flatMap(s=>s.gaps).sort((a,b)=>a-b);delete result.type;
  const row={version,mode,humans,bots,roomCount,...result,updatesPerSecond:nodes.length?samples.reduce((n,s)=>n+s.count,0)/nodes.length/result.seconds:0,gapP95Ms:gaps[Math.floor(gaps.length*.95)]||0,gapMaxMs:gaps.at(-1)||0,errors:samples.flatMap(s=>s.errors)};
  assert.deepEqual(row.errors,[]);if(roomCount){assert.ok(row.updatesPerSecond>17);assert.equal(row.rooms.length,roomCount);assert.ok(row.rooms.every(r=>r.phase===(mode==='royale'?'active':'playing')));}
  rows.push(row);if(process.env.RAVEL_CAPACITY_OUTPUT)writeFileSync(process.env.RAVEL_CAPACITY_OUTPUT,JSON.stringify(rows,null,2));console.log(JSON.stringify(row));
 }finally{clearInterval(inputTimer);for(const net of nodes)net.destroy();child.send({type:'close'});await once(child,'exit');rmSync(temp,{recursive:true,force:true});}
}
