# Zone Wars reference and implementation boundaries

Research reviewed October 18, 2026. The reference is Prettyboy's original solo Tilted Zone Wars, island **3729-0643-9775**. There are separate names-off, all-weapons, duos, trios, squads and zero-build islands; those are not interchangeable rulesets.

## Primary references

- [Prettyboy's official island listing](https://www.fortnite.com/@prettyboy/3729-0643-9775) describes the original as solo Zone Wars with name tags enabled. Its creator posts show ongoing changes to the loot pool, including seasonal items. The listing does not expose exact map coordinates, server scripts or item drop probabilities.
- [Fortnite's Tilted Zone Wars promotion](https://www.youtube.com/watch?v=6GFbSjJrp2k) describes random building spawns, randomized equipment and last-player-standing combat.
- [Epic's Zone Wars design example](https://dev.epicgames.com/documentation/en-us/fortnite/zone-wars-in-fortnite-creative) explains randomized spawns and inventory, an advanced storm controller with six beacons, changing storm centers, escalating damage and a final zero-radius storm. Its example configuration is a general design guide, not Prettyboy's unpublished configuration.

## Implemented rules

Sixteen solo contestants, parties entering together as rivals, one life per round, spectator cycling after elimination, an eight-second protected preparation period, random room assignment and a fresh randomized five-slot kit each round. Player nameplates remain visible. A public series is first to five; private rooms expose capacity, target score, human-only/bot fill and bot skill.

The district has nine enterable multi-storey landmarks: brick and twin apartments, an office tower, corner shops, construction, pawn shop, diner, south apartments and a clock tower. Streets, crosswalks, cars, interior partitions, furniture, roof equipment, stairs, basketball court and surrounding hills form the playable urban space. Windows, floors and stairways use real collision geometry. Sixteen separated spawn cells occupy multiple building floors. Builds, world damage, inventory and loot reset between rounds.

Equipment guarantees a shotgun, assault rifle, support weapon or mobility item, shields, and healing or utility. It uses Ravelfront's weapon, rarity, ammunition, healing, impulse and launch-pad systems. Contestants receive 100 health, 100 shield and 500 of each material. Eliminations grant 50 health/shield siphon plus bounded materials and ammunition. Loadout choices and weighting are explicit in `src/zone-wars-rules.js`.

The six moving circles close from radius 94 through 62, 40, 24, 13, 7 and 0. Storm damage steps through 5, 5, 8, 10, 10 and 15 per second. The final circle closes at 186 seconds; the round has a hard limit of 210 seconds. Storm paths and spawn/loadout randomness survive host transfer.

## Deliberate, disclosed differences

This is an original, playable Tilted-style district built for Ravelfront's renderer and movement scale. It is **not a verified one-to-one reproduction** of Fortnite's terrain, geometry, artwork, weapons, UI, current seasonal loot or hidden probabilities. Public research cannot establish those unpublished internals. The numerical timings, dimensions, bot behavior, first-to-five target and kit probabilities above are explicit Ravelfront choices, rather than claims about Prettyboy's current island. The game retains its own item names, models and interface.

## Score semantics

Public leaderboards track each mode independently. Zone Wars wins mean round wins; Box Fights wins mean series wins; Zombies wins mean successful extraction; Royale and Free For All count match victories. Private rooms do not feed competitive public rankings; existing career eligibility rules remain in place. Training displays this browser's practice eliminations and completed six-objective drills. There is no invented global training ranking.

The relay persists cumulative mode totals independently from reward eligibility, deduplicates match/round updates and merges identities without mixing modes. Existing public Royale history is retained. Rankings follow the Play selection until the Kills or Wins filter is explicitly overridden; Follow Play removes that tab's override.
