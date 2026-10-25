import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {IconVoting} from '../server/realtime/icon-voting.js';
import {ICON_CLOSES_AT,iconName,duplicateCandidate} from '../src/icon-voting-rules.js';
test('deadline is exactly Tuesday 3:15 PM New York, not browser local time',()=>{assert.equal(new Date(ICON_CLOSES_AT).toISOString(),'2026-10-27T19:15:00.000Z');});
test('three-letter rule and duplicate variants',()=>{for(const value of ['Jo','A--bcde','<script>','12345','    '])assert.throws(()=>iconName(value));assert.equal(iconName('Joe'),'Joe');assert.equal(iconName('  André  '),'André');const list=[{first:'André',last:'Smith'}];for(const [f,l]of [['Andre','SMITH'],['André','S-mith'],['Smith','Andre'],['Andree','Smith']])assert.ok(duplicateCandidate(list,f,l));assert.equal(duplicateCandidate(list,'Robert','Jones'),undefined);});
test('atomic nominations, vote replacement, durable restart and exact closing boundary',async()=>{const dir=await mkdtemp(tmpdir()+'/icon-vote-');try{let now=ICON_CLOSES_AT-5000;const options={path:dir+'/poll.json',now:()=>now},v=new IconVoting(options);const results=await Promise.allSettled([v.mutate('one',{action:'nominate',first:'Sarah',last:'Smith'}),v.mutate('two',{action:'nominate',first:'SARAH',last:'Smith'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);await v.mutate('two',{action:'nominate',first:'Peter',last:'Jones'});const [a,b]=v.summary('one').candidates;await v.mutate('one',{action:'vote',candidate:a.id});await v.mutate('one',{action:'vote',candidate:a.id});await v.mutate('one',{action:'vote',candidate:b.id});assert.deepEqual(v.summary('one').candidates.map(c=>c.votes),[0,1]);const restored=new IconVoting(options);assert.equal(restored.summary('one').vote,b.id);assert.equal(restored.summary('new').vote,null);now=ICON_CLOSES_AT;assert.equal(restored.summary('new').closed,true);await assert.rejects(restored.mutate('one',{action:'vote',candidate:a.id}),/closed/);await assert.rejects(restored.mutate('new',{action:'nominate',first:'Other',last:'Person'}),/closed/);}finally{await rm(dir,{recursive:true,force:true});}});
test('owner edits preserve votes, enforce duplicates and stale checks; deletes clear votes durably',async()=>{
 const dir=await mkdtemp(tmpdir()+'/icon-owner-');
 try{
 const opts={path:dir+'/poll.json',now:()=>ICON_CLOSES_AT-1000},v=new IconVoting(opts);
 await v.mutate('a',{action:'nominate',first:'Joe',last:'Fox'});
 await v.mutate('b',{action:'nominate',first:'Sam',last:'Lee'});
 const [a,b]=v.summary().candidates;
 await v.mutate('a',{action:'vote',candidate:a.id});
 const edit={action:'edit',id:a.id,expectedFirst:a.first,expectedLast:a.last,first:'Jon',last:'Fox'};
 await assert.rejects(v.mutate('a',edit),/Unknown/);
 await assert.rejects(v.mutate(null,{...edit,first:'Jo'},true),/three/);
 await assert.rejects(v.mutate(null,{...edit,first:b.first,last:b.last},true),/matching/);
 await v.mutate(null,edit,true);
 assert.equal(v.summary('a').vote,a.id);assert.equal(v.summary().candidates[0].votes,1);
 await assert.rejects(v.mutate(null,edit,true),/changed/);
 await v.mutate(null,{action:'delete',id:a.id,expectedFirst:'Jon',expectedLast:'Fox'},true);
 const restored=new IconVoting(opts);assert.equal(restored.summary('a').vote,null);assert.equal(restored.summary().candidates.length,1);
 await restored.mutate('a',{action:'vote',candidate:b.id});assert.equal(restored.summary('a').vote,b.id);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('owner voting endpoint rejects unauthorized access',async()=>{
 const {OwnerService}=await import('../server/realtime/owner.js');
 const {Readable}=await import('node:stream');
 const owner=Object.create(OwnerService.prototype);owner.tokens=new Map();owner.now=Date.now;
 const req=Readable.from([Buffer.from(JSON.stringify({action:'delete',id:'test'}))]);Object.assign(req,{method:'POST',url:'/owner/icon-voting',headers:{origin:'https://game.test'}});
 let status;const res={writeHead(s){status=s;},end(){}};
 await owner.handle(req,res,{origins:['https://game.test'],relay:{}});assert.equal(status,401);
});
