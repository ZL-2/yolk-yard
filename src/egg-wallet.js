import {SHOP_SLOTS,shopItem} from './shop-catalog.js';
export const WALLET_KEY='yolk-egg-shop-v1';
export const EGG_REWARDS={welcome:300};
const integer=(value,max=1e9)=>Number.isFinite(Number(value))?Math.max(0,Math.min(max,Math.floor(Number(value)||0))):0;
export function normalizeWallet(value,legacyEggs=0){
 if(!value||value.version!==1)return {version:1,balance:integer(legacyEggs)+EGG_REWARDS.welcome,earned:integer(legacyEggs)+EGG_REWARDS.welcome,owned:[],favorites:[],presets:[null,null,null],receipts:[],lastReward:null};
 return {...value,identityVersion:2,migration:value.migration||{from:'legacy-v1',rate:1,ownership:'one-to-one replacement'},legacyOwned:value.legacyOwned||[...(value.owned||[])],balance:integer(value.balance),earned:integer(value.earned),owned:[...new Set((value.owned||[]).filter(id=>shopItem(id)))],favorites:[...new Set((value.favorites||[]).filter(id=>shopItem(id)))],presets:(value.presets||[]).slice(0,3),receipts:(value.receipts||[]).filter(id=>typeof id==='string').slice(-200)};
}
export function purchase(wallet,id){
 const item=shopItem(id);if(!item)throw Error('That item is unavailable.');
 if(wallet.owned.includes(id))throw Error('You already own this item.');
 if(wallet.balance<item.price)throw Error(`You need ${item.price-wallet.balance} more Marks.`);
 return {...wallet,balance:wallet.balance-item.price,owned:[...wallet.owned,id]};
}
export function reward(wallet,id,amount,label){
 if(wallet.receipts.includes(id))return wallet;
 amount=integer(amount,2000);return {...wallet,balance:wallet.balance+amount,earned:wallet.earned+amount,receipts:[...wallet.receipts,id].slice(-200),lastReward:{amount,label}};
}
export function ownedLoadout(wallet,profile){return Object.fromEntries(SHOP_SLOTS.map(slot=>[slot,wallet.owned.includes(profile?.[slot])&&shopItem(profile[slot])?.slot===slot?profile[slot]:'']));}
export class EggWallet {
 constructor(storage,legacyEggs=0){this.listeners=new Set();this.storage=storage;this.legacyEggs=legacyEggs;this.value=this.read();this.error='';try{this.persist(this.value);}catch(error){this.error=error.message;}}
 read(){let raw;try{raw=JSON.parse(this.storage.getItem(WALLET_KEY));}catch{}return normalizeWallet(raw,this.legacyEggs);}
 persist(next){try{this.storage.setItem(WALLET_KEY,JSON.stringify(next));}catch{throw Error('Browser storage is unavailable. Nothing was charged. Allow storage before buying.');}this.value=next;for(const listener of this.listeners)listener(next);return next;}
 subscribe(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 async change(fn){const run=()=>this.persist(fn(this.read()));return globalThis.navigator?.locks?globalThis.navigator.locks.request(WALLET_KEY,run):run();}
 buy(id){return this.change(w=>purchase(w,id));}
 award(id,amount,label){return this.change(w=>reward(w,id,amount,label));}
 async awardVerified(receipt){let applied=false;const wallet=await this.change(w=>{if(w.receipts.includes(receipt.id))return w;applied=true;return reward(w,receipt.id,receipt.amount,receipt.label);});return {applied,wallet};}
}
