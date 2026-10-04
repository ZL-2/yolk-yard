// Host-owned spectator intent; names come only from the accepted player roster.
export function watcherAction(sim,p,action){
 if(typeof action!=='string'||!action.startsWith('watch:'))return false;
 if(!p||p.bot)return true;
 const id=action.slice(6),target=sim.players.get(id);
 p.watchingId=(!id||(!p.spectating&&p.health>0)||!target||target===p||target.health<=0||target.spectating)?null:id;
 return true;
}
export function watchersFor(state,id){const target=state?.players?.find(p=>p.id===id);if(!target||target.health<=0||target.spectating)return [];return state.players.filter(p=>p.id!==id&&!p.bot&&p.connected!==false&&(p.spectating||p.health<=0)&&p.watchingId===id);}
export function spectatorMessage(previous,current){const known=new Set(previous),joined=current.filter(p=>!known.has(p.id));return joined.length?joined.map(p=>p.name).join(', ')+(joined.length===1?' is':' are')+' spectating you.':null;}

export function spectatorTargets(state,localId){
 const me=state?.players?.find(p=>p.id===localId),alive=(state?.players||[]).filter(p=>p.id!==localId&&p.health>0&&!p.spectating&&!p.boss);
 const teamMode=state?.options?.mode==='royale'&&[2,4].includes(state.options.teamSize);
 const mates=teamMode&&me?.team>=0?alive.filter(p=>p.team===me.team):[];
 return (mates.length?mates:alive).sort((a,b)=>{const rank=p=>(teamMode&&me?.team>=0&&p.team===me.team?0:2)+(p.bot?1:0);return rank(a)-rank(b);});
}
