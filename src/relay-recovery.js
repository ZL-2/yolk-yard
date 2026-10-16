// The server retains the authenticated session slightly longer than the client
// retries, so a brief outage cannot race room cleanup and lose its match state.
export const RELAY_RECONNECT_MS=30000;
export const RELAY_SESSION_GRACE_MS=RELAY_RECONNECT_MS+5000;
