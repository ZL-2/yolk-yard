import {sanitizeJimStyle} from './jim-style.js';
import {rankPublicPlayers} from './leaderboards.js';
import {eligibleRankItems,rankItem,rankLoadout,PRESTIGE_SLOTS} from '../../src/royale-ranking.js';
// Entitlements belong to the authenticated social identity, never the local wallet.
export class RoyaleRankRewards{
 constructor(progression){this.progression=progression;this.relay=progression.relay;this.sent=new Map();this.dirty=true;}
 invalidate(){this.dirty=true;if(!this.timer){this.timer=setTimeout(()=>{this.timer=null;this.refresh();},300);this.timer.unref?.();}}
 ranks(){if(this.dirty||!this.rows){this.rows=rankPublicPlayers(this.progression.accounts,this.relay.parties?.store.identities,'royale').rating;this.byIdentity=new Map(this.rows.filter(p=>p.socialId).map(p=>[p.socialId,p]));this.dirty=false;}return this.rows;}
 status(id){
  this.ranks();const store=this.relay.parties?.store,identity=store?.identities.get(id);if(!identity)return null;
  const row=this.byIdentity.get(id),eligible=eligibleRankItems(row?.rank,row?.rating),old=identity.royaleRankRewards||{eligible:[],claimed:[],epoch:0,revision:0};
  const rank=row?.rating>0?row.rank:0,rating=row?.rating||0,changed=JSON.stringify(old.eligible)!==JSON.stringify(eligible);
  if(changed||old.rank!==rank||old.rating!==rating){
   identity.royaleRankRewards={eligible,claimed:(old.claimed||[]).filter(x=>eligible.includes(x)),rank,rating,epoch:old.epoch+(changed?1:0),revision:old.revision+1};store.save?.();
  }
  const record=identity.royaleRankRewards||old,claimed=(record.claimed||[]).filter(x=>eligible.includes(x));
  return {identity:id,rank:row?.rating>0?row.rank:0,rating:row?.rating||0,wins:row?.wins||0,kills:row?.kills||0,eligible,claimed,equipped:claimed.includes(identity.profile?.pickaxe)?identity.profile.pickaxe:'',loadout:Object.fromEntries(PRESTIGE_SLOTS.filter(slot=>claimed.includes(identity.profile?.[slot])).map(slot=>[slot,identity.profile[slot]])),pending:eligible.filter(x=>!claimed.includes(x)),epoch:record.epoch,revision:record.revision};
 }
 sanitize(profile,id){const status=this.status(id);const approved={...rankLoadout(profile,status?.claimed||[]),royaleRank:status?.rank>0&&status.rank<=25?status.rank:0};return sanitizeJimStyle(this.relay,this.relay.tournament?.sanitize(approved,id)||approved,id);}
 sanitizePeer(profile,peer,admittedIdentity){return this.sanitize(profile,admittedIdentity||this.progression.accounts.get(peer?.progressId)?.socialId);}
 sync(id,force=false){
  let status=this.status(id);if(!status)return null;
  const parties=this.relay.parties,identity=parties.store.identities.get(id),user=parties.users?.get(id),approved=this.sanitize(identity.profile,id);
  if(JSON.stringify(approved)!==JSON.stringify(identity.profile)){
   const changes=Object.fromEntries([...PRESTIGE_SLOTS,'royaleRank'].filter(slot=>approved[slot]!==identity.profile?.[slot]).map(slot=>[slot,approved[slot]]));
   identity.profile=approved;if(user)user.profile=approved;parties.store.save?.();this.apply(id,changes);if(user)parties.sync?.(parties.parties?.get(user.party));status=this.status(id);
  }
  const key=JSON.stringify(status);if(force||this.sent.get(id)!==key){this.sent.set(id,key);parties.send?.(user,{type:'royale-rank',record:status});}
  return status;
 }
 refresh(){
  this.ranks();const parties=this.relay.parties;if(!parties?.store)return;
  const ids=new Set([...(parties.users?.keys()||[]),...this.rows.slice(0,25).map(p=>p.socialId).filter(Boolean)]);
  for(const [id,identity]of parties.store.identities)if(identity.royaleRankRewards?.eligible?.length)ids.add(id);
  for(const id of ids)this.sync(id);
 }
 claim(id,ids,equip){
  const status=this.sync(id),requested=[...new Set(Array.isArray(ids)?ids:[])];
  if(!status||!requested.length||requested.length>24||requested.some(x=>!rankItem(x)||!status.eligible.includes(x)))throw Error('Your Royale rank changed. Refresh your rewards to see current access.');
  // A set is an explicit slot -> item map, never an ambiguous "equip all".
  const choices=typeof equip==='string'?{[rankItem(equip)?.slot||'pickaxe']:equip}:equip&&typeof equip==='object'&&!Array.isArray(equip)?equip:{};
  if(equip&&(!Object.keys(choices).length||Object.entries(choices).some(([slot,item])=>!PRESTIGE_SLOTS.includes(slot)||rankItem(item)?.slot!==slot||!requested.includes(item))))throw Error('Choose one of the rewards being claimed for each equipment slot.');
  const store=this.relay.parties.store,identity=store.identities.get(id),record=identity.royaleRankRewards;
  record.claimed=[...new Set([...status.claimed,...requested])];record.revision++;
  if(Object.keys(choices).length){identity.profile={...identity.profile,...choices};const u=this.relay.parties.users?.get(id);if(u){u.profile=identity.profile;this.relay.parties.sync?.(this.relay.parties.parties?.get(u.party));}this.apply(id,choices);}
  store.save?.();return this.sync(id,true);
 }
 apply(id,cosmetics){
  // Apply only changed appearance slots. Inventory, health and movement survive.
  for(const peer of this.relay.peers?.values()||[]){if(this.progression.accounts.get(peer.progressId)?.socialId!==id)continue;
   const room=this.relay.authority?.roomFor(peer),p=room?.sim.players.get(peer.authorityId||peer.id);if(p){Object.assign(p,cosmetics);if(p.nextProfile)Object.assign(p.nextProfile,cosmetics);}
   const player=peer.listing?'host':peer.id,message={type:'rank-cosmetic',player,cosmetics,...(Object.hasOwn(cosmetics,'pickaxe')?{pickaxe:cosmetics.pickaxe}:{})};this.relay.send?.(peer,message);
   for(const host of peer.links?.values()||[])if(host.listing)this.relay.send?.(host,{...message,player:peer.id});
  }
 }
 close(){clearTimeout(this.timer);this.sent.clear();}
}
