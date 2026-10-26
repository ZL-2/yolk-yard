// The visible waiting state gets ten full seconds before the relay transfers host duties.
export const HOST_WAIT_NOTICE_MS=1800;
export const HOST_WAIT_TRANSFER_MS=10000;
export const HOST_STALL_MS=HOST_WAIT_NOTICE_MS+HOST_WAIT_TRANSFER_MS;
export const HOST_TIMEOUT_REASON='Host unresponsive for 10 seconds';
export const HOST_TIMEOUT_MESSAGE='Your game stopped sending match updates and could not recover its connection. Host duties were released so active players could continue; matches without another active player end. You can rejoin from the lobby.';
export const MATCH_ENDED_REASON='No active player available to host';

export const HOST_RECOVERY_MS=30000;
