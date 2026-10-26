// Host-owned spectator intent; names come only from the accepted player roster.
export const canSpectate=(p,viewerId)=>!!p&&p.id!==viewerId&&p.health>0&&!p.spectating&&!p.boss&&!p.henchman;
export function watcherAction(sim,p,action){
 if(typeof action!=='string'||!action.startsWith('watch:'))return false;
 if(!p||p.bot)return true;
 const id=action.slice(6),target=sim.players.get(id);
 p.watchingId=(!id||(!p.spectating&&p.health>0)||!canSpectate(target,p.id))?null:id;
 return true;
}
export function watchersFor(state,id){const target=state?.players?.find(p=>p.id===id);if(!target||target.health<=0||target.spectating)return [];return state.players.filter(p=>p.id!==id&&!p.bot&&p.connected!==false&&(p.spectating||p.health<=0)&&p.watchingId===id);}
export function spectatorMessage(previous,current){const known=new Set(previous),joined=current.filter(p=>!known.has(p.id));return joined.length?joined.map(p=>p.name).join(', ')+(joined.length===1?' is':' are')+' spectating you.':null;}

export function spectatorTargets(state,localId){
 const me=state?.players?.find(p=>p.id===localId),alive=(state?.players||[]).filter(p=>canSpectate(p,localId));
 const teamMode=(state?.options?.mode==='royale'&&[2,3,4].includes(state.options.teamSize))||(state?.options?.mode==='boxfight'&&state.options.boxFormat!=='ffa');
 const mates=teamMode&&me?.team>=0?alive.filter(p=>p.team===me.team):[];
 if(state?.players?.find(p=>p.id===me?.killerId)?.bot){const humans=alive.filter(p=>!p.bot);if(humans.length)return humans.sort((a,b)=>Number(b.team===me.team)-Number(a.team===me.team));}
 const roundMode=['boxfight','zonewars'].includes(state?.options?.mode);
 return (mates.length&&!roundMode?mates:alive).sort((a,b)=>{const rank=p=>roundMode&&p.id===me?.killerId?-1:(teamMode&&me?.team>=0&&p.team===me.team?0:2)+(p.bot?1:0);return rank(a)-rank(b);});
}
