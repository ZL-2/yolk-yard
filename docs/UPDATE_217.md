# Update 217 — smoother combat and tournament delivery

Version 6.25.0 / protocol 85. The development identifier is 217; the in-game Quality Update number is assigned sequentially from published history and may differ. Baseline: deployed Update 216, commit `2c16f3b21909290cdd20934730be8ef88660cb89`.

## What changed

- The Render authority yields between snapshot recipients, targeting 2 ms of work per slice. It retains one active broadcast and one request for fresh state rather than building an unbounded backlog. Inputs and the 60 Hz simulation can run between slices. Competitors retain 20 Hz snapshots; tournament spectators retain 10 Hz. Backpressure, ordered baselines, private team markers and event cursors remain per recipient. A round/map change aborts stale work.
- Building snapshots retain the same immutable rows for unchanged structures; damaging one object no longer regenerates every build's row. Door snapshots are detached, frozen and reused until changed. Vault processing scans vault doors only, and environmental damage checks indexed authored-object membership. Destroyed scenery is removed from affected collision buckets without rebuilding the entire island index; building changes still rebuild normally. Terrain-anchored structures skip unnecessary support queries.
- Snapshot comparison skips unchanged scalar fields without allocating empty patches. Shared normalization and comparison memos are bounded to one broadcast and released with it. Opponents no longer receive HUD-only data such as reserve ammo, materials or personal field records. The owner and currently watched player retain exact full state.
- Gameplay now passes the actual view distance to humanoid LOD selection. Animation updates are staggered at distance, with one scheduler instead of two. Magnification increases the effective detail range. The authored eleven models and physical hitboxes are unchanged.
- Distant held guns use shared baked geometry in one draw call, including their wrap. Near/aimed weapons retain the articulated model. IK uses reusable scratch math. Both operator detail levels load under the loading screen; redundant LOD texture resources are released.
- Damage feedback uses one glyph atlas and one instanced draw. It retains white health damage, cyan shield damage, critical feedback, pellet aggregation, pop/fade animation and depth testing. Capacity is bounded to 64 numbers / 1,536 glyphs; bursts reuse storage instead of repeatedly uploading canvases.
- Remote presentation can bridge a missing packet for at most 75 ms and 0.75 m. It does not extrapolate through death, teleport, passenger or traversal transitions. Own prediction and authoritative hit regions are unchanged.

## Evidence

Friday, October 23: Render's one-minute CPU metric reached the service's full **0.5-core allocation at 16:13 UTC / 12:13 p.m. EDT**. Memory peaked around 317 MB in the observed Cup window, below the 537 MB limit. These metrics show CPU pressure but cannot resolve individual subsecond stalls. The plan was not changed.

Tests ran locally on Node 24; the environment exposes an eight-core CPU quota. The real WebSocket clients ran in a separate process so their decoding was excluded from server CPU. No production identity, competitive entrant or reward was created.

| Measurement | Update 216 | Update 217 |
| --- | ---: | ---: |
| 11-client combat + 3 spectators, server CPU ms per wall second | 459.4–726.9 | 335.2–350.6 |
| Same network fixture, event-loop delay p99 | 25.85–60.92 ms | 10.98–15.73 ms |
| Same 12-second network fixture, largest observed event-loop delay | 294.39 ms | 30.59 ms |
| Deterministic 20-second combat, CPU ms per simulated second | 247.4 | 212.1 |
| Deterministic combat, total snapshot work | 2,667 ms | 2,282 ms |
| Deterministic combat, world-damage processing | 242.7 ms | 75.0 ms |
| Ten visible operator/weapon draws | 212 | 79 |
| Ten visible operator/weapon triangles | 394,366 | 228,831 |
| 120 accepted hit events, feedback preparation | 33.7 ms | 1.6 ms |
| Forty simultaneous damage numbers, draw calls | 40 | 1 |

The deterministic fight includes 11 human input streams, three spectators, the island's 15 boss/guard NPCs, 180 builds, automatic rifles and Stormspikes. Both versions produced **946 shots, 2,153 events, and identical player health and positions**. The network test briefly pauses one spectator's transport and verifies recovery without decoder reset. Across two final short runs, competitors received 239–240 snapshots and spectators 115–120 over approximately 12 seconds. The table reports the range across three baseline and two final network runs; timer-driven fights vary, so these ranges are observations rather than a hardware performance guarantee.

A separate two-minute final stress run kept all 11 competitors active, advanced the simulation by 120.02 seconds, fired 5,429 shots and recovered the paused spectator without a decoder reset. It averaged 311.3 ms of server CPU per wall second, with a 12.07 ms event-loop p99 and approximately 297 MB RSS. It still observed an isolated **180.88 ms event-loop pause** (105 ms maximum simulation step, 180 ms maximum snapshot slice). This remains a limitation: the change reduces sustained work and common stalls but does not establish that all long pauses are eliminated.

The browser comparison runs the actual `View.update` path in Chromium with the same viewport, medium quality and fixed resolution scale. It verifies full near models, authored far LODs, bounded feedback and a single damage draw. It uses software rendering, so triangle/draw reductions are reliable work counts, not a promise of a particular hardware FPS. Median view-update CPU improved from 3.9 to 2.9 ms; p99 was essentially unchanged (14.2 versus 14.5 ms), so no p99 rendering improvement is claimed.

Raw evidence is in [performance217](performance217/). CPU profiles and full packet captures are intentionally excluded from the repository.

## Verification and limits

Focused checks compare incremental collision removal against freshly rebuilt indexes across rays, cached areas and later additions, and cover immutable snapshots, lossless deltas, interleaved delivery, backpressure/reconnect, spectator cutoff and post-elimination viewing, once-only tournament settlement, movement, hitboxes, construction, weapon behavior, all eleven anatomy rigs and release history. Chromium checks inspect real assets and shader output, preserve health/shield aggregation, and verify that a 1,000-hit burst remains within the fixed feedback budget and expires cleanly. The production verifier is read-only and checks the exact Pages/Render commit, version/protocol, server clock and tournament schedule.

The service remains on half a CPU core. Local improvements do not establish a universal FPS, latency or 48-player guarantee, and do not remove school Wi-Fi latency or CPU quota throttling. Tournament times, owner-edited rewards, entry rules, spectating, results and normal-matchmaking reopening are not changed by this release.

Reproduce locally:

```sh
node --expose-gc scripts/tournament-load-profile.mjs /path/to/baseline 11 1200 before
node --expose-gc scripts/tournament-load-profile.mjs . 11 1200 after
node scripts/tournament-realtime-profile.mjs /path/to/baseline 11 before
node scripts/tournament-realtime-profile.mjs . 11 after
PERFORMANCE_SECONDS=120 node scripts/tournament-realtime-profile.mjs . 11 soak
node scripts/performance-browser-check.mjs /path/to/baseline before
node scripts/performance-browser-check.mjs . after
```

The sustained-load fixture refreshes only its synthetic participants' activity timestamps: repetitive scripted input otherwise correctly triggers the production anti-AFK policy. Production AFK enforcement is unchanged.
