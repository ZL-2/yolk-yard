# Ravelfront Zombies — research and design record

> Historical design for Update 173. Update 175 replaces its round-based format with timed open-world extraction. See [BLACKTIDE_EXTRACTION_DESIGN.md](BLACKTIDE_EXTRACTION_DESIGN.md) and [UPDATE_175.md](UPDATE_175.md) for the current rules. The original-only asset statement below describes that older release; Update 175 also includes credited third-party CC0/CC BY assets.

Research date: 17 October 2026. This is an original cooperative survival mode, not a port of Call of Duty. Names, map geometry, narrative, models, effects, music and sounds are original. No Activision assets are included.

## What the generations teach us

| Generation | Verified reference / distinction | Decision for Ravelfront |
|---|---|---|
| World at War | The origin of the mode: enclosed survival spaces, escalating waves and routes purchased through an initially small environment. The later maps developed the power/perk/upgrade loop. [1,2] | A vulnerable pistol start, a recognizable arrival yard, purchasable routes and a power objective. |
| Black Ops | Expanded the survival maps and their environmental objectives. Its maps were among those remastered in Chronicles. [2] | Distinct interconnected zones, useful traversal loops, traps and secrets; preserve readable combat space. |
| Black Ops II | Activision distinguishes TranZit, endless Survival, and competitive 4v4 Grief. [3] | Survival and exploration within one bespoke map. Grief is incompatible with the cooperative focus. No sprawling vehicle transit dependency. |
| Black Ops III | Complex quests, Wonder Weapons, GobbleGums and separate Zombies progression; Chronicles revisits eight earlier maps. [2,4] | Optional multi-stage main quest and unusual weapons. No consumable monetization or out-of-match advantages. |
| Black Ops 4 | Preselected perks, specialist weapons, Elixirs/Talismans and custom mutations radically customize a run. [5,6] | Field abilities and controlled choices, but map machines remain meaningful. No unrestricted reward-bearing custom rules. |
| Cold War | Rarity and armor, salvage crafting, upgradeable perks, field upgrades and optional voted exfil. Outbreak is a different, objective-led large-region experience. [7,8] | Recoverable co-op mistakes, bounded armor, three weapon upgrade tiers, a single crafting resource and optional extraction. No Outbreak-scale map. |
| Modern Warfare Zombies | An open-world PvE extraction format for up to 24 players in eight squads of 1–3. [9] | Useful lessons for clear objectives and extraction; persistent loadout imports and many squads would undermine the classic run economy. |
| Black Ops 6 | Returns to round-based play; single salvage resource, rarity/ammo mods, explicit main quests, optional guidance, readable HUD and stability features. [10,11] | Clear station prompts, quest journal, revival status, immutable purchase authority and reconnect continuity. No large augment grind before a player can participate. |
| Black Ops 7 and 2026 updates | Round-based play, Survival, Cursed variants, broader customization and ongoing map/mechanics updates. Cursed Survival deliberately revisits pistol starts and a BO3-inspired points model. Patch notes document pathing, lingering last enemies, UI and stability fixes. [12–15] | Preserve a focused pistol-start loop; build stuck-enemy recovery, bounded effects and explicit terminal-state handling from the outset. |

Enjoyment is not universal. The design inference from the series is that route knowledge, resource decisions, teamwork, readable danger, optional discovery and escalating pressure reinforce each other. Official BO6 reporting says main-quest completion rose from 3.38% to 8.23% after Directed Mode [11]; that supports offering clues without making the optional quest mandatory. This is not evidence that every player prefers every modern system.

## Numerical evidence versus original tuning

Confirmed in the cited official material: classic/modern round-based co-op supports up to four; Cold War exfil becomes available after round 10 and every five rounds thereafter with a co-op majority; BO6 describes three Pack-a-Punch tiers; the official Liberty Falls guide names a 5,000 Essence first upgrade; BO7's deep dive prices its random weapon machine at 950 Essence; MWZ supports 24 players in eight squads of up to three. [7,9,10,12,16]

The exact historical health curves, hit-point awards, per-round enemy caps, aim assist, special spawn odds and pathfinding algorithms are not established by those official guides. Community formulas vary by title, map and patch. They are **not treated as confirmed values or copied**. All Ravelfront numbers below and in `src/zombies-config.js` are original tuning, to be checked against its weapon speeds, player movement, map distances and multiplayer budget.

