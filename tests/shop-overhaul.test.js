import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {NEW_COLLECTIONS} from '../src/shop-collections.js';
import {SHOP_ITEMS,SHOP_BUNDLES,SHOP_SLOTS,shopItem,quoteOffer,outfitStyles} from '../src/shop-catalog.js';
import {normalizeWallet,purchase,EggWallet,WALLET_KEY,ownedLoadout} from '../src/egg-wallet.js';
import {BOSSES} from '../src/bosses.js';
import {makeHumanoid,animateHumanoid,humanoidDiagnostics} from '../src/humanoid.js';
import {makeShopPickaxe,makeShopBack,makeShopGlider,makeShopTrail,collectionWrapTexture} from '../src/shop-models.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {safeProfile} from '../src/data.js';
const funded=(balance=10000)=>({...normalizeWallet(null),balance});
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
test('six original characters have six complete collections, two styles, and optimized artwork',()=>{
 assert.equal(NEW_COLLECTIONS.length,6);assert.equal(SHOP_BUNDLES.length,6);assert.equal(SHOP_ITEMS.filter(i=>!i.rankReward).length,126);
 for(const set of NEW_COLLECTIONS){assert.equal(outfitStyles('outfit-'+set.id).length,2);for(const slot of SHOP_SLOTS)assert.ok(shopItem(slot+'-'+set.id));const bytes=readFileSync(new URL('../public/'+set.art,import.meta.url));assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes.length<150000);}
 for(const boss of BOSSES){const item=shopItem(boss.outfit);assert.equal(item.name,boss.name);assert.equal(item.set,shopItem(boss.backbling).set);}
});
test('old collection balances, IDs, favorites and presets survive without a second welcome grant',()=>{
 const old={...funded(1275),owned:['outfit-garden-alt','wrap-neon','outfit-ember'],favorites:['wrap-neon'],presets:[{outfit:'outfit-ember',wrap:'wrap-neon'},null,null]};
 const next=normalizeWallet(old,9999);assert.equal(next.balance,1275);assert.deepEqual(next.owned,old.owned);assert.deepEqual(next.favorites,old.favorites);assert.deepEqual(next.presets,old.presets);
 assert.deepEqual(normalizeWallet(next,9999).owned,old.owned);
});
test('one outfit purchase includes both styles and never sells the other style twice',()=>{
 let w=purchase(funded(),'outfit-nyx');assert.equal(w.balance,8500);assert.ok(w.owned.includes('outfit-nyx-alt'));assert.equal(w.owned.length,2);
 assert.throws(()=>purchase(w,'outfit-nyx-alt'),/already own/);assert.equal(quoteOffer(w,'outfit-nyx').owned,true);
 const repaired=normalizeWallet({...funded(),owned:['outfit-nyx-alt']});assert.ok(repaired.owned.includes('outfit-nyx'));assert.equal(repaired.balance,10000);
});
test('bundle credits owned items, grants only the remainder and spends once',()=>{
 let w=purchase(funded(),'outfit-voss');w=purchase(w,'pickaxe-voss');const q=quoteOffer(w,'bundle-voss');
 assert.equal(q.ownedCount,2);assert.equal(q.price,3200-1600-750);assert.equal(q.count,6);assert.ok(q.saving>0);
 const paid=purchase(w,'bundle-voss',q.price);assert.equal(paid.balance,10000-3200);assert.equal(new Set(paid.owned).size,7);assert.equal(quoteOffer(paid,'bundle-voss').owned,true);assert.throws(()=>purchase(paid,'bundle-voss'),/already own/);
 for(const slot of SHOP_SLOTS)assert.ok(paid.owned.includes(slot+'-voss'));
});
test('a completed bundle never goes negative and a free remainder is explicit',()=>{
 let w=funded();for(const id of ['outfit-rook','pickaxe-rook','glider-rook'])w=purchase(w,id);
 const q=quoteOffer(w,'bundle-rook');assert.equal(q.price,0);assert.equal(q.owned,false);const next=purchase(w,'bundle-rook',0);assert.equal(next.balance,w.balance);assert.equal(quoteOffer(next,'bundle-rook').owned,true);
});
test('insufficient funds and changed ownership cannot charge a stale confirmation',()=>{
 assert.throws(()=>purchase(funded(2999),'bundle-rook'),/more Marks/);
 const before=funded(),quote=quoteOffer(before,'bundle-nyx'),after=purchase(before,'wrap-nyx');
 assert.throws(()=>purchase(after,'bundle-nyx',quote.price),/collection changed/);assert.equal(after.balance,9550);
});
test('duplicate rapid purchases and failed storage retain exactly one consistent debit',async()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},wallet=new EggWallet(storage);wallet.persist(funded());
 const results=await Promise.allSettled([wallet.buy('bundle-pulse',2500),wallet.buy('bundle-pulse',2500)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(wallet.value.balance,7500);assert.equal(wallet.value.owned.length,7);
 const blocked=new EggWallet({getItem:()=>JSON.stringify(funded()),setItem:()=>{throw Error('blocked');}});await assert.rejects(blocked.buy('bundle-wren',2500),/Nothing was charged/);assert.equal(blocked.value.balance,10000);assert.equal(blocked.value.owned.length,0);assert.ok(memory.get(WALLET_KEY));
});
test('all new styles and complete loadouts survive profile validation and player snapshots',()=>{
 for(const set of NEW_COLLECTIONS)for(const style of outfitStyles('outfit-'+set.id)){
  const wallet=purchase(funded(),'bundle-'+set.id),profile=safeProfile({name:'Collection QA',...Object.fromEntries(SHOP_SLOTS.map(slot=>[slot,slot+'-'+set.id])),outfit:style.id});assert.deepEqual(ownedLoadout(wallet,profile),Object.fromEntries(SHOP_SLOTS.map(slot=>[slot,profile[slot]])));
  for(const Type of [Simulation,RoyaleSimulation]){const sim=new Type({bots:0,fill:false});sim.addPlayer('qa',profile);const p=sim.snapshot().players.find(p=>p.id==='qa');for(const slot of SHOP_SLOTS)assert.equal(p[slot],profile[slot]);}
 }
});
test('unique character geometry stays a single skinned mesh with shared bones and finite poses',()=>{
 const signatures=new Set();for(const set of NEW_COLLECTIONS){const model=makeHumanoid({outfit:'outfit-'+set.id}),mesh=model.userData.human.mesh,d=humanoidDiagnostics(model);assert.equal(d.bones,32);assert.ok(d.vertices<13000,set.id+': '+d.vertices);let meshes=0;model.traverse(o=>{if(o.isMesh)meshes++;});assert.equal(meshes,1);signatures.add(hash(mesh.geometry.attributes.position.array));
  for(const p of [{grounded:true},{grounded:true,vz:-5},{downed:true},{flight:'glide',grounded:false},{health:0}]){animateHumanoid(model,{health:100,...p},1/30,1);model.updateMatrixWorld(true);assert.ok(mesh.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)));}
 }
 assert.equal(signatures.size,6);
});
test('every new equipment and trail model is distinct and batches opaque and glass surfaces',()=>{
 for(const [slot,factory]of Object.entries({pickaxe:makeShopPickaxe,backbling:makeShopBack,glider:makeShopGlider,trail:makeShopTrail})){
  const hashes=new Set();for(const set of NEW_COLLECTIONS){const model=factory(slot+'-'+set.id),parts=[];let count=0;model.traverse(m=>{if(!m.isMesh)return;count++;assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));parts.push(hash(m.geometry.attributes.position.array));});assert.ok(count>=1&&count<=4,slot+' '+set.id);hashes.add(parts.join(':'));}assert.equal(hashes.size,6,slot);
 }
 const wraps=NEW_COLLECTIONS.map(s=>collectionWrapTexture(shopItem('wrap-'+s.id)));assert.equal(new Set(wraps.map(t=>hash(t.image.data))).size,6);wraps.forEach(t=>t.dispose());
});
