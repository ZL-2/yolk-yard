export const mapVaults=map=>map.vaults|| (map.vault?[map.vault]:[]);
export const VAULT_AMMO_STOCK=Object.freeze({light:48,medium:60,shells:8,heavy:4,rockets:2});
export const VAULT_DOOR_SECONDS=2.4;
export function vaultDoorPose(door,state,time){const age=Math.max(0,time-(state?.changedAt??-100)),open=!!state?.open;if(!door.vault){const t=Math.min(1,age/.25),ease=t*t*(3-2*t);return {angle:Math.PI/2*(open?ease:1-ease),bolt:0,wheel:0};}const bolt=open?Math.min(1,age/.65):0,t=open?Math.max(0,Math.min(1,(age-.65)/(VAULT_DOOR_SECONDS-.65))):0;return {angle:Math.PI/2*t*t*(3-2*t),bolt,wheel:bolt*Math.PI*1.4};}
export function vaultState(state,id){return state.vaults?.find(v=>v.id===id)||(state.vault?.id===id?state.vault:null);}
export function vaultOpen(state,id){return !id||!!vaultState(state,id)?.open;}
