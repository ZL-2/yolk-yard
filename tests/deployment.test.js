import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {DeploymentStatus} from '../server/realtime/deployment.js';
test('update latch survives restart and failed probes; clears only after frontend and relay are the same published build',async()=>{
 const folder=await mkdtemp(tmpdir()+'/ravel-deploy-'),path=folder+'/deployment.json',events=[];
 const relay={peers:new Map([['p',{}]]),send:(p,m)=>events.push(m),parties:{users:new Map(),send:()=>{},store:{storage:()=>({available:true})}}};
 let latest='3.5.1',frontend={build:'old',appVersion:'3.5.0'},offline=false;
 const fetcher=async url=>{if(offline)throw Error('offline');return {ok:true,json:async()=>url.includes('raw.githubusercontent')?{version:latest}:frontend};};
 try{
  const old=new DeploymentStatus(relay,{build:'old',version:'3.5.0',path,fetcher});await old.ready;await old.check();assert.equal(old.snapshot().updating,true);const start=old.snapshot().startedAt;
  offline=true;await old.check();assert.equal(old.snapshot().updating,true);
  const next=new DeploymentStatus(relay,{build:'new',version:'3.5.1',path,fetcher});await next.ready;assert.equal(next.snapshot().startedAt,start);assert.equal(next.snapshot().updating,true);
  offline=false;await next.check();assert.equal(next.snapshot().updating,true);frontend={build:'new',appVersion:'3.5.1'};await next.check();assert.equal(next.snapshot().updating,false);assert.equal(events.at(-1).deployment.build,'new');
  await next.set(true);relay.parties.store.storage=()=>({available:false});await next.check();assert.equal(next.snapshot().updating,true,'unhealthy social storage cannot reopen the game');
 }finally{await rm(folder,{recursive:true,force:true});}
});
