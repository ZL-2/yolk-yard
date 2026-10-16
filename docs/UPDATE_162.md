# Update 162 — One Frontier

Version 5.14.1, protocol 57.

## Investigation

Render reported one instance, no server failures or restarts since October 14, and no application errors on October 16. The October 16 13:00–16:00 UTC samples peaked near 138 MB against a 512 MB allocation and below 0.07 CPU cores against 0.5 allocated. These observations do not prove the cause of every reported crash: the previous relay did not log host-removal or connection-rejection reasons. The public simulation runs in a browser, so a match can fail while Render remains healthy.

Three real-socket regressions were reproduced against published commit `a5d25a3` and pass with this update:

1. Six players, followed by the bus transition while the host uplink is congested, overflowed the shared 1.8 MB pending queue and destroyed the host transport. Snapshot admission now applies backpressure without destroying that socket, advances world/event cursors only after acceptance, and retains the latest checkpoint separately for every skipped recipient. UTF-8 batches split below the server's 2 MB message limit. An oversized reliable channel can close only that channel.
2. A brief guest-channel interruption immediately converted its contestant into a bot. The returning guest became a late spectator and lost the original inventory. Public hosts now reserve the same contestant for ten seconds, clear stale controls, and restore its connected state when its channel returns.
3. An eliminated player elected host restored survivors as temporarily disconnected. The next simulation tick treated the active match as empty and began a new round before they reconnected. Recovery now pauses for surviving humans to reconnect, with a bounded ten-second deadline.

Additional defects corrected:

- Host selection now requires a current-round recovery checkpoint, visible-tab readiness, and a recent readiness heartbeat. Uninitialized or frozen members cannot indefinitely block a synchronized successor.
- A cancelled initial host reservation releases immediately; capacity checks happen before reserving a host.
- A failed member of a queueing party no longer cancels already-playing public teammates, including a host serving other parties.
- The FRONTIER address is reserved across protocol versions, preventing old tabs from opening another version's public room.
- Cleanup checks the peer object as well as its ID, so delayed cleanup cannot delete a replacement session at the same public address.
- A migrated host that loses its canonical alias stops hosting rather than running an orphan simulation while trying to reacquire the address.
- Bounded lifecycle logs record host creation, transfer, removal reasons, and rejected public connections. No tokens, private credentials, or player profiles are logged.

The blue arrival banner, extra Join button, and CSS that hid the main match card have been removed. The existing unobtrusive arrival sound remains. The mobile party panel is positioned below the complete public card so it cannot obscure the Join button or its description. The banner used the same public-queue action; removing it alone would not have corrected the reproduced failures.

## Verification

- Real sockets: six concurrent queue requests create exactly one host; six-player blocked-uplink recovery; same-round reconnect with inventory; spectator-to-host handoff; party admission failure isolation; immediate cancellation/requeue; old-version room rejection.
- Regression coverage: host leases, stale peer cleanup, suspended candidates, transport frame sizes, delta baselines, action ordering, public round lifecycle, private parties, deployment completion, and the existing host migration/scoring/inventory scenario.
- Browser acceptance: one visible public card after arrival notifications, desktop/mobile lobby, actual browser-host admission, socket guest, and same-round guest reconnect.
- Production build and matching website/relay release verification.

Publication is authorized while matches are active. No waiting for an empty match and no hosting-plan changes.

References used to verify the browser and WebSocket behavior:
- https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- https://github.com/websockets/ws/blob/master/doc/ws.md
