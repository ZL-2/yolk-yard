// Counts are unique connected people, never bots, match capacity or spectators.
export function modePopulation(id,counts){
 if(['box-fights','zone-wars'].includes(id))return 0;
 const n=counts?.[id];return Number.isFinite(n)&&n>=0?Math.floor(n):null;
}
export function modePopulationMarkup(id,counts){
 const count=modePopulation(id,counts),label=count===null?'Player count unavailable':`${count} ${count===1?'player':'players'} playing${id==='training'?' while connected':''}`;
 return `<span class="mode-population" data-mode-population="${id}" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3z"/></svg><b>${count===null?'—':count.toLocaleString('en-US')}</b><span>PLAYING</span></span>`;
}
