const count=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
// Preserve available public history once; subsequent counters outlive receipt retention.
export function publicTotals(account){
 if(account.publicTotals?.version===1&&account.publicHistoryReconciled)return account.publicTotals;
 const seen=new Set(),totals={version:1,kills:0,wins:0};
 for(const r of account.receipts||[]){if(!r?.id||seen.has(r.id)||r.custom!==false||r.mode!=='royale'||r.reason==='Removed for inactivity')continue;seen.add(r.id);account.publicParticipant=true;totals.kills+=count(r.kills);totals.wins+=Number(!!r.won);}
 // Receipts are a lower bound, not a second balance to add to saved totals.
 // Marks eligibility must not discard a short but legitimate public result.
 totals.kills=Math.max(totals.kills,count(account.publicTotals?.kills));totals.wins=Math.max(totals.wins,count(account.publicTotals?.wins));
 account.publicHistoryReconciled=true;return account.publicTotals=totals;
}
export function rankPublicPlayers(accounts,identities=new Map()){
 const groups=new Map();
 for(const [id,a]of accounts){const totals=publicTotals(a);if(!a.publicParticipant&&!totals.kills&&!totals.wins)continue;const identity=identities.get(a.socialId),key=a.socialId?'social:'+a.socialId:'account:'+id;
  let p=groups.get(key);if(!p){p={id:key,socialId:a.socialId,name:identity?.profile.name||a.publicName||'Operator',kills:0,wins:0,rounds:new Map()};groups.set(key,p);}
  p.kills+=count(totals.kills);p.wins+=count(totals.wins);
  // A restored social identity may have several old progression credentials.
  // Merge those rows, counting overlapping round records only once.
  for(const r of a.publicRounds||[]){const old=p.rounds.get(r.id);if(old){p.kills-=Math.min(count(old.kills),count(r.kills));p.wins-=Math.min(count(old.wins),count(r.wins));}p.rounds.set(r.id,{kills:Math.max(count(old?.kills),count(r.kills)),wins:Math.max(count(old?.wins),count(r.wins))});}
 }
 const players=[...groups.values()].map(({rounds,...p})=>p);
 const rank=metric=>[...players].sort((a,b)=>b[metric]-a[metric]||b[metric==='kills'?'wins':'kills']-a[metric==='kills'?'wins':'kills']||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map((p,i)=>({...p,rank:i+1}));
 return {kills:rank('kills'),wins:rank('wins')};
}
export function publicLeaderboardView(ranks,socialId,{offset=0}={}){
 const project=p=>({rank:p.rank,name:p.name,kills:p.kills,wins:p.wins,you:!!socialId&&p.socialId===socialId});
 return Object.fromEntries(['kills','wins'].map(metric=>{const all=ranks[metric],start=Math.min(Math.floor(count(offset)/25)*25,Math.max(0,Math.ceil(all.length/25)-1)*25),self=socialId?all.find(p=>p.socialId===socialId):null;return [metric,{total:all.length,offset:start,hasMore:start+25<all.length,rows:all.slice(start,start+25).map(project),self:self?project(self):null}];}));
}
