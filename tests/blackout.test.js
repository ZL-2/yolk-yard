import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {BLACKOUT_GATE,BLACKOUT_HOLD,BLACKOUT_LOGS} from '../src/blackout-map.js';
import {blackoutPrompt} from '../src/blackout.js';
import {canStand,movePlayer,wallDistance} from '../src/physics.js';
import {tickVaultDoors} from '../src/frontier-world.js';

test('the wreck deck, breach, tunnel and recording sites are usable with ordinary movement',()=>{
  const map=ROYALE_MAP;
  const actor={x:156,y:9.4,z:193,health:100,grounded:true,flight:'ground',yaw:Math.PI,pitch:0,vy:0};
  for(let i=0;i<240;i++)movePlayer(actor,{yaw:Math.PI,forward:1},map,1/60);
  assert.ok(actor.z>217 && Math.abs(actor.y-2.2)<.05);
  for(let i=0;i<320;i++)movePlayer(actor,{yaw:0,forward:1},map,1/60);
  assert.ok(actor.z<194,'the tunnel can be climbed back to shore');
  Object.assign(actor,{x:164,y:2.2,z:217,grounded:true,vy:0});
  for(let i=0;i<60;i++)movePlayer(actor,{yaw:Math.PI/2,forward:1},map,1/60);
  assert.ok(actor.x<160 && Math.abs(actor.y-2.2)<.05,'hull breach admits players');
  assert.ok(canStand(map,{x:156,y:8.8,z:219}));
  Object.assign(actor,{x:143.55,y:8.8,z:237.6,grounded:true,vy:0});
  for(let i=0;i<100;i++)movePlayer(actor,{yaw:Math.PI,forward:1},map,1/60);
  assert.ok(actor.z>247&&actor.y>12.5,'the aft stair reaches the radio balcony');
  for(let i=0;i<80;i++)movePlayer(actor,{yaw:-Math.PI/2,forward:1},map,1/60);
  assert.ok(actor.x>153&&actor.y>12.5,'the balcony connects to the bridge roof');
  for(const point of [...map.blackout.breakers,...map.blackout.radios])assert.ok(canStand(map,point));
});

test('both breakers gate the hold, replicate and survive recovery, with one siren and three recordings',()=>{
  const sim=new RoyaleSimulation({bots:1,capacity:2,seed:238});
  const player=sim.addPlayer('player',{name:'Wreck QA'});
  sim.startRound();
  assert.equal(sim.blackout,null);
  assert.equal(sim.beginBattle(),true);
  const site=sim.map.blackout;
  const chests=sim.chests.filter(c=>c.vaultId===BLACKOUT_HOLD);
  assert.equal(chests.length,2);
  assert.ok(chests.every(c=>c.epic));
  const press=point=>{
    Object.assign(player,point,{flight:'ground',interactLatch:false});
    sim.interact(player,{interact:true},1/60);
  };
  Object.assign(player,{x:chests[0].x,y:chests[0].y,z:chests[0].z,flight:'ground'});
  assert.equal(sim.openChest(player,chests[0]),false);
  const front={x:site.gate.x,y:site.gate.y+1,z:site.gate.z-2};
  assert.ok(wallDistance(sim.map,front,{x:0,y:0,z:1},4)<4);
  press(site.breakers[0]);
  press(site.breakers[0]);
  assert.deepEqual(sim.snapshot().royale.blackout,{power:1,open:false});
  assert.equal(sim.doors[BLACKOUT_GATE].open,false);
  const copy=new RoyaleSimulation().restore(sim.checkpoint());
  assert.deepEqual(copy.blackout,{power:1,open:false});
  press(site.breakers[1]);
  press(site.breakers[1]);
  assert.deepEqual(sim.snapshot().royale.blackout,{power:3,open:true});
  assert.equal(sim.events.filter(e=>e.cue==='blackout-siren').length,1);
  sim.time+=3;
  tickVaultDoors(sim);
  assert.equal(sim.doors[BLACKOUT_GATE].passable,true);
  assert.equal(wallDistance(sim.map,front,{x:0,y:0,z:1},4),4);
  for(const [index,radio] of site.radios.entries()){
    Object.assign(player,radio);
    assert.match(blackoutPrompt(sim.map,sim,player,()=>true).text,/PLAY RECORDING/);
    press(radio);
    assert.equal(sim.events.findLast(e=>e.type==='blackout-recording').index,index);
  }
  assert.equal(BLACKOUT_LOGS.length,3);
  const chest=chests[0];
  Object.assign(player,{x:chest.x,y:chest.y,z:chest.z});
  assert.equal(sim.openChest(player,chest),true);
  assert.equal(sim.openChest(player,chest),false);
  sim.phase='results';
  assert.equal(sim.startRound(),true);
  assert.equal(sim.blackout,null);
});
