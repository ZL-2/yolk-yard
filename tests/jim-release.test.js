import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWallet,purchase} from '../src/egg-wallet.js';
import {quoteOffer} from '../src/shop-catalog.js';
import {JIM_NORMAL,JIM_GOLF} from '../src/jim-catalog.js';
import {grantJimStyle,jimStyleRecord,acknowledgeJimStyle,sanitizeJimStyle} from '../server/realtime/jim-style.js';
import {ProgressionService} from '../server/realtime/progression.js';
const funded=()=>({...normalizeWallet(null),balance:10000});
test('purchases and normalization never grant Golf; partial bundle credits remain correct',()=>{
 let w=purchase(funded(),JIM_NORMAL);assert.ok(w.owned.includes(JIM_NORMAL));assert.ok(!normalizeWallet(w).owned.includes(JIM_GOLF));assert.throws(()=>purchase(w,JIM_GOLF),/Win an online/);
 assert.equal(quoteOffer(w,'bundle-jim-icon').price,1500);w=purchase(w,'bundle-jim-icon');assert.equal(w.balance,7000);assert.ok(!w.owned.includes(JIM_GOLF));assert.equal(quoteOffer(w,'bundle-jim-icon').owned,true);
 assert.ok(normalizeWallet({...w,owned:[...w.owned,JIM_GOLF]}).owned.includes(JIM_GOLF));
});
function fixture(){let saves=0;const messages=[],identities=new Map([['winner',{}],['loser',{}]]);return {relay:{peers:new Map(),send(){},parties:{store:{identities,save(){saves++;}},users:new Map(),send(u,m){messages.push(m);}}},saves:()=>saves,messages};}
test('only a qualifying win grants Golf; acknowledgement persists without revoking access',()=>{
 const f=fixture(),r=f.relay;
 for(const bad of [{won:false,outfit:JIM_NORMAL},{won:true,outfit:'outfit-scout'},{won:true,outfit:JIM_NORMAL,spectator:true},{won:true,outfit:JIM_NORMAL,afkRemoved:true}])assert.equal(grantJimStyle(r,'winner',bad),false);
 assert.equal(jimStyleRecord(r,'winner').unlocked,false);assert.equal(sanitizeJimStyle(r,{outfit:JIM_GOLF},'winner').outfit,JIM_NORMAL);
 assert.equal(grantJimStyle(r,'winner',{won:true,outfit:JIM_NORMAL}),true);assert.equal(jimStyleRecord(r,'winner').pending,true);assert.equal(f.saves(),1);
 grantJimStyle(r,'winner',{won:true,outfit:JIM_NORMAL});assert.equal(f.saves(),1);acknowledgeJimStyle(r,'winner');assert.equal(jimStyleRecord(r,'winner').pending,false);assert.equal(jimStyleRecord(r,'winner').unlocked,true);assert.equal(sanitizeJimStyle(r,{outfit:JIM_GOLF},'winner').outfit,JIM_GOLF);
 grantJimStyle(r,'winner',{won:true,outfit:JIM_NORMAL});assert.equal(jimStyleRecord(r,'winner').pending,false);
});
for(const styleOnly of [false,true])test(`${styleOnly?'private host':'public authority'} result grants winner only and settles once`,async()=>{
 const f=fixture(),r=f.relay;let now=0;const service=new ProgressionService(r,{path:null,clock:()=>now});await service.ready;
 const host={id:'room',progressId:'host-progress',listing:{},ws:{},links:new Map(),rewardPublic:!styleOnly},guest={id:'guest',progressId:'guest-progress',ws:{},links:new Map([['host',host]])};host.links.set('guest',guest);r.peers.set(host.id,host);r.peers.set(guest.id,guest);service.account(host.progressId).socialId='winner';service.account(guest.progressId).socialId='loser';
 const state={round:1,matchId:'jim-test',mode:'royale',phase:'playing',stage:'active',hostId:'host',teamSize:1,winnerId:'host',players:[{id:'host',outfit:JIM_NORMAL,health:100,x:0,y:0,z:0,place:1},{id:'guest',outfit:JIM_NORMAL,health:100,x:10,y:0,z:0,place:2}],events:[]};
 service.frame(host,state,{styleOnly});now=2;service.frame(host,{...state,phase:'results'},{styleOnly});assert.equal(jimStyleRecord(r,'winner').unlocked,true);assert.equal(jimStyleRecord(r,'loser').unlocked,false);const count=f.saves();service.frame(host,{...state,phase:'results'},{styleOnly});assert.equal(f.saves(),count);if(styleOnly)assert.equal(service.account(host.progressId).receipts.length,0);await service.close();
});

test('Golf ownership and seen state survive social-store restart',async()=>{
 const {SocialStore}=await import('../server/realtime/social-store.js');const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const dir=await mkdtemp(tmpdir()+'/jim-persistence-');
 try{let store=new SocialStore(dir+'/social.json');const {identity}=store.identify(null,{name:'Jim Persistence'}),relay={parties:{store,users:new Map(),send(){}}};grantJimStyle(relay,identity.id,{won:true,outfit:JIM_NORMAL});await store.flush();store=new SocialStore(dir+'/social.json');relay.parties.store=store;assert.equal(jimStyleRecord(relay,identity.id).pending,true);acknowledgeJimStyle(relay,identity.id);await store.flush();relay.parties.store=new SocialStore(dir+'/social.json');assert.equal(jimStyleRecord(relay,identity.id).unlocked,true);assert.equal(jimStyleRecord(relay,identity.id).pending,false);}finally{await rm(dir,{recursive:true,force:true});}
});
