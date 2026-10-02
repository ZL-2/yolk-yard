# Season 1 — The Fortified Coast

Version 4.1.0 / protocol 32. Quality Update 118.

## Locations

| Place | Identity and changes |
|---|---|
| Relay Borough | Clock tower, occupied market arcades, warm civilian facades and signal-corps checkpoints |
| Northfield Commons | Three grain elevators, ration depot, red agricultural buildings and abandoned convoy supplies |
| Aster Command | Voss's fortified command house, twin battlements, observatory dome, banners and underground archive vault |
| Breakwater Docks | Tall cargo gantries, blue freight buildings, stranded equipment and port drainage tunnel |
| Sable Woods | Ranger cabins, fire lookout, timber piles and deserted field hospital |
| Ironwake Quarry | Mine headframe, conveyor, excavator and repair yards |
| Sunward Terraces | Pale stepped resort roofs, pergolas, water tower and medical evacuation camp |
| Signal Heights | Three radar masts, uplink buildings and crashed equipment |
| Crater Conservatory | Research biodomes, basin-side laboratories and sample storage |
| Fourteen small landmarks | Individual equipment, roof bands, signage and stories: fuel, rescue, mill, beacon, relay, depot, pump, observation camp, orchard, salvage, field kitchen, cave refuge and drainage maintenance |
| Three bridges and connecting roads | Crossings, settlement access spurs, service routes and checkpoint approaches |
| Aster Relay arena | Twin dish spires, blue operations huts, signal core and checkpoint cover |
| Breakwater Docks arena | Orange overhead cargo frame, freight alleys, gantry deck and underpass |
| Ironwake Foundry arena | Copper exhaust stacks, service passages, pipework and furnace cover |
| Kestrel Forward Airfield | Runway, parked tiltrotor, taxiways, maintenance hangar, operations hut, observation tower, staging supplies, medical shelter, practice range and movement course |

## Gameplay

- Voss patrols four points inside his command house. Acquisition takes 1.35 seconds; shooting occurs in 0.42-second bursts every 3.4 seconds, with wider aim error, limited turn rate and line-of-sight checks. His health/shield and ordinary legendary rifle statistics are unchanged.
- Voss drops one keycard alongside the existing legendary rifle and mythic Jump Rig. Equip the card for a directional distance/elevation panel, dotted world route and map guidance. Hold Use for two seconds at the reader; the authority consumes one card and unlocks the vault. A vault contains exactly two Epic Chests and two regular chests. Locked vault chests cannot be opened from outside, and its shell cannot be destroyed to bypass the gate.
- Floor loot is Common–Rare (58/29/13 weighted weapon rarity split; launcher retains its Rare minimum). Seven percent of ordinary chest spawns become Epic Chests. Every Epic Chest guarantees an Epic (75%) or Legendary (25%) weapon with matching ammo and a support item. The two designated regular vault chests remain regular.
- Tactical sprint accelerates to 8.8 m/s in Royale. It spends 18 stamina/second; stamina recharges at 22/second after a 1.1-second rest. Exhaustion requires 25 stamina before restarting. Weapons lower, strides lengthen and knees lift; firing interrupts sprint and observes a 0.2-second weapon-raise delay. Shared movement rules also cover arena sprint.
- Authoritative building-entry doors support Use to open/close, sprint-through, player-safe closing, 180 health and destruction. Bots open doors on their routes. Upper-floor open passages remain open.
- Exactly three zip lines and three ascenders serve Aster Command, Ironwake Quarry and Breakwater Docks. Shared simulation and client prediction follow the same collision-checked routes. Jump releases a ride; traversal prevents firing and item use. Platforms have clear dismounts.
- Existing destructible walls/props show three stages of darkening, fissure shading and small chips before removal. Updates modify only affected ranges in existing static batches; damaged doors and player-built pieces also show wear.
- Online private Royale launches enforce 48 contestants with bots filling empty seats. Human arrivals replace bots. Manual room start, invite codes and party/team handling remain. Offline training retains its smaller roster.

## Presentation and performance

- High-contrast field palette defines foreground and background together across Settings, Help, private rooms, forms and dialogs. Room codes and secondary buttons are readable; focus states remain visible.
- Aster Command has a prominent boss/vault ring and label on the island map. Epic Chests use a distinct armored violet design. Season 1 briefing and Help explain the new mechanics.
- Static scenery and traversal hardware are batched; doors/chests are created near the observer. Damaged geometry updates only when its visible stage changes. Navigation remains cached, bot path searches budgeted, and keycard route geometry updates at 10 Hz only while equipped.

## Focused verification

`node --test tests/world-overhaul.test.js tests/season-one.test.js tests/royale-teammate-bots.test.js tests/snapshot-codec.test.js tests/weapon-balance.test.js tests/hitbox.test.js`

`node scripts/world-overhaul-browser-check.mjs`

The world suite checks loot, boss patrol/drop, vault stairs both ways, locked access/consumption/checkpoint restore, all six traversal routes both ways, door collision/destruction/snapshot parity, tactical stamina/recovery and staged batched damage. The browser suite checks computed contrast, real private code join and manual start, 48 seats on host and guest, airstrip rendering, replicated door state, map prominence and the equipped-keycard/vault flow.

Transport checks cover all 48 contestant connections plus spectator channels, the boss in a full snapshot, bounded queued controls after a stalled host frame, and continued rejection of sustained floods. The two-browser check stalls the host for four seconds before verifying the guest remains connected and receives the authoritative door state.

A 600-tick, 48-contestant simulation sample averaged 2.95 ms per tick (p95 6.05 ms; p99 9.78 ms). This measures simulation CPU work, not GPU frame rate or a guarantee across devices.
