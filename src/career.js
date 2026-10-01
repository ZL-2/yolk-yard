const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
export const CAREER_MODES={all:'All deployments',royale:'Frontier Royale',ffa:'Free For All'};
export const CAREER_MODE_LABELS={...CAREER_MODES,teams:'Team Scramble (retired)'};
export const CAREER_GRADES=[{name:'Recruit',score:0},{name:'Scout',score:1000},{name:'Operator',score:3500},{name:'Specialist',score:8000},{name:'Vanguard',score:16000},{name:'Commander',score:30000}];
export function recordCareerReceipt(stats,receipt){
 if(!receipt?.eligible||typeof receipt.id!=='string'||stats.careerReceiptIds?.includes(receipt.id))return stats;
 const mode=Object.hasOwn(CAREER_MODE_LABELS,receipt.mode)&&receipt.mode!=='all'?receipt.mode:'ffa';
 const next={...stats,matches:count(stats.matches)+1,kills:count(stats.kills)+count(receipt.kills),wins:count(stats.wins)+Number(!!receipt.won),assists:count(stats.assists)+count(receipt.assists),modes:{...stats.modes}};
 const old=next.modes[mode]||{},placements=Array.isArray(old.placements)?old.placements:[];
 next.modes[mode]={...old,matches:count(old.matches)+1,kills:count(old.kills)+count(receipt.kills),wins:count(old.wins)+Number(!!receipt.won),assists:count(old.assists)+count(receipt.assists),placements:mode==='royale'&&count(receipt.place)>0?[...placements,count(receipt.place)].slice(-100):placements};
 if(mode==='royale'){
  const records=[old.bestPlacement,...placements,receipt.place].filter(n=>Number.isFinite(n)&&n>0);
  next.modes[mode].bestPlacement=records.length?Math.min(...records):null;
 }
 next.careerReceiptIds=[...(stats.careerReceiptIds||[]),receipt.id].slice(-200);
 next.history=[{id:receipt.id,mode,time:count(receipt.time),kills:count(receipt.kills),assists:count(receipt.assists),won:!!receipt.won,place:count(receipt.place),marks:count(receipt.amount),custom:!!receipt.custom},...(Array.isArray(stats.history)?stats.history:[])].slice(0,50);
 return next;
}
export function careerSummary(stats={},wallet={},selected='all'){
 const source=selected==='all'?stats:stats.modes?.[selected]||{},matches=count(source.matches),kills=count(source.kills),wins=count(source.wins),assists=count(source.assists);
 const score=count(stats.matches)*100+count(stats.kills)*20+count(stats.assists)*10+count(stats.wins)*200;
 const grade=CAREER_GRADES.findLast(g=>score>=g.score)||CAREER_GRADES[0],next=CAREER_GRADES[CAREER_GRADES.indexOf(grade)+1];
 const placements=[stats.modes?.royale?.bestPlacement,...(Array.isArray(stats.modes?.royale?.placements)?stats.modes.royale.placements:[])].filter(n=>Number.isFinite(n)&&n>0);
 const history=(Array.isArray(stats.history)?stats.history:[]).filter(r=>selected==='all'||r.mode===selected);
 const milestones=[['First victory','Win a verified match',count(stats.wins),1],['Field regular','Complete 25 verified matches',count(stats.matches),25],['Century','Earn 100 eliminations',count(stats.kills),100],['Team player','Earn 50 assists',count(stats.assists),50],['Veteran','Complete 100 verified matches',count(stats.matches),100],['Frontier collection','Own 10 cosmetic items',wallet.owned?.length||0,10]].map(([name,description,current,target])=>({name,description,current,target,complete:current>=target,percent:Math.min(100,current/target*100)}));
 return {selected,matches,kills,wins,assists,winRate:matches?Math.min(100,wins/matches*100):0,perMatch:matches?kills/matches:0,score,grade:grade.name,nextGrade:next?.name,needed:next?next.score-score:0,progress:next?(score-grade.score)/(next.score-grade.score)*100:100,best:placements.length?Math.min(...placements):null,history,milestones,owned:wallet.owned?.length||0,received:count(wallet.earned)};
}
