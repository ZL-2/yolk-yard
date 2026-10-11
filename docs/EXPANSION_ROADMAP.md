# Expansion acceptance ledger

Requested 2026-10-10. Baseline: `c2866b6` / Quality Update 141. This is an
implementation ledger, **not a claim that the entire expansion has shipped**.
`E` = existing implementation located, still needs acceptance verification;
`P` = pending implementation; `I` = implemented, awaiting end-to-end acceptance;
`V` = implemented and verified by linked checks;
`G` = deliberately gated on measured core stability. Never mark a category
complete merely because a menu, stub, or configuration value exists.

## Acceptance scope

| Category | Individually tracked requirements |
| --- | --- |
| 1 Combat | V pooled directional damage; V differentiated confirmations; I multi-attacker recap; E authority/prediction consistency |
| 2 Weapons | E distinct balance profiles; P tradeoff attachments; P inspection; I tactical/empty reload distinction |
| 3 Movement | I swept mantle; I low vault; E blended transitions; P corner/door collision acceptance |
| 4 Building | E placement reasons; I placement buffering; E edit highlights/reset; E cracks, P collapse warning effects |
| 5 Inventory | V preferred slots; V compare before swap; V crosshair loot targeting; V multi-stack merging/capacity |
| 6 Survival | I clear movement rules; I healing suggestions; P limited recovery stations; I cancellation reasons |
| 7 Bots | E bounded skill; E combat roles; E last-known information; E stuck recovery; E bounded natural mistakes |
| 8 Teammates | P tactical commands; P item sharing; E safe revive planning; E formation spacing |
| 9 Bosses | E distinct encounters; E warnings; E Mythic counterplay; E patrol variation; E vault identities |
| 10 Map | E unique layouts; E sightline reduction; P route validation; E landmarks; P location-weighted loot |
| 11 Environment | P warning/detonation props; E breakable cover; E functional doors; P power systems |
| 12 Storm | E phase timing; P late-circle reachability; E traversal rotations; E early equipment window |
| 13 Objectives | P approximate bounties; G moving convoy; E capture relays; P one optional rotating event |
| 14 Vehicles | G buggy/occupants/fuel/damage; G counterplay; E authored traversal; E collision-safe traversal exits, G vehicle exits |
| 15 Characters | E foot placement; E independent upper body; E grips; E revive/Mythic poses, P carry/injury poses; E animation distance tiers |
| 16 Imagery | E model-derived renders; E recognizable silhouettes; E materials; E location loading art; P artwork/model consistency acceptance |
| 17 Effects | E muzzle flashes; P material impacts; E Mythic effects; P visibility-safe atmosphere presets; E bounded pools |
| 18 Audio | E surface steps; P indoor acoustics; E distance detail; P explicit voice priority; P exploration music ducking |
| 19 HUD | I minimap side/visibility, inventory/map scale; E descriptions; E urgent notifications; E interaction prompts; E results breakdown |
| 20 Controls | I independent sensitivity contexts; P third-person collision acceptance; I comfort sliders; P controller; I jump/build buffering, P reload buffering |
| 21 Social | E quick chat/pings; E party readiness; E recovery status; P recent teammates; E party continuity |
| 22 Progress | E weapon mastery; E weekly, P daily challenges; P discoveries; E career milestones; E reward transparency |
| 23 Cosmetics | E sets; E interactive previews; P named loadouts; E cosmetic prestige; E ownership/pricing |
| 24 Rankings | E kills/wins, P qualified win rate; P friends filter; P seasonal rankings; E verified receipts, P match-history UI; E ranking transparency |
| 25 CPU | E think budgets; E spatial indices; E route cache; V hitbox/projectile allocation reduction; E developer subsystem timing |
| 26 Graphics | E scenery batches; E distance detail; E visibility updates; E shared materials/assets; P repeated-join cleanup verification |
| 27 Network | E interest tiers; E interpolation; P important-event replay reliability; P measured host ranking; E bandwidth/backpressure |
| 28 Loading | E lobby-first presentation; E incremental map preparation; E actual stage labels; E versioned assets; E reusable safe geometry |
| 29 Accessibility | I non-color hit labels; I prompt text scale/contrast; I hold/toggle; I audio-visual categories; I reduced-motion setting |
| 30 Training | E basic tutorial, P survival/loot lessons; P moving range targets/accuracy; P timed building drills; P independent practice tuning; P one-time contextual help |
| 31 Editor | E undo/redo; E properties, P grouping/visibility/locking acceptance; E snapping; P map validation; E draft/publish separation |
| 32 Safety | E bounded host/input claims, P expanded validation; P recoverable backups; E release agreement; E regression scripts; E opt-in diagnostics |

## Release gates

- No production deployment or protocol change is implied by this work branch.
- Keep gameplay authority on the elected host; presentation changes must not
  change hitboxes or predict awards. Public progression remains relay-validated.
- No new per-bot every-frame searches, global raycasts, unbounded histories,
  timers, particle systems, or draw calls. New UI updates are event-driven or use
  the existing throttled HUD update.
- Compare identical seeded workloads against the immutable baseline in one
  environment, with warmup and repeated samples. Report variance; do not turn a
  noisy microbenchmark into an assurance for every device.
- Exercise host and guest, reconnect/migration, storm, death/respawn, ordinary
  and Mythic movement, full inventory, and low quality before release.
- Vehicles, voice chat, convoys, and extensive new destruction remain gated.
  They are not implemented by placeholders or silently enabled in public play.

## Baseline triage

`npm test`: 549 tests, 505 pass, 44 fail before any edits. Many old fixtures still
expect server-hosted public arenas, retired Team Scramble, one boss, old bot
counts, former maps, and a Set-returning collision API. These are not evidence
of new regressions and must not cause reverting current product rules. Actual
collision, roster, and presentation failures must be isolated separately.

The unchanged repository and its dependencies are retained in a detached local
worktree for differential testing. Baseline results alone are not a release gate
waiver. New or touched behavior requires direct regression coverage.

## Foundation checkpoint (not a release)

- `tests/expansion-foundation.test.js`: damage/assist accounting, bounded recap,
  split/replayed event presentation, indicator pooling, preferred slots, partial
  stacks and overflow, shared targeting, live weapon comparison, cancellation,
  swept mantle/vault at 20/30/60 Hz, obstacles and ceilings, prediction,
  migration, snapshot isolation, jump/build buffers and reload presentation.
- `tests/comfort.test.js`: corrupt-storage clamping, hold/toggle/reset behavior,
  independent context sensitivities and independently disabled visual sounds.
- Latest full differential run: 582 tests, 539 passed, 43 failed. No new failing
  test names versus the original 549-test baseline; one prior hitbox check now
  passes. Existing failures are **not** hidden or relabeled as passing.
- `scripts/expansion-performance-check.mjs`: identical deterministic hitbox,
  collision and projectile queries against immutable baseline code, with seven
  alternating warmed samples and numerical-equivalence assertions.
- Desktop/mobile browser interactions and visual-review follow-ups passed,
  including cramped small-screen inventory controls. Exact acceptance is tracked
  in [EXPANSION_VERIFICATION.md](EXPANSION_VERIFICATION.md), with exact test
  counts, benchmark limits, CI evidence and remaining gates.
- `.github/workflows/expansion-checks.yml` runs
  only on this feature branch, has read-only repository permission and has **no
  deployment job**. The local environment currently lacks Chromium.
- No production version, protocol, relay configuration or progression schema
  has been changed. Remaining P/E/G requirements are still outstanding.
