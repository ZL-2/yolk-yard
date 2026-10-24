import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {ROYALE_PICKAXES,ROYALE_REWARDS,ROYALE_SETS,eligibleRankItems,royaleRating,eligibleRankPickaxes,rankLoadout} from '../src/royale-ranking.js';
import {rankPublicPlayers,publicLeaderboardView} from '../server/realtime/leaderboards.js';
import {ProgressionService} from '../server/realtime/progression.js';
import {normalizeWallet,purchase,ownedLoadout} from '../src/egg-wallet.js';
import {makeShopPickaxe} from '../src/shop-models.js';
import {leaderboardMarkup} from '../src/leaderboard-ui.js';
import {SocialStore} from '../server/realtime/social-store.js';
import {mkdtemp,rm} from 'node:fs/promises';

const ids=ROYALE_PICKAXES.map(i=>i.id),all=ROYALE_REWARDS.map(i=>i.id),extras=all.filter(id=>!ids.includes(id));
const account=(socialId,wins,kills)=>({socialId,publicName:socialId,publicParticipant:true,publicTotals:{version:1,wins,kills}});
function fixture(){const identities=new Map(),sent=[],updates=[],users=new Map(),parties={store:{identities,save(){}},users,send:(u,m)=>{if(u)sent.push([u.id,m]);},sync(){}};const relay={parties,peers:new Map(),send:(p,m)=>updates.push([p.id,m])},service=new ProgressionService(relay,{path:null});relay.progression=service;
 const add=(id,wins=0,kills=0)=>{identities.set(id,{profile:{name:id,pickaxe:''}});users.set(id,{id,profile:identities.get(id).profile});service.accounts.set(id,account(id,wins,kills));service.rankRewards.invalidate();};return {service,relay,identities,sent,updates,add};}

