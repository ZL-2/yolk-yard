import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {SHOP_ITEMS,SHOP_BUNDLES,shopItem,shopOffer,offerGrants,cosmeticProfile} from '../src/shop-catalog.js';
import {DEFAULT_OUTFIT_ID} from '../src/default-operator.js';
import {normalizeWallet,ownedLoadout,purchase} from '../src/egg-wallet.js';
import {safeProfile,randomAppearance,rng} from '../src/data.js';
import {OPERATOR_ASSET_IDS} from '../src/operator-assets.js';
const ids=['voss','rook','nyx','pulse','wren','morrow','rank-25','rank-10','rank-5','rank-1','scout'];
test('the roster has exactly six Shop, four earned and one free default character',()=>{
 const outfits=SHOP_ITEMS.filter(i=>i.slot==='outfit');
 assert.deepEqual(outfits.map(i=>i.id).sort(),ids.map(i=>'outfit-'+i).sort());
 assert.equal(outfits.filter(i=>i.featured).length,6);assert.equal(outfits.filter(i=>i.rankReward).length,4);
 assert.equal(outfits.filter(i=>i.default).length,1);assert.equal(shopItem(DEFAULT_OUTFIT_ID).price,0);
 assert.deepEqual([...OPERATOR_ASSET_IDS].sort(),[...ids].sort());
 for(const bundle of SHOP_BUNDLES)assert.equal(offerGrants(bundle).filter(id=>id.startsWith('outfit-')).length,1);
 const random=rng(215);for(let i=0;i<200;i++){const item=shopItem(randomAppearance(random).outfit);assert.ok(item?.slot==='outfit'&&!item.rankReward);}
});
test('new and returning players own Scout without losing Marks or replaying welcome rewards',()=>{
 const fresh=normalizeWallet(null);assert.deepEqual(fresh.owned,[DEFAULT_OUTFIT_ID]);assert.equal(fresh.balance,300);
 const next=normalizeWallet({version:1,balance:7480,earned:15620,owned:['outfit-wren','pickaxe-frost'],receipts:['reward-1']});
 assert.equal(next.balance,7480);assert.equal(next.earned,15620);assert.deepEqual(next.receipts,['reward-1']);
 assert.ok(next.owned.includes(DEFAULT_OUTFIT_ID));assert.ok(next.owned.includes('pickaxe-frost'));
 assert.deepEqual(normalizeWallet(next),next);assert.throws(()=>purchase(next,DEFAULT_OUTFIT_ID),/already own/);
});
test('retired outfits disappear while purchase history and alternate base purchases survive',()=>{
 const next=normalizeWallet({version:1,balance:1234,owned:['outfit-neon','outfit-wren-alt','backbling-neon'],favorites:['outfit-neon','outfit-wren'],receipts:['purchase-7']});
 assert.deepEqual(next.owned.sort(),['backbling-neon','outfit-scout','outfit-wren']);
 assert.deepEqual(next.retiredOwned.sort(),['outfit-neon','outfit-wren-alt']);assert.equal(next.balance,1234);
 assert.deepEqual(next.receipts,['purchase-7']);assert.ok(!next.favorites.includes('outfit-neon'));
 assert.equal(shopOffer('outfit-neon'),undefined);assert.equal(shopOffer('outfit-wren-alt'),undefined);
 assert.throws(()=>purchase(next,'outfit-neon'),/unavailable/);
});
test('empty, retired, corrupt and unowned saved outfits fall back to Scout',()=>{
 for(const id of ['',null,undefined,'outfit-neon','outfit-wren-alt','unrecognized']){
  assert.equal(safeProfile({name:'Scout',outfit:id}).outfit,DEFAULT_OUTFIT_ID);
  assert.equal(cosmeticProfile({outfit:id}).outfit,DEFAULT_OUTFIT_ID);
 }
 const wallet=normalizeWallet({version:1,balance:100,owned:[]});
 assert.equal(ownedLoadout(wallet,{outfit:'outfit-wren'}).outfit,DEFAULT_OUTFIT_ID);
 assert.equal(ownedLoadout(wallet,{outfit:'outfit-rank-25'},['outfit-rank-25']).outfit,'outfit-rank-25');
});
test('ranked and tournament rewards remain exclusive; existing equipment survives',()=>{
 const wallet=normalizeWallet({version:1,balance:99999,owned:['outfit-rank-1','pickaxe-rank-1','wrap-royal','glider-cloud']});
 assert.ok(!wallet.owned.includes('outfit-rank-1'));assert.ok(!wallet.owned.includes('pickaxe-rank-1'));
 assert.ok(wallet.owned.includes('wrap-royal'));assert.ok(wallet.owned.includes('glider-cloud'));
 assert.throws(()=>purchase(wallet,'outfit-rank-1'),/rankings/);
 assert.equal(shopItem('pickaxe-frontier-champion').tournamentReward,true);
});
test('all eleven ship real skinned Blender assets, editable sources and smaller distance meshes',()=>{
 const glb=(id,suffix='')=>{const buffer=readFileSync(new URL('../public/models/operators/'+id+suffix+'.glb',import.meta.url));assert.equal(buffer.toString('ascii',0,4),'glTF');assert.equal(buffer.readUInt32LE(4),2);assert.equal(buffer.readUInt32LE(8),buffer.length);return JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());};
 for(const id of ids){const near=glb(id),far=glb(id,'-lod'),tris=g=>g.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+g.accessors[p.indices].count/3,0),0);
  assert.match(near.asset.generator,/Blender/);assert.ok(near.skins.every(s=>s.joints.length===32),id+' rig');
  assert.ok(tris(near)>5000&&tris(near)<70000,id+' geometry budget');assert.ok(tris(far)<tris(near)*.4,id+' LOD');
  assert.ok(near.materials.length<=2,id+' material budget');assert.ok(near.images.length>0,id+' textures');
  assert.ok(statSync(new URL('../art/operators/'+id+'/'+id+'.blend',import.meta.url)).size>100000,id+' editable source');
 }
});

