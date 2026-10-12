// Keep the placeholder out of public identities without changing saved cosmetics.
export function needsPlayerName(name) {
  const key=String(name??'').normalize('NFKC').trim().toLowerCase();
  return !key || key==='player';
}
