export function celebrationWinners(state){
 if(!state)return [];
 const players=state.players instanceof Map?[...state.players.values()]:state.players||[];
 const box=state.boxfight||(state.boxStage?{stage:state.boxStage,winner:state.roundWinner,seriesWinner:state.seriesWinner}:null);
 if(box){
  if(state.phase!=='results'&&box.stage!=='intermission')return [];
  const winner=state.phase==='results'?box.seriesWinner:box.winner;if(winner==null)return [];
  return players.filter(p=>p.contestant&&!p.friendSpectator&&(state.options.boxFormat==='ffa'?p.id===winner:p.team===winner));
 }
 if(state.zombies||state.zStage){const extracted=state.zombies?.outcome==='extracted'||state.zOutcome==='extracted';return players.filter(p=>!p.friendSpectator&&(p.zExtracted||state.phase==='results'&&extracted&&p.health>0));}
 if(state.phase!=='results')return [];
 if(state.royale||state.options?.mode==='royale'){
  const r=state.royale||state;return players.filter(p=>p.contestant!==false&&!p.friendSpectator&&(p.id===r.winnerId||r.winnerTeam>=0&&p.team===r.winnerTeam));
 }
 if(['teams','coop'].includes(state.options?.mode)&&state.scores?.[0]!==state.scores?.[1]){const team=state.scores[0]>state.scores[1]?0:1;return players.filter(p=>p.team===team&&!p.friendSpectator);}
 const contenders=players.filter(p=>!p.friendSpectator&&!p.awaitingEntry),best=Math.max(...contenders.map(p=>p.kills||0));
 const top=contenders.filter(p=>(p.kills||0)===best);return top.length===1?top:[];
}
export const canCelebrate=(state,p)=>!!p&&celebrationWinners(state).some(w=>w.id===p.id);
export function celebrationTarget(state,id){const winners=celebrationWinners(state);if((state?.zombies||state?.zStage)&&state.phase!=='results')return winners.find(p=>p.id===id)?.id||null;return winners.find(p=>p.id===id)?.id||winners.find(p=>p.health>0&&!p.spectating)?.id||winners[0]?.id||null;}
