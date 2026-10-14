import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoyaleSimulation} from '../src/royale.js';
import {ChatRoom,ChatInbox} from '../src/chat.js';
import {FILTER_VERSION} from '../src/moderation.js';
import {throwPath,thrownProjectile,stepThrowable,SMOKE_RULES} from '../src/throwables.js';
import {UTILITY_WEAPONS} from '../src/weapon-balance.js';
import {damageVehicle} from '../src/vehicles.js';
import {confirmationKind} from '../src/combat-feedback.js';
import {SocialStore} from '../server/realtime/social-store.js';
import {creditReferral,referralSummary} from '../server/realtime/referrals.js';
import {PartyService} from '../server/realtime/parties.js';
import {EggWallet} from '../src/egg-wallet.js';
import {MatchEndUI} from '../src/match-end-ui.js';
const flat={size:100,boxes:[]};
function match(){const s=new RoyaleSimulation({seed:156,capacity:4,bots:0,fill:false});s.addPlayer('host',{name:'Crew Leader'});s.addPlayer('guest',{name:'Crew Guest'});s.startRound();return s;}
test('spectator room messages reach living players and spectators through recipient validation',()=>{
 const state={phase:'playing',options:{mode:'royale',teamSize:1},players:[{id:'a',name:'Active'},{id:'s',name:'Watcher',spectating:true}]};
 const result=new ChatRoom().submit('s',{version:FILTER_VERSION,channel:'room',text:'Nice round'},state,1000);
 assert.equal(result.ok,true);assert.equal(result.message.channel,'room');assert.deepEqual(result.recipients,['a','s']);assert.equal(new ChatInbox().accept(result.message,state,'a').text,'Nice round');
});
test('warmup planning survives manual departure and guards occupy separate posts',()=>{
 const s=match(),route={...s.route},hot={...s.operations.hotspot};assert.equal(s.beginBattle('host-start'),true);assert.deepEqual(s.route,route);assert.deepEqual(s.operations.hotspot,hot);assert.equal(s.startReason,'host-start');
 for(const id of new Set([...s.players.values()].filter(p=>p.henchman).map(p=>p.bossId))){const guards=[...s.players.values()].filter(p=>p.henchman&&p.bossId===id);assert.equal(guards.length,4);for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(Math.hypot(guards[i].x-guards[j].x,guards[i].z-guards[j].z)>12,id);assert.equal(new Set(guards.map(p=>JSON.stringify(p.patrol))).size,4);}
});
test('bots dive promptly when the destination is close and glide for long crossings',()=>{
 const s=match();s.beginBattle();const p=s.players.get('guest');Object.assign(p,{bot:true,flight:'dive',x:0,z:0,y:100,botLand:{x:20,z:0},flightLatch:false});assert.equal(s.thinkBot(p).jump,false);p.botLand={x:400,z:0};assert.equal(s.thinkBot(p).jump,true);p.flight='glide';p.botLand={x:20,z:0};assert.equal(s.thinkBot(p).jump,true);
});
test('throw preview and simulation agree through bounce, rest, and fuse',()=>{
 const p={id:'a',x:0,y:0,z:0,yaw:0,pitch:.1},path=throwPath(p,flat),b=thrownProjectile(p);for(let i=0;i<180;i++)stepThrowable(b,flat,1/60);const end=path.at(-1);assert.ok(Math.hypot(b.x-end.x,b.y-end.y,b.z-end.z)<1e-8);assert.ok(b.bounces>0);assert.equal(b.fuse,3);assert.equal(b.damage,100);assert.equal(b.buildDamage,375);assert.ok(b.y>=0);
 const wall={size:100,boxes:[{x:0,y:0,z:-3,w:20,h:10,d:.4}]},bounce=thrownProjectile(p);for(let i=0;i<30;i++)stepThrowable(bounce,wall,1/60);assert.ok(bounce.vz>0);assert.ok(bounce.z>-3);
});
test('smoke is thrown before deployment and never deals blast damage',()=>{
 const s=match();s.beginBattle();s.map=flat;const p=s.players.get('host');Object.assign(p,{x:0,y:0,z:0,yaw:0,pitch:0,flight:'ground'});s.launch(p,true,0,{throwable:'smoke'});assert.equal(s.smokes.length,0);const health=p.health;
 for(let i=0;i<92;i++){s.time+=1/60;s.updateProjectiles(1/60);}assert.equal(s.projectiles.length,0);assert.equal(s.smokes.length,1);assert.equal(s.smokes[0].until-s.smokes[0].born,SMOKE_RULES.duration);assert.ok(Math.abs(s.smokes[0].z)>5);assert.equal(p.health,health);
});
test('vehicle feedback reports actual applied damage and drives hit confirmation',()=>{
 const events=[],v={id:'atv',health:50,revision:0,seats:[]},sim={options:{mode:'royale'},players:new Map(),emit:(type,e)=>events.push({type,...e})};damageVehicle(sim,v,100,{id:'a'});const hit=events.find(e=>e.type==='vehicle-hit');assert.equal(hit.amount,50);assert.equal(confirmationKind(hit,'a'),'body');assert.equal(damageVehicle(sim,v,10,{id:'a'}),false);
});
test('new referrals persist, self and repeat visits never credit, and wallet totals cannot replay',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crew-referral-'));let store=new SocialStore(join(dir,'social.json'));
 try{const owner=store.identify(null,{name:'Owner'}).identity,newcomer=store.identify(null,{name:'Recruit'}).identity;assert.equal(creditReferral(store,owner,owner.code,true),null);assert.equal(creditReferral(store,newcomer,owner.code,false),null);assert.equal(creditReferral(store,newcomer,owner.code,true),owner);assert.equal(creditReferral(store,newcomer,owner.code,true),null);await store.flush();store=new SocialStore(join(dir,'social.json'));const record=referralSummary(store.identities.get(owner.id));assert.equal(record.marks,1000);const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},wallet=new EggWallet(storage),before=wallet.value.balance;await wallet.syncReferrals(record);await wallet.syncReferrals(record);assert.equal(wallet.value.balance,before+1000);await wallet.syncReferrals({...record,marks:3000});assert.equal(wallet.value.balance,before+3000);await wallet.syncReferrals(record);assert.equal(wallet.value.balance,before+3000);}finally{clearTimeout(store.timer);await rm(dir,{recursive:true,force:true});}
});
test('active social tab receives launches, spectators are labeled, and All Online includes friends',async()=>{
 const store=new SocialStore(null),service=new PartyService({peers:new Map()},{store}),first={readyState:1,send(){},close(){}},second={readyState:1,send(){},close(){}},a=store.identify(null,{name:'Active User'}).identity,b=store.identify(null,{name:'Friend User'}).identity;
 try{for(const identity of [a,b]){const u={id:identity.id,profile:identity.profile,sessions:new Map([[first,{visible:true,seen:Date.now()}]]),ws:first};service.users.set(u.id,u);service.create(u);}const u=service.users.get(a.id);u.sessions.set(second,{visible:false});service.command(u,{type:'presence',visible:false},second);assert.equal(u.ws,first);service.command(u,{type:'presence',visible:true,activity:'spectating'},second);assert.equal(u.ws,second);assert.equal(service.presence(u.id),'spectating');store.friendAction(a.id,'friend-send',b.id);store.friendAction(b.id,'friend-accept',a.id);assert.equal(service.social(u).online[0].id,b.id);}finally{await service.close();}
});
test('victory holds the first-person scene for two seconds before showing the banner',()=>{
 const previous=globalThis.document,root={hidden:true,setAttribute(){},contains(){return false;},querySelector(){return null;}};globalThis.document={createElement:()=>root,body:{append(){}},activeElement:null};
 try{const ui=new MatchEndUI(),state={round:1,phase:'results',options:{mode:'royale',teamSize:1},royale:{matchId:'win',winnerId:'me'},winnerId:'me',players:[{id:'me',health:100,kills:1,place:1}]};const early=ui.update(state,'me',true,1000);assert.equal(early.slowMotion,true);assert.equal(early.victory,false);assert.equal(root.hidden,true);ui.update(state,'me',true,2999);assert.equal(root.hidden,true);const shown=ui.update(state,'me',true,3000);assert.equal(shown.phase,'victory');assert.equal(root.hidden,false);}finally{globalThis.document=previous;}
});
