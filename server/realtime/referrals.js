import {normalizeFriendCode} from './social-store.js';
export const REFERRAL_MARKS=1000;
export function referralSummary(identity){const count=Math.max(0,Math.floor(identity?.referralCount||0));return {id:identity.id,count,marks:Math.max(0,Math.floor(identity?.qualifiedReferralCount||0))*REFERRAL_MARKS,code:identity.code};}
// Only a freshly registered identity can credit its first referring player.
// Both sides live in the same durable social snapshot, including offline awards.
export function creditReferral(store,identity,code,isNew){
 if(!isNew||identity.referredBy||!code)return null;
 const inviter=store.identities.get(store.codes.get(normalizeFriendCode(code)));
 if(!inviter||inviter.id===identity.id)return null;
 identity.referredBy=inviter.id;identity.referredAt=Date.now();
 inviter.referralCount=(inviter.referralCount||0)+1; // Attribution only; currency requires server-verified qualifying matches.
store.save();return inviter;
}
