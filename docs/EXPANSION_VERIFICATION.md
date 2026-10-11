# Expansion foundation verification

This is a work-branch checkpoint, not a release or a completion claim for the
32-category expansion. Production remains Quality Update 141, protocol 43.
The item-by-item scope is in [EXPANSION_ROADMAP.md](EXPANSION_ROADMAP.md).

## Compared revisions

- Immutable baseline: `c2866b6edbaaae26c4aac6f0717960e2c5a2bf7e`.
- First fully passing branch CI: `7c87e186d2fd51777284c5882abd40c06bccdb4e`.
- Follow-up: traversal/revive exclusion and small-screen inventory corrections;
  acceptance is recorded in the subsequent branch workflow run.
- Branch: `expansion-foundation-142`.
- Verification date: 2026-10-11.

## Automated evidence

| Check | Result and limits |
| --- | --- |
| Full repository suite | 580 tests: 537 passed, 43 failed. Baseline: 549 tests, 505 passed, 44 failed. No new failing test names; the fixed humanoid hitbox/checkpoint test now passes. **The whole suite is not green.** |
| Focused checkpoint suite | 51 passed: foundation, performance HUD, guest presentation, remote input, building, arms and audio. |
| Local real-socket public-host scenarios | Passed first-player hosting, concurrent joins, brief reconnect, graceful/abrupt/frozen-host migration, checkpoint-world preservation, joining after migration, late spectator admission and authenticated leaderboards; zero server simulations, protocol 43. |
| Production asset build | Passed on the branch. Existing large-bundle warning remains; no download-size improvement is claimed. |
| First complete branch CI | [Run 38105284235](https://github.com/ZL-2/yolk-yard/actions/runs/38105284235) passed 213 focused tests, six HUD/guest-presentation tests, real-socket scenarios, production build, CPU guard and browser checks. |
| Browser acceptance | Desktop and 390px settings, aim toggle, pickup, comparison, feedback and inventory checks passed with no page errors. Visual review found cramped mobile inventory controls despite the original no-overflow assertion; corrected layout and stronger 320px/390px checks are awaiting the follow-up run. |
| Traversal follow-up | 46 focused foundation/Mythic checks and six existing revive/vault/traversal scenarios passed after excluding revive during active traversal. |

The branch workflow has read-only repository permission and no deployment job.
Its browser scenario launches its own local relay, not the production service.
It exercises saved settings, small-screen layouts, real aim-toggle input and
camera response, preferred-slot pickup, loot comparison, combat feedback and
inventory layout. Screenshots and JSON reports are uploaded as
`expansion-verification` artifacts for 14 days.
The CI browser uses software-rendered WebGL. Its on-screen FPS is not a
hardware-GPU performance measurement.

The full-suite failures remain visible. Several fixtures expect retired server
arenas, retired modes, former maps/bot counts, or obsolete collision interfaces.
Others need individual investigation. Their existence is not waived merely
because the same failures occurred on the baseline.

## CPU comparison

`scripts/expansion-performance-check.mjs` compares identical seeded inputs with
seven alternating warmed samples in one process. It also asserts hitbox region
and distance equivalence, projectile contact distance and normal equivalence,
and ordinary movement/stance equivalence at varied time steps. New mantle/vault
paths are covered separately at 20, 30 and 60 Hz.

Latest local median wall-clock CPU workload times, in milliseconds:

| Workload | Baseline | Foundation | Change |
| --- | ---: | ---: | ---: |
| 24,000 humanoid-hit queries | 30.341 | 8.867 | 70.8% lower |
| 8,000 world-visibility queries | 32.554 | 32.646 | 0.3% higher; within noise |
| 8,000 swept projectile queries | 102.681 | 38.159 | 62.8% lower |
| 11,520 ordinary movement steps | 23.119 | 21.642 | 6.4% lower |

The CI guard permits a 10% median variance ceiling to reduce noise-related
failures; it is **not** a claim that a 10% real regression is acceptable.
Hitbox/projectile work avoids temporary objects and arrays, inventory sync
reuses simulation-owned arrays, and movement reuses exact broadphase results.
Snapshots and prediction own their mutable copies.

A supplementary 150-second simulation with one human, 47 ordinary bots and
three bosses measured active-tick mean/p95/p99 of 0.949/1.584/4.333 ms, versus
0.963/1.628/4.539 ms on the baseline. Timer-budgeted bot decisions cause different
match outcomes even with a fixed seed, so this is a load smoke check, **not an
identical-gameplay benchmark**. An earlier sample was slightly slower; single
samples must not be generalized.

These checks do not measure GPU time, device-wide CPU usage, live Internet
latency, battery drain or frame rate on the player's computer. They cannot
guarantee zero performance regression on every device.

## Behavioral boundaries

- Damage, inventory, knockdowns and awards remain host-authoritative. No new
  client position or award claim is trusted.
- Combat history is bounded to 24 records and 12 seconds. Direction indicators
  reuse five DOM nodes; confirmations use a 64-entry deduplication cache.
- Mantles and vaults sweep the complete route and recheck it during movement.
  They cannot pass through walls or ceilings, overlap Mythic traversal, fire
  weapons mid-climb, or grant additional fall immunity.
- Guest reconciliation clones mutable traversal state instead of advancing the
  authoritative snapshot. Fire prediction uses the same eligibility gate.
- Slot preferences only choose empty slots. Partial-stack merging preserves
  overflow and never silently removes a gun. Held chest search stays on its
  reachable chest while aim changes.
- Comfort changes do not disable actual weapon recoil or change hitboxes.
- No new central diagnostics overlay, database schema, production version,
  protocol revision or relay configuration is introduced.

## Remaining release gates

Finish the small-screen follow-up browser review; investigate outstanding relevant
baseline failures; exercise live-device multiplayer and repeat-join cleanup;
complete the remaining roadmap items or explicitly agree a smaller release
scope. Vehicles, convoys, voice chat and extensive destruction remain gated.
Do not merge or deploy this checkpoint as if the entire expansion were done.
