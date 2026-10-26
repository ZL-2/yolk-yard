export const TOURNAMENT_CARD_LEAD_MS=2*60*60*1000;
export const tournamentTeamSize=e=>[1,2,3,4].includes(e?.teamSize)?e.teamSize:1;
export const tournamentModeLabel=e=>['Solos','Duos','Trios','Squads'][tournamentTeamSize(e)-1];
export const tournamentBaseName=name=>String(name||'Frontier Cup').replace(/\s*[-–—]\s*(Solos?|Duos?|Trios?|Squads?)\s*$/i,'').trim();
export const tournamentName=e=>`${tournamentBaseName(e?.name)} - ${tournamentModeLabel(e)}`;
export const tournamentMode=e=>tournamentModeLabel(e)+' Royale';
// Dated, non-recurring events. The relay owns admission and reward decisions.
const event=(id,opens,code,duplicateReward=0)=>Object.freeze({id,code,name:'Frontier Cup',teamSize:1,mode:'Solos Royale',region:'NA · New York',timeZone:'America/New_York',opensAt:Date.parse(opens),lockAt:Date.parse(opens)-180000,startsAt:Date.parse(opens)+60000,capacity:48,spectators:16,prizes:[5000,2500,1000],pickaxe:'pickaxe-frontier-champion',duplicateReward});
export const TOURNAMENTS=Object.freeze([
 event('frontier-cup-2026-10-23','2026-10-23T12:10:00-04:00','RAVELCUP'),
 event('frontier-cup-2026-10-26','2026-10-26T12:00:00-04:00','CUPOCT26',10000)
]);
export const TOURNAMENT=TOURNAMENTS[0];
export const TOURNAMENT_PICKAXE=Object.freeze({id:TOURNAMENT.pickaxe,slot:'pickaxe',name:'Frontier Champion',set:'frontier-cup',tier:'legendary',price:0,color:'#152337',accent:'#ffd477',shape:1,tournamentReward:true,description:'The exclusive Frontier Cup winner’s trophy pickaxe. Gilded victory wings, a crystal crown and an obsidian grip. Awarded only to the tournament champion; never sold. Standard pickaxe reach, speed and damage.'});
export const tournamentPhase=(now,state,event=TOURNAMENT)=>['finished','cancelled'].includes(state?.phase)?state.phase:state?.phase==='running'?'running':now<event.lockAt?'scheduled':now<event.opensAt?'preparing':now<event.startsAt?'entry':'starting';
export const eventTime=(at,options={})=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',...options}).format(at);
export const eventDate=(at,options={})=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',...options}).format(at);
export const eventAnnouncement=e=>`${tournamentName(e)} is starting. Other matches are closed. Join in the lobby from ${eventTime(e.opensAt)}–${eventTime(e.startsAt)} New York time, or spectate once the match starts.`;
export const tournamentMessage=eventAnnouncement(TOURNAMENT);
export const tournamentEvents=s=>s?.events||(s?.id?[s]:TOURNAMENTS.map(e=>({...e,phase:'unavailable',results:[]})));
export function visibleTournament(events,now){return events.find(e=>['preparing','entry','starting','running'].includes(e.phase))||events.filter(e=>['finished','cancelled'].includes(e.phase)&&e.endedAt&&now<e.endedAt+7200000).sort((a,b)=>b.endedAt-a.endedAt)[0]||events.find(e=>e.phase==='scheduled'&&now>=e.opensAt-TOURNAMENT_CARD_LEAD_MS&&now<e.startsAt)||null;}
export function placementReward(e,r){const marks=Number(r.marks)||0,tool=Object.hasOwn(r,'pickaxeAwarded')?r.pickaxeAwarded:(r.place===1&&!r.bonusMarks&&e.pickaxe);return `${marks.toLocaleString('en-US')} Marks${tool?' + Frontier Champion':''}${r.bonusMarks?' (includes '+r.bonusMarks.toLocaleString('en-US')+' repeat-winner bonus)':''}`;}