Economy comparison: classic hit-based rewards encourage early weak-weapon use and melee optimization but enable deliberate point farming. Modern elimination-centered rewards reduce that behavior but make failed kills less rewarding. Ravelfront uses bounded damage credit (a per-enemy budget shared among contributors), kill/critical/melee awards and capped assists. No rewards for damaging dead enemies, healing enemies, shooting barriers or repeat interaction spam.

## Feature matrix

| System | Status / coherent equivalent | Browser and authority constraints |
|---|---|---|
| Rounds / intermission / special waves | Essential: finite wave population, indefinite wave counter, bounded simultaneous population | Authority owns all clocks; health/speed/damage cap; pressure and variety carry later waves |
| Spawn director | Essential: unlocked-zone entrances, distance checks, emergence animation | Queue the population instead of allocating a whole wave; recover stuck stragglers |
| Pursuit / crowd navigation | Essential: shared reverse navigation fields toward living players, local separation | Rebuild fields on a staggered schedule and door changes; no A* per zombie per frame |
| Eight enemy classes | Essential: distinct pursuit, armor, charge, leap, pulse and boss attacks | Telegraphs and melee reach verified by authority; capped specials |
| Points / crafting | Essential: Charge points and Scrap, separate from Marks | Atomic purchase, range/visibility/power/zone checks, bounded wallets |
| Random weapon machine | Essential: Signal Cache with weighted roll, exclusive claim, relocation | No paid real-money randomness; authoritative result and expiry |
| Wall weapons / ammunition | Essential: labeled weapon racks and ammo refills | Check weapon ownership and upgraded ammo price |
| Perks | Essential: Iron Pulse, Quickwire, Longstride, Lifeline, Glass Eye, Second Wind | Four equipped; no duplicates; downing loses newest, bleed-out loses all |
| Weapon upgrades | Essential: Resonance Forge, three tiers | Damage/magazine/reserve/visual changes; no PvP stat mutation |
| Rarity / ammo mods | Selective: three salvage grades; chill, chain and burn | Explicit cooldown and target caps; independent of upgrade tiers |
| Special weapons | Essential: Arc Loom, Rift Driver, Cinder Lance | Distinct bounded crowd-control roles; finite ammo and acquisition paths |
| Power / doors / shortcuts / traps | Essential: map unlock graph and optional defenses | Collision and navigation change together; closed zones stay inaccessible |
| Barricades | Selective: entrance shutters absorb breach time; limited repair rewards | Repair cannot become a farming loop or mandatory between-wave chore |
| Power-ups | Essential: shared ammo, double points, overcharge, chill and guard | Finite lifetimes and pickup count; synchronized duration |
| Downing / revive / spectate | Essential: bleed-out, hold revive, solo recovery, next-wave return | Team wipe only when no valid recovery remains; no free respawn command |
| Main quest | Essential: restore power, find three relay cores, solve order puzzle, charge conduits, boss finale | Solo completable; no simultaneous four-person switches; shared progress |
| Side discoveries | Essential: logs, hidden cache and station trial | Once-per-run rewards; independent from required survival progression |
| Boss | Essential: original Bellwether with telegraphed slam, pulse and summons; attack rotation changes as health falls | No unavoidable instant attacks; arena remains navigable |
| Exfil | Essential: majority vote, rendezvous, timed final wave | Disconnect-aware vote; definitive success/failure; no duplicate payout |
| Equipment / field abilities | Essential: fragmentation, decoy, pulse, sanctuary | Charges/cooldowns; nearby limits; damage respects walls |
| HUD / tutorial / results | Essential: round, enemy pressure, economy, team, objectives, stations, controls | Stable DOM; no 60 Hz large HTML reconstruction |
| Sound / music | Essential: original synthesized cues, restrained ambience and proximity vocals | Concurrent voice limits, distance/occlusion, release all nodes on exit |
| Art / animation | Essential: original diseased human silhouettes, articulated gait, attack and death | Instanced limbs, deterministic phases, distance LOD, bounded corpses |
| Progression / career | Essential: separate verified Zombies record and Marks | Server simulation only; AFK filters, idempotent receipts, capped hourly rewards |
| Solo–four player matchmaking | Essential: existing social/party admission, fixed public rules, private capacity | Whole-party reservation, defined late join, connection grace; lobby leader is not simulation owner |
| Large open world / many squads / player buildings | Unsuitable for this release | Conflicts with map progression and CPU/network goals |
| Persistent combat advantages / consumable shop | Incompatible | Would weaken pistol-start balance and introduce farming incentives |
| Multiple full maps / every historical variant | Optional future expansion | One complete bespoke map establishes a coherent, maintainable system |

