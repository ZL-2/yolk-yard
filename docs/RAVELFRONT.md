# Ravelfront — A New Frontier

Version 3.0.0 / multiplayer protocol 20. Published Quality Update numbering is derived from the last successfully deployed release, not CI attempts. This document supersedes older design notes.

## Identity and research

Ravelfront combines the image of an unravelled relay network with a contested frontier. Ravel Coast's crews salvage abandoned coastal research and freight infrastructure after a network collapse. Graphite/navy, sea teal and signal amber identify equipment, navigation and warnings. The wordmark and angular R insignia are original SVG/CSS assets; no commercial game artwork or character assets are used. The new Kestrel is a four-rotor cargo aircraft.

On 28 September 2026, exact-name web searches for “Ravelfront”, combinations with game/gaming/trademark, and searches scoped to USPTO, Justia and Trademarkia did not identify an established game or gaming brand with that name. A returned cycling PDF contained a broken “TRAVEL Front” phrase. This is a preliminary collision check, not formal trademark clearance.

Combat reference research includes Epic's [Shooting Test #1](https://www.fortnite.com/news/shooting-test-1), which is explicitly historical, and Epic staff's [Wild Weeks / v39.51 changes](https://communities.epicgames.com/thread/wild-weeks-return-with-og-unvaults-power-hours-and-a-buncha-bars/HE3O), checked during this update. The latter describes a weapon-specific 1.75× rifle headshot multiplier, temporary hunting-rifle tuning and range-dependent projectile behavior. This supports separate head/body handling and per-weapon rules, not a universal current Fortnite damage table. Ravelfront retains its own tested fictional weapon values: head multipliers range from 1.5× to 2×, with 1× for the launcher. Torso and limbs share body damage; no separate limb multiplier. No claim of exact current Fortnite parity is made.

## Characters, weapons and performance

`humanoid.js` builds one sculpted skinned surface per operator: shaped torso, neck, facial features, shoulder/arm/forearm, palms and curled individual fingers, hips, thighs, calves, knees, fitted boots and outfit equipment. It uses a 32-bone reusable skeleton contract. An outfit changes mesh color, face/skin, hair/helmet and equipment details without changing gameplay code.

The body has 7,810 vertices and 11,160 triangles. Identical outfits share geometry and vertex-color material; each actor has its own bone transforms. Invisible third-person arm surfaces were replaced with lightweight grip targets. Distant actors animate at 20 or 10 Hz; nearby actors at render rate. Clocks continue at distance. Gameplay snapshots transmit movement/action state, never bones. Existing interpolation and sparse world snapshots remain.

Locomotion derives gait distance from actual velocity, with linear stance travel, lifted swing, foot orientation, two-bone legs, acceleration/stop blending and restrained turning lean. Layered arms follow category-specific grips and reload targets. States include idle, walk/backpedal/strafe, run/sprint, jump/fall/land, draw/holster/switch, ADS/recoil/reload, tool swings/harvest, building/editing, item use, throw, skydive/glide and elimination. Existing gameplay has no crouch, slide or swimming mechanic, so none is presented as implemented.

The fixed human movement capsule has radius .32, height 1.85 and eye height 1.70. Head and body ellipsoid regions are independent of cosmetics, account for yaw and flight pitch, and are evaluated by the elected simulation host. Hitscan and moving projectiles use the same anatomical regions. Weapon models, sockets and authoritative muzzles share viewmodel scale/offsets. Navigation now uses those human dimensions and explicit authored stair lanes. Full-body visual IK is presentation, not a source of hitbox size.

Audio adds restrained distance-based soil, wood, metal and stone steps plus human landing/equipment/damage cues. No speech samples or third-party sounds are used.

## Migration and cosmetic catalog

The browser storage namespace and relay room addressing are intentionally retained for compatibility. These internal identifiers are not game branding. Existing wallets retain balances, earned totals, receipts, favorites, presets and all 84 owned IDs. An identity-version migration marker records 1:1 conversion; previous ownership is also retained in the migration record. The 12 collections replace their predecessors at the same prices. Profile, multiplayer identity, settings, keybinds and historical statistics are not reset. Old release numbers remain; obsolete themed notes are archived under neutral labels.

The Locker shows the full equipped operator, inspection rotation, six actual model previews, presets and uniform colors. The Outfitter has 12 original collections with multiple outfits, field tools, wraps, packs, gliders and trails, with purchase confirmation, ownership checks and equip integration. Marks use a compact hexagonal M token. Local browser storage remains the account model; this update does not claim synchronized registered accounts.

## Reward policy and authority boundary

Only the relay issues online match receipts. Old client minute and elimination payouts are removed. Browser wallet application is idempotent. Combat is still simulated by the elected host; this is not a dedicated authoritative game simulation or an anti-cheat service. The relay independently validates connected human identities, uses its own wall clock, observes authenticated guest inputs and calculates reward policy. It never accepts a client's wallet balance or proposed reward amount.

Eligibility requires a match of at least 90 real seconds, 45 active seconds, an activity fraction, and meaningful distance, damage or contributions. Spawn Island and offline practice produce no rewards. AFK removals are disqualified. Humans only add population value if they qualify as participants. Bot weights are Casual .10, Intermediate .25, Advanced .45 and Impossible .65; human opponents are 1.0. Population is capped at 32 and scales as `1 + .48 × log2(population)`. Placements, victory, up to 15 weighted eliminations and five assists contribute. Active engagement scales the result. Custom rooms use .55. Maximums are 600 Marks per match and 900 per hour per browser identity. Repeated opponent eliminations taper after two in the rolling hour and stop adding combat value after four.

Illustrative public victory base budgets, before elimination/assist bonuses:

| Contestants | All eligible humans | Casual bots | Intermediate bots | Advanced bots | Impossible bots |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2 | 148 | 15 | 37 | 67 | 96 |
| 4 | 196 | 20 | 49 | 88 | 127 |
| 8 | 244 | 24 | 61 | 110 | 159 |
| 16 | 292 | 29 | 73 | 131 | 190 |
| 32 | 340 | 34 | 85 | 153 | 221 |

The 32-human column is a policy comparison; the current networking capacity remains 16 humans plus fill bots. Public/custom provenance is assigned by matchmaking rather than trusting the host's visibility setting. Match receipts update per-mode wins, matches, eliminations, assists and Royale placements; existing historical totals remain untouched.

Progression receipts, hourly totals and opponent-pair counters are atomically written to `RAVEL_REWARD_DATA_PATH`, or next to the existing owner history file when configured. Without a persistent disk they survive process restarts on the same filesystem but not replacement deployments. Browser balances remain durable independently. Browser-local identities and host-simulated combat inherently cannot provide full anti-cheat or prevent identity resets; no such guarantee is made.

## Inactivity and Spawn Island

59 seconds without meaningful play triggers removal, with a warning in the last 12 seconds. Actual displacement, substantial look changes and validated combat/build/loot actions count. Packet arrivals, idle animation, slot toggles and fixed repetitive signatures do not. Loading, transport, recovery and dead spectators do not accrue idle debt. The simulation handles immediate HUD state; the relay adds a wall-clock guard for online matches. AFK removal cannot qualify for match progression.

Online warmup is 30 seconds, replicated from the host's deadline. Existing real-human full-capacity early start remains. More than 100 validated points cover eight dry island regions, with occupancy balancing and minimum separation. Bots keep spawn-region homes, wander locally, pause, practice movement and only occasionally fire from the range area. Practice gear and kills reset at departure.

## Verification

Focused checks cover migration, every weapon grip, anatomical regions, finite rig states, reward matrices and farming bounds, AFK activity, 32-contestant distribution, authored stairs, building/editing, loot, countdown and host recovery. The rebrand browser suite produces an operator/action contact sheet, lobby/Locker/shop/mobile captures and populated-island diagnostics. Party/Duo and real WebSocket suites remain deployment gates. Live verification requires the exact deployed build SHA, matching relay protocol/features, responsive UI and a two-client party match reaching its shared transport phase.
