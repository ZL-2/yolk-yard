# Box Fights design reference

Research checked 17 October 2026. These are design references for an original Ravel Front mode, not copied Fortnite assets, map layouts, weapon statistics or a claim of exact Fortnite parity.

## Primary sources and decisions

| Reference | Observed design | Ravel Front adaptation |
| --- | --- | --- |
| [Epic: 1v1 Box Fight design](https://dev.epicgames.com/documentation/en-us/fortnite/design-a-1v1-box-fight-in-fortnite-creative) | Confined building arena, opposing spawns, a timed barrier and elimination rounds. | Enclosed two-storey rooms, seven seconds to build, one life per round, three-second resets. |
| [Epic: Box Fight devices](https://dev.epicgames.com/documentation/en-us/fortnite/box-fight-3-add-devices-in-unreal-editor-for-fortnite) | Separate spawn barriers and central sight blocker. Equal rifle/shotgun/healing inventory, finite materials and ammunition; round timer and eliminations matter more than the minimap. The example kit grants 500 wood. | Protected team halves or individual FFA cells, opaque center gate, identical rifle/shotgun kits, two mini shields, two splash heals, 500 wood, compact round/alive scoreboard. |
| [Clix / Pandvil Box Fights, 7620-0771-9529](https://www.fortnite.com/@pandvilnetwork/7620-0771-9529) | Explicit 1v1–4v4 support, team selection and controllable match setup. | Four public team-size pools, private team selection, friend-versus-friend parties, configurable first-to target and loadout. |
| [Pandvil 2v2 Box Fight, 6562-8953-6567](https://www.fortnite.com/@pandvil/6562-8953-6567?lang=en-US) | Emphasis on short downtime and repeated team fights. | Immediate spectator flow, automatic next-round reset, side swapping and automatic public-series restart. |
| [Finest Realistics, 9854-1829-8735](https://www.fortnite.com/@finest/9854-1829-8735?lang=en-US) | Fast 1v1–4v4 rounds and a variety of combat locations; a useful adjacent practice format. | Three arena sizes with rotation every two rounds, so both teams receive each spawn side before changing maps. This stays a box-fighting ruleset; it does not reproduce Realistics POIs. |

## Complete match loop

Choose Box Fights → public matchmaking or private room → reserve the whole party → wait for human opponents → prepare behind barriers → fight → last surviving team/operator earns one round → clear all structures and dropped items → restore equal gear and swap sides → repeat until the target → series results → rematch or public automatic restart.

Public settings: 1v1, 2v2, 3v3 or 4v4; first to five; Classic kit; arena rotation; human opponents start a 15-second queue, or start immediately when all seats are occupied. Queue admission closes when preparation begins. Private codes may join in progress and wait for the next round. Public parties fit together; a larger private party may deliberately split across teams. Private FFA has eight seats. Private targets are 3, 5, 7 or 10; Classic and Pressure kits; humans only in every format.

All players start with 100 health and 100 shield. The default weapon order is rifle in slot 1 (selected on spawn), shotgun in slot 2; heals follow. This resets each round and applies to public and private rooms. Classic uses the existing epic pump shotgun and rare assault rifle definitions (internal IDs `scatter`/`sprinter`); Pressure uses the existing double shotgun and SMG. Equipment uses the game's existing rarity, spread, reload and damage rules. Eliminations grant 50 health/shield siphon and 100 wood, capped at 100/100 vitals and 500 wood. Friendly fire is disabled; there are no knockdowns, mid-round respawns or floor weapon spawners.

The storm starts closing at 45 seconds, reaches zero radius at 85, and damages all remaining players. At 100 seconds an unresolved round draws. Simultaneous final eliminations draw without awarding a point. Repeated draws have a bounded series limit. Results show round wins, eliminations and damage; career/reward settlement uses one series identity rather than paying each internal round.

## Implementation boundaries

The existing host-authoritative shooting, six-slot inventory, material spending, construction health, destruction/support, placement solver, window/door/other edits, repair, revision checks, prediction and spectator systems are reused. New arena bounds prevent building outside the walls or above the ceiling. Host and guest apply identical preparation movement constraints. Bot admission, bot fill and practice AI are disabled for this mode in both public and private rooms.

Checkpoints carry phase, clocks, map, scores, build revisions, player inventory and late-arrival state through host migration. No account authentication, purchased rankings, persistent competitive ladder, new currency or third-party integration is introduced.

## Verification

`tests/box-fights.test.js`: equipment, protection, ownership edits, bounds, friendly fire, siphon, reset/side swaps, simultaneous draws, storm, late joins, complete parties, checkpoints, FFA, rotation, rewards identity human-only waiting, departure handling and bot rejection.

`tests/box-fights-network.test.js`: real relay matchmaking, separate pools, ready party reservations, guest edits and elected host recovery.

`scripts/box-fights-browser.mjs`: real desktop lobby/options/private room, guest admission, build/edit controls, HUD, arena rendering, storm, series scoreboard and rematch. Screenshots and checks are retained as CI artifacts. Shared building, social, chat, snapshot and reward regressions also run.
