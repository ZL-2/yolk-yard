# Update 204 — Human combat performance

Version 6.16.0 / protocol 76. Desktop combat and multiplayer work; no mobile changes or new assets/dependencies.

The reported human-only firefight stalls reproduced in the real lag-compensated hitscan path. `shotPose` spread the entire player record for each target, twice per pellet. The first CPU profile attributed about 2.7 seconds to that method in a 48-human replay. Bot-only benchmarks do not exercise that path. Each accepted trigger now shares compact, historical collision poses across its sight/muzzle tests and pellets. A conservative sphere rejects clear misses before anatomical ellipsoid work. Effective historical lean includes grounded/vehicle restrictions.

Royale opponent rows omit private prediction bookkeeping and round display positions to one millimetre and angles to 0.0001 radians. Owners and watched players retain exact prediction state. Health, inventory, damage, events and full migration checkpoints remain immediate and exact. Shared normalized rows, patches and serialized record boundaries reduce repeated work. Relay enqueue no longer serializes a room inside the input/render callback: encoding yields between complete messages after a four-millisecond work budget. Large individual frames can exceed that budget; ordering, event merging, per-channel baselines, byte limits, backpressure and prepared-command reconnect replay remain intact.

Game WebSockets negotiate low-level native compression with a 2 KiB threshold, no context takeover and bounded server concurrency. Voice remains on its separate transport. Compression is handled by the browser networking implementation rather than a main-thread JavaScript compressor. The connection panel's sent-byte counter still reports logical application bytes; the socket experiment measures actual TCP bytes separately.

Impact sparks, marks and explosion debris use three persistent, bounded instanced batches. Cosmetic overload replaces decorations, never simulation hits. Effects far from the camera are culled, incoming tracer segments crossing the view are preserved, and scopes extend the effect radius. Muzzle flashes reuse their geometry/material. Damage changes upload only affected GPU attribute ranges. Buildings outside the existing display range defer geometry/material construction until approached, then show their current damage/edit state.

## Reproducible evidence

`COMBAT_BASELINE=../baseline-203 node scripts/update-204-performance.mjs` compares commit `0085b257a5f75251772762b4a17019367427a82c` with this source in separate processes. Both run 180 ticks of all-human Royale combat with sanitized remote inputs, SMGs/Stormspikes, builds, recipient snapshots and checkpoints. The 12- and 48-human outcomes match exactly: damage, positions, shots, events and destroyed world/build state. Ten thousand seeded rays also preserve the baseline's anatomical contacts across lean, crouch, slide, downed and flight poses.

One local final run:

| Measurement | Update 203 | Update 204 |
| --- | ---: | ---: |
| 48-human simulation tick, p95 | 192.91 ms | 21.15 ms |
| Accepted shot CPU, p95 | 5.13 ms | 0.21 ms |
| Complete 48-human replay CPU workload | 7.93 s | 3.79 s |
| Application payload across all recipients | 292.97 MB | 165.67 MB |
| 120 simultaneous impacts, actual draw calls | 960 | 3 |
| Meshes allocated by 120 distant impacts | 840 | 0 |

The 12-human replay fell from 1.25 to 1.01 seconds overall; its small-sample broadcast p95 was higher (14.51 to 22.39 ms), while simulation p95 fell from 15.67 to 3.75 ms. The production transport yields encoding work rather than synchronously running the benchmark's entire recipient loop. These are CPU workload and draw-call measurements, not a promised device FPS gain.

`node scripts/update-204-network-check.mjs` connects eight real WebSocket clients, exchanges combat inputs at 60 Hz, verifies damage and owner prediction, then forcibly reconnects a guest. The local final run transmitted 705,867 host TCP bytes for 5,816,272 logical bytes (88% smaller), preserved combat after recovery, and recorded a 19.77 ms p95 simulation interval. This measures a local relay, not Internet latency or hosting-tier capacity.

Validation: 52 focused gameplay/transport/render contracts, the deterministic baseline comparison, the eight-client combat/reconnect check, production build, desktop WebGL shader/draw-call checks and the published website/relay gate. Browser rendering uses software graphics for correctness and draw-call evidence; it is not representative of a player's GPU. CI stores JSON reports, CPU profiles and desktop screenshots in the Update 204 artifacts. No unrelated mobile or full-game sweep is required for this file-scoped release.