test('Victory Score preserves wins and gives every kill ten points without diminishing returns',()=>{
 assert.equal(royaleRating({wins:1,kills:25}),1250);assert.equal(royaleRating({wins:0,kills:100}),1000);assert.equal(royaleRating({wins:5,kills:100}),6000);
 assert.equal(royaleRating({wins:30,kills:500})-royaleRating({wins:30,kills:400}),1000);
 assert.equal(royaleRating({wins:NaN,kills:-10}),0);assert.equal(royaleRating({wins:Infinity,kills:Infinity}),0);
 for(const [rank,count]of [[1,4],[2,3],[5,3],[6,2],[10,2],[11,1],[25,1],[26,0],[0,0]])assert.equal(eligibleRankPickaxes(rank,100).length,count);
 assert.deepEqual(eligibleRankPickaxes(1,0),[]);
});
test('Royale score has unique stable places, rewards wins in a score tie and leaves other modes alone',()=>{
 const accounts=new Map([['a',account('a',1,0)],['b',account('b',0,100)],['c',account('c',1,0)]]),identities=new Map([['a',{profile:{name:'Zulu'}}],['c',{profile:{name:'Alpha'}}]]);
 let ranks=rankPublicPlayers(accounts,identities,'royale');assert.deepEqual(ranks.rating.map(p=>p.socialId),['a','c','b']);identities.get('c').profile.name='AAAA';assert.deepEqual(rankPublicPlayers(accounts,identities,'royale').rating.map(p=>p.socialId),['a','c','b']);
 const board=publicLeaderboardView(ranks,'a');assert.equal(board.rating.self.rating,1000);assert.equal(board.rating.rows[0].you,true);assert.equal(JSON.stringify(board).includes('socialId'),false);assert.equal(rankPublicPlayers(accounts,identities,'ffa').rating,undefined);
 const html=leaderboardMarkup({leaderboards:board,leaderboardTab:'rating',profile:{name:'A'}});assert.match(html,/data-leaderboard-tab="rating"/);assert.match(html,/HOW SCORE WORKS/);assert.match(html,/>SCORE<\/span><span>WINS<\/span><span>KILLS/);assert.equal(leaderboardMarkup({leaderboardMode:'ffa',profile:{name:'A'}}).includes('royale-rank-info'),false);
});
test('claims are cumulative; dropping and regaining thresholds revoke and re-offer only affected rewards',async()=>{
 const f=fixture(),r=f.service.rankRewards;f.add('champion',2,20);f.add('rival',1,0);
 assert.deepEqual(r.status('champion').pending,all);r.claim('champion',ids,ids[3]);assert.equal(f.identities.get('champion').profile.pickaxe,ids[3]);assert.deepEqual(r.status('champion').pending,extras);
 f.service.recordPublicStat({identity:'rival'},'wins');f.service.recordPublicStat({identity:'rival'},'wins');r.refresh();let status=r.status('champion');assert.equal(status.rank,2);assert.deepEqual(status.claimed,ids.slice(0,3));assert.equal(f.identities.get('champion').profile.pickaxe,'');assert.throws(()=>r.claim('champion',[ids[3]],ids[3]),/rank changed/);
 for(let i=0;i<25;i++)f.add('ahead-'+i,10,10);r.refresh();status=r.status('champion');assert.deepEqual(status.eligible,[]);assert.deepEqual(status.claimed,[]);
 f.service.accounts.get('champion').publicTotals.wins=50;r.invalidate();r.refresh();assert.deepEqual(r.status('champion').pending,all);assert.equal(r.status('champion').claimed.length,0);assert.throws(()=>r.claim('champion',[ids[0]],ids[3]),/Choose one/);await f.service.close();
});
test('revocation reaches an active authoritative actor and a browser-hosted guest connection',async()=>{
 const f=fixture(),r=f.service.rankRewards;f.add('champion',1,1);r.claim('champion',ids,ids[3]);
 const host={id:'host-peer',listing:{}},guest={id:'guest-peer',progressId:'champion',authorityId:'actor',links:new Map([['host',host]])},actor={pickaxe:ids[3],nextProfile:{pickaxe:ids[3]}};f.relay.peers.set(guest.id,guest);f.relay.authority={roomFor:()=>({sim:{players:new Map([['actor',actor]])}})};
 f.add('rival',10,0);r.refresh();assert.equal(actor.pickaxe,'');assert.equal(actor.nextProfile.pickaxe,'');assert.ok(f.updates.some(([id,m])=>id==='guest-peer'&&m.type==='rank-cosmetic'&&m.pickaxe===''));assert.ok(f.updates.some(([id,m])=>id==='host-peer'&&m.player==='guest-peer'));await f.service.close();
});
test('local wallet, preset and unclaimed profile edits cannot grant rank equipment',async()=>{
 const wallet=normalizeWallet({balance:99999,owned:ids});assert.equal(wallet.owned.some(id=>ids.includes(id)),false);assert.throws(()=>purchase(wallet,ids[0]),/live Royale rankings/);assert.equal(ownedLoadout(wallet,{pickaxe:ids[0]}).pickaxe,'');assert.equal(ownedLoadout(wallet,{pickaxe:ids[0]},[ids[0]]).pickaxe,ids[0]);assert.equal(rankLoadout({pickaxe:ids[3]},ids.slice(0,3)).pickaxe,'');
 const f=fixture(),r=f.service.rankRewards;f.add('winner',1,1);assert.equal(r.sanitize({pickaxe:ids[3]},'winner').pickaxe,'');r.claim('winner',ids);assert.equal(r.sanitize({pickaxe:ids[3]},'winner').pickaxe,ids[3]);assert.equal(r.sanitize({pickaxe:ids[3]},'unknown').pickaxe,'');await f.service.close();
});
test('all four trophy tools have distinct detailed geometry and a bounded shared render cost',()=>{
 const signatures=[];for(const item of ROYALE_PICKAXES){const g=makeShopPickaxe(item.id),copy=makeShopPickaxe(item.id),size=new Box3().setFromObject(g).getSize(new Vector3());assert.equal(g.children.length,2);assert.equal(g.children[0].geometry,copy.children[0].geometry);assert.ok(size.y>1.6&&size.y<2.3&&size.x>.65&&size.x<1.6);let vertices=0;g.traverse(m=>{if(m.isMesh){vertices+=m.geometry.attributes.position.count;assert.ok(Array.from(m.geometry.attributes.position.array).every(Number.isFinite));}});assert.ok(vertices<25000,`${item.name}: ${vertices} vertices`);signatures.push(vertices+':'+size.x.toFixed(3));}assert.equal(new Set(signatures).size,4);
});
test('claims survive a complete store reload and are still revoked against restored rankings',async()=>{
 const directory=await mkdtemp('/tmp/ravel-prestige-');let store=new SocialStore(directory+'/social.json'),service;
 try{const {identity,token}=store.identify(null,{name:'Persisted Champion',pickaxe:''}),relay={parties:{store},peers:new Map()};service=new ProgressionService(relay,{path:directory+'/progress.json'});await service.ready;service.accounts.set('champion',account(identity.id,2,25));service.dirty=true;service.rankRewards.invalidate();service.rankRewards.claim(identity.id,ids,ids[3]);await store.flush();await service.close();
  store=new SocialStore(directory+'/social.json');relay.parties.store=store;service=new ProgressionService(relay,{path:directory+'/progress.json'});await service.ready;const restored=store.identify(token,identity.profile);assert.equal(restored.identity.id,identity.id);assert.deepEqual(service.rankRewards.status(identity.id).claimed,ids);assert.deepEqual(service.rankRewards.status(identity.id).pending,extras);assert.equal(restored.identity.profile.pickaxe,ids[3]);service.accounts.set('rival',account('rival',10,0));service.rankRewards.invalidate();service.rankRewards.refresh();assert.equal(restored.identity.profile.pickaxe,'');assert.deepEqual(service.rankRewards.status(identity.id).claimed,ids.slice(0,3));
 }finally{await service?.close();await store.flush();clearTimeout(store.timer);await rm(directory,{recursive:true,force:true});}
});

test('a verified admission restores a claimed reward before a new browser progression credential is bound',async()=>{
 const f=fixture(),r=f.service.rankRewards;f.add('returning-champion',5,25);r.claim('returning-champion',ids,ids[3]);const freshPeer={progressId:'new-browser'},profile={pickaxe:ids[3]};
 assert.equal(r.sanitizePeer(profile,freshPeer).pickaxe,'');assert.equal(r.sanitizePeer(profile,freshPeer,'returning-champion').pickaxe,ids[3]);assert.equal(r.sanitizePeer(profile,freshPeer,'someone-else').pickaxe,'');await f.service.close();
});
