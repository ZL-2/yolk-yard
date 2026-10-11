# Expansion verification

This is a work-branch checkpoint, not a release or a completion claim for the
32-category expansion. Production remains Quality Update 141, protocol 43.
The item-by-item scope is in [EXPANSION_ROADMAP.md](EXPANSION_ROADMAP.md).

## Compared revisions

- Immutable baseline: `c2866b6edbaaae26c4aac6f0717960e2c5a2bf7e`.
- First fully passing branch CI: `7c87e186d2fd51777284c5882abd40c06bccdb4e`.
- Traversal/mobile follow-up: `c50ef8da010d1ab4ae3f6a8d5ef8f3c9c1b1ebd9`.
- Previous verified code checkpoint: `ac2ac7c1cb86340e7585a582279391a8b1cc2b59`.
- Current verified code checkpoint: `d7493b5e62d172e52f8b4ce2df283ca7891e0dc2`.
- Branch: `expansion-foundation-142`.
- Verification date: 2026-10-11.

## Automated evidence

| Check | Result and limits |
| --- | --- |
| Full repository suite | Latest local run: 605 tests, 565 passed, 40 failed. Baseline: 549 tests, 505 passed, 44 failed. No new failing test names. Humanoid hitbox/checkpoint and authored foundation checks pass; door damage and queued bot utility checks now use the correct closed-leaf state and equip-plus-throw duration. **The whole suite is not green.** |
| Focused checkpoint suite | 51 passed: foundation, performance HUD, guest presentation, remote input, building, arms and audio. |
| Local real-socket public-host scenarios | Passed first-player hosting, concurrent joins, brief reconnect, graceful/abrupt/frozen-host migration, checkpoint-world preservation, guest inventory-preference delivery and preservation after migration, joining after migration, late spectator admission and authenticated leaderboards; zero server simulations, protocol 43. |
| Production asset build | Passed on the branch. Existing large-bundle warning remains; no download-size improvement is claimed. |
| First complete branch CI | [Run 38105284235](https://github.com/ZL-2/yolk-yard/actions/runs/38105284235) passed 213 focused tests, six HUD/guest-presentation tests, real-socket scenarios, production build, CPU guard and browser checks. |
| Previous foundation CI | [Run 38105822036](https://github.com/ZL-2/yolk-yard/actions/runs/38105822036) passed **228 focused tests** (216 gameplay, six HUD/guest-presentation, six revive/traversal), real-socket scenarios including guest preferences/migration, production build, baseline CPU guard and every browser assertion. |
| Current follow-up CI | [Run 38108261932](https://github.com/ZL-2/yolk-yard/actions/runs/38108261932) passed **281 focused tests**, 72 seeded bot scenarios, real-socket scenarios, production build, baseline CPU comparison, desktop/mobile browser checks and the full owner-editor browser scenario. |
| Browser acceptance | [Follow-up run 38105551883](https://github.com/ZL-2/yolk-yard/actions/runs/38105551883) passed desktop/390px settings, real aim-toggle and camera response, preferred pickup, loot comparison, combat feedback, and 320px/390px inventory/inspection checks with no page errors. Screenshots were inspected. Mobile button clipping and key/quantity overlap were corrected; stronger assertions now cover them. |
| Traversal follow-up | 46 focused foundation/Mythic checks and six existing revive/vault/traversal scenarios passed after excluding revive during active traversal. |
| Final recap follow-up | 28 foundation tests passed after separating actual finishing-hit source/distance from knock credit, correcting splash-healing advice and pickaxe-swap cancellation feedback; included in the successful final CI run. |

The branch workflow has read-only repository permission and no deployment job.
Its browser scenario launches its own local relay, not the production service.
It exercises saved settings, small-screen layouts, real aim-toggle input and
camera response, preferred-slot pickup, loot comparison, combat feedback and
inventory layout. Screenshots and JSON reports are uploaded as
`expansion-verification` artifacts for 14 days.
Current screenshots, browser results and CPU samples are in
[artifact 11690855631](https://github.com/ZL-2/yolk-yard/actions/runs/38108261932/artifacts/11690855631),
retained until 2026-10-25. Camera, map validation, GLB import and the 1024px editor
screenshots were reviewed, alongside the earlier mobile inventory review.
The CI browser uses software-rendered WebGL. Its on-screen FPS is not a
hardware-GPU performance measurement.

The full-suite failures remain visible. Several fixtures expect retired server
arenas, retired modes, former maps/bot counts, or obsolete collision interfaces.
Others need individual investigation. Their existence is not waived merely
because the same failures occurred on the baseline.
The broader [PR workflow 38108355409](https://github.com/ZL-2/yolk-yard/actions/runs/38108355409)
also reports 605 tests / 565 passes / 40 failures. Its older arena browser script
waits for `menuPose.time`, and its solo browser script is blocked by the Season 1
launch dialog. Those scripts still need updating or investigation; the PR is
**not fully green**. Deployment jobs were skipped.

## CPU comparison

`scripts/expansion-performance-check.mjs` compares identical seeded inputs with
seven alternating warmed samples in one process. It also asserts hitbox region
and distance equivalence, projectile contact distance and normal equivalence,
and ordinary movement/stance equivalence at varied time steps. New mantle/vault
paths are covered separately at 20, 30 and 60 Hz.

Latest GitHub runner median wall-clock CPU workload times, in milliseconds:

| Workload | Baseline | Current branch | Change |
| --- | ---: | ---: | ---: |
| 24,000 humanoid-hit queries | 38.383 | 10.976 | 71.4% lower |
| 8,000 world-visibility queries | 37.431 | 37.571 | 0.4% higher; within noise |
| 8,000 swept projectile queries | 121.684 | 44.892 | 63.1% lower |
| 11,520 ordinary movement steps | 30.304 | 27.331 | 9.8% lower |

The preceding local comparison also passed: hitboxes 77.7% lower, projectiles
62.2% lower, movement 8.2% lower and visibility 1.1% higher (within noise).
Compare each current/baseline pair only within its own environment, not raw
milliseconds across machines. The final runner includes the authored terrain
follow-up; both physics versions receive that same current map.

The CI guard permits a 10% median variance ceiling to reduce noise-related
failures; it is **not** a claim that a 10% real regression is acceptable.
Hitbox/projectile work avoids temporary objects and arrays, inventory sync
reuses simulation-owned arrays, and movement reuses exact broadphase results.
Snapshots and prediction own their mutable copies.
Changing HUD, comfort, inventory preferences or input settings no longer calls
the graphics-quality reset: it preserves adaptive render resolution instead of
resizing the canvas and restoring full resolution. The browser check instruments
the real quality-reset method and verifies it is not called by those controls.

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

## Door, camera, editor and bot follow-up

- `tests/expansion-collision.test.js` covers all 122 ordinary doorway passages
  (both directions, three offsets, 20/60 Hz), diagonal frames, moved/copied and
  rotated/scaled door controls, guest door collision, occupied closing and wall
  occlusion. It also checks edited-leaf render ownership and separately edited
  or removed leaves in building previews.
- The authored coast passes 937 local map checks with five clear spawns and no
  warnings or errors. The dock drainage roof had intersected the hangar entrance
  at head height; roof clearance now follows the highest terrain under each
  tunnel. The last fallback spawn was moved out of a foundation.
- Two later vault additions had raised terrain through the Aster barracks and
  western woods cabin. Moving those buildings 7 m east and 5 m west respectively
  separates the conflicting authored footprints. The existing foundation test
  passes unchanged for all 61 buildings, floor overlaps and spawn clearance;
  the full-suite run above includes this fix. Building/tree/door/loot counts
  stay unchanged; scatter re-evaluation changes props from 823 to 824 and boxes
  from 6505 to 6506. That resulting map is included in the passing CPU comparison.
- The editor validator yields after 4 ms of work, caps its displayed issue list
  at 200, cancels when closed and changes no match geometry. Runtime simulation
  ticks never invoke it. Relay publish validation rejects insufficient clear
  spawns or mismatched door controls; local route/support findings are warnings.
- Camera tests cover near-plane edge contacts, ceiling/floor contacts, new build
  geometry, immediate retraction, smooth release and target changes. One short
  spatial sweep applies only to the local third-person camera.
- Five reload tests exercise a 220 ms tap window, input-edge coalescing, guest
  delivery, held reload, mantle/equip completion, expiry, swaps and resets.
- Three bot utility tests prove expired/missing/consumed plans cannot suppress
  ordinary gun aiming, activation respects equip/latch state, and an expired
  cached intent cannot keep throwing. Expensive bot decisions remain scheduled.
- All 72 seeded stationary/moving-target duel scenarios pass again. Across these
  uncommon-weapon fixtures, a full 200-health/shield target survives 4.667 to
  10.517 seconds; longest stationary bot interval is 0.633 seconds. This bounds
  these fixtures, not every multiplayer encounter or weapon rarity.
- Real-socket public hosting, reconnect and all three host-transfer scenarios
  pass again with zero relay simulations and unchanged protocol 43.
- New browser scenarios check a wall behind an emoting player, camera recovery
  when it is removed, editor check results, keyboard focus, a floating-object
  warning and location focus, alongside existing owner editing/publishing checks.
  Camera/settings/HUD scenarios passed in branch run 38107880124. The editor
  report, focus, transforms, history, locking and draft publication also passed
  before Test walk exposed a real capture conflict: the main menu handler
  released the editor's pointer lock. That handler now recognizes editor-owned
  capture; Test walk's click handler is registered once per editor session.
  Follow-up run 38108261932 passes full editor acceptance, repeated Test walk
  and stable handler counts, plus GLB import/export, concurrent-draft rejection,
  expired authorization recovery and saved-draft reopening. There are no page
  errors. Screenshots of clear/warning reports, camera, import and editor were
  inspected.

## Remaining release gates

Investigate outstanding relevant baseline failures; exercise live-device
multiplayer and repeat-join cleanup;
complete the remaining roadmap items or explicitly agree a smaller release
scope. Vehicles, convoys, voice chat and extensive destruction remain gated.
Do not merge or deploy this checkpoint as if the entire expansion were done.
