// The server retains the authenticated session slightly longer than the client
// retries, so a brief outage cannot race room cleanup and lose its match state.
export const RELAY_RECONNECT_MS=30000;
export const RELAY_SESSION_GRACE_MS=RELAY_RECONNECT_MS+5000;
export const RELAY_CONNECT_MS=12000;
// Fast first retry; capped, jittered retries avoid a room-wide reconnect burst.
export function relayRetryDelay(attempt,random=Math.random){
 return Math.round(Math.min(4000,250*2**Math.min(4,Math.max(0,attempt)))*(.8+.4*random()));
}
