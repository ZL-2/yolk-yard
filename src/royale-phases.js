export const ROYALE_PHASES=Object.freeze({WAITING:'waiting',ISLAND:'spawn-island',STARTING:'starting',BUS:'battle-bus',DROP:'drop',ACTIVE:'active',ENDING:'ending',FINISHED:'finished'});
export const isWarmup=stage=>['waiting','spawn-island','starting'].includes(stage);
export const acceptsContestants=stage=>isWarmup(stage);
// Bots are simulated by the host; only humans consume relay connections.
export const MAX_CONTESTANTS=32,MAX_HUMANS=16,WARMUP_SECONDS=60;
export const OFFLINE_WARMUP_SECONDS=10;
export const MAX_SPECTATORS=4;
