const count=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
// Preserve available public history once; subsequent counters outlive receipt retention.
export function publicTotals(account){
 if(account.publicTotals?.version===1)return account.publicTotals;
 const seen=new Set(),totals={version:1,kills:0,wins:0};
 for(const r of account.receipts||[]){if(!r?.id||seen.has(r.id)||r.custom!==false||r.mode!=='royale'||!r.eligible)continue;seen.add(r.id);totals.kills+=count(r.kills);totals.wins+=Number(!!r.won);}
 return account.publicTotals=totals;
}
export function rankPublicPlayers(accounts,identities=new Map()){
 const players=[];
 for(const [id,a]of accounts){const totals=publicTotals(a);if(!totals.kills&&!totals.wins)continue;const identity=identities.get(a.socialId);players.push({id,socialId:a.socialId,name:identity?.profile.name||a.publicName||'Operator',kills:count(totals.kills),wins:count(totals.wins)});}
 const rank=metric=>players.filter(p=>p[metric]>0).sort((a,b)=>b[metric]-a[metric]||b[metric==='kills'?'wins':'kills']-a[metric==='kills'?'wins':'kills']||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map((p,i)=>({...p,rank:i+1}));
 return {kills:rank('kills'),wins:rank('wins')};
}
export function publicLeaderboardView(ranks,socialId){
 const project=p=>({rank:p.rank,name:p.name,kills:p.kills,wins:p.wins,you:p.socialId===socialId});
 return Object.fromEntries(['kills','wins'].map(metric=>[metric,{total:ranks[metric].length,rows:ranks[metric].slice(0,25).map(project),self:ranks[metric].find(p=>p.socialId===socialId)?project(ranks[metric].find(p=>p.socialId===socialId)):null}]));
}
