# Quality Update 119 — Kestrel: Clear Skies

Version 4.1.1, protocol 33. Protocol changes keep the compact airfield collision identical across connected clients.

## Changes

- Generated Jump Rig and Voss keycard inventory previews from the actual 3D item models; also repaired missing smoke and scanner previews. Generator accepts selected IDs.
- Jump Rig charge ring and remaining seconds in the hotbar and inventory. The ring reads the replicated recharge deadline and simulation time, updates existing elements, and never grants speculative charges. Full capacity hides the timer; spent charges retain their count.
- Guest transport interpolation preserves independently controlled yaw and pitch; guest movement prediction immediately accepts both look axes. Bus camera remains an orbit around the Kestrel.
- Military airfield footprint falls from 192×192m to 136×136m (49.8% less terrain area). The parked aircraft retains full size. Runway, hangar, deck, practice lanes, cargo, medical area and 48 safe spawn seats remain. Practice fire targets the relocated range.
- Reuse exact nearby collision bucket unions for short rays and movement; reuse bounded A* search workspace with generation stamps; avoid copying player objects to compare weapon slots; remove per-tick door filter/sort allocations; only compute landing surface normals when there is a fall to resolve.
- Ordinary doors still update authoritative collision and loot support, but do not invalidate routes that already ignore door leaves. Clients skip geometry serialization for identical world revisions.
- Outside 180m of every living human and without a human target, Royale bots perform tactical searches at half their normal rate. Cached intentions, 60Hz movement, firing cadence, ammo, damage, and damage-triggered reactions remain active. Near-human decision rates and all combat statistics are unchanged. Empty-public-room behavior is unchanged.

## Evidence

Render diagnostics before this patch recorded approximately 0.481 of the allocated 0.5 CPU cores during a public match (~96%), versus ~0.006–0.01 cores while idle. No hosting-plan changes were made.

Local CPU-profiled simulation used seed 821, one connected human, 47 Intermediate bots, 150 simulated seconds and the boss. No rendering was running during either recorded profile. Active-round measurements:

| Tick cost | Before | After |
|---|---:|---:|
| Mean | 2.494 ms | 1.970 ms |
| 95th percentile | 4.461 ms | 3.895 ms |
| 99th percentile | 7.471 ms | 6.481 ms |

Mean active tick cost improved ~21%, p95 ~13%, p99 ~13%. The two trajectories differ because the compact spawn layout and bot scheduling alter deterministic decisions. This is representative workload evidence, not a machine-independent FPS or CPU guarantee. Peak individual ticks can still include allocation/GC and world preparation; the update does not claim to eliminate every spike.

Reproduce with `node --cpu-prof scripts/kestrel-performance-check.mjs`; JSON is written to test-results/kestrel-performance.json. Browser checks separately cover real asset decoding, 48 seats, host and guest bus look in four directions, inventory/hotbar recharge progression and full-charge clearing. Essential regression coverage includes collision candidate completeness, repeated routes, doors, boss/rig behavior, remote input, snapshots, recurring rooms and authority timing. An older bot-speed test expects instant maximum sprint speed and predates tactical acceleration; it was not used as a release gate or changed to hide that mismatch.
