import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Group} from 'three';
import {needsPlayerName} from '../src/player-name.js';
import {PartyService} from '../server/realtime/parties.js';
import {SocialStore} from '../server/realtime/social-store.js';
import {VERSION} from '../src/data.js';
import {leaderboardMarkup} from '../src/leaderboard-ui.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {validLootPoint,LOOT_TABLE} from '../src/royale-loot.js';
import {VAULT_AMMO_STOCK} from '../src/vaults.js';
import {AMMO_RULES} from '../src/weapon-balance.js';
import {RoyaleSimulation} from '../src/royale.js';
import {movePlayer,canStand} from '../src/physics.js';
import {SEASON} from '../src/season-one.js';
import {SHADOWSTEP} from '../src/shadowstep.js';
import {useSeasonItem} from '../src/season-world.js';
import {preferredSpectator,matchOutcome} from '../src/match-presentation.js';
import {MatchEndUI} from '../src/match-end-ui.js';
import {EliminationEffects,ELIMINATION_EFFECT_LIMIT} from '../src/elimination-effects.js';
import {makeHumanoid} from '../src/humanoid.js';
import {FieldSamples,FIELD_SAMPLES,birdLocation} from '../src/field-samples.js';

test('new and saved placeholder names are rejected without matching ordinary nicknames',()=>{
 for(const name of ['Player',' player ','PLAYER','Ｐｌａｙｅｒ','',null])assert.equal(needsPlayerName(name),true);
 for(const name of ['Player One','Zach','Scout','Player123'])assert.equal(needsPlayerName(name),false);
});
test('party admission rejects Player before creating an identity and restores a renamed saved identity',async()=>{
 class Socket extends EventEmitter{readyState=1;bufferedAmount=0;sent=[];send(m){this.sent.push(JSON.parse(m));}close(code,reason){this.closed={code,reason};this.readyState=3;this.emit('close');}}
 const store=new SocialStore(null),relay={peers:new Map(),progression:{leaderboardCache:null}},parties=new PartyService(relay,{store});
 const tick=()=>new Promise(r=>setImmediate(r));
 try{
  const rejected=new Socket();parties.attach(rejected);rejected.emit('message',Buffer.from(JSON.stringify({type:'hello',version:VERSION,profile:{name:'Player'}})));await tick();assert.equal(rejected.closed.code,1008);assert.match(rejected.closed.reason,/Choose a player name/);assert.equal(store.identities.size,0);
  const saved=store.identify(null,{name:'Player'}),ws=new Socket();parties.attach(ws);ws.emit('message',Buffer.from(JSON.stringify({type:'hello',version:VERSION,token:saved.token,profile:{name:'New Scout'}})));await tick();
  const hello=ws.sent.find(m=>m.type==='hello');assert.equal(hello.id,saved.identity.id);assert.equal(hello.token,saved.token);assert.equal(store.identities.size,1);assert.equal(parties.users.get(hello.id).profile.name,'New Scout');
  const u=parties.users.get(hello.id);assert.throws(()=>parties.command(u,{type:'profile',profile:{name:'Player'}}),/Choose a player name/);assert.equal(u.profile.name,'New Scout');
 }finally{await parties.close();}
});
test('top rankings show each operator once; an off-page personal rank stays pinned',()=>{
 const rows=Array.from({length:25},(_,i)=>({rank:i+1,name:'Scout '+i,kills:50-i,wins:0,you:i===0})),board={rows,total:40,self:rows[0]};
 let markup=leaderboardMarkup({profile:{name:'Scout 0'},leaderboards:{kills:board}});assert.equal((markup.match(/class="frontier-rank /g)||[]).length,25);assert.equal(markup.includes('aria-label="Your rank"'),false);
 board.self={rank:35,name:'Outside',kills:1,wins:0,you:true};markup=leaderboardMarkup({profile:{name:'Outside'},leaderboards:{kills:board}});assert.equal((markup.match(/class="frontier-rank /g)||[]).length,26);assert.ok(markup.includes('aria-label="Your rank"'));
});
test('every vault guarantees two substantial stacks of every ammo type behind its own lock',()=>{
 const s=new RoyaleSimulation({bots:2,capacity:3,seed:94});s.addPlayer('host',{name:'Stock Check'});s.startRound();s.beginBattle();
 for(const v of ROYALE_MAP.vaults){
  const points=ROYALE_MAP.floorLoot.filter(p=>p.vaultId===v.id);assert.equal(points.length,10);
  for(const [type,count]of Object.entries(VAULT_AMMO_STOCK)){const stocks=points.filter(p=>p.ammoType===type);assert.equal(stocks.length,2);for(const p of stocks){assert.equal(p.chance,1);assert.equal(p.ammoCount,count);assert.ok(validLootPoint(ROYALE_MAP,p));}}
  const actual=s.loot.filter(p=>p.vaultId===v.id&&p.ammoType);for(const [type,count]of Object.entries(VAULT_AMMO_STOCK))assert.equal(actual.filter(p=>p.ammoType===type).reduce((n,p)=>n+p.count,0),count*2);
 }
 assert.equal(AMMO_RULES.rockets.cap,8);assert.equal(AMMO_RULES.rockets.min,2);assert.ok(LOOT_TABLE.find(p=>p.id==='thumper').weight>2);
});
test('distinct Rook and Nyx approaches are reachable without jumps, including the bunker stairs in both directions',()=>{
 const map={...ROYALE_MAP,boxes:ROYALE_MAP.boxes.filter(b=>!b.doorId)};
 for(const v of ROYALE_MAP.vaults.filter(v=>v.id!=='aster-vault')){
  assert.ok(canStand(map,v.entrance));assert.ok(canStand(map,v.reader));
  const p={...v.entrance,health:100,flight:'ground',grounded:true,vy:0,yaw:0,pitch:0};
  for(let i=0;i<145;i++){movePlayer(p,{yaw:0,forward:1},map,1/60);assert.ok(canStand(map,p));}
  assert.ok(p.z<v.z+4,'walk inside');assert.ok(Math.abs(p.y-v.y)<.02);
  for(let i=0;i<145;i++){movePlayer(p,{yaw:Math.PI,forward:1},map,1/60);assert.ok(canStand(map,p));}
  assert.ok(p.z>=v.entrance.z-.2,'walk outside');assert.ok(Math.abs(p.y-v.entrance.y)<.36,'ascend to surface');
 }
 assert.equal(ROYALE_MAP.vaults[1].theme,'armored-cargo');assert.equal(ROYALE_MAP.vaults[2].theme,'recessed-forest');
 const rook=ROYALE_MAP.vaults[1],p={x:196,y:rook.y,z:199,health:100,flight:'ground',grounded:true,vy:0,yaw:Math.PI,pitch:0};
 for(let i=0;i<37;i++)movePlayer(p,{forward:1,yaw:Math.PI},map,1/60);assert.ok(p.z>202.5,'walk through the deck railing opening');
 for(let i=0;i<140;i++)movePlayer(p,{forward:1,yaw:-Math.PI/2},map,1/60);assert.ok(p.x>210,'walk the service catwalk to the hold');assert.ok(Math.abs(p.y-rook.y)<.02);assert.ok(canStand(map,p));
});
test('mobility buffs preserve protected directional motion without reducing Grappler utility',()=>{
 assert.equal(SEASON.rig.charges,4);assert.equal(SEASON.rig.recharge,8);assert.equal(SHADOWSTEP.charges,6);assert.equal(SHADOWSTEP.recharge,7);assert.ok(Math.abs(SHADOWSTEP.duration*SHADOWSTEP.speed-13.2)<1e-8);
 const p={x:0,y:0,z:0,health:100,flight:'ground',grounded:true,yaw:0,shadowDirection:{x:1,z:0}},sim={time:10,emit(){}};
 assert.equal(useSeasonItem(sim,p,{id:'jumpRig'}),true);assert.equal(p.launchVelocity.x,30);assert.equal(p.launchVelocity.z,0);assert.equal(p.vy,26);assert.equal(p.fall.immune,true);
});
test('elimination selects the nearest living teammate before the killer and reports shared team victory',()=>{
 const players=[{id:'me',team:0,contestant:true,health:0,spectating:true,eliminatedAt:10,killerId:'killer',x:0,z:0,kills:2,place:0},{id:'far',team:0,health:100,x:25,z:0},{id:'near',team:0,health:100,x:3,z:0},{id:'killer',team:1,health:100,x:1,z:0}];
 const state={phase:'playing',options:{mode:'royale',teamSize:4},royale:{},players};assert.equal(preferredSpectator(state,'me'),'near');assert.equal(matchOutcome(state,'me').dead,true);assert.equal(matchOutcome(state,'me').place,0);
 state.phase='results';state.royale.winnerId='near';state.royale.winnerTeam=0;assert.equal(matchOutcome(state,'me').win,true);assert.equal(matchOutcome(state,'me').place,1);
 assert.equal(matchOutcome(state,'me').canCelebrate,false);assert.equal(matchOutcome(state,'near').canCelebrate,true);
 state.options.teamSize=1;assert.equal(matchOutcome(state,'me').win,false);
});
test('a shared victory never repeats a dead teammate camera hold or offers an impossible celebration',()=>{
 const previous=globalThis.document,root={hidden:true,setAttribute(){},contains(){return false;}};globalThis.document={createElement:()=>root,body:{append(){}},activeElement:null};
 try{
  const ui=new MatchEndUI(),state={round:1,phase:'results',options:{mode:'royale',teamSize:2},royale:{matchId:'team-end',winnerTeam:0,winnerId:'ally'},players:[{id:'me',team:0,contestant:true,health:0,spectating:true,eliminatedAt:10,place:1},{id:'ally',team:0,contestant:true,health:100}]};
  const frame=ui.update(state,'me',true,1000);assert.equal(frame.hold,false);assert.equal(frame.phase,'victory');assert.equal(root.innerHTML.includes('data-action="emotes"'),false);
 }finally{globalThis.document=previous;}
});
test('elimination visuals cap at four merged ghosts, expire and release owned resources',()=>{
 const parent=new Group(),effects=new EliminationEffects(parent),model=makeHumanoid(),listener={x:0,z:0};model.updateMatrixWorld(true);
 for(let i=0;i<20;i++)effects.spawn({x:i,y:0,z:0},model,listener);
 assert.equal(effects.active.length,ELIMINATION_EFFECT_LIMIT);assert.equal(parent.children.length,4);assert.equal(effects.active[0].ghost.isSkinnedMesh,undefined);assert.equal(effects.active[0].group.children.length,5);
 assert.equal(effects.spawn({x:1000,y:0,z:0},model,listener),false);for(let i=0;i<120;i++)effects.update(1/60);assert.equal(parent.children.length,0);assert.equal(effects.active.length,0);
 effects.spawn({x:0,y:0,z:0},model,listener,true);effects.clear();assert.equal(parent.children.length,0);model.userData.human.mesh.skeleton.dispose();
});
test('birds are localized outdoors and not inside roofs, vaults or flights',()=>{
 const map={districts:[{id:'woods',x:0,z:0},{id:'docks',x:100,z:0}],buildings:[],vaults:[]},p={x:5,y:0,z:0,health:100,flight:'ground'};
 assert.ok(birdLocation(map,p));assert.equal(birdLocation(map,{...p,x:100}),null);assert.equal(birdLocation(map,{...p,flight:'glide'}),null);
 map.buildings=[{x:5,z:0,w:10,d:10,h:4,baseY:0}];assert.equal(birdLocation(map,p),null);assert.ok(birdLocation(map,{...p,y:4}));map.buildings=[];map.vaults=[{x:5,z:0,y:-2,width:18,depth:14}];assert.equal(birdLocation(map,p),null);
});
test('field samples decode once, obey categories and distance, bound overlap and clean up',async()=>{
 const beforeFetch=globalThis.fetch,beforeDocument=globalThis.document;
 const node=()=>({gain:{value:0},pan:{value:0},playbackRate:{value:1},connect(n){return n;},disconnect(){},start(){},stop(){this.onended?.();}}),sound={ctx:{createBufferSource:node,createGain:node,createStereoPanner:node,decodeAudioData:async()=>({duration:1})},enabled:true,volume:.5,effectsVolume:.8,ambienceVolume:.4,voices:new Set(),spatial:p=>({gain:p?.x>100?0:1,pan:0}),master:node()};
 let loads=0;globalThis.document={baseURI:'https://example.invalid/yolk-yard/'};globalThis.fetch=async()=>{loads++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};};
 try{
  const samples=new FieldSamples(sound);await Promise.all([samples.load(),samples.load()]);await samples.load();assert.equal(loads,3);
  for(let i=0;i<100;i++)samples.play('step');assert.equal(sound.voices.size,FIELD_SAMPLES.step.cap);for(const v of [...sound.voices])v.onended();assert.equal(sound.voices.size,0);
  samples.play('birds');samples.play('birds');assert.equal(sound.voices.size,1);samples.stop();assert.equal(sound.voices.size,0);
  sound.effectsVolume=0;samples.play('step');assert.equal(sound.voices.size,0);sound.effectsVolume=.8;samples.play('step',{x:1000});assert.equal(sound.voices.size,0);
 }finally{globalThis.fetch=beforeFetch;globalThis.document=beforeDocument;}
});
