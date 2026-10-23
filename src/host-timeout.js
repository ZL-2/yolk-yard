// The visible waiting state gets ten full seconds before the relay evicts a host.
export const HOST_WAIT_NOTICE_MS=1800;
export const HOST_WAIT_TRANSFER_MS=10000;
export const HOST_STALL_MS=HOST_WAIT_NOTICE_MS+HOST_WAIT_TRANSFER_MS;
export const HOST_TIMEOUT_REASON='Host unresponsive for 10 seconds';
export const HOST_TIMEOUT_MESSAGE='You were disconnected because your game stopped sending match updates for 10 seconds. Host duties were released so active players could continue; matches without another active player end. You can rejoin from the lobby.';
export const MATCH_ENDED_REASON='No active player available to host';
