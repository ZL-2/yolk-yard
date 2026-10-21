import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPERIENCES,modeMarkup,lobbyMarkup} from '../src/lobby-ui.js';
import {modeAvailable} from '../src/mode-availability.js';
import {fixture} from './helpers/public-match.js';
import {MatchAuthority} from '../server/realtime/authority.js';
import {queueZombies} from '../server/realtime/zombies-service.js';
import {VERSION} from '../src/data.js';

test('Zombies is preserved after Training, disabled and visibly paused',()=>{
 assert.deepEqual(EXPERIENCES.map(e=>e.id),['royale','box-fights','zone-wars','ffa','training','zombies']);
 const markup=modeMarkup({mode:'royale'},false,1,{zombies:12});
 const card=markup.match(/<button class="yard-mode-card mode-paused"[^]*?<\/button>/)?.[0];
 assert.ok(card);assert.match(card,/data-experience="zombies"[^>]*disabled/);
 assert.match(card,/NOT CURRENTLY AVAILABLE/);assert.doesNotMatch(card,/mode-population/);
 assert.equal(modeAvailable('zombies'),false);
 for(const mode of ['royale','boxfight','zonewars','ffa','training'])assert.equal(modeAvailable(mode),true);
});

test('a stale Zombies selection cannot present an enabled Play button',()=>{
 const profile={name:'Operator'},party={leader:'p',state:'idle',selection:{mode:'zombies',access:'private'},members:[{id:'p',profile}]};
 const markup=lobbyMarkup({profile,party,id:'p',online:true,balance:0});
 assert.match(markup,/data-action="lobby-play" disabled>UNAVAILABLE/);
 assert.match(markup,/Choose another mode/);
 assert.match(markup,/data-action="choose-mode" >/);
});

test('real relay rejects public, private, custom and stale Zombies launches without reserving rooms',async()=>{
 const f=await fixture();try{
  const u=await f.user('Paused Mode Tester'),service=f.app.relay.parties,p=service.parties.get(u.party.id);
  for(const access of ['public','private'])await assert.rejects(u.ask('select',{mode:'zombies',access}),/not currently available/);
  await assert.rejects(u.ask('queue',{custom:true,options:{mode:'zombies'}}),/not currently available/);
  p.selection={...p.selection,mode:'zombies'};await assert.rejects(u.ask('queue'),/not currently available/);
  p.selection={...p.selection,mode:'royale'};
  const code='PAUSE222',key=`yolk-yard-v${VERSION}-${code}`;
  f.app.relay.peers.set(key,{listing:{mode:'zombies',public:false}});
  try{await assert.rejects(u.ask('queue',{code}),/not currently available/);}finally{f.app.relay.peers.delete(key);}
  assert.equal(p.state,'idle');assert.equal(service.tickets.size,0);assert.equal(f.app.relay.authority.rooms.size,0);
  await u.ask('select',{mode:'boxfight',access:'public',teamSize:1});await u.ask('queue');const game=await f.game(u);assert.equal(game.sim.options.mode,'boxfight');
 }finally{await f.close();}
});

test('direct Zombies service and old room hello cannot bypass the pause',()=>{
 assert.throws(()=>queueZombies(null,null,{}),/not currently available/);
 const messages=[],room={sim:{options:{mode:'zombies'}}},peer={},other={id:'old-zombies'};
 const authority={rooms:new Map([[other.id,room]]),send:(_peer,message)=>messages.push(message)};
 assert.equal(MatchAuthority.prototype.data.call(authority,peer,other,{channel:'test',data:{type:'hello'}}),true);
 assert.equal(messages[0].data.type,'reject');assert.match(messages[0].data.reason,/not currently available/);
});
