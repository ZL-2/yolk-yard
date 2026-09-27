import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { weapon } from '../src/data.js';
import { criticalHit } from '../src/combat.js';
function arena(id) {
  const sim = new Simulation({ bots: 0, seed: 11 });
  const player = sim.addPlayer('test', { weapon: id });
  sim.startRound();
  sim.spawn(player);
  sim.time = 10;
  sim.map = { ...sim.map, boxes: [] };
  Object.assign(player, { x: 0, y: 0, z: 0, nextShot: 0, shieldUntil: 0 });
  return { sim, player };
}
function hold(sim, player, frames, fire = true) {
  for (let n = 0; n < frames; n++) {
    sim.setInput(player.id, { seq: player.ack + 1, fire, slot: player.slot });
    sim.tick(1 / 60);
  }
}
test('semi-auto hold fires once while automatic hold repeats at the reference rate', () => {
  const semi = arena('anchor');
  hold(semi.sim, semi.player, 60);
  assert.equal(semi.player.ammo[0], weapon('anchor').magazine-1);
  hold(semi.sim, semi.player, 1, false);
  hold(semi.sim, semi.player, 1);
  assert.equal(semi.player.ammo[0], weapon('anchor').magazine-2);
  const auto = arena('sprinter');
  hold(auto.sim, auto.player, 60);
  const shots=auto.sim.events.filter(e=>e.type==='shot');assert.ok(shots.length>=6&&shots.length<=8);for(let i=1;i<shots.length;i++)assert.ok(shots[i].time-shots[i-1].time>=weapon('sprinter').interval-1e-8);
});
test('one burst has three shots spaced by the configured interval and holding does not start another', () => {
  const {sim,player} = arena('duet');
  hold(sim,player,60);
  const shots = sim.events.filter(e => e.type === 'shot');
  assert.equal(shots.length, 3);
  for (let n=1;n<3;n++) assert.ok(Math.abs(shots[n].time-shots[n-1].time-weapon('duet').burstInterval)<1/60+1e-8);
  assert.equal(player.ammo[0],21);
});
test('reload uses empty and tactical times and never creates reserve ammo', () => {
  const {sim,player} = arena('sprinter');
  player.ammo[0]=0;
  sim.reload(player);
  assert.ok(Math.abs(player.reloadEnd-sim.time-weapon('sprinter').reloadEmpty)<1e-9);
  sim.time=player.reloadEnd;
  sim.tick(1/60);
  assert.deepEqual([player.ammo[0],player.reserve[0]],[30,210]);
  player.ammo[0]=29;
  sim.reload(player);
  assert.ok(Math.abs(player.reloadEnd-sim.time-weapon('sprinter').reload)<1e-9);
});
test('shotgun fires ten accepted pellet paths and consumes one shell', () => {
  const {sim,player} = arena('scatter');
  sim.fire(player);
  assert.equal(sim.events.findLast(e=>e.type==='shot').shots.length,10);
  assert.equal(player.ammo[0],weapon('scatter').magazine-1);
  assert.equal(sim.projectiles.length,0);
});
test('ammo pickup adds class-specific amounts and stays available at capacity', () => {
  const {sim,player} = arena('sprinter');
  const item = {type:'ammo',x:0,y:0,z:0,availableAt:0};
  sim.pickups=[item];
  sim.collect(player);
  assert.equal(item.availableAt,0);
  player.reserve=[190,20];
  sim.collect(player);
  assert.deepEqual(player.reserve,[220,35]);
  assert.ok(item.availableAt>sim.time);
});
test('rocket only explodes after arming and uses the configured damage', () => {
  const {sim,player} = arena('thumper');
  const rocket={owner:player.id,weapon:'thumper',x:0,y:0.85,z:0,popper:false,travelled:2.9};
  sim.explode(rocket);
  assert.equal(player.health,100);
  rocket.travelled=3;
  sim.explode(rocket);
  assert.ok(Math.abs(player.health-(100-weapon('thumper').damage*.55))<1e-9);
});
test('ordinary shell hits have no limb or edge multiplier',()=>{const w=weapon('sprinter');for(const x of [0,.4,.6])assert.equal(criticalHit({x,y:.9,z:0},{y:0},w),false);});

test('replicated crosshair spread widens on movement and recovers at rest', () => {
  const { sim, player } = arena('sprinter');
  const readSpread = () => sim.snapshot().players.find(p => p.id === player.id).shotSpread;
  hold(sim, player, 10, false);
  const idle = readSpread();
  for (let i = 0; i < 20; i++) {
    sim.setInput(player.id, {seq: player.ack + 1, forward: 1});
    sim.tick(1 / 60);
  }
  assert.ok(readSpread() > idle);
  assert.equal(readSpread(), player.accuracyState[player.slot].spread);
  hold(sim, player, 180, false);
  assert.ok(Math.abs(readSpread() - idle) < 1e-9);
});

test('long-range scopes remain stable when moving and jumping', () => {
  for (const id of ['needle','anchor']) {
    const { sim, player } = arena(id);
    const moving = structuredClone(player), still = structuredClone(player);
    moving.aim = still.aim = true;
    // Include bloom inherited from moving before entering the scope.
    moving.accuracyState[moving.slot].movement = 0.8;
    for (let i = 0; i < 45; i++) {
      const previous = {x:moving.x,y:moving.y,z:moving.z};
      moving.x += 0.2; moving.y += 0.1;
      sim.updateAccuracy(moving, previous, 1/60);
      sim.updateAccuracy(still, still, 1/60);
      assert.equal(moving.accuracyState[moving.slot].spread, still.accuracyState[still.slot].spread, id);
    }
    moving.aim = false;
    sim.updateAccuracy(moving, {...moving, x:moving.x-0.2}, 1/30);
    assert.ok(moving.accuracyState[moving.slot].spread > still.accuracyState[still.slot].spread, id);
  }
});
