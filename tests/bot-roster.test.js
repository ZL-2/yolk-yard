import test from 'node:test';
import assert from 'node:assert/strict';
import {BOT_ROSTER,availableBotName} from '../src/bot-roster.js';
import {moderateText,safeName} from '../src/moderation.js';
import {nameKey} from '../src/data.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';

const botNames=sim=>[...sim.players.values()].filter(p=>p.bot&&!p.boss&&!p.henchman).map(p=>p.name);
const identities=sim=>[...sim.players.values()].map(p=>[p.id,p.name]);
function uniqueNames(sim){
  const names=[...sim.players.values()].map(p=>nameKey(p.name));
  assert.equal(new Set(names).size,names.length);
  for(const name of botNames(sim))assert.equal(safeName(name),name);
}

test('48 original Coast callsigns are distinct, readable and accepted by moderation',()=>{
  assert.equal(BOT_ROSTER.length,48);
  assert.equal(new Set(BOT_ROSTER.map(nameKey)).size,48);
  for(const [index,name]of BOT_ROSTER.entries()){
    assert.ok(name.length<=18,name);
    assert.match(name,/^[A-Za-z]+$/);
    assert.equal(moderateText(name,{kind:'name'}).ok,true,name);
    assert.equal(availableBotName('bot-'+index,[]),name);
  }
});

test('the full roster leaves room for human aliases without numeric fallback names',()=>{
  const players=BOT_ROSTER.map((name,index)=>({id:'bot-'+index,name}));
  for(let i=0;i<16;i++){
    const name=availableBotName('bot-'+i,players,[BOT_ROSTER[i].toUpperCase()]);
    assert.equal(safeName(name),name);
    assert.ok(name.length<=18);
    assert.match(name,/^[A-Za-z]+$/);
    assert.ok(!players.some(p=>nameKey(p.name)===nameKey(name)));
    players.push({name});
  }
});

test('FFA and team fill use distinct roster names without changing bot RNG',()=>{
  for(const mode of ['ffa','teams']){
    const sim=new Simulation({mode,fill:true,seed:432});
    sim.addPlayer('human',{name:BOT_ROSTER[0].toUpperCase()});
    const before=sim.random.state();sim.uniqueBotName('bot-0');
    assert.equal(sim.random.state(),before);
    sim.startRound();assert.equal(botNames(sim).length,7);uniqueNames(sim);
    const beforeRound=identities(sim);sim.phase='results';sim.startRound();
    assert.deepEqual(identities(sim),beforeRound);
    const bot=[...sim.players.values()].find(p=>p.bot);
    const desired=bot.name;assert.equal(sim.setProfile('human',{name:desired}),true);
    assert.equal(sim.players.get('human').name,desired);uniqueNames(sim);
  }
});

test('all 48 Royale bot seats have their own identity across recurring rounds',()=>{
  const sim=new RoyaleSimulation({capacity:48,fill:true,bots:47,recurring:true,seed:433});
  sim.startRound();assert.deepEqual(botNames(sim),BOT_ROSTER);uniqueNames(sim);
  const original=identities(sim);sim.phase='results';sim.startRound();
  assert.deepEqual(identities(sim),original);
});

test('human Royale joins and spectators can claim callsigns without duplicate names',()=>{
  const sim=new RoyaleSimulation({capacity:48,fill:true,seed:434});sim.startRound();
  const spectator=sim.admitPlayer('spectator',{name:BOT_ROSTER[0].toLowerCase()},{spectator:true});
  assert.ok(spectator);assert.equal(botNames(sim).length,48);uniqueNames(sim);
  const human=sim.admitPlayer('human',{name:BOT_ROSTER[1]});
  assert.ok(human);assert.equal(botNames(sim).length,47);uniqueNames(sim);
  assert.equal(sim.setProfile('human',{name:BOT_ROSTER[2]}),true);uniqueNames(sim);
});

test('teammate fill uses the same unique roster and preserves team allocation',()=>{
  const sim=new RoyaleSimulation({capacity:8,bots:0,fill:false,teamSize:4,seed:435});
  const a=sim.addPlayer('human-a',{name:'Captain'}),b=sim.addPlayer('human-b',{name:'Partner'});
  sim.startRound();sim.fillBotTeammates();
  assert.equal(botNames(sim).length,2);uniqueNames(sim);
  for(const human of [a,b])assert.equal([...sim.players.values()].filter(p=>p.bot&&p.team===human.team).length,2);
});

test('checkpoint migration preserves names and deterministic replacement identities',()=>{
  const sim=new RoyaleSimulation({capacity:4,bots:3,fill:true,seed:436});
  sim.addPlayer('human',{name:'Captain'});sim.startRound();sim.stage='active';
  const restored=new RoyaleSimulation().restore(sim.checkpoint());
  assert.deepEqual(identities(restored),identities(sim));
  sim.leavePlayer('human');restored.leavePlayer('human');
  assert.equal(botNames(sim).length,4);
  assert.deepEqual(identities(restored),identities(sim));uniqueNames(sim);uniqueNames(restored);
  const replacement=[...sim.players.values()].find(p=>p.id.startsWith('bot-fill-'));
  assert.ok(replacement);assert.ok(BOT_ROSTER.includes(replacement.name));
});

test('reserving player names does not rename authored bosses or sentinels',()=>{
  const sim=new Simulation({bots:0,seed:437});
  const boss=sim.addPlayer('boss',{name:'Commandant Voss'},true);boss.boss=true;
  const guard=sim.addPlayer('guard',{name:'Voss Sentinel'},true);guard.henchman=true;
  sim.reserveHumanName(boss.name);sim.reserveHumanName(guard.name);
  assert.equal(boss.name,'Commandant Voss');assert.equal(guard.name,'Voss Sentinel');
});
