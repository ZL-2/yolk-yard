import {shopOffer} from '../../src/shop-catalog.js';
export const ICON_CREATORS=Object.freeze({'jim-icon':{name:'ballz'}});
export function iconBeneficiary(economy,set){
 const config=ICON_CREATORS[set];if(!config)return null;
 const pinned=economy.store.meta('icon-beneficiary:'+set);
 if(pinned)return economy.relay.parties.store.identities.get(pinned)||null;
 const matches=[...economy.relay.parties.store.identities.values()].filter(p=>p.profile?.name?.trim().toLowerCase()===config.name);
 if(matches.length!==1)return null;
 economy.store.setMeta('icon-beneficiary:'+set,matches[0].id);return matches[0];
}
export function payIconPurchase(economy,purchase){
 const offer=shopOffer(purchase.offer),creator=iconBeneficiary(economy,offer?.set);if(!creator||purchase.price<=0)return null;
 const key='icon-share:'+purchase.id;if(economy.store.get('SELECT id FROM marks_ledger WHERE id=?',key))return null;
 const remainderKey='icon-share-remainder:'+offer.set+':'+creator.id,total=purchase.price+economy.store.meta(remainderKey,0),amount=Math.floor(total/20);economy.store.setMeta(remainderKey,total%20);
 const paid=economy.credit(creator.id,key,amount,'icon-earnings',economy.now(),{offer:purchase.offer,purchase:purchase.id,spent:purchase.price,rate:5,purchasedAt:purchase.at,reason:`5% Icon Series earnings from ${offer.name} (${purchase.price.toLocaleString()} Marks spent). Fractional Marks carry forward to the next payout.`});
 return paid?creator.id:null;
}
export function reconcileIconEarnings(economy){
 if(!economy.db)return;
 economy.store.transaction(()=>{for(const p of economy.store.all("SELECT p.* FROM marks_purchases p LEFT JOIN marks_icon_scanned l ON l.id=p.id WHERE l.id IS NULL LIMIT 500")){payIconPurchase(economy,p);const offer=shopOffer(p.offer);if(!ICON_CREATORS[offer?.set]||economy.store.get('SELECT id FROM marks_ledger WHERE id=?','icon-share:'+p.id))economy.store.run('INSERT OR IGNORE INTO marks_icon_scanned VALUES(?)',p.id);}});
}
