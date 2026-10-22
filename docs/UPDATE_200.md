# Update 200 — Performance, presentation and multiplayer

Version 6.14.0 / protocol 72. Builds on the published Update 199 (1aa771f933c85bb2bd0817c6966b4ff905c65991). Stormspike, Kestrel, the flight station, halved ATV speeds, credits and announcement remain available.

## Changes

- Shared rendering responds to actual elapsed frame time, including slow frames longer than the simulation's capped dt. Sustained overload lowers render resolution within quality-specific limits; stable frames gradually restore it. Severe overload can suspend shadows until headroom returns. DOM text remains at native resolution. Simulation, input, snapshot and combat clocks are independent.
- Filmic tone mapping retains bright surface detail. A tighter, texel-quantized sun shadow volume follows the camera across the island. Shadows update at most 30 times per second (10 under pressure), and a scope and main view share that update. Scope draw calls now appear in render diagnostics.
- Spatial collision buckets now cover larger arena and Training maps, with the same exact narrow-phase hit tests. Campaign caches static bucket unions while reading current door activity, honors the saved frame cap and adapts resolution. The editor limits idle renders to 30 FPS while preserving camera and input updates.
- Team/ping markers reuse keyed elements and text nodes. HUD labels update only when text changes. Desktop settings have a category sidebar, wider controls and keyboard navigation. Existing preferences remain; new profiles show FPS and connection warnings while detailed network telemetry remains opt-in.
- Initial transient handshake failures retry within the existing connection deadline. Authenticated recovery uses capped exponential backoff with jitter and retains the existing 30-second deadline.
- Reliable commands use a bounded 32-command / 512 KiB in-flight window (one complete oversized baseline may exceed the byte window). Acknowledgements drain ordered pending work. Heartbeats and acknowledgements bypass congestion; queued snapshots still coalesce before delta encoding. No movement steps or action edges are dropped by coalescing.
- Snapshot resets invalidate world cursors as well as the encoder; authoritative matches can also request a fresh baseline. Connection startup rejects/cleans up once on timeout. Closed sockets no longer throw from send races.
- Remote presentation adapts its 60–160 ms buffer to arrival jitter. Sparse poses never blend through teleports, death/respawn or vehicle/seat changes. The existing shot timestamp follows that same visual sample; physics remains authoritative.
- Stalled authoritative sessions now show connection feedback, and active hosts no longer report stale guest snapshots as a network failure.

## Verification

Focused checks cover collision equivalence on every arena, moving world invalidation, render adaptation/recovery, shadow placement, jitter bounds, teleports, seat changes, real connection startup failure, 100 ordered actions under delayed acknowledgements, full-world baseline recovery, relay process restart and authenticated exactly-once replay, host transfer, snapshots and remote input. Existing campaign, model and weapon contracts are retained. The canvas/shader stub in the world preparation test was brought up to date with the existing flight station and shader preparation API.

The performance comparison runs identical workloads in isolated checkouts against Update 199 and writes `test-results/update-200/performance.json`. Desktop browser checks exercise FFA, Training, Box Fights, Zone Wars and Royale, categorized settings and marker node reuse; the campaign flow checks mission play and exit independently of a continuing multiplayer room. Production build and exact website/relay live verification remain release gates. No mobile work or mobile acceptance pass is included. Paused modes stay paused.

Local comparison on identical workloads (median microseconds per query):

| Workload | Update 199 | Update 200 | Reduction |
| --- | ---: | ---: | ---: |
| FFA ray + movement candidates | 1.09 µs | 0.50 µs | 54% |
| Team arena ray + movement candidates | 0.97 µs | 0.40 µs | 59% |
| Training ray + movement candidates | 1.82 µs | 1.47 µs | 19% |
| Campaign nearby collision union | 0.37 µs | 0.14 µs | 62% |

The large Royale, Box Fights and Zone Wars maps already used spatial buckets. Their recorded CPU query costs remain under the regression guard; this update’s rendering, HUD and transport changes apply there too.

CPU query timings are workload measurements, not a guarantee of device FPS or internet ping. The browser runner uses software graphics for correctness and screenshots; it is not a hardware performance benchmark. Dynamic resolution can soften the 3D image under heavy load, and a longer jitter buffer trades a little presentation latency for stability. Connection recovery cannot preserve a session after its existing deadline expires.
