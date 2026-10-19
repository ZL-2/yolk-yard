# Update 189 — match connection recovery

Version 6.7.2, game protocol 69 (compatible with the preceding release).

The reported October 19 14:55 UTC disconnect coincides with a relay shutdown during deployment. Separate live logs show an elected public host repeatedly publishing an invalid first state, then replaying that same rejected command on every reconnect.

Changes:
- A desktop run reproduced the relay evicting a live host during slow map rendering with a guest present. Host removal now depends on transport liveness or explicit leave, not a 15-second simulation stall. The original host retains its room while rendering catches up; real disconnects still elect a successor.
- Restore the host's network snapshot synchronously from its simulation checkpoint before publishing. Do not publish an empty public room or a lobby phase over an active lease.
- A rejected public listing preserves the last valid listing and acknowledges the consumed command. It cannot poison the reliable action stream or disconnect every guest.
- Reconnect completion requires replay acknowledgements and a live transport reply. Merely accepting registration no longer resets the failure deadline. Expired credentials and irrecoverable command errors end once.
- Graceful relay shutdown saves authenticated browser-hosted sessions, delivery cursors, unacknowledged messages, links, public leases, party membership and progression tracking to the existing persistent disk. Startup consumes the compatible, unexpired checkpoint before accepting connections. The browser keeps its simulation and snapshot codecs.
- Recovery files use restricted permissions and never enter HTTP routes or logs. Invalid credentials remain invalid after restoration. Stale or incompatible recovery files do not resurrect rooms. Server-owned Zombies simulations are not included in this browser-hosted recovery format.
- Support reports retain the transport close reason and last ping before UI cleanup.

The first rollout from the previous relay cannot restore sessions that the previous code never saved. Subsequent compatible graceful restarts can resume within the existing 30-second client / 35-second server recovery window. This does not claim recovery from process crashes without a shutdown checkpoint, closed browser tabs, or longer outages.

Validation: targeted real WebSocket tests exercise checkpoint-only host election, a rejected listing followed by valid gameplay, full relay replacement during an active Battle Royale round, authenticated resume, exactly-once action replay, expired checkpoint rejection, and bounded failed recovery. The desktop acceptance script exercises the actual spawn-island-to-battle-map render path, replaces the relay under a connected browser host and guest, verifies the same round resumes, then finishes and returns to the lobby. No mobile checks are included in this release scope.
