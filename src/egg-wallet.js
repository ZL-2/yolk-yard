import {DEFAULT_OUTFIT_ID} from './default-operator.js';
import {SHOP_SLOTS,shopItem,quoteOffer,outfitStyles} from './shop-catalog.js';
export const WALLET_KEY='yolk-egg-shop-v1';
export const EGG_REWARDS={welcome:300};
const integer=(value,max=1e9)=>Number.isFinite(Number(value))?Math.max(0,Math.min(max,Math.floor(Number(value)||0))):0;
export function normalizeWallet(value,legacyEggs=0){
 if(!value||value.version!==1)return {version:1,balance:integer(legacyEggs)+EGG_REWARDS.welcome,earned:integer(legacyEggs)+EGG_REWARDS.welcome,owned:[DEFAULT_OUTFIT_ID],favorites:[],presets:[null,null,null],receipts:[],lastReward:null};
 const owned=[...new Set([DEFAULT_OUTFIT_ID,...(Array.isArray(value.owned)?value.owned:[]).map(id=>typeof id==='string'&&id.endsWith('-alt')&&shopItem(id.slice(0,-4))?.slot==='outfit'?id.slice(0,-4):id)].filter(id=>shopItem(id)&&!shopItem(id).rankReward).flatMap(id=>shopItem(id).styleRoot?outfitStyles(id).filter(i=>!i.winReward||i.id===id).map(i=>i.id):[id]))];
 return {...value,rosterRevision:215,retiredOwned:[...new Set([...(Array.isArray(value.retiredOwned)?value.retiredOwned:[]),...(Array.isArray(value.owned)?value.owned:[]).filter(id=>typeof id==='string'&&id.startsWith('outfit-')&&!shopItem(id))])],identityVersion:2,migration:value.migration||{from:'legacy-v1',rate:1,ownership:'one-to-one replacement'},legacyOwned:value.legacyOwned||[...(Array.isArray(value.owned)?value.owned:[])],balance:integer(value.balance),earned:integer(value.earned),owned,favorites:[...new Set((Array.isArray(value.favorites)?value.favorites:[]).filter(id=>shopItem(id)))],presets:(Array.isArray(value.presets)?value.presets:[]).slice(0,3),receipts:(Array.isArray(value.receipts)?value.receipts:[]).filter(id=>typeof id==='string').slice(-200)};
}
export function purchase(wallet,id,expectedPrice){
 const quote=quoteOffer(wallet,id);if(!quote)throw Error('That item is unavailable.');
 if(quote.offer.tournamentReward)throw Error('This exclusive pickaxe is awarded only to the Frontier Cup winner.');
 if(quote.offer.winReward)throw Error('Win an online match wearing Jim to unlock Golf.');
 if(quote.offer.rankReward)throw Error('Earn and claim this item through the live Royale rankings.');
 if(quote.owned)throw Error('You already own this item.');
 if(expectedPrice!==undefined&&expectedPrice!==quote.price)throw Error('Your collection changed. Review the updated price and confirm again.');
 if(wallet.balance<quote.price)throw Error(`You need ${quote.price-wallet.balance} more Marks.`);
 return {...wallet,balance:wallet.balance-quote.price,owned:[...new Set([...wallet.owned,...quote.grants])]};
}
export function reward(wallet,id,amount,label){
 if(wallet.receipts.includes(id))return wallet;
 amount=integer(amount,2000);return {...wallet,balance:wallet.balance+amount,earned:wallet.earned+amount,receipts:[...wallet.receipts,id].slice(-200),lastReward:{amount,label}};
}
export function ownedLoadout(wallet,profile,rankAccess=[]){return Object.fromEntries(SHOP_SLOTS.map(slot=>[slot,(wallet.owned.includes(profile?.[slot])||rankAccess.includes(profile?.[slot]))&&shopItem(profile[slot])?.slot===slot?profile[slot]:slot==='outfit'?DEFAULT_OUTFIT_ID:'']));}
export class EggWallet {
 constructor(storage,legacyEggs=0){this.listeners=new Set();this.storage=storage;this.legacyEggs=legacyEggs;this.value=this.read();this.error='';try{this.persist(this.value);}catch(error){this.error=error.message;}}
 configureServer(request){this.serverRequest=request;}
 syncServer(record){if(!record?.identity||record.economyRevision!==1)return;this.serverValue=record;this.value={...this.readLocal(),balance:record.balance,earned:record.earned,owned:record.owned};this.persist(this.value);}
 readLocal(){let raw;try{raw=JSON.parse(this.storage.getItem(WALLET_KEY));}catch{}return normalizeWallet(raw,this.legacyEggs);}
 read(){if(this.serverValue){const record=this.serverValue;return {...this.readLocal(),balance:record.balance,earned:record.earned,owned:record.owned};}let raw;try{raw=JSON.parse(this.storage.getItem(WALLET_KEY));}catch{}return normalizeWallet(raw,this.legacyEggs);}
 persist(next){try{this.storage.setItem(WALLET_KEY,JSON.stringify(next));}catch{throw Error('Browser storage is unavailable. Nothing was charged. Allow storage before buying.');}this.value=next;for(const listener of this.listeners)listener(next);return next;}
 subscribe(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 async change(fn){
  // Resolve the lock callback even when validation/storage fails. Raise the
  // error after release so a rejected purchase cannot stall the next action.
  const run=()=>{try{return {value:this.persist(fn(this.read()))};}catch(error){return {error};}};
  const result=globalThis.navigator?.locks?await globalThis.navigator.locks.request(WALLET_KEY,run):run();
  if(result.error)throw result.error;return result.value;
 }
 syncTournamentRewards(record){if(!record?.identity||!Array.isArray(record.owned))return Promise.resolve();return this.change(w=>({...w,owned:[...new Set([...w.owned.filter(id=>!shopItem(id)?.tournamentReward),...record.owned.filter(id=>shopItem(id)?.tournamentReward)])]}));}
 syncReferrals(record){if(this.serverRequest)return this.serverRequest('economy-sync').then(r=>{this.syncServer(r);return {amount:0};});if(!record?.id||!Number.isSafeInteger(record.marks)||record.marks<0)return Promise.resolve({amount:0});let amount=0;return this.change(w=>{const paid=w.referralCredits?.[record.id]||0;amount=Math.max(0,record.marks-paid);return {...w,balance:w.balance+amount,earned:w.earned+amount,referralCredits:{...w.referralCredits,[record.id]:Math.max(paid,record.marks)},referralNotices:{...w.referralNotices,[record.id]:w.referralNotices?.[record.id]??paid}};}).then(()=>({amount}));}
 syncOwnerGrants(record){if(this.serverRequest)return this.serverRequest('economy-sync').then(r=>{this.syncServer(r);return {amount:0};});if(!record?.id||!Number.isSafeInteger(record.marks)||record.marks<0||record.marks>1e9)return Promise.resolve({amount:0});let amount=0;return this.change(w=>{const paid=integer(w.ownerCredits?.[record.id]);amount=Math.max(0,record.marks-paid);if(w.balance+amount>1e9)throw Error('Spend some Marks before collecting the remaining owner grant.');return {...w,balance:w.balance+amount,earned:Math.min(1e9,w.earned+amount),ownerCredits:{...w.ownerCredits,[record.id]:Math.max(paid,record.marks)}};}).then(()=>({amount}));}
 pendingReferralReward(id){const w=this.read(),through=w.referralCredits?.[id]||0,amount=through-(w.referralNotices?.[id]??through);return amount>0?{id,amount,through}:null;}
 acknowledgeReferralReward(id,through){return this.change(w=>({...w,referralNotices:{...w.referralNotices,[id]:Math.max(w.referralNotices?.[id]||0,Math.min(through,w.referralCredits?.[id]||0))}}));}
 buy(id,expectedPrice){if(!this.serverRequest)return Promise.reject(Error('Connect to the online wallet before buying.'));return this.serverRequest('economy-buy',{offer:id,price:expectedPrice,requestId:crypto.randomUUID()}).then(r=>{this.syncServer(r);return this.value;});}
 award(){if(!this.serverRequest)return Promise.reject(Error('Marks are awarded only by the online game service.'));return this.serverRequest('economy-sync').then(r=>{this.syncServer(r);return this.value;});}
 async awardVerified(receipt){if(!this.serverRequest)return {applied:false,wallet:this.value};const applied=!this.read().receipts.includes(receipt.id);this.syncServer(await this.serverRequest('economy-sync'));if(applied)await this.change(w=>({...w,receipts:[...w.receipts,receipt.id].slice(-200)}));return {applied,wallet:this.value};}
}
