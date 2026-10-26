# Smoother matches and responsive actions — 6.33.0 / protocol 88

This update covers server-authoritative Cups and player-hosted matches. Server transport and replay persistence changes apply to the relay; collision, rendering, action presentation and fair-play scheduling also cover player hosts and guests.

## Changes

- Predict reload, pickaxe and item-use presentation and sound, reconcile acknowledgements, suppress duplicate sound, cancel rejected actions, and retain authoritative resources and outcomes. Equip and pickup prediction from 6.31 remain intact.
- Patch changed build collision buckets, recycle index slots, preserve static solids, and handle edits, destruction, doors, growth and remote world updates without rebuilding the full index.
- Yield during terrain/environment/architecture texture construction and limit geometry batches. Map transitions adopt completed preparation or continue it asynchronously. Crowd construction is limited to two detailed models per update; inexpensive silhouettes keep pending opponents visible. Streamed retirement/cancellation releases geometry.
- Use asynchronous GPU timer queries for resolution decisions. CPU stalls preserve resolution; unsupported timers use a small reversible probe that is rolled back if frame time does not improve.
- Spread fair-play pair evaluation across ticks at one captured sampling instant. The evidence rule is unchanged. Replay serialization, compression and disk writes use an ordered, bounded worker, with readable pending chunks, explicit storage errors, retained evidence and shutdown draining.
- Keep server Cups at 20 Hz regardless of spectators or the old 32-member threshold. Share opponent baselines and restore lossless owner/watched rows before gameplay consumes the state. Cumulative transport receipts are coalesced without delaying command execution. Protocol 88 prevents incompatible clients joining.

## Local validation

The complete test run initially passed 1,213 tests and exposed 27 failures. Comparison against the exact preceding release reproduced all unrelated failures (25 baseline failures, including a timing-dependent case); the three change-related failures were corrected by preserving the legacy snapshot contract and testing asynchronous map completion. All 212 focused release regression checks pass, covering the modified behavior, authority, resumption, collision, evidence, loading, Icon voting and rendering.

Same-machine isolated measurements, 48 actors and the normal 600-build cap:

| Work | Before median / p95 | After median / p95 |
| --- | --- | --- |
| Host collision edit + first query | 5.53 / 11.00 ms | 0.90 / 1.33 ms |
| Guest collision update + first query | 5.82 / 11.26 ms | 0.85 / 1.22 ms |
| Fair-play work per uninterrupted slice | 6.27 / 10.06 ms | 0.34 / 0.63 ms |
| Replay capture/flush on main thread | 1.61 / 9.24 ms | 0.15 / 2.45 ms |

Cold map construction's largest generator step fell from the investigation's 165 ms to 6.7–10.5 ms in follow-up browser runs. Streaming detail can still have occasional longer allocation/GC steps; these are measured rather than described as zero stalls.

A real Cup browser test withholds decoded authority updates and exercises weapon switching, movement, pickup, reload, pickaxe and item use. All respond before acknowledgement, with no speculative inventory or healing. Sustained WebGL rendering exercises 47 visible opponents over 60 rendered frames, checks bounded construction and complete models, and produces a screenshot. The software GPU in this environment is very slow; its FPS is not a school-Mac performance claim.

The 11-player plus 3-spectator socket test under an approximate 50 ms / 100 ms server CPU quota delivered 400 player updates in 20 seconds, simulated 20.02 seconds, used 226 CPU ms/second, and measured event-loop p95 7.44 ms / max 44.11 ms. The test clients run in separate processes outside that quota.

The 48-player plus 3-spectator test with six client processes delivered 295–300 updates in 15 seconds and kept simulation time current. It used approximately 992 CPU ms/second on this machine. **A continuously firing 48-player Cup does not fit a half-core budget here.** No paid plan change was made, no player cap was silently reduced, and no claim of universally freeze-free performance is made. Host hardware, browser/GPU load and network conditions remain relevant.

Reproduce with `scripts/frame-stalls-performance.mjs`, `scripts/frame-stalls-browser-check.mjs`, `scripts/input-response-browser-check.mjs`, and `PERFORMANCE_CLIENT_SHARDS=6 node scripts/tournament-realtime-profile.mjs . 48 <tag>`. `scripts/cpu-quota-check.py` approximates a per-process Linux CPU quota for local stress tests; it is not a production host measurement.
