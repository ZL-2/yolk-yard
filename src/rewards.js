// Original Ravelfront economy. Pure policy shared with the relay's tests and UI.
// Only the relay settles matches; no client timer or elimination pays currency.
export const BOT_REWARD_WEIGHT=Object.freeze({1:.10,2:.25,3:.45,4:.65});
export const REWARD_POLICY=Object.freeze({minimumSeconds:90,minimumActive:45,hourCap:900,customCoefficient:.55,maximum:600});
export const opponentWeight=p=>p.bot?(BOT_REWARD_WEIGHT[p.difficulty]||.1):p.familiarity>=6?.1:p.familiarity>=3?.4:1;
export function participation(p){return !p.afkRemoved&&p.active>=45&&(p.distance>=65||p.damage>=70||p.contributions>=5)&&p.active>=Math.min(90,p.elapsed*.12);}
export function calculateReward({player,opponents,elapsed,custom=true,mode='royale',place=0,won=false,eliminations=[],assists=0,hourEarned=0}){
 const eligible=elapsed>=90&&participation({...player,elapsed:player.elapsed??elapsed});
 if(!eligible)return {amount:0,eligible:false,reason:player.afkRemoved?'Removed for inactivity':elapsed<90?'Match too short':'Meaningful participation required'};
 const valid=opponents.filter(p=>p.bot||participation({...p,elapsed:p.elapsed??elapsed}));
 if(!valid.length)return {amount:0,eligible:false,reason:'No qualifying opponents'};
 const population=Math.min(32,valid.length+1),challenge=valid.reduce((n,p)=>n+opponentWeight(p),0)/valid.length;
 const scale=1+.48*Math.log2(population),finish=mode==='royale'?(won?100:22+48*Math.pow(Math.max(0,1-(Math.max(2,place)-1)/population),2)):(won?80:35);
 const combat=eliminations.slice(0,15).reduce((n,e)=>n+14*opponentWeight(e)*(e.repeat===undefined?1:e.repeat<2?1:e.repeat<4?.2:0),0)+Math.min(5,assists)*4;
 const engagement=Math.min(1,player.active/120);
 const amount=Math.max(0,Math.min(REWARD_POLICY.maximum,REWARD_POLICY.hourCap-hourEarned,Math.round((finish*scale*challenge+combat)*(.65+.35*engagement)*(custom?.55:1))));
 return {amount,eligible:true,reason:amount?'Match verified':'Hourly reward limit reached',population,challenge:Number(challenge.toFixed(3)),scale:Number(scale.toFixed(3)),custom};
}
// Bounded participation evidence from the elected public host or legacy server
// simulation. The relay settles rewards without accepting wallet balances.
export function rewardFrame(state,localId,input){return {round:state.round,phase:state.phase,time:state.time,matchId:state.royale?.matchId||String(state.round),stage:state.royale?.stage,mode:state.options.mode,difficulty:state.options.difficulty,teamSize:state.options.teamSize,scores:state.scores,winner:state.winner,winnerId:state.royale?.winnerId,winnerTeam:state.royale?.winnerTeam,hostId:localId,input:{yaw:input.yaw,pitch:input.pitch},players:state.players.filter(p=>!p.boss).map(p=>Object.fromEntries(['id','name','bot','team','x','y','z','health','spectating','awaitingEntry','flight','contestant','lateSpectator','afkRemoved','place','kills','assists','deaths','points'].map(k=>[k,p[k]]))),events:state.events.filter(e=>['hit','elimination','revived','build-place','harvest','pickup','royale-cue','shot','launch','afk-removed','build-result','inventory-change'].includes(e.type)).slice(-150).map(e=>Object.fromEntries(['id','type','player','target','amount','cue','weapon','buildId','ok','changed','x','z'].map(k=>[k,e[k]])))};}
