# Update 175 — Blacktide Extraction
Version 6.2.0 · protocol 61 · desktop release

## What changed
The Zombies playlist is now a timed open-world PvE expedition, not endless rounds.
Its main instruction is deliberately short: **complete three gold contracts, then call and board a green extraction transport**. Players can escape earlier. Optional story operations are not required to understand or finish a run.

- Nine districts across the original 360-by-360-meter Blacktide Exclusion Coast; 27 enterable buildings, linked roads, interiors, elevated routes, district landmarks and three extraction sites.
- Public worlds admit up to 24 operators during their first ten minutes. Existing four-player parties remain together; private sessions support one through four. An in-world squad invitation can grow a squad to six.
- 25 minutes of exploration followed by a five-minute contamination emergency. Each squad can extract independently, without clearing every enemy or ending someone else's run.
- 27 reusable contract terminals covering supply recovery, communications defense, marked-threat hunts, infestation clearance, rescue-rover escort, hostile relay sabotage and vault defense.
- Supply lockers, backpacks, armor plates, medkits, filters, self recovery, weapon calibration, five rarity grades, three resonance tiers, five ammunition mods and four attachment choices.
- Nine original perks, six field abilities, three special weapons, deployable support, drivable field rovers, a rescue hound, randomized Signal Cache, wall weapons and ammunition stations.
- Server-verified stash and contraband, insured weapon cooldown, craftable blueprints, containment progress and five optional story acts. No real-money consumable shop.
- Twelve enemy archetypes, human mercenaries, telegraphed special attacks, authored humanoid motion retargeted to Ravelfront proportions, animated hounds and licensed performed creature vocals.
- Dedicated tactical map, backpack, timer, threat zones, squad status, objective markers, responsive station menus, briefing/loadout and after-action screens.

## Reliability boundaries
The server owns damage, contracts, purchases, extraction and persistence. A player cannot submit their own reward amount, claimed damage, price or objective completion.

The migration removes round-boundary late admission, next-round resurrection, round-gated extraction votes and the mandatory final-wave clear. Loading players cannot falsely trigger a wipe. Independent extraction does not replace the shared room. Replay clears run-local recordings, schematics and boarding state. Remote vehicle input is consumed and acknowledged rather than accumulating.

Persistent rewards require meaningful participation; an empty extraction cannot bank newly minted starter supplies. Existing brought-in supplies can be returned. Reward receipts are idempotent and bounded. Echo Keeper protects unused backpack supplies after eligible participation; it does not promise a cross-session corpse-retrieval system.

## Performance and verification
A local ten-minute simulation with 24 player slots, 48 active infected and 24 recipients at 20 Hz measured:
- 151.67 ms CPU per simulated second;
- simulation step p99 3.28 ms;
- approximately 73.93 KiB per client per second;
- 27.34 MiB retained heap growth.

These are local workload measurements, not a guarantee of FPS or network latency on every machine. Static scenery uses shared material atlases and spatial batches; nearby infected use authored rigs, farther enemies use inexpensive instanced representations. Navigation fields, corpses, projectiles, support equipment and effects are bounded.

Focused tests cover authority, capacity, reconnect, contracts, gear ownership, persistence, extraction, combat, vehicles, animation finiteness, PvP isolation and the newly merged Box Fights mode. Desktop browser acceptance exercises actual mode selection, a three-person party, purchases, objective/map UI, crowd rendering, boarding, independent extraction and replay.

## Deliberate differences and limits
This is an original browser adaptation, not MWIII or a promise of one-for-one AAA production parity.
- The world is smaller and the live enemy count lower than a native-engine open-world game.
- The four-person Ravelfront party is retained instead of copying COD's initial squad size.
- The main goal and extraction are simpler; there is no kill-every-enemy extraction requirement.
- Story is delivered through field records and playable operations, not motion-captured cinematics.
- Art is stylized Ravelfront geometry. This does not reproduce COD's photoreal materials, facial capture, dismemberment, licensed soundtrack, military assets or voice cast.
- Transport boarding is an explicit interaction within a landing zone, not a fully simulated walkable aircraft interior.
- No PvP weapon tuning changes, region blocking, mobile expansion or live AI inference service.

Box Fights Update 174 is preserved. The host repository's existing automatic deployment remains the publishing route.
