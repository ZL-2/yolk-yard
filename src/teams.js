// Parties are lobby groups; team numbers belong only to a match.
export const isDuos=options=>options?.mode==='royale'&&options.teamSize===2;
export const teamMode=options=>options?.mode==='teams'||isDuos(options);
export const teammates=(options,a,b)=>!!(a&&b&&a.id!==b.id&&teamMode(options)&&a.team>=0&&a.team===b.team);
export const teamKey=(options,p)=>isDuos(options)?p.team:p.id;
export const livingTeams=(options,players)=>new Set([...players].filter(p=>p.contestant&&p.health>0&&!p.spectating).map(p=>teamKey(options,p)));
export const wonRoyale=(state,id)=>!!state?.royale&&(state.royale.winnerId===id||isDuos(state.options)&&state.royale.winnerTeam>=0&&state.players.find(p=>p.id===id&&p.contestant)?.team===state.royale.winnerTeam);
