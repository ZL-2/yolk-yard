export const ROYALE_PHASES=Object.freeze({WAITING:'waiting',ISLAND:'spawn-island',STARTING:'starting',BUS:'battle-bus',DROP:'drop',ACTIVE:'active',ENDING:'ending',FINISHED:'finished'});
export const isWarmup=stage=>['waiting','spawn-island','starting'].includes(stage);
export const acceptsContestants=stage=>isWarmup(stage);
// Sixteen contestants plus four observers fit the deployed relay's 20-peer limit.
export const MAX_SPECTATORS=4;
