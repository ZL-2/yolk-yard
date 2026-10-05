export const mapVaults=map=>map.vaults|| (map.vault?[map.vault]:[]);
export function vaultState(state,id){return state.vaults?.find(v=>v.id===id)||(state.vault?.id===id?state.vault:null);}
export function vaultOpen(state,id){return !id||!!vaultState(state,id)?.open;}
