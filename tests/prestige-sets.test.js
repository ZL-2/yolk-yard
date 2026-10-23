import test from 'node:test';
import assert from 'node:assert/strict';
import {ROYALE_REWARDS,ROYALE_SETS,PRESTIGE_SLOTS,eligibleRankItems,rankLoadout} from '../src/royale-ranking.js';
import {ProgressionService} from '../server/realtime/progression.js';
import {makeShopBack,makeShopGlider,makeShopTrail} from '../src/shop-models.js';
import {safeProfile} from '../src/data.js';
import {Simulation} from '../src/simulation.js';
const setLoadout=set=>Object.fromEntries(set.items.map(i=>[i.slot,i.id]));
test('full sets stack at every cutoff; entitlement sanitizing preserves unrelated gear',()=>{
 for(const [rank,n]of [[1,24],[2,18],[5,18],[6,12],[10,12],[11,6],[25,6],[26,0]])assert.equal(eligibleRankItems(rank,1).length,n);
 assert.equal(new Set(ROYALE_REWARDS.map(i=>i.id)).size,24);for(const set of ROYALE_SETS)assert.deepEqual(set.items.map(i=>i.slot),PRESTIGE_SLOTS);
 const profile={...setLoadout(ROYALE_SETS[3]),wrap:'wrap-voss'};assert.deepEqual(rankLoadout(profile,eligibleRankItems(2,1)),{outfit:'',wrap:'wrap-voss',backbling:'',glider:'',trail:'',pickaxe:''});
});
test('atomic set claims, upgrade migration, downgrade revocation and reclaim persist on all slots',async()=>{
 const identity={profile:safeProfile({name:'Champion',pickaxe:'pickaxe-rank-1'}),royaleRankRewards:{eligible:ROYALE_SETS.map(s=>s.items.at(-1).id),claimed:['pickaxe-rank-1'],epoch:1,revision:1}},store={identities:new Map([['champ',identity]]),save(){}},updates=[];
 const relay={parties:{store,users:new Map(),send(){}},peers:new Map(),send:(p,m)=>updates.push(m)},service=new ProgressionService(relay,{path:null});relay.progression=service;await service.ready;
 service.accounts.set('champ',{socialId:'champ',publicParticipant:true,publicName:'Champion',publicTotals:{version:1,wins:3,kills:20}});const r=service.rankRewards;r.invalidate();
 try{
  let status=r.status('champ');assert.equal(status.pending.length,23);assert.equal(status.epoch,2);assert.deepEqual(status.claimed,['pickaxe-rank-1']);
  const apex=setLoadout(ROYALE_SETS[3]);r.claim('champ',ROYALE_REWARDS.map(i=>i.id),apex);assert.equal(r.status('champ').pending.length,0);assert.equal(identity.profile.royaleRank,1);
  const actor={...identity.profile,health:78,inventory:[{id:'sprinter',ammo:9}],nextProfile:{...identity.profile}},peer={id:'champ-peer',progressId:'champ',links:new Map()};relay.peers.set(peer.id,peer);relay.authority={roomFor:()=>({sim:{players:new Map([[peer.id,actor]])}})};
  const revision=r.status('champ').revision;assert.throws(()=>r.claim('champ',[ROYALE_REWARDS[0].id],{outfit:ROYALE_REWARDS[1].id}),/Choose one/);assert.equal(r.status('champ').revision,revision);
  store.identities.set('rival',{profile:{name:'Rival'}});service.accounts.set('rival',{socialId:'rival',publicParticipant:true,publicName:'Rival',publicTotals:{version:1,wins:10,kills:0}});r.invalidate();r.refresh();
  status=r.status('champ');assert.equal(status.rank,2);assert.equal(status.claimed.length,18);for(const slot of PRESTIGE_SLOTS){assert.equal(identity.profile[slot],'');assert.equal(actor[slot],'');assert.equal(actor.nextProfile[slot],'');}assert.equal(actor.royaleRank,2);assert.equal(actor.health,78);assert.equal(actor.inventory[0].ammo,9);assert.ok(updates.some(m=>m.cosmetics?.outfit===''));
  assert.throws(()=>r.claim('champ',Object.values(apex),apex),/rank changed/);service.accounts.get('champ').publicTotals.wins=20;r.invalidate();r.refresh();assert.equal(r.status('champ').pending.length,6);r.claim('champ',Object.values(apex),apex);assert.deepEqual(r.status('champ').loadout,apex);
 }finally{await service.close();}
});
test('all cape, glider and trail meshes remain finite, shared and bounded; live rank survives snapshots',()=>{
 for(const set of ROYALE_SETS)for(const [slot,make,max]of [['backbling',makeShopBack,2],['glider',makeShopGlider,2],['trail',makeShopTrail,1]]){const id=set.items.find(i=>i.slot===slot).id,g=make(id,2),other=make(id,2);assert.ok(g.children.length<=max);assert.equal(g.children[0].geometry,other.children[0].geometry);g.traverse(m=>{if(m.isMesh)assert.ok(Array.from(m.geometry.attributes.position.array).every(Number.isFinite));});if(slot==='backbling')assert.equal(g.userData.displayRank,2);}
 const s=new Simulation({bots:0});s.addPlayer('p',safeProfile({...setLoadout(ROYALE_SETS[0]),royaleRank:17}));assert.equal(s.snapshot().players[0].royaleRank,17);
});
