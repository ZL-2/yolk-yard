# Quality Update 53 — Hatch, Drop & Outplay

This release extends Sunnybreak Reborn (Quality Update 52). It preserves its nine districts, 17 landmarks, modeled blasters, configurable optics, distinct ammunition, authored loot sockets, harvesting, building and maps. Protocol 16 prevents older clients from entering rooms with incompatible phase and inventory rules.

## Match flow and authority

`royale-phases.js` defines waiting → spawn-island → starting → battle-bus → drop → active → ending → finished. The transport's generic `phase` remains lobby/playing/results for compatibility; gameplay decisions use the authoritative Royale stage. Clients derive the current map from that stage, including during recovery.

Hatchling Atoll is a separate 128 m practice island with a terminal, stairs and roof deck, cargo area, target range, palms, benches, beach and hopping pier. Twenty collision-checked spawn points are selected with occupied-position rejection. Contestants have temporary practice blasters and building materials. Damage, eliminations, streaks, placements and currency rewards are disabled. Static scenery is reconstructed locally.

The host owns a 30-second countdown and requires at least two contestants (including configured bots). The last five seconds enter `starting`. Contestant admission stays open until the atomic Battle Bus transition. That transition replaces the map, navigation graph, builds, destruction, loot, chests, projectiles, inputs, effects and temporary powers; it resets health, shield, inventory, ammunition and materials. Cosmetics persist. The rematch returns to a fresh Atoll and resets tip dismissal.

After departure, public listings say Spectate. Up to eight late spectators occupy separate seats beyond the sixteen contestants. Their health is zero; they are excluded from collision, damage, pickup, build, harvest, team balance, alive count, placement and victory logic. Forged rejoin/respawn/input commands do not admit them. Existing spectator controls follow living players. Match identity, stage, contestant flags, random state and loot survive host transfer. A departing contestant's existing bot takeover behavior preserves that contestant's life; spectators never create a replacement contestant.

## Falls, launches and dropped items

`airborne.js` tracks airborne apex and landing in the same collision substeps used for movement and guest prediction. The host applies damage on the actual landing, directly to health. Small jumps and drops are safe. Landing above the original floor reduces the measured fall. The terrain normal reduces damage on slopes.

Reference decisions:

- Epic's [September 2017 BR balance notes](https://www.fortnite.com/news/ea-1-6-3-release-notes) document the classic threshold: just over three stories begins at 10 damage; six stories becomes lethal, with slope reduction. Yolk stories are four world units. Above 12 units, damage is `10 + 90 × ((fall − 12) / 12)²`, multiplied by the squared upward surface normal. This intermediate curve is Yolk tuning, not an assertion that Epic publishes that formula.
- Epic's [Showdown Act III announcement](https://communities.epicgames.com/thread/showdown-act-iii-moving-into-the-next-era-for-zero-build/5FiD) changes otherwise lethal falls in noncompetitive Build/Zero Build to leave one HP, remove shield and add a recovery state; competitive is excluded. This update deliberately keeps lethal ordinary falls, as requested, rather than adopting that newer nonlethal rule.
- Epic's [Shockwave Grenade announcement](https://www.fortnite.com/patch-notes/v5-30-content-update) specifies fall protection for the resulting launch. Yolk's Shock Egg grants one landing's immunity without glider deployment. Ordinary impulses remain vulnerable. Launch Nests explicitly force their intended glider; Bus exits explicitly permit deployment. Height alone never redeploys a glider after an ordinary launch.

The central launch policy records immunity, redeploy permission, forced glider and source independently. Landing clears all of them. Normal terrain/build falls, destroyed support and higher landing platforms use the same state machine.

`loot-motion.js` wakes support checks when geometry changes. Unsupported pickups and chests descend under gravity, stop at the next valid support, and resume the existing upright/hover presentation. Airborne inventory drops and eliminations begin at their actual height. The host sends motion parameters on wake and authoritative positions at rest, not a new loot payload every frame. Guests interpolate the same trajectory. Geometry changes nudge intersecting items to validated accessible positions; terrain provides the final floor. Contents, ownership and chest-open state remain authoritative.

## Shared bot intelligence

The same perception, objective and navigation modules run in Royale, FFA and Team Scramble. Local bot play uses its selected underlying mode. The host runs AI; clients receive normal actor snapshots.

