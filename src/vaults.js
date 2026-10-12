export const mapVaults=map=>map.vaults|| (map.vault?[map.vault]:[]);
export const VAULT_AMMO_STOCK=Object.freeze({light:48,medium:60,shells:8,heavy:4,rockets:2});
export function vaultState(state,id){return state.vaults?.find(v=>v.id===id)||(state.vault?.id===id?state.vault:null);}
export function vaultOpen(state,id){return !id||!!vaultState(state,id)?.open;}
