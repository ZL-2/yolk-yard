import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxFightSimulation} from '../src/box-fights.js';
import {ZoneWarsSimulation} from '../src/zone-wars.js';
import {checkpointWorldKey} from '../src/action-network.js';
import {SnapshotInterest} from '../src/snapshot-interest.js';

for(const Simulation of [ZoneWarsSimulation,BoxFightSimulation]){
 test(Simulation.name+' drops the complete loadout once and clears the drops next round',()=>{
  const sim=new Simulation({boxFormat:'ffa',capacity:4,fill:false});
  const loser=sim.addPlayer('loser',{name:'One'});
  const winner=sim.addPlayer('winner',{name:'Two'});
  sim.addPlayer('other',{name:'Three'});
  sim.startRound();sim.boxEnd=sim.time;sim.tick(1/30);
  loser.inventory[1]={id:'sprinter',weapon:true,rarity:3,count:1,ammo:7};
  loser.inventory[2]={id:'mini',count:3,rarity:1};
  loser.inventory.fill(null,3);
  loser.bank={light:45,medium:55,shells:12,heavy:0,rockets:2};
  loser.materials={wood:75,brick:12,metal:3};
  const last=sim.lootId;
  sim.damage(loser,winner,1000,'test');
  sim.damage(loser,winner,1000,'test');
  const drops=sim.loot.filter(item=>item.uid>last);
  assert.deepEqual(drops.map(item=>[item.id,item.count]),[['sprinter',1],['mini',3],['light',45],['medium',55],['shells',12],['rockets',2],['wood',75],['brick',12],['metal',3]]);
  assert.equal(drops[0].ammo,7);
  assert.equal(drops[0].rarity,3);
  assert.ok(loser.inventory[0].pickaxe&&loser.inventory.slice(1).every(item=>item===null));
  assert.ok(Object.values(loser.bank).every(count=>count===0));
  assert.ok(Object.values(loser.materials).every(count=>count===0));
  winner.inventory[1]=null;
  winner.x=drops[0].x;winner.y=drops[0].y;winner.z=drops[0].z;
  assert.ok(sim.accessible(winner,drops[0]));
  assert.equal(sim.takeLoot(winner,drops[0]),true);
  assert.ok(winner.inventory.some(item=>item?.id==='sprinter'&&item.ammo===7));
  sim.beginBoxRound();
  assert.ok(drops.every(drop=>!sim.loot.some(item=>item.uid===drop.uid)));
 });
}

test('Zone Wars snapshots keep the recipient and watched inventory and omit unused remote slots',()=>{
 const s=new ZoneWarsSimulation({fill:false,capacity:4});
 for(const id of ['local','watched','remote'])s.addPlayer(id,{name:id+' player'});
 s.startRound();
 for(const p of s.players.values()){
  p.inventory[2]={id:'sprinter',weapon:true,ammo:7};p.slot=2;
  p.inventory[3]={id:'mini',count:3};
 }
 s.players.get('local').watchingId='watched';
 const snapshot=s.snapshot();
 const [local,watched,remote]=new SnapshotInterest().players(snapshot,snapshot.players[0]);
 assert.equal(local.inventory[3].id,'mini');assert.equal(watched.inventory[2].ammo,7);
 assert.equal(remote.inventory[2].id,'sprinter');assert.equal(remote.inventory[2].ammo,undefined);
 assert.equal(remote.inventory[3],null);
 const key=checkpointWorldKey(snapshot,{builds:false});
 snapshot.royale.builds=[{id:'wall',revision:1}];
 assert.equal(checkpointWorldKey(snapshot,{builds:false}),key);
 snapshot.royale.lootVersion++;
 assert.notEqual(checkpointWorldKey(snapshot,{builds:false}),key);
});
