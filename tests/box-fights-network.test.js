import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,until,pause} from './helpers/public-match.js';
import {buildingTick,editBuilding} from '../src/building.js';

test('Box matchmaking isolates team sizes and closes entry when the round begins',async()=>{
 const f=await fixture();try{
  const a=await f.user('Box Solo Host'),b=await f.user('Box Solo Guest'),c=await f.user('Box Duos'),d=await f.user('Box Next Duel');
  for(const u of [a,b,d])await u.ask('select',{mode:'boxfight',teamSize:1});await c.ask('select',{mode:'boxfight',teamSize:2});await a.ask('queue');await b.ask('queue');await c.ask('queue');
  const first=await f.game(a);await until(()=>b.launches.length,'Second duelist reservation');const second=await f.game(b),duo=await f.game(c);assert.equal(first.net.code,second.net.code);assert.notEqual(first.net.code,duo.net.code);assert.equal(second.state.options.mode,'boxfight');assert.equal(second.state.options.map,'box-foundry');
  first.sim.beginBoxRound();first.net.broadcast(first.sim.snapshot());first.net.publishRoom();await until(()=>f.app.relay.publicHost.roomFor(f.app.relay.peers.get(first.net.peer.id)).state.stage==='box-prepare','Build phase closes entry');await d.ask('queue');const next=await f.game(d);assert.notEqual(next.net.code,first.net.code);assert.deepEqual(f.games.flatMap(g=>g.errors),[]);
 }finally{await f.close();}
});
test('ready 2v2 and 4v4 parties reserve capacity, stay together and enforce public rules',async()=>{
 for(const size of [2,4]){const f=await fixture();try{
  const users=[];for(let i=0;i<size;i++)users.push(await f.user('Box '+size+' Member '+i));const [leader,...mates]=users;await leader.ask('privacy',{value:'open'});for(const u of mates)await u.ask('join',{id:leader.party.id});await leader.ask('select',{mode:'boxfight',teamSize:size,options:{scoreLimit:1,boxFormat:'ffa',fill:false}});await assert.rejects(leader.ask('select',{mode:'boxfight',teamSize:1}),/fit|team/i);await assert.rejects(leader.ask('queue'),/ready/i);
  for(const u of mates)await u.ask('ready',{value:true});await leader.ask('queue');const host=await f.game(leader);for(const u of mates){await until(()=>u.launches.length,'Whole party dispatch');await f.game(u);}const humans=[...host.sim.players.values()].filter(p=>!p.bot);assert.equal(humans.length,size);assert.equal(new Set(humans.map(p=>p.team)).size,1);assert.equal(new Set(humans.map(p=>p.teamSlot)).size,size);assert.equal(host.sim.options.capacity,size*2);assert.equal(host.sim.options.scoreLimit,5);assert.equal(host.sim.options.boxFormat,'teams');assert.equal(host.sim.options.fill,false);assert.equal(host.sim.options.bots,0);assert.equal(host.sim.players.size,size);assert.ok(host.sim.players.size<=size*2);
 }finally{await f.close();}}
});
test('private 3v3 and FFA codes retain the room format for joining parties',async()=>{
 const f=await fixture();try{
  for(const [format,size,capacity]of [['teams',3,6],['ffa',1,8]]){
   const hostUser=await f.user('Private '+format),guestUser=await f.user('Joining '+format);await hostUser.ask('select',{mode:'boxfight',access:'private',teamSize:size,options:{boxFormat:format,boxArena:'box-relay',scoreLimit:7}});await hostUser.ask('queue');const host=await f.game(hostUser);host.net.publishRoom();await until(()=>f.app.relay.peers.get(host.net.peer.id)?.listing,'Private listing');await guestUser.ask('queue',{code:host.net.code});const launch=guestUser.launches.at(-1);assert.equal(launch.options.boxFormat,format);assert.equal(launch.options.teamSize,size);assert.equal(launch.options.capacity,capacity);const guest=await f.game(guestUser);assert.equal(guest.state.options.scoreLimit,7);assert.equal(guest.state.options.boxArena,'box-relay');
  }
 }finally{await f.close();}
});
test('real guest edits and host migration retain builds, scores and current round',async()=>{
 const f=await fixture();try{
  const a=await f.user('Box Migration Host'),b=await f.user('Box Migration Guest');for(const u of [a,b])await u.ask('select',{mode:'boxfight',teamSize:2});await a.ask('queue');const host=await f.game(a);await b.ask('queue');const guest=await f.game(b);clearInterval(guest.clock);/* Inspect the restored checkpoint before a departing final opponent can forfeit the round. */host.sim.beginBoxRound();host.sim.boxEnd=1e6;
  const p=host.sim.players.get(guest.net.id);Object.assign(p,{x:0,z:p.boxSpawn.z<0?-6:6,yaw:p.boxSpawn.z<0?0:Math.PI,pitch:0});buildingTick(host.sim,p,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});const wall=host.sim.builds[0];assert.ok(wall);host.net.broadcast(host.sim.snapshot());await until(()=>guest.state.royale.builds?.length===1,'Guest sees structure');
  guest.net.send({type:'player-action',action:'build-change:'+JSON.stringify({id:wall.id,mask:16,path:[],revision:0,yaw:p.yaw,pitch:0})});await until(()=>host.sim.builds[0].mask===16,'Guest edit authorized by host');await until(()=>guest.state.royale.builds?.[0]?.mask===16,'Edited structure delivered');host.sim.roundWins={0:2,1:1};host.sim.boxEnd=host.sim.time;host.sim.tick(1/30);host.sim.players.get(guest.net.id).inventory[1].ammo=2;const match=host.sim.matchId,round=host.sim.boxRound;
  host.net.broadcast(host.sim.snapshot());await until(()=>guest.state.boxfight.stage==='fight','Fight checkpoint');await pause(650);host.net.destroy();await a.ask('returned');await until(()=>guest.net.isHost&&guest.sim,'Guest elected host',15000);assert.equal(guest.sim.matchId,match);assert.equal(guest.sim.boxRound,round);assert.deepEqual(guest.sim.roundWins,{0:2,1:1});assert.equal(guest.sim.builds[0].mask,16);assert.equal(guest.sim.players.get(guest.net.id).inventory[1].ammo,2);assert.ok(!guest.sim.map.boxes.some(b=>b.objectId==='box-divider'));assert.deepEqual(guest.errors,[]);
 }finally{await f.close();}
});
