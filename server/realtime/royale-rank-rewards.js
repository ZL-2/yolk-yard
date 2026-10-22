import {rankPublicPlayers} from './leaderboards.js';
import {eligibleRankPickaxes,rankPickaxe,rankLoadout} from '../../src/royale-ranking.js';
// Entitlements belong to the authenticated social identity, never the local wallet.
export class RoyaleRankRewards{
 constructor(progression){this.progression=progression;this.relay=progression.relay;this.sent=new Map();this.dirty=true;}
 invalidate(){this.dirty=true;if(!this.timer){this.timer=setTimeout(()=>{this.timer=null;this.refresh();},300);this.timer.unref?.();}}
 ranks(){if(this.dirty||!this.rows){this.rows=rankPublicPlayers(this.progression.accounts,this.relay.parties?.store.identities,'royale').rating;this.byIdentity=new Map(this.rows.filter(p=>p.socialId).map(p=>[p.socialId,p]));this.dirty=false;}return this.rows;}
 status(id){
  this.ranks();const store=this.relay.parties?.store,identity=store?.identities.get(id);if(!identity)return null;
  const row=this.byIdentity.get(id),eligible=eligibleRankPickaxes(row?.rank,row?.rating),old=identity.royaleRankRewards||{eligible:[],claimed:[],epoch:0,revision:0};
  if(JSON.stringify(old.eligible)!==JSON.stringify(eligible)){
   identity.royaleRankRewards={eligible,claimed:(old.claimed||[]).filter(x=>eligible.includes(x)),epoch:old.epoch+1,revision:old.revision+1};store.save?.();
  }
  const record=identity.royaleRankRewards||old,claimed=(record.claimed||[]).filter(x=>eligible.includes(x));
  return {identity:id,rank:row?.rating>0?row.rank:0,rating:row?.rating||0,wins:row?.wins||0,kills:row?.kills||0,eligible,claimed,equipped:claimed.includes(identity.profile?.pickaxe)?identity.profile.pickaxe:'',pending:eligible.filter(x=>!claimed.includes(x)),epoch:record.epoch,revision:record.revision};
 }
 sanitize(profile,id){return rankLoadout(profile,this.status(id)?.claimed||[]);}
 sanitizePeer(profile,peer){return this.sanitize(profile,this.progression.accounts.get(peer?.progressId)?.socialId);}
 sync(id,force=false){
  const status=this.status(id);if(!status)return null;
  const parties=this.relay.parties,identity=parties.store.identities.get(id),user=parties.users?.get(id),approved=rankLoadout(identity.profile,status.claimed);
  if(approved!==identity.profile){identity.profile=approved;if(user)user.profile=approved;parties.store.save?.();this.apply(id,'');if(user)parties.sync?.(parties.parties?.get(user.party));}
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
  if(!status||!requested.length||requested.length>4||requested.some(x=>!rankPickaxe(x)||!status.eligible.includes(x)))throw Error('Your Royale rank changed. Refresh your rewards to see current access.');
  if(equip&&!requested.includes(equip))throw Error('Choose one of the rewards being claimed.');
  const store=this.relay.parties.store,identity=store.identities.get(id),record=identity.royaleRankRewards;
  record.claimed=[...new Set([...status.claimed,...requested])];record.revision++;store.save?.();
  if(equip){identity.profile={...identity.profile,pickaxe:equip};const u=this.relay.parties.users?.get(id);if(u){u.profile=identity.profile;this.relay.parties.sync?.(this.relay.parties.parties?.get(u.party));}this.apply(id,equip);}
  return this.sync(id,true);
 }
 apply(id,pickaxe){
  // Update an already equipped tool, including a browser-hosted match, without
  // respawning anyone or changing weapons/combat state.
  for(const peer of this.relay.peers?.values()||[]){if(this.progression.accounts.get(peer.progressId)?.socialId!==id)continue;
   const room=this.relay.authority?.roomFor(peer),p=room?.sim.players.get(peer.authorityId||peer.id);if(p){p.pickaxe=pickaxe;if(p.nextProfile)p.nextProfile.pickaxe=pickaxe;}
   const player=peer.listing?'host':peer.id;this.relay.send?.(peer,{type:'rank-cosmetic',player,pickaxe});
   for(const host of peer.links?.values()||[])if(host.listing)this.relay.send?.(host,{type:'rank-cosmetic',player:peer.id,pickaxe});
  }
 }
 close(){clearTimeout(this.timer);this.sent.clear();}
}
