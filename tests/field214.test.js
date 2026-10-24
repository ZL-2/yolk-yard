import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {fixture} from './helpers/public-match.js';
import {TOURNAMENTS} from '../src/tournament.js';
import {combatReticle,nameplateVisible} from '../src/combat-hud-policy.js';
import {mapViewport,mapPosition,zoomMap} from '../src/tactical-map.js';
import {competitiveCareerMarkup} from '../src/competitive-career.js';

test('map zoom keeps the pointer on the same world position; panning stays inside the island',()=>{
 const initial=mapViewport({},256),anchor=mapPosition(initial,256,.6,.4),zoomed=zoomMap(initial,256,4,.6,.4);
 assert.deepEqual(mapPosition(zoomed,256,.6,.4),anchor);
 assert.deepEqual(mapViewport({zoom:100,x:900,z:-900},256),{zoom:6,x:256-256/6,z:-(256-256/6)});
 assert.deepEqual(zoomMap(zoomed,256,1),initial);
 const panned=mapViewport({zoom:2,x:80,z:-50},256);
 assert.deepEqual(mapPosition(panned,256,.5,.5),{x:80,z:-50});
 assert.deepEqual(mapPosition(panned,256,.75,.25),{x:144,z:-114});
});
test('passenger reticle has no ADS transition gap, including equip/reload and stale sprint state',()=>{
 const state={royale:{}},p={health:100,flight:'ground',vehicleId:'atv',vehicleSeat:1,sprinting:true,tacticalSprint:true};
 for(const perspective of ['first','third'])for(const aimBlend of [0,.1,.7,.8,.81,1]){
  const r=combatReticle(state,p,{scopeActive:true,aimBlend,perspective});assert.equal(Number(r.scope)+Number(r.crosshair),1);
 }
 assert.deepEqual(combatReticle(state,{...p,reloadEnd:100},{scopeActive:false,aimBlend:1}),{scope:false,crosshair:true});
 for(const changes of [{vehicleSeat:0},{health:0},{spectating:true},{downed:true},{emote:'wave'}])assert.deepEqual(combatReticle(state,{...p,...changes},{scopeActive:false,aimBlend:0}),{scope:false,crosshair:false});
});
test('Box Fights suppress enemy names, preserve squad names; Zone Wars displays enemies',()=>{
 const local={id:'a',team:0},enemy={id:'b',team:1,health:100},mate={...enemy,team:0},box={options:{mode:'boxfight',boxFormat:'2v2'},boxfight:{}};
 for(const royale of [undefined,{}])assert.equal(nameplateVisible({...box,royale},enemy,local),false);
 assert.equal(nameplateVisible(box,mate,local),true);
 assert.equal(nameplateVisible({...box,zonewars:{},royale:{}},enemy,local),true);
 assert.equal(nameplateVisible({...box,zonewars:{}},{...enemy,spectating:true},local),false);
 assert.equal(nameplateVisible({options:{mode:'royale'},royale:{}},enemy,local),false);
});
test('Marks acknowledgements belong to the recipient and survive server restart without changing the wallet total',async()=>{
 const dir=await mkdtemp('/tmp/ravel-grant-214-'),f=await fixture({serverOptions:{ownerCode:'local-test-code-214-only',ownerPath:dir+'/owner.sqlite',tournamentOptions:{autoStart:false}}});
 try{
  const a=await f.user('Grant Recipient'),b=await f.user('Other Recipient'),owner=f.app.owner;
  owner.db.run('INSERT INTO grants VALUES(?,?,?,?,?)','grant-one',a.id,Date.now(),650,'Private audit reason');
  assert.equal(owner.grantSummary(a.id).notices[0].amount,650);assert.ok(!JSON.stringify(owner.grantSummary(a.id)).includes('Private audit'));
  await b.ask('grant-ack',{ids:['grant-one'],id:a.id});assert.equal(owner.grantSummary(a.id).notices.length,1);
  await assert.rejects(a.ask('grant-ack',{ids:['grant-one',42]}),/Invalid/);
  assert.deepEqual(await a.ask('grant-ack',{ids:['grant-one']}),[]);assert.deepEqual(await a.ask('grant-ack',{ids:['grant-one']}),[]);
  owner.db.run('INSERT INTO grants VALUES(?,?,?,?,?)','grant-two',a.id,Date.now(),350,'Another award');
  await f.restart();const restored=f.app.owner.grantSummary(a.id);
  assert.equal(restored.marks,1000);assert.deepEqual(restored.notices.map(n=>n.id),['grant-two']);
 }finally{await f.close();await rm(dir,{recursive:true,force:true});}
});
test('competitive career uses authenticated identity, durable prizes and repeat-winner bonus; excludes manual grants',async()=>{
 const dir=await mkdtemp('/tmp/ravel-career-214-'),f=await fixture({serverOptions:{ownerCode:'local-test-code-214-only',ownerPath:dir+'/owner.sqlite',tournamentOptions:{autoStart:false,now:()=>Date.parse('2026-10-24T12:00Z')}}});
 try{
  const a=await f.user('Cup Winner'),b=await f.user('Career Stranger'),service=f.app.relay.tournament,old=service.event(TOURNAMENTS[0].id);
  old.complete('finished','Local fixture',[{identity:a.id,name:'Cup Winner',place:1,kills:8}]);
  delete old.state.results[0].kills;old.state.standingsComplete=false;old.db.setMeta(old.key,old.state);
  service.event(TOURNAMENTS[1].id).complete('finished','Local fixture',[{identity:a.id,name:'Cup Winner',place:1,kills:4},{identity:b.id,name:'Career Stranger',place:2,kills:2}]);
  f.app.owner.db.run('INSERT INTO grants VALUES(?,?,?,?,?)','manual-grant',a.id,Date.now(),999,'Manual fixture');
  const career=await a.ask('competitive-career'),other=await b.ask('competitive-career',{id:a.id,identity:a.id});
  assert.equal(career.stats.marks,20000);assert.equal(career.stats.bonusMarks,10000);assert.equal(career.stats.wins,2);assert.equal(career.stats.kills,4);assert.equal(career.stats.killsRecorded,1);
  assert.equal(other.identity,b.id);assert.equal(other.stats.marks,2500);assert.equal(other.stats.wins,0);
  assert.match(competitiveCareerMarkup(career),/20,000 Marks/);assert.match(competitiveCareerMarkup(career),/Duplicate reward/);
  assert.equal(career.results.find(r=>r.id===old.id).kills,null);
  await f.restart();assert.deepEqual(f.app.relay.tournament.career(a.id).stats,career.stats);
 }finally{await f.close();await rm(dir,{recursive:true,force:true});}
});
