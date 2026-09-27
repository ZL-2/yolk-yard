export const eggIcon='<svg class="eggs-icon" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1C7 1 2 12 2 18a10 10 0 0 0 20 0C22 12 17 1 12 1Z" fill="#fff6db" stroke="#81592c" stroke-width="1.5"/><ellipse cx="12" cy="18" rx="5.5" ry="5" fill="#f5ba34"/><path d="M6 14c.5-3 2-6 3-7" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
export const formatEggs=value=>Math.max(0,Math.floor(value||0)).toLocaleString('en-US');
export const eggsMarkup=value=>`${eggIcon}<span>Eggs: <b data-eggs-balance>${formatEggs(value)}</b></span>`;
