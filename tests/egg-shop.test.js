import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOP_ITEMS,SHOP_SLOTS,shopItem} from '../src/shop-catalog.js';
import {normalizeWallet,purchase,reward,ownedLoadout,EggWallet} from '../src/egg-wallet.js';
import {safeProfile} from '../src/data.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {makeShopPickaxe,makeShopBack,makeShopGlider,makeShopTrail} from '../src/shop-models.js';
test('84 original cosmetics have unique IDs, supported palettes and priced categories',()=>{
 assert.equal(SHOP_ITEMS.length,84);assert.equal(new Set(SHOP_ITEMS.map(i=>i.id)).size,84);
 for(const item of SHOP_ITEMS){assert.ok(item.price>=200&&item.price<=1400);assert.match(item.color,/^#[0-9a-f]{6}$/i);assert.ok(SHOP_SLOTS.includes(item.slot));}
});
test('wallet migrates eggs once, deducts exactly once and rejects overspending',()=>{
 let wallet=normalizeWallet(null,70);assert.equal(wallet.balance,370);
 wallet=purchase(wallet,'wrap-cloud');assert.equal(wallet.balance,170);assert.equal(normalizeWallet(wallet,70).balance,170);
 assert.throws(()=>purchase(wallet,'wrap-cloud'),/already own/);assert.throws(()=>purchase(wallet,'outfit-royal'),/more Marks/);
 const next=reward(wallet,'round-a',100,'Match');assert.equal(next.balance,270);assert.equal(reward(next,'round-a',100,'Match'),next);
 assert.equal(ownedLoadout(next,{wrap:'wrap-cloud',outfit:'outfit-royal'}).outfit,'');
});
test('failed storage does not report a purchase or deduct the in-memory balance',async()=>{
 const wallet=new EggWallet({getItem:()=>null,setItem:()=>{throw Error('quota');}});const original=wallet.value;
 await assert.rejects(wallet.buy('wrap-cloud'),/Nothing was charged/);assert.equal(wallet.value,original);assert.equal(wallet.value.balance,300);
});
test('cosmetic styles survive both simulation snapshots without changing blaster stats',()=>{
 const profile=safeProfile({name:'Shop test',outfit:'outfit-neon',wrap:'wrap-cloud',pickaxe:'pickaxe-royal',backbling:'backbling-garden',glider:'glider-reef',trail:'trail-neon'});
 for(const Type of [Simulation,RoyaleSimulation]){const sim=new Type({bots:0,fill:false});sim.addPlayer('host',profile);const p=sim.snapshot().players[0];for(const slot of SHOP_SLOTS)assert.equal(p[slot],profile[slot]);}
 assert.equal(safeProfile({wrap:'outfit-neon'}).wrap,'');
});
test('every new tool, accessory, glider and trail produces a visible 3D model',()=>{
 const factories={pickaxe:makeShopPickaxe,backbling:makeShopBack,glider:makeShopGlider,trail:makeShopTrail};
 for(const item of SHOP_ITEMS){if(!factories[item.slot])continue;const model=factories[item.slot](item.id);let meshes=0;model.traverse(m=>{if(m.isMesh){meshes++;assert.ok(m.geometry.attributes.position.count>0);m.geometry.dispose();m.material.dispose();}});assert.ok(meshes>0,item.id);}
});
