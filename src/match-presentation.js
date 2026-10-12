import {teammates,wonRoyale} from './teams.js';
import {spectatorTargets} from './spectator-status.js';

export const ELIMINATION_HOLD=1.25,VICTORY_REVEAL=1.35;
export function preferredSpectator(state,id){
 const me=state?.players.find(p=>p.id===id);if(!me)return null;
 const eligible=spectatorTargets(state,id),nearest=eligible.filter(p=>teammates(state.options,me,p)).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z));
 const killer=state.players.find(p=>p.id===me.killerId),humans=eligible.filter(p=>!p.bot);
 if(killer?.bot&&humans.length)return nearest.find(p=>!p.bot)?.id||humans[0].id;
 return nearest[0]?.id||eligible.find(p=>p.id===me.killerId)?.id||humans[0]?.id||eligible[0]?.id||null;
}
export function matchOutcome(state,id){
 const p=state?.players?.find(p=>p.id===id);if(!state?.royale||!p)return null;
 const win=state.phase==='results'&&wonRoyale(state,id),dead=p.health<=0&&p.eliminatedAt!=null;
 if(!win&&!dead&&state.phase!=='results')return null;
 const killer=state.players.find(k=>k.id===p.killerId);
 return {win,dead,canCelebrate:win&&p.health>0&&!p.spectating&&!p.downed,place:win?1:p.place||0,kills:p.kills||0,crowned:!!p.crownedVictory,killer:killer?.name||'',weapon:p.recap?.weapon||'',damage:p.damageDealt||0,finished:state.phase==='results',spectator:!win&&!dead};
}
