# Blacktide Extraction — Update 175 implementation record

## Direction and evidence

The current brief supersedes the round-based design in Update 173. The game now uses a shared, timed PvE world with independent extraction. Its mandatory instruction fits in one sentence: **complete three gold contracts, then call and board a green extraction transport**. The contract goal guides beginners; it does not lock early escape. Story acts and high-threat encounters are optional.

Official MWZ material confirms a 24-operator PvE world, initial solo/duo/trio deployments, in-world squads of up to six, squad-owned contracts, cooperating strangers and separate story progression [1]. The equipment guide distinguishes insured weapons, contraband, backpack acquisitions and schematic crafting cooldowns [2]. The launch overview describes rarity tools, weapon-upgrade crystals, ammunition mods, perks and field abilities [3]. Later acquisition and mission guides describe powerful endgame items and optional Rift progression [4,5]. These are reference mechanics, not permission to copy assets or a specification for the original engine's internals.

All Blacktide numerical tuning below is an **original design decision**, not a claim about COD's exact formulas, spawn budgets, pathfinding or damage calculations. This release retains Ravelfront's four-person starting party, uses a smaller browser-scale map, and simplifies extraction. It does not merge the old round-clear, purchased-route or exfil-vote requirements into the new format.

## Rules and implementation boundaries

| Parameter | Blacktide implementation |
|---|---|
| Public session | Up to 24 operators, subject to server workload admission |
| Private deployment | Solo, duo, trio or four operators |
| In-world squad | Consent-based joining, up to six |
| Late admission | First 10 minutes; existing players retain the current world |
| Clock | 25 minutes exploration, then 5 minutes contamination shutdown |
| Map | 360 × 360 meters, nine districts, three threat bands |
| Main goal | Three contracts; then green extraction; early extraction allowed |
| Transport | 35 seconds inbound, 25 seconds boarding, 8 seconds departure presentation |
| Boarding | Explicit interaction; stay within nine meters until departure |
| Final route | Contamination starts in the southwest and reaches the northeast final site only after its scheduled departure |
| Live enemy budget | 48 active; eight retained corpses; bounded reuse pool |
| Director | Once per second, at most three new enemies per director pass |
| Replication | Controlled 20 Hz snapshots with shared/delta encoding |
| Weapon scaling | Five rarity grades and three separate resonance tiers |
| Backpack | Six slots, upgradeable to nine; at most three imported supplies |
| Storage | 30 saved supplies, eight contraband weapons |
| Reward limits | Meaningful contribution gate; up to 200 Marks/run and 400/hour |

## Change inventory

This is an auditable inventory of the delivered adaptation, not a claim that every MWZ asset, seasonal feature or production value has been duplicated. “Adapted” means a smaller original counterpart; “Excluded” identifies an intentional difference or a remaining production gap.

