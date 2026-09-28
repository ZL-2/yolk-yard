export const eggIcon='<svg class="eggs-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 22 7v10L12 23 2 17V7Z" fill="#f2b34c"/><path d="M6 16V8h3l3 4 3-4h3v8h-3v-4l-3 4-3-4v4Z" fill="#172d38"/></svg>';
export const formatEggs=value=>Math.max(0,Math.floor(value||0)).toLocaleString('en-US');
export const eggsMarkup=value=>`${eggIcon}<span><b data-eggs-balance>${formatEggs(value)}</b> <span class="currency-label">Marks</span></span>`;