- **Perception:** forward field of view plus collision line of sight, gunfire/build/impact events, approximate incoming-fire bearings and short-range team callouts. Observations copy last known positions and velocity. Confidence decays; search memory expires. Hidden actors are not tracked through walls. Bots never fire at an invisible remembered target.
- **Threats:** visibility, confidence, recent damage, distance, observed vulnerability and target commitment influence selection. Damage interrupts strategy. Commitment avoids frame-by-frame target switching; large new threats can override it.
- **Objectives:** fight, seek cover, retreat, investigate, support, resupply or patrol in arenas. Royale adds real ground/chest looting, useful ammunition, rarity/category upgrades, healing, shield, material harvesting, defensive building and mobility use. Useful loadouts reduce looting priority. Authored rooms guide searches; actual hidden loot rolls are not revealed.
- **Storm:** travel-time estimates and a safety margin trigger rotations before damage starts. Escaping the storm overrides distant fights. Safe POIs and landmarks provide purposeful later-game searches.
- **Combat:** weapon-specific distances, limited prediction from observed motion, imperfect bursts, turning limits, repositioning and cover. Basic defensive walls/stairs use the same placement validation and finite material costs as players. Healing stops when threatened.
- **Navigation:** cached map graphs, door interaction, step/slope checks, cliff avoidance, local obstacle steering, separation, progress tracking and bounded recovery routes. Geometry revisions invalidate paths after edits or destruction. Boats/swimming, vaulting and a general parkour planner are not systems this game currently has.

| Difficulty | Reaction delay | Strategy interval | Memory | Main difference |
| --- | ---: | ---: | ---: | --- |
| Casual | 0.85 s | 2.4 s | 5 s | Slower recognition, simpler movement, less cover/build use |
| Intermediate | 0.52 s | 1.7 s | 8 s | More reliable searches, equipment choices and retreats |
| Advanced | 0.28 s | 1.1 s | 11 s | Stronger positioning, prediction and earlier rotations |
| Impossible | 0.18 s | 0.75 s | 14 s | Fast, fallible execution with the same information and resources |

`bot-config.js` also centralizes hearing, sight, aim error, burst timing, turn speed, cover preference, building chance, retreat threshold and storm margin. No difficulty gains extra health, ammo, materials, perfect accuracy or global enemy coordinates. Chests are discovered by sight or within the same twelve-unit hum radius players hear; bots do not read unopened contents. Footstep perception has an explicit capability switch and stays disabled because movement audio is intentionally silent in the current game. Team callouts carry an observation, not a live enemy feed.

Visual perception runs every 0.13–0.28 seconds; strategy runs less frequently. Royale bot inputs are cached for 85 ms. At most two full path queries run in a simulation tick; recovery searches have fixed distance and node budgets. No static map geometry or procedural glide pose adds recurring network traffic.

## UI and animation

The Shell Market uses original cream, teal and yolk styling, rendered cosmetic imagery, clear rarity/category/price information, collections, filters, favorites, purchase confirmation and responsive layouts. Keyboard arrows/Home/End navigate cards; existing purchase, equip and saved-loadout behavior remains. All six Locker slots show the actual equipped model or an explicit starter/empty preview. Outfit preview cache keys preserve the cosmetic's real asset identity.

A compact egg icon and formatted balance sit beside account statistics. Wallet subscriptions update balances immediately; the shop retains the balance needed for purchases. Currency remains earned, local-browser progress, with no real-money purchases.

The upper arena streak banner is triggered by the real authoritative `streak-bonus` event. It announces the earned upgrade, then keeps compact timers only for timed powers. Shield/overheal show their actual remaining state; Restock has no fake countdown. Royale cannot award or display arena streak powers.

Glider deployment, turning, forward lean, subtle body sway and landing blend from existing velocity/orientation state for local and remote eggs. No animation packets are needed. Pickaxe now occupies the first hotbar slot (1), items occupy 2–6, and P is the dedicated pickaxe shortcut. Existing customized bindings remain editable. L closes flight tips independently of movement, mouse lock and glider actions.

## Essential verification

- The 191-test suite passed, including a complete seeded sixteen-bot Royale round: twelve contestants acquired weapons and the match reached valid results.
- Focused regression coverage checks admission, spectator isolation, reset/checkpoint state, falls and slope/landing conditions, launch immunity, support destruction, airborne drops, sparse loot versions, perception limits, objective priorities, difficulty and smooth glide blending.
- A real local WebSocket relay run connects a host, early human guest, late spectator and bots. It checks Spawn Island movement, synchronized Bus departure, rejected forged spectator actions, guest glider inputs, Shock Egg immunity, shared final loot positions, host migration and rematch reset.
- Browser checks exercise the real play menu, Spawn Island movement, slot selection, Bus/map handoff, flight tips, deployment, mobility, rematch and arena streak HUD. Shop checks cover purchases, actual images, equip, presets, persistence and mobile overflow.

The Pages workflow runs the authoritative relay flow in addition to its existing unit and network gates. Deployed version and browser verification are recorded with the release, not inferred from local source files.