| # | System / change | Result |
|---:|---|---|
| 1 | Endless rounds | Replaced by a timed expedition |
| 2 | Inter-round breaks | Removed from the active format |
| 3 | Round-gated map routes | Replaced by an initially open coast |
| 4 | Required power switch | Removed as a prerequisite |
| 5 | Simple main mission | Three contracts, then extract |
| 6 | Early escape | Allowed at an available transport site |
| 7 | Optional story | Five original acts across successful deployments |
| 8 | Initial tutorial | Briefing, arrival instruction, field-map quick plan |
| 9 | Persistent objective | Updates for contracts, inbound aircraft, boarding and shutdown |
| 10 | Threat-based difficulty | Three geographical bands rather than round multiplication |
| 11 | Public worlds | Server-owned, up to 24 operators |
| 12 | Private rooms | One through four configured seats |
| 13 | Whole-party admission | Uses existing reservations |
| 14 | Ready states | Uses existing party readiness checks |
| 15 | Squad identity | Shared contracts and separate team channels |
| 16 | In-world squad joining | Nearby request and explicit acceptance, capped at six |
| 17 | Independent extraction | Does not terminate another squad's expedition |
| 18 | Late joining | Immediate deployment during the first ten minutes |
| 19 | Reconnection | Existing authenticated connection recovery retains the run |
| 20 | Leadership changes | Party leader is not the combat simulation owner |
| 21 | Match capacity | New rooms cannot evict an existing room |
| 22 | Replay | New match identity and cleared run-local state |
| 23 | Map topology | Nine linked districts with roads and exterior combat space |
| 24 | Starting area | Harbor Approach and a nearby low-threat contract |
| 25 | Buildings | 27 enterable structures with explicit collision |
| 26 | Elevation | Selected platforms, stairways and tower interiors |
| 27 | District landmarks | Harbor, airfield, hospital, freight, reactor and observatory scenery |
| 28 | World surfaces | Shared meter-scaled architecture material atlas |
| 29 | Static batching | Spatial batches bound draw-call cost |
| 30 | Loot locations | 54 initial supply lockers plus expiring enemy drops |
| 31 | Roads | Connected marked routes, safe for rover navigation |
| 32 | World labels | Distance-culled station and district signage |
| 33 | Extraction sites | Three visible, mapped landing zones |
| 34 | Optional breach | Original Lattice encounter in the shared world |
| 35 | Final operation | Story-gated Bellwether encounter |
| 36 | Recorded clues | Three discoverable field records |
| 37 | Contract terminals | 27 sites across the coast |
| 38 | Recovery contracts | Three held interactions with supply cases |
| 39 | Defense contracts | Hold a visible radius under pressure |
| 40 | Hunt contracts | Marked elite target, tracked authoritatively |
| 41 | Purge contracts | Neutralize three contaminated relays |
| 42 | Escort contracts | Protect a moving rover; progress reflects distance |
| 43 | Sabotage contracts | Disable relays defended by human mercenaries |
| 44 | Vault contracts | Timed area defense with a supply reward |
| 45 | Contract ownership | One active contract per squad |
| 46 | Interaction checks | Range and line of sight on the server |
| 47 | Held objectives | Moving away or taking damage interrupts |
| 48 | Contract expiry | Five-minute deadline and explicit failure |
| 49 | Contract reuse | Cooldown before the terminal becomes available again |
| 50 | Personal reward claims | Squad members cannot duplicate a claim |
| 51 | Spawn director | Population and pacing depend on living operators |
| 52 | Spawn presentation | Entrances, distance exclusions and emergence animation |
| 53 | Navigation | Shared reverse fields and staggered refreshes |
| 54 | Crowd separation | Local spacing avoids collapsed enemy piles |
| 55 | Obstacle traversal | Existing combat-core climbs and local obstacle handling |
| 56 | Stuck recovery | Reposition at a reachable nearby entrance |
| 57 | Ordinary infected | Human-shaped pursuit enemies |
| 58 | Runners | Faster pursuit pressure |
| 59 | Armored infected | Armor and a distinct silhouette |
| 60 | Heavy infected | Durable close-range pressure |
| 61 | Leapers | Gap-closing attack state |
| 62 | Disruptors | Equipment disruption and distinct growths |
| 63 | Elites | Rare stronger ability encounters |
| 64 | Bellwether boss | Telegraphs, multiple attacks and health display |
| 65 | Ash hounds | Animated quadrupeds and a low-health burst |
| 66 | Lure enemy | Short-range grasp/disruption counterpart |
| 67 | Mercenaries | Ranged line-of-sight attacks, not normal zombie pursuit alone |
| 68 | Colossus | High-tier contract threat with slam telegraphs |
| 69 | Humanoid locomotion | Authored clips retargeted to Ravelfront proportions |
| 70 | Attack / hit / climb | Dedicated clips with blending |
| 71 | Death / sprint | Existing licensed motion integrated with infection states |
| 72 | Animation LOD | Nearby authored rigs, cheaper distant representation |
| 73 | Actor cleanup | Bounded pool, corpse lifetime and effect limits |
| 74 | Charge economy | In-match currency remains separate from Marks |
| 75 | Scrap economy | Calibration and ammunition-mod purchases |
| 76 | Supply lockers | One claim per world locker |
| 77 | Backpack | Use, discard, capacity and visible contents |
| 78 | Armor plates | Consumable armor restoration |
| 79 | Trauma kits | Consumable health restoration |
| 80 | Filter cartridges | Bounded contamination protection |
| 81 | Self recovery | Limited recovery while downed |
| 82 | Insured loadout | Preferred weapon with failure cooldown |
| 83 | Contraband | Owned recovered weapon storage |
| 84 | Stash import | Consumes only supplies actually owned |
| 85 | Blueprint crafting | Unlocked recipes with server-time cooldowns |
| 86 | Containment | Persistent contract/extraction record |
| 87 | Anti-farming | Empty runs cannot mint starter supplies or weapons |
| 88 | Signal Cache | Weighted weapon roll, owner claim, presentation and relocation |
| 89 | Wall weapons | Priced racks and ammo behavior |
| 90 | Ammo stations | Priced authoritative refills |
| 91 | Resonance Forge | Three upgrade tiers, distinct from rarity |
| 92 | Weapon grades | Five levels with centralized PvE stats |
| 93 | Attachments | Four compact handling/magazine choices, not full COD Gunsmith |
| 94 | Ammunition mods | Chill, burn, chain, conversion and blast |
| 95 | Special weapons | Arc Loom, Rift Driver and Cinder Lance |
| 96 | Perks | Nine original perks; limited equipped set |
| 97 | Perk loss / recovery | Combat-core loss rules; insurance explicitly documented |
| 98 | Field abilities | Six charge-powered effects |
| 99 | Tactical / lethal | Decoys and fragmentation equipment |
| 100 | Sentry | Timed line-of-sight support fire |
| 101 | Mortar | Three bounded activation-position blasts |
| 102 | Bulwark suit | Temporary resistance with visible duration |
| 103 | Rescue hound | Temporary follower that attacks and helps downed squadmates |
| 104 | Field rovers | Server movement, collision, fuel and driver ownership |
| 105 | Traps | Original optional area defenses |
| 106 | Power-ups | Existing bounded shared combat buffs |
| 107 | Downed operators | Crawl, bleed-out and teammate revival |
| 108 | Bleed-out | No next-round resurrection in the new format |
| 109 | Rescue after bleed-out | Nearby interrupted recovery interaction |
| 110 | Loading protection | Loading-only rosters cannot falsely wipe |
| 111 | Contamination | Server damage, filter consumption, world boundary and map footprint |
| 112 | Final transport | Automatic end-of-session evacuation opportunity |
| 113 | Boarding UI | Live inbound/landed state with explicit BOARD action |
| 114 | After-action screen | Individual extraction, contribution and reward result |
| 115 | Tactical map | Threat bands, buildings, contracts, squad and extraction markers |
| 116 | Dedicated HUD | Timer, mission, Charge, gear, perks, fields, squad and boss |
| 117 | Screen separation | Modal layout and markers avoid the main HUD panels |
| 118 | Audio | Original cues/music plus credited recorded creature vocals |
| 119 | Voice budgets | Distance, occlusion and concurrent voice limits |
| 120 | Career | Separate Zombies contracts, kills, extractions and cooperative records |
| 121 | Authority | Clients cannot set rewards, prices, objective completion or enemy health |
| 122 | Reward settlement | Per-operator idempotent receipts before the world ends |
| 123 | Multiplayer deltas | Contracts, vehicles, loot, enemies and transports replicated |
| 124 | PvP isolation | Zombies kit modifiers do not mutate global weapon definitions |
| 125 | Existing modes | Box Fights, Royale and Arena integrations preserved |
| 126 | Desktop verification | Real party admission, contracts, purchase, crowd, boarding and replay |
| 127 | Long-session workload | Ten-minute 24-slot / 48-enemy local benchmark |
| 128 | Production parity | Excluded: photoreal assets, facial capture, cinematic campaign |
| 129 | COD content | Excluded: copied maps, characters, logos, recordings and weapon designs |
| 130 | Native-engine scale | Adapted: smaller world, fewer live enemies and compact effects |
| 131 | Separate Rift instances | Adapted: optional encounters remain in the shared map |
| 132 | Cross-session corpse recovery | Adapted: eligible Echo Keeper storage protection |
| 133 | Large vehicle simulation | Adapted: simple rovers and non-walkable transport presentation |
| 134 | Mobile / AI inference / region blocking | Excluded from this release |