## Original identity and map

**BLACKTIDE RELAY**: a storm-battered coastal signal station whose experimental resonance lattice has fused the missing staff into an infected collective. The operators are sent to restore the beacon, discover the failed evacuation, and choose between shutting the lattice down or escaping with its records.

Arrival Yard → Pump Hall / Freight Arcade → Reactor Court → Signal Gallery → Beacon Platform. Connecting routes open loops rather than a single dead-end corridor. Covered interiors, an elevated gallery with two stairways, a central machinery landmark, a secret archive, an extraction pad and service openings provide distinct spatial identities. Emergency amber contrasts with cool coastal fog and restrained cyan resonance effects. Human enemy silhouettes use workwear, maintenance armor and exposed lattice growth, never eggs or copied COD creatures.

Design constraints: no required copyrighted reference asset, no copied quest puzzle, no global damage mutation, no client-issued rewards, no zombie simulation in the PvP player collection, no unbounded event/corpse/projectile history. Public/private Zombies run under the relay's authoritative simulation so closing the party leader's browser cannot destroy the only copy of a live run.

## Sources

1. Activision, franchise retrospective (2023): https://www.callofduty.com/blog/2023/10/call-of-duty-20th-anniversary-celebration-franchise-recap-community
2. Activision, BO3 Zombies guide: https://www.callofduty.com/es/blog/archives/bo3-zombies-guide
3. Activision, BOII launch announcement (2012): https://investor.activision.com/news-releases/news-release-details/future-blacktm
4. Official BOIII product and progression overview: https://www.callofduty.com/blackops3
5. Activision, Black Ops 4's New Zombies Adventures (2018): https://www.callofduty.com/blog/2018-10/new-zombies-adventures.html
6. Activision, BO4 Zombies Details: https://www.callofduty.com/ar/blog/archives/call-of-duty-black-ops-4-zombies-details
7. Treyarch, Cold War Zombies Gameplay Guide (2020): https://www.treyarch.com/game-intel/2020/10/Black_Ops_Cold_War_Zombies_Gameplay_Guide
8. Activision, Mauer der Toten / Outbreak guide (2021): https://www.callofduty.com/blog/2021/07/black-ops-cold-war-zombies-mauer-der-toten-tips
9. Activision, Modern Warfare Zombies overview: https://www.callofduty.com/guides/zombies/call-of-duty-guides-modern-warfare-zombies-overview-and-lore
10. Treyarch/Blizzard, BO6 full gameplay overview (2024): https://news.blizzard.com/en-us/article/24121368/black-ops-6-zombies-what-you-need-to-know
11. Treyarch/Activision, 115 Day and Directed completion data (2025): https://www.callofduty.com/blog/2025/01/call-of-duty-black-ops-6-zombies-115-day-announcement
12. Activision, BO7 Zombies deep dive (2025): https://www.callofduty.com/ca/en/blog/2025/09/call-of-duty-black-ops-7-zombies-deep-dive
13. Activision, BO7 launch Zombies (2025): https://www.callofduty.com/blog/2025/11/call-of-duty-black-ops-7-launch-zombies
14. Activision, BO7 Season 02 (2026): https://www.callofduty.com/blog/2026/01/call-of-duty-black-ops-7-warzone-zombies-season-02-announcement/
15. Treyarch, BO7 Season 01 fixes: https://www.callofduty.com/patchnotes/2025/12/call-of-duty-black-ops-7-season-01-patch-notes
16. Activision, BO6 Liberty Falls guide: https://www.callofduty.com/guides/blackops6/zombies/call-of-duty-guides-black-ops-6-round-based-zombies-liberty-falls

Research distinguishes observed series features from implementation choices. Performance measurements and shipped behavior are recorded separately after implementation; these budgets are not benchmark claims.
