import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {RoyaleSimulation} from '../src/royale.js';
import {RelayPeer} from '../src/relay-peer.js';
const baseline=process.env.NETWORK_PERF_BASELINE;assert.ok(baseline,'NETWORK_PERF_BASELINE is required');
const OldPeer=(await import(pathToFileURL(resolve(baseline,'src/relay-peer.js')))).RelayPeer;
const sim=new RoyaleSimulation({bots:45,fill:true,capacity:48,seed:151});for(const [id,name]of [['host','Host'],['one','Guest One'],['two','Guest Two']])sim.addPlayer(id,{name});sim.startRound();sim.beginBattle();
const templates=[];
for(let frame=0;frame<12;frame++){
 sim.time+=.05;for(const p of sim.players.values())p.x+=p.bot?.012:.02;
 const snapshot=sim.snapshot();if(frame){delete snapshot.royale.loot;delete snapshot.royale.chests;delete snapshot.royale.builds;delete snapshot.royale.worldDamage;}
 templates.push({snapshot,checkpoint:frame%4===0?{simulation:sim.checkpoint(),chat:{sequence:0,enabled:true,members:[],reports:[]},kicked:[]}:undefined});
}
function run(Peer,guests){
 const owner=Object.create(Peer.prototype);Object.assign(owner,{destroyed:false,rotating:false,socket:{readyState:1,bufferedAmount:0},unacked:new Map(),queue:[],queueBytes:0,queuedSizes:new WeakMap(),queuedWork:new WeakMap(),snapshotWork:new WeakMap(),connections:new Map(),emit(type){throw Error(type);},control(message){this.bytes+=JSON.stringify(message).length;},bytes:0});
 for(let i=0;i<guests;i++)owner.connections.set('c'+i,{channel:'c'+i,open:true,compact:true,queuedBytes:0});
 const frames=structuredClone(templates),start=performance.now();
 for(const {snapshot,checkpoint}of frames){const network={hostId:'host',members:[{id:'host'},...Array.from({length:guests},(_,i)=>({id:'guest-'+i}))]};for(let i=0;i<guests;i++)owner.enqueue({type:'data',channel:'c'+i,data:{type:'state',state:{...snapshot,events:[...snapshot.events],network},...(checkpoint?{checkpoint}:{})}});owner.flush();}
 clearTimeout(owner.flushTimer);assert.equal(owner.queueBytes,0);assert.ok([...owner.connections.values()].every(c=>c.queuedBytes===0));return {ms:performance.now()-start,bytes:owner.bytes};
}
const report={baseline,workloads:{},note:'CPU time to size, queue, encode and serialize identical 48-contestant + 15-NPC frames for one or two guests; not a promise of device FPS or Internet ping.'};
for(const guests of [1,2]){
 run(RelayPeer,guests);run(OldPeer,guests);const samples={current:[],baseline:[]};
 for(let trial=0;trial<7;trial++)for(const [name,Peer]of trial%2?[['baseline',OldPeer],['current',RelayPeer]]:[['current',RelayPeer],['baseline',OldPeer]]){const result=run(Peer,guests);samples[name].push(result.ms);}
 const median=a=>[...a].sort((a,b)=>a-b)[3],current=median(samples.current),old=median(samples.baseline);report.workloads[(guests+1)+'Players']={currentMs:current,baselineMs:old,reductionPercent:Math.round((1-current/old)*1000)/10,samples};assert.ok(current<old*1.12,'Snapshot workload regressed for '+(guests+1)+' players');
}
await mkdir('test-results/expansion',{recursive:true});await writeFile('test-results/expansion/field-stability-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
