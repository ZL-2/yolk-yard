const labels={offline:'Offline',away:'Away',online:'Online',lobby:'In Lobby','in-party':'In Party',matchmaking:'Finding Match','in-match':'In Match',spectating:'Spectating',reconnecting:'Reconnecting'};
const paths={offline:'M5 5l14 14M12 3a9 9 0 1 0 9 9',away:'M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z',lobby:'M4 10l8-7 8 7v10h-6v-7h-4v7H4Z','in-party':'M8 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 1a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 20v-4a5 5 0 0 1 10 0v4m1-7a4 4 0 0 1 7 3v4',matchmaking:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6','in-match':'m14 2-9 12h6l-1 8 9-12h-6Z',spectating:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',online:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z',reconnecting:'M20 7a9 9 0 0 0-16 5m0 5a9 9 0 0 0 16-5M20 2v5h-5M4 22v-5h5'};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const presenceLabel=s=>labels[s]||'Offline';
export function presenceMarkup(status,detail=''){
 const state=Object.hasOwn(labels,status)?status:'offline';
 return `<span class="presence-badge" data-presence="${state}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[state]}"/></svg><span>${labels[state]}</span></span>${detail?`<span class="presence-detail">${escape(detail)}</span>`:''}`;
}
