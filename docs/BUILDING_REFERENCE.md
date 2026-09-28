> Historical technical notes. Current identity, humanoid combat, economy and timing are specified in [Ravelfront](RAVELFRONT.md).

# Frontier Royale manual building reference

Reference date: 2026-09-26. Code and graphics are original. The gameplay baseline is classic standard Battle Royale manual building after the August 9, 2018 material rebalance. This is NOT a claim of exact parity with September 2026 Fortnite. Save the World, Creative health multipliers, Simple Edit, and accelerated-harvesting LTMs are excluded.

## Evidence and its limits

- Epic [v5.10 Battle Royale notes](https://www.fortnite.com/patch-notes/v5-10) verify wood wall maximum 150, metal wall maximum 500, approximately 25-second metal construction, and 75 pickaxe damage to player structures. That release's initial wall health was superseded by the next source. Only its Battle Royale section is used.
- Epic [August 9 rebalance](https://www.fortnite.com/news/weapon-and-building-balance-8-9) specifies initial wall health of 90 wood, 100 stone, 110 metal. The widely circulated 99-stone table is not substituted for Epic's explicit 100 baseline.
- Jon Knight's [own Battle Royale gameplay screenshots and walkthrough](https://smartphones.gadgethacks.com/how-to/edit-structures-fortnite-battle-royale-0183582/) demonstrate blue selection grids, red invalid feedback, wall openings, floor variants, ordered stair gestures, and raising roof corners. This is observational evidence for interaction families, not an exhaustive engine specification.
- The [2018 Battle Royale wall walkthrough](https://forums.tomshardware.com/faq/fortnite-battle-royale-advanced-wall-editing-guide.3339080/) supplies additional wall families. Neither walkthrough proves every possible legal bit mask in a particular executable.
- Epic's [Simple Edit support](https://www.epicgames.com/help/fr/c-Category_Fortnite/c-Fortnite_Gameplay/fortnite-a000092956?lang=en-US) establishes that Simple Edit is a separate option. This implementation uses manual selection.

## Implemented material table

| Material | Initial HP | Maximum HP | HP per 0.5-second tick | Time to maximum without damage |
|---|---:|---:|---:|---:|
| Wood | 90 | 150 | 8 | 4 seconds |
| Brick | 100 | 300 | 9 | 11.5 seconds |
| Metal | 110 | 500 | 8 | 24.5 seconds |

Initial wall HP and the wood/metal maxima have direct Epic support above. Brick maximum and exact tick increments follow the classic community-reported baseline; they were not independently verified in Epic's published engine data. Using the table for every piece and edit is a Ravelfront approximation: per-piece/shape health reductions are NOT claimed to match Fortnite. Construction has a finite remaining health budget; taking damage does not create free healing. Edits preserve current HP, remaining construction, material, owner and age. Paid repairs add a finite health budget over time. These edit/damage/repair details are explicit Ravelfront rules because exact version-matched Fortnite timing could not be established.

## Original balancing / engine adaptations

- Camera-facing placement and persistent manual rotation offsets are the user's explicit custom rule. Heading snapping has a 4-degree hysteresis band; it uses horizontal facing only. Leaving build mode resets the offset on next entry.
- All environmental health, size scaling, and resource budgets in `src/building-rules.js` are original Ravel Coast balancing. Comparable wood objects generally yield more per harvesting effort than brick, and metal less. Large metal objects can still contain more total resources than small wood props. These are NOT Fortnite object statistics or a claimed universal Fortnite harvesting formula.
- Environmental pickaxe damage is 50, weak points double it, player damage remains the user's 20, structure damage is 75. Resource allocation is proportional to actual valid harvesting damage with cumulative integer rounding and a finite per-object budget. Bullets do not grant resources; player builds never grant resources.
- Eight Ravelfront world units is the edit reach (two of our 4-unit cells), not a verified meter-for-meter Fortnite range. Authoritative line-of-sight checks reject edits behind intervening structures. Owner edits are allowed; teammate edits require an explicitly team-enabled build. Current Royale remains solo, so unrelated eggs sharing a default team value gain no access.
- Roofs raise corners and stairs follow ordered paths. Floors have diagonal connecting bridges. Walls support windows, doors, combined door/window, partial walls, triangles and arches with mirrored variants. The catalog is intentionally explicit; unrecognized combinations are rejected. Exhaustive Fortnite pattern parity remains unverified.
- This game's existing collision engine uses axis-aligned solids. Slopes and arches use matching fine stepped volumes for rendering, movement and projectiles, rather than Fortnite's smooth meshes. Decorative rails and exact Fortnite silhouettes are not reproduced. Door leaves switch between open and closed collision states; there is no interpolated hinge animation.
- Manual confirmation is the default. Optional confirm-on-selection-release is a user-requested convenience beyond the historical baseline. Fire selects, Aim resets, Edit confirms, Escape cancels; these use existing remappable bindings.

## Authority and verification

Previews and drag selections are local only. A confirmation is a bounded `build-change:` command with an expected revision and selection, transported by the existing player-action channel. The host checks permissions, range, line of sight, legality and player obstruction; guests receive the same geometry through snapshots. Placement spends host-owned resources; harvesting and construction run only on the host. No networking service or architecture is replaced.

Focused checks live in `tests/building-overhaul.test.js`, `tests/building.test.js`, `scripts/building-browser-check.mjs`, and `scripts/building-network-check.mjs`. Production version/history are emitted by the existing release system.
