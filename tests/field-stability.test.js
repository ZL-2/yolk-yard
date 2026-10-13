import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoyaleSimulation} from '../src/royale.js';
import {BOSSES} from '../src/bosses.js';
import {HENCHMEN,henchmanAwake,henchmanDefinition} from '../src/henchmen.js';
import {bossAlertVisual,alertBossToDamage} from '../src/boss-awareness.js';
import {bossInput} from '../src/season-world.js';
import {gun} from '../src/data.js';
import {canStand} from '../src/physics.js';
import {makeHumanoid} from '../src/humanoid.js';
import {realMatchPlayers,departureFeed,eliminationNotice} from '../src/match-roster.js';
import {presenceMarkup} from '../src/presence-ui.js';
import {RelaySnapshotWork} from '../src/relay-snapshot-work.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {SocialStore} from '../server/realtime/social-store.js';
import {Network} from '../src/network.js';
const match=()=>{const s=new RoyaleSimulation({bots:1,fill:false,capacity:8,seed:151});s.addPlayer('host',{name:'Real Operator'});s.startRound();return s;};
test('a failed stale host candidate advances the election immediately',async()=>{
 const network=Object.create(Network.prototype),handlers=new Map();let promoted=false;
 Object.assign(network,{closed:false,migrating:true,id:'live',members:[{id:'gone',peerId:'gone',order:1},{id:'live',peerId:'live',order:2}],failedHosts:new Set(),timers:new Set(),peer:{connect(){const attempt={on(k,fn){handlers.set(k,fn);return this;},close(){handlers.get('close')?.();}};queueMicrotask(()=>handlers.get('error')?.({type:'peer-unavailable'}));return attempt;}},promote(){promoted=true;this.migrating=false;}});
 network.electHost();await new Promise(r=>setTimeout(r,20));assert.equal(promoted,true);assert.ok(network.failedHosts.has('gone'));assert.equal(network.timers.size,0);
});
test('exactly four themed sentinels per boss use valid supports, Uncommon rifles and no match seats',()=>{
 const s=match();s.beginBattle();const guards=[...s.players.values()].filter(p=>p.henchman);assert.equal(guards.length,12);assert.equal(s.snapshot().royale.contestants,2);
 for(const boss of BOSSES){const group=guards.filter(p=>p.bossId===boss.id);assert.equal(group.length,4);for(const p of group){assert.ok(canStand(s.map,p),p.id);assert.equal(p.outfit,boss.outfit);assert.equal(p.boss,false);assert.equal(p.contestant,false);assert.equal(p.health,HENCHMEN.health);assert.equal(p.shield,HENCHMEN.shield);assert.equal(p.inventory[1].rarity,1);assert.equal(p.inventory[1].id,'sprinter');assert.equal(gun(p).rarity,1);assert.equal(henchmanDefinition(boss).ability,null);assert.equal(p.inventory.filter(i=>i&&!i.pickaxe).length,1);}
  const regular=makeHumanoid({outfit:boss.outfit}),guard=makeHumanoid(group[0]);assert.notEqual(regular.userData.human.mesh.geometry,guard.userData.human.mesh.geometry);assert.equal(guard.userData.human.mesh.skeleton.bones.length,32);
 }
 const restored=new RoyaleSimulation(s.options).restore(s.checkpoint());assert.equal([...restored.players.values()].filter(p=>p.henchman).length,12);assert.ok(restored.snapshot().players.filter(p=>p.henchman).every(p=>p.bossId&&p.inventory[1].rarity===1));
});
test('sentinels share alert markers, respect sleep bounds, and drop their rifle once without Mythics or scores',()=>{
 const s=match();s.beginBattle();const p=s.players.get('host'),guard=[...s.players.values()].find(p=>p.henchman);
 assert.equal(henchmanAwake(s,guard),false);Object.assign(p,{...guard.home,flight:'ground',spectating:false,health:100});s.time+=1;assert.equal(henchmanAwake(s,guard),true);
 alertBossToDamage(s,guard,p);assert.equal(bossAlertVisual(guard,s.time).symbol,'!');assert.ok(s.events.some(e=>e.type==='boss-voice'&&e.player===guard.id));assert.equal(bossInput(s,guard).slot,1);assert.equal(guard.bossWindup,undefined);
 const before=s.loot.length,kills=p.kills;s.damage(guard,p,999,'Test');const drops=s.loot.slice(before);assert.equal(drops.filter(i=>i.weapon).length,1);assert.equal(drops.find(i=>i.weapon).rarity,1);assert.ok(drops.every(i=>!i.bossId&&!/keycard|Rig|shadowstep|Winch/i.test(i.id)));assert.equal(p.kills,kills);assert.equal(bossAlertVisual(guard,s.time),null);s.damage(guard,p,999,'Test');assert.equal(s.loot.length,before+drops.length);
});
test('departure roster and feed exclude bots, NPCs, disconnected seats and spectators',()=>{
 const s=match();s.addPlayer('guest',{name:'Second Operator'});const state=s.snapshot();state.players.push({id:'ghost',name:'Disconnected',contestant:true,connected:false},{id:'watcher',name:'Observer',contestant:false,spectating:true});assert.deepEqual(realMatchPlayers(state).map(p=>p.name),['Real Operator','Second Operator']);
 s.leavePlayer('guest');const event=s.events.findLast(e=>e.type==='leave');assert.deepEqual(departureFeed(event),{name:'Second Operator',text:'checked out'});assert.equal(departureFeed({type:'leave',name:'Bot',human:false}),null);
 assert.equal(eliminationNotice({streak:11,targetName:'Opponent'},true),'Eliminated Opponent');assert.equal(eliminationNotice({streak:11,targetName:'Opponent'},false),'11 in a row!');
});
test('active-round bot replacement keeps the departing human name in the feed',()=>{
 const s=match();s.options.fill=true;s.options.bots=1;s.beginBattle();s.leavePlayer('host');const event=s.events.findLast(e=>e.type==='leave');assert.equal(event.name,'Real Operator');assert.equal(event.human,true);assert.equal(event.player,'host');
});
test('status badges distinguish away, lobby and match and escape auxiliary text',()=>{
 for(const state of ['away','lobby','in-match','offline','spectating'])assert.match(presenceMarkup(state),new RegExp('data-presence="'+state+'"'));assert.match(presenceMarkup('lobby','<script>'),/&lt;script&gt;/);
});
test('shared snapshot queue measurements exactly retain JSON sizes and connection deltas',()=>{
 const checkpoint={simulation:{players:[{id:'a',inventory:[null,{id:'sprinter'}]}],loot:[{uid:1,x:2,z:3}]}},players=[{id:'a',name:'Operator “α”',x:1,inventory:[null,{id:'sprinter',ammo:30}]}],work=new RelaySnapshotWork(),decoders=[new SnapshotDecoder(),new SnapshotDecoder()],encoders=[new SnapshotEncoder(),new SnapshotEncoder()];
 for(let frame=0;frame<4;frame++){const nextPlayers=players.map(p=>({...p,x:frame})),network={members:[{id:'a'}],hostId:'host'};for(let recipient=0;recipient<2;recipient++){
  const message={type:'data',channel:String(recipient),data:{type:'state',state:{round:1,time:frame,players:nextPlayers,events:[],network,royale:{loot:[{uid:1,x:2}],worldDamage:{a:0},nullable:null}},...(frame===0?{checkpoint}:{})}};
  assert.equal(work.measure(message),JSON.stringify(message).length);const decoded=decoders[recipient].decode(encoders[recipient].encode(message.data,work.batch).frame);assert.equal(decoded.state.players[0].x,frame);if(frame===0)assert.deepEqual(decoded.checkpoint,checkpoint);
 }}
 const sparse={type:'data',data:{type:'state',state:{players:[null,,undefined],royale:{missing:undefined,value:Infinity},name:'"\\\nα'},checkpoint:{}}};assert.equal(new RelaySnapshotWork().measure(sparse),JSON.stringify(sparse).length);
});
test('cleared feedback stays out of the inbox after restart and can be restored without losing content',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ravelfront-inbox-')),path=join(dir,'social.json');let store=new SocialStore(path);
 try{const identity=store.identify(null,{name:'Ticket Operator'}).identity,request=store.featureRequest(identity.id,'Please improve match connections');assert.equal(store.featureInbox().open,1);const clear=store.featureInbox('clear',request.id);assert.equal(clear.requests.length,0);assert.equal(clear.cleared,1);await store.flush();store=new SocialStore(path);assert.equal(store.featureInbox().requests.length,0);assert.equal(store.featureInbox('list',undefined,true).requests[0].text,'Please improve match connections');const restored=store.featureInbox('restore',request.id);assert.equal(restored.open,1);assert.equal(restored.requests[0].id,request.id);assert.equal(restored.cleared,0);await store.flush();}finally{clearTimeout(store.timer);await rm(dir,{recursive:true,force:true});}
});
