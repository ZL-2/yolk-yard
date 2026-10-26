// Health/construction ticks do not change world ownership. Keep exact recovery
// checkpoints for pickups and structural edits without copying the whole world
// again for every repair/damage tick.
export function checkpointWorldKey(state){
 const r=state.royale;if(!r)return null;
 return JSON.stringify([r.matchId,state.round,state.phase,state.boxfight?.stage,state.boxfight?.seriesWinner,state.players?.map(p=>[p.id,p.health>0,!!p.downed,p.kills,p.deaths]),state.options.map,r.lootVersion,(r.builds||[]).map(b=>[b.id,b.owner,b.revision,b.mask,b.path,b.doorOpen,b.rotation,b.x,b.y,b.z]),Object.keys(r.worldDamage||{}).filter(id=>r.worldDamage[id].destroyed),(r.doors||[])]);
}
export function actionFrameDue(sim,state){return !state||sim.eventId!==(state.events?.at(-1)?.id??0)||sim.buildVersion!==state.royale?.buildVersion&&!!state.royale;}

// Inventory acknowledgements may use the next 30 Hz slot. Keep idle/ordinary
// snapshots at their existing cadence and never flood sockets on every input.
export function responseFrameDue(sim,age,lastAge,lastVersion,interval=.05){
 const elapsed=age-lastAge+1e-8;
 return elapsed>=interval||elapsed>=1/30&&(sim.responseVersion||0)!==(lastVersion||0);
}
