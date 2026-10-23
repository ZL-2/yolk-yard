// Calendar inputs always mean New York wall time, not the owner's device zone.
export function tournamentLocalTime(at){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
 const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function parseTournamentTime(value){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value||''))throw Error('Enter a complete New York date and time.');
 const naive=Date.parse(value+'Z');if(!Number.isFinite(naive))throw Error('Invalid date and time.');
 const matches=[4,5].map(offset=>naive+offset*3600000).filter(at=>tournamentLocalTime(at)===value);
 if(matches.length!==1)throw Error(matches.length?'This New York time occurs twice when daylight saving ends. Choose a time outside 1:00–1:59 a.m. that day.':'This date or New York time does not exist. Check the daylight-saving change.');
 return matches[0];
}
export const TOURNAMENT_RULE_FIELDS=['opensAt','lockAt','startsAt','capacity','spectators','prizes','pickaxe','duplicateReward'];
export function validateTournament(input,{id,code,now}){
 if(!input||typeof input!=='object')throw Error('Tournament details are required.');
 const text=(key,max,required=false)=>{if(typeof input[key]!=='string')throw Error('Invalid '+key);const v=input[key].replace(/[\u0000-\u001f]/g,' ').trim();if(v.length>max||required&&!v)throw Error('Check tournament '+key+' (maximum '+max+' characters).');return v;};
 const integer=(key,min,max)=>{const v=input[key];if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(`Check ${key}: enter a whole number from ${min} to ${max}.`);return v;};
 const name=text('name',80,true),description=text('description',1600),region=text('region',80,true);
 for(const k of ['opensAt','lockAt','startsAt'])integer(k,Date.UTC(2020,0,1),Date.UTC(2100,0,1));
 if(input.lockAt>input.opensAt||input.opensAt-input.lockAt>1800000)throw Error('Matchmaking must close 0–30 minutes before entry opens.');
 if(input.startsAt-input.opensAt<60000||input.startsAt-input.opensAt>1800000)throw Error('The entry window must last 1–30 minutes.');
 if(now!==undefined&&input.lockAt<=now+5000)throw Error('Schedule matchmaking closure at least five seconds in the future.');
 const capacity=integer('capacity',2,48),spectators=integer('spectators',0,16),duplicateReward=integer('duplicateReward',0,1000000);
 if(!Array.isArray(input.prizes)||input.prizes.length!==3||input.prizes.some(v=>!Number.isSafeInteger(v)||v<0||v>1000000))throw Error('Enter three podium prizes from 0 to 1,000,000 Marks.');
 if(input.pickaxe!==null&&input.pickaxe!=='pickaxe-frontier-champion')throw Error('Choose Frontier Champion or no pickaxe.');
 if(!input.pickaxe&&duplicateReward)throw Error('A repeat-winner bonus requires a pickaxe reward.');
 return {id,code,name,description,region,timeZone:'America/New_York',mode:'Solo Royale',opensAt:input.opensAt,lockAt:input.lockAt,startsAt:input.startsAt,capacity,spectators,prizes:[...input.prizes],pickaxe:input.pickaxe,duplicateReward};
}