## Reliability and known production limits

The model and audio licenses are recorded in `public/models/blacktide/CREDITS.txt`. Authored animation is baked; there is no runtime HY-Motion service or its memory requirement. Horde navigation and enemy state are independent of human PvP bots. Temporary enemy, projectile, effect and navigation state is bounded.

Local load-test results and the desktop acceptance scope are in `UPDATE_175.md`. Software-rendered screenshots establish scene correctness, not hardware FPS. A CPU/network budget is not a promise of zero lag under every device, network and concurrent hosting load. The existing small relay may refuse new deployments when its admission budget is reached; it must not terminate an existing expedition to make room.

This release is not a literal full MWZ clone. Boss silhouettes and behavior, world scale, route variety, story presentation, vehicle physics, attachment breadth and audiovisual production remain an original browser adaptation. No automated check establishes that every possible live-session edge case is impossible.

## Primary references

1. [Activision — Modern Warfare Zombies overview and lore](https://www.callofduty.com/guides/zombies/call-of-duty-guides-modern-warfare-zombies-overview-and-lore).
2. [Activision — Equipping your operator](https://www.callofduty.com/guides/zombies/call-of-duty-guides-modern-warfare-zombies-equipping-your-operator).
3. [Activision — Operation Deadbolt launch content](https://www.callofduty.com/ca/en/blog/2023/11/call-of-duty-modern-warfare-III-zombies-operation-deadbolt-launch-content).
4. [Activision — Acquisitions](https://www.callofduty.com/guides/zombies/call-of-duty-guides-modern-warfare-zombies-acquisitions).
5. [Activision — Missions and progression](https://www.callofduty.com/guides/zombies/call-of-duty-guides-modern-warfare-zombies-missions-and-progression).

Reviewed 17 October 2026. These sources guide the adaptation; the source code and tests, not the comparison, define shipped behavior.
