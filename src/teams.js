// Parties are lobby groups; team numbers belong only to a match.
export const isDuos=options=>options?.mode==='royale'&&options.teamSize===2;
export const isTeamRoyale=options=>options?.mode==='royale'&&[2,4].includes(options.teamSize);
export const teamMode=options=>options?.mode==='teams'||isTeamRoyale(options);
export const teammates=(options,a,b)=>!!(a&&b&&a.id!==b.id&&teamMode(options)&&a.team>=0&&a.team===b.team);
export const teamKey=(options,p)=>isTeamRoyale(options)?p.team:p.id;
export const livingTeams=(options,players)=>new Set([...players].filter(p=>p.contestant&&p.health>0&&!p.spectating).map(p=>teamKey(options,p)));
export const wonRoyale=(state,id)=>!!state?.royale&&(state.royale.winnerId===id||isTeamRoyale(state.options)&&state.royale.winnerTeam>=0&&state.players.find(p=>p.id===id&&p.contestant)?.team===state.royale.winnerTeam);
export const TEAM_COLORS=['#7dddf4','#c5a1ff','#ffd27b','#89e3a4'];
export const teamStyle=(players,p)=>{const index=players.filter(o=>o.contestant&&o.team===p.team).sort((a,b)=>(a.teamSlot??99)-(b.teamSlot??99)||a.id.localeCompare(b.id)).findIndex(o=>o.id===p.id);const slot=p.teamSlot??Math.max(0,index);return {slot:slot+1,color:TEAM_COLORS[slot%4]};};
