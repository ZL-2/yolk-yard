export const RELEASE_NOTES = [
  {number:'75',title:'Server Phase Diagnostics',changes:['Connection reports separate Spawn Island, departure, bus and battle timings, including maximum simulation step, broadcast work and observed callback gap. Exact departure setup time is recorded even when a full room starts early.','Measurements reset for each new round and remain available after leaving the match. Maintenance remains enabled.']},
  {number:'74',title:'Prepare the Match Before Departure',changes:['Server navigation is prepared before matches are accepted, avoiding first-room navigation stalls. Battle loot and collision data are prepared in bounded batches during the countdown, then adopted at departure.','Loot uses a saved independent seed so preparation timing and checkpoint recovery preserve the same results. Maintenance remains enabled.']},
  {number:'73',title:'Faster Match Initialization',changes:['Harvest metadata uses indexed prop lookups, reducing server work at bus departure and during harvesting. Prepared scenery keeps the object IDs needed for destruction.','Connection reports distinguish ordinary bus movement from prediction corrections and include server simulation and scheduling stall measurements. Maintenance remains enabled.']},
  {number:'71',title:'Smoother Island Departure',changes:['Battle-island geometry is prepared in small batches during Spawn Island and shaders are compiled ahead of departure, avoiding the full scene build at countdown zero.','Server loot placement uses nearby collision geometry instead of repeatedly scanning the entire island. Maintenance remains enabled.']},
  {number:'70',title:'Ready on the Front',changes:['Lobby operators now hold a planted, cinematic weapon-ready stance inspired by the supplied motion reference: natural breathing, weight shifts, head scans and occasional smooth sight checks replace continuous walking in place.','Party members share the same articulated weapon grip and idle system with staggered timing. Both boots stay grounded, cosmetics remain equipped, and lobby motion is independent of pointer input and gameplay.']},
  {number:'69',title:'Stall Recovery and Input Continuity',changes:['The authoritative server retains bounded simulation time after short scheduling stalls and catches up over several callbacks instead of discarding elapsed time.','Delayed input bursts can use time already earned on the server. Persistent overload still trims stale controls, and clients cannot gain extra movement time. Maintenance remains enabled.']},
  {number:'68',title:'Large Match Simulation Performance',changes:['Movement collision checks no longer repeatedly copy full operator records or allocate temporary candidate arrays. Stance, stairs and collision rules are preserved.','Loot pickup, chest interaction and nearby bot loot discovery use a shared spatial lookup that refreshes when items change. Server authority, contestant capacity and maintenance access are preserved.']},
  {number:'67',title:'Responsive Server Input',changes:['Overloaded servers now discard stale queued controls instead of replaying seconds of old movement. Movement remains limited by server time, and normal packet jitter retains ordered prediction.','Repeated collision bucket queries are cached and invalidated when geometry changes. Chest proximity scans run only while interacting. Maintenance remains enabled while performance is verified.']},
  {number:'65',title:'Performance and Connection Recovery',changes:['Movement input now runs independently of drawing, with bounded recovery from short stalls and server-enforced timing. Battle Royale broadcasts skip unchanged world collections and backlogged connections; catch-up produces one fresh snapshot instead of repeated stale frames.','Off-screen operators skip animation and model creation. Humanoids use conservative visibility bounds, weapon geometry reuses its baked cache, and lobby entry defers loading unused map geometry. Existing weapon artwork is regenerated from the unchanged designs.','Maintenance remains enabled with the existing server-validated administrator access. Accounts, currency and cosmetics are preserved. Refresh to use protocol 22.']},
  {number:'64',title:'Maintenance: Administrator Access Only',changes:['Public access is paused while performance and connection issues are repaired. The maintenance page offers administrator authentication using the existing server-only owner code. Production game and party connections require a valid, expiring administrator session.']},
  {
    number: "63",
    title: "Fieldcraft & Firepower: Performance Hotfix",
    changes: [
      "Urgent performance pass: bounded render resolution, adaptive GPU load, automatic expensive-shadow reduction on slow devices, and capped secondary scope rendering reduce stalls and input delay. Supersampling and multisample overhead no longer overwhelm high-resolution laptop screens.",
      "Completes the Fieldcraft & Firepower release with a guarded stance transition: entering glide or skydive clears compact crouch collision and restores the correct airborne combat silhouette.",
      "Update 62's server-owned combat, crouch/slide, Duo downing/revives, private danger pings, eleven refreshed weapons and images, original firearm audio, cinematic operator lobby and repaired owner access remain integrated. Focused browser and server checks verify this final build."
    ]
  },
  {
    number: "62",
    title: "Fieldcraft & Firepower",
    changes: [
      "All eleven firearms have refined metal/polymer geometry, one canonical name, and regenerated images projected from the actual model factory. Separate category-tuned viewmodel cameras fix camera clipping across screen sizes. Original firing and handling sound designs distinguish every firearm; short accepted-path tracers replace long yellow beams.",
      "Operators gain fuller heads, fitted clothing detail, articulated gloves and refined stance poses. A shared humanoid rig blends crouching, sliding, crawling, reviving and weapon actions. Decorative equipment never enlarges standardized combat regions. The lobby now uses an independent cinematic walking and scanning loop, with no pointer-following behavior.",
      "Hold Crouch to lower your body, camera and combat hit regions. Sprint into a crouch to slide with bounded momentum, slope response, limited steering and a cooldown. Standing requires overhead clearance. Input prediction and server validation keep movement smooth and fair.",
      "Frontier Royale Duos now supports Downed players, slow crawling, finishing and bleed-out. Hold Interact beside an eligible teammate for ten seconds to restore 30 health. Walls, range, movement and combat damage interrupt revival; abandoned progress decays. Teams with no active survivor resolve immediately, including storm and disconnect cases.",
      "Middle mouse places a world marker and Y marks danger; both controls can be rebound. Your Duo sees ownership, distance, map markers and a short notification. Server validation, replacement, expiry and rate limits prevent marker spam.",
      "Online matches now run on the relay. Browsers submit movement and interaction intent; the server owns hits, critical damage, downing, revives, teams, markers and rewards. Room leadership can transfer without transferring combat authority. The 30-second Spawn Island countdown and existing accounts, cosmetics, Marks and settings are preserved.",
      "Sprinter no longer has an extra ADS dot; intentional reflex optics retain their reticles. Seven presses on the Ravel Front logo open owner authentication correctly, and failed attempts can be retried. The private owner key remains server-only. Refresh to join protocol 21 matches."
    ]
  },
  {
    "number": "51",
    "title": "Ravelfront: A New Frontier",
    "changes": [
      "Ravelfront is an original coastal frontier shooter. A new wordmark, graphite/teal/amber interface, expedition lobby, Kestrel tiltrotor, world signage and match presentation establish its own identity.",
      "Articulated skinned human operators share an anatomical skeleton, blended movement/action states, foot and hand IK, category-specific weapon grips and per-weapon reloads. Humanoid head/body combat regions are independent of outfits. No cosmetic changes combat size.",
      "The rebuilt Outfitter and Locker contain 84 original operator and equipment cosmetics in 12 collections, full character inspection and actual model previews. Existing currency becomes Marks at 1:1 and every purchased item maps to its replacement. Profiles, career history, settings and keybinds stay intact.",
      "The relay settles online rewards from meaningful participation, eligible opponents, bot difficulty, logarithmic population, placement, victory, eliminations and assists. Custom reductions, minimum activity, repeat-opponent limits and match/hour caps reduce farming. Offline practice and Spawn Island award nothing.",
      "Active contestants receive an inactivity warning with 12 seconds left and are removed after 59 seconds without meaningful play. Loading, transport, recovery and spectators are exempt. Idle packets, slot toggles and repeated camera jitter do not qualify.",
      "Online Spawn Island returns to 30 authoritative seconds with existing full-human early departure. Balanced spawn regions spread humans and bots across Relay Cay; local wandering and occasional range practice keep bots distributed.",
      "Original restrained footsteps, landing and equipment cues accompany the human movement pass. Shared geometry/materials, lightweight grip targets and distance-based animation scheduling keep 32-contestant rooms practical. Refresh to join the new game protocol."
    ]
  },
  {
    "number": "50",
    "title": "Better Together",
    "changes": [
      "An original Ravelfront lobby puts customized operators on center stage, with Play, Locker, Item Shop, Career, Updates, Settings and Social. Public matchmaking is the primary action; Custom Match remains available. The separate offline-bot Play flow has been retired.",
      "Relay-backed lobby parties support invitations, acceptance, decline, leader controls, privacy, readiness and reconnects. Party members appear together and enter public or custom matches together, with reserved human seats and bot replacement.",
      "Frontier Royale Duos adds Fill / No Fill, protected teammates, team markers and vitals, bot partners, teammate spectating, shared placement and last-Duo victory. Teams persist through Spawn Island, the Kestrel and host recovery. Existing 32-contestant capacity and the authoritative online countdown are preserved.",
      "Eleven fictional blasters now use centralized, distinct damage falloff, head critical hits, rarity scaling, accuracy recovery, bloom, recoil, pellet patterns and build damage. Bots use the same combat rules. Scoped aiming stays stable and your scope sensitivity is preserved.",
      "Immediate firing feedback pairs with host-confirmed trajectories and damage. Most blasters use authoritative hitscan; Needle bolts and explosive projectiles retain travel. Bounded target-history compensation supports remote hits, and reticles communicate actual spread and first-shot readiness. Native transport heartbeats and authoritative room ownership prevent false host transfers during slow scene loads. Refresh to join updated rooms."
    ]
  },
  {
    "number": "49",
    "title": "Settings, Your Way",
    "changes": [
      "Settings now use a wide category-tab layout with Video, Audio, Mouse, HUD, Gameplay and Keybinds sections, plus contextual descriptions for the selected option.",
      "Ravelfront paper-and-ink styling, gold active tabs, independently scrolling options, a persistent footer and a compact mobile layout keep every control easy to reach. Existing automatic saves, resets and keybind Apply / Discard behavior are preserved."
    ]
  },
  {
    "number": "48",
    "title": "Six Slots, Full Width",
    "changes": [
      "The Battle Royale inventory now reserves one dedicated pickaxe column and the remaining width for five equal item slots.",
      "Equipment cards no longer collapse into narrow strips at laptop or responsive panel sizes; empty and occupied slots keep identical dimensions."
    ]
  },
  {
    "number": "47",
    "title": "Ready for Departure",
    "changes": [
      "Play Offline With Bots uses its own explicit session setting and a full ten-second Spawn Island countdown. Online matches retain sixty seconds, even when only one human is playing with bots.",
      "Online public and custom matches depart immediately when every configured contestant seat contains a connected human. Bots, spectators, stale records and duplicate connections never satisfy the threshold; the existing 32-contestant and 16-human limits are preserved.",
      "Joining players inherit the host's remaining time. Departure finalizes fill bots, locks the roster and resets practice equipment once. The warmup HUD separately reports real players and bots, and late arrivals remain spectator-only."
    ]
  },
  {
    "number": "46",
    "title": "Connected Island — On-Time Departure",
    "changes": [
      "Spawn Island now follows sixty real seconds of host time even when a slow frame drops physics work. The replicated countdown and host-recovery checkpoint keep everyone on the same deadline, without accelerating movement or match physics.",
      "Includes the full Connected Island update: connected building and automatic materials, scroll-wheel reset, repaired map geometry, visible storm, smarter bots, dedicated pickaxe plus five item slots, 32-contestant fill, larger vitals and rebalanced storm phases."
    ]
  },
  {
    "number": "45",
    "title": "Connected Island",
    "changes": [
      "Building automatically continues with the next usable material, while preserving deliberate selections. A shared host/preview solver ranks nearby grid attachments, including ramp-to-floor extensions, with consistent collision and resource validation.",
      "Wheel-up and wheel-down support contextual Edit + Reset edit bindings. Shared reset scrolling confirms in one gesture without switching equipment. A dedicated pickaxe precedes five equal slots numbered 1–5; HUD prompts follow your saved bindings.",
      "Ravel Coast foundations, stair landings, wall corners, roof trim and terrain transitions have been aligned. Roads now use the terrain surface itself. The storm has a clearly visible animated blue-violet wall driven by the actual safe-zone boundary.",
      "Royale now targets 32 contestants with up to 16 humans, bot fill and four separate spectator seats. Forty clear Spawn Island points, distributed bot landings, guaranteed ground-floor weapons, matching ammo and district chest minimums support the larger match.",
      "The host controls a 60-second Spawn Island countdown. Practice bots explore, idle and take limited turns at the range. Match bots can interrupt a distant fight for a much more dangerous nearby attacker, with commitment to prevent target flicker.",
      "Storm movement starts 140 seconds after Bus departure, then tightens through eight phases ending at 8:46. Larger responsive health/shield bars improve combat readability. Narrow collision queries, bounded pathfinding and shared sparse snapshots control browser and network work. Refresh before joining updated rooms."
    ]
  },
  {
    "number": "44",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "43",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "42",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "41",
    "title": "Manual builds, edits & materials",
    "changes": [
      "Crosshair-driven world-space editing with piece-specific grids, stair gestures, roof corner selection, validity feedback, reset/cancel and optional release confirmation.",
      "Forward-facing ramps, persistent deliberate rotation, working edited doors, shared collision and host-validated guest edits.",
      "Object-aware finite harvesting budgets, weak points and material construction health. Player pickaxe damage remains 20. Reference differences are documented in the repository."
    ]
  },
  {
    "number": "40",
    "title": "Outfitter & Locker",
    "changes": [
      "84 new earnable cosmetics across 12 original collections: outfits, pickaxes, blaster wraps, back accessories, gliders and dive trails.",
      "A visual item shop and locker with favorites, previews, saved loadouts and free original customization.",
      "A persistent browser wallet with 300 starter Marks, active-play and elimination rewards, and match completion bonuses. No real-money purchases or gameplay advantages."
    ]
  },
  {
    "number": "39",
    "title": "Private owner overview",
    "changes": [
      "A hidden menu gesture opens a server-verified owner code prompt and an overview of anonymous visits, session activity and live rooms.",
      "Owner analytics stay disabled until a private server code is configured. A persistent relay disk is needed to keep past sessions across restarts; no player names, chat or IP addresses are recorded for analytics."
    ]
  },
  {
    "number": "38",
    "title": "Direct multiplayer relay",
    "changes": [
      "Online rooms now use the replacement persistent WebSocket server, removing database polling from gameplay.",
      "Brief connection interruptions can recover without leaving the match."
    ]
  },
  {
    "number": "37",
    "title": "Leaner multiplayer updates",
    "changes": [
      "Reduced full recovery snapshots and merged queued movement updates while preserving action changes and world data.",
      "Prepared support for the replacement persistent relay and brief connection recovery."
    ]
  },
  {
    "number": "36",
    "title": "Server-connected multiplayer",
    "changes": [
      "Public listings, room codes, and match messages now use secure WebSockets through the shared game server.",
      "Arena and Frontier Royale retain their existing game rules, chat filtering, and host transfer. Direct player-to-player connections are no longer needed for the default online mode.",
      "Refresh before joining a new room. Connection reports now check the game server and shared directory."
    ]
  },
  {
    "number": "35",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "34",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "33",
    "title": "Smooth stairs and better controls",
    "changes": [
      "Consistent stair contact, controlled step-downs and a smoothly eased camera remove stair jitter in arenas and Frontier Royale, including player-built stairs.",
      "Rebuilt keybind editor with primary and secondary slots, automatic reassignment of occupied inputs, mouse and scroll support, searchable actions, clear controls, Apply, Discard and confirmed default reset.",
      "Unsaved bindings stay in a draft; closing asks you to Apply or Discard. Escape remains available for the menu. Updated movement clients use compatible rooms."
    ]
  },
  {
    "number": "32",
    "title": "One place to Play",
    "changes": [
      "Choose Frontier Royale, Free for all or Team scramble from a single Play menu, with public matches, custom rooms, local bots and room codes together.",
      "Removed the left-side Loadout shortcut. New matches fill empty contestant seats with bots by default."
    ]
  },
  {
    "number": "31",
    "title": "Harvest, build and edit in Frontier Royale",
    "changes": [
      "Carry five items plus a permanent sixth-slot pickaxe. Harvest wood, brick and metal from destructible island scenery; aim for weak points for a faster harvest.",
      "Build walls, floors, stairs and roofs with grid previews, material costs, rotation, section editing, repairs and support collapse. Structures block movement and shots and take weapon damage.",
      "A new resource bank, blueprint selector, edit grid and six-slot hotbar bring building controls to keyboard and touch. Materials, world destruction and builds sync across the room and host transfers."
    ]
  },
  {
    "number": "30",
    "title": "Names belong in the yard",
    "changes": [
      "Ordinary names are allowed in chat, player profiles and public room listings, including names that also refer to places.",
      "Contact details, addresses, explicit private-detail disclosures and inappropriate language remain filtered."
    ]
  },
  {
    "number": "29",
    "title": "Try a server connection",
    "changes": [
      "A separate server check tests HTTPS access, secure WebSocket opening and three server replies without a room code.",
      "Open it from Check connection and copy the results. Multiplayer still uses its existing connections."
    ]
  },
  {
    "number": "28",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "27",
    "title": "Connection reports without developer tools",
    "changes": [
      "Check matchmaking and public discovery from the home screen or connection errors.",
      "Room joins record data-channel and host-handshake progress. Copy a report without names, room codes, IP addresses or credentials.",
      "Directory reports distinguish remote responses from this browser acting as coordinator; empty results do not prove remote connectivity."
    ]
  },
  {
    "number": "26",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "25",
    "title": "Ravel Coast rebuilt",
    "changes": [
      "A much denser island: 92 buildings, 560 trees, rolling terrain, distinct district architecture and hundreds of detailed props.",
      "Rebuilt Kestrel, curved gliders, treasure and supply chests, ammo and every utility item. Ground loot uses full blaster models; Sentry, Breach and Comet have distinct new designs.",
      "Royale sprint now matches normal-mode movement speed; walking is slower. Footsteps and button-hover sounds are removed; button clicks retain feedback.",
      "Reset any sensitivity, field-of-view or audio slider—or reset all sliders. Press I or M again to close inventory or map; custom bindings work too."
    ]
  },
  {
    "number": "24",
    "title": "Expanded chat and name filtering",
    "changes": [
      "Merged both supplied profanity lists and canonical forms: 3,717 unique terms, with duplicates removed.",
      "The expanded filter applies to chat and player names, with checks for disguised spellings and safe word boundaries."
    ]
  },
  {
    "number": "23",
    "title": "Frontier Royale: last operator standing",
    "changes": [
      "Drop from the Kestrel onto Ravel Coast, a 512 × 512 island with nine districts, chests and floor loot.",
      "Public matchmaking, private rooms and bot matches support 16 contestants, five inventory slots, eleven blasters and eight utility items.",
      "Skydive, deploy your glider, sprint with stamina, mark the map and outrun eight storm stages. Eliminated players spectate until the rematch.",
      "Original sound bank adds positional combat, transport, wind, footsteps, loot, item use, shields, storm and victory feedback, with separate sound controls."
    ]
  },
  {
    "number": "22",
    "title": "Clear comms, safer conversations",
    "changes": [
      "Room, team and spectator chat with quick messages, desktop shortcuts and touch controls.",
      "Always-on filtering for chat and player names, including disguised language, common personal details and real-name/location detection.",
      "Mute players, choose quick messages only or turn chat off; report to the host, who can silence players or pause room chat.",
      "Host-enforced spam limits and independent recipient checks; chat clears when you leave the room."
    ]
  },
  {
    "number": "21",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "20",
    "title": "Sculpted hands and smooth switches",
    "changes": [
      "Redesigned arms with smooth bends, fuller forearms and tapered wrists instead of sticks and ball joints.",
      "Larger sculpted hands have four curled fingers, defined palms and opposing thumbs for a more convincing grip.",
      "Kept every blaster’s aiming, firing and reload animations in first person and multiplayer.",
      "Blasters lower before switching and rise into a weapon-specific grip when drawn, with synchronized handling and clean rapid-switch transitions."
    ]
  },
  {
    "number": "19",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "18",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "17",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "16",
    "title": "Your match, your rules",
    "changes": [
      "One Create Match flow for public or private matches with configurable bots.",
      "Edit arena, mode, time limit, score target and bot difficulty in the lobby and before every rematch."
    ]
  },
  {
    "number": "15",
    "title": "Open the yard",
    "changes": [
      "Open the game directly without login, browser approval or activation codes.",
      "Restored invite-code multiplayer and local bot practice. Kept the public-match directory and public/private room controls without an access dashboard."
    ]
  },
  {
    "number": "14",
    "title": "Steady scoped accuracy",
    "changes": [
      "Moving and jumping no longer reduce accuracy while aiming through a sight or scope.",
      "Scoping immediately removes movement spread; firing spread still follows each blaster’s stats."
    ]
  },
  {
    "number": "13",
    "title": "Your controls, your way",
    "changes": [
      "Customize keyboard and mouse bindings with two bindings per action, or restore the defaults.",
      "Control hints follow your saved bindings."
    ]
  },
  {
    "number": "12",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "11",
    "title": "Your yard, on the same link",
    "changes": [
      "Added public-match browsing and room visibility controls on the GitHub Pages address."
    ]
  },
  {
    "number": "10",
    "title": "Crosshairs that show your accuracy",
    "changes": [
      "Crosshair arms widen with movement and firing spread, then settle as accuracy recovers.",
      "The indicator uses the match host’s actual weapon spread in practice and multiplayer."
    ]
  },
  {
    "number": "09",
    "title": "Crosshair preferences and ordered updates",
    "changes": [
      "Center Dot and Hit Markers can be switched independently, both enabled by default.",
      "Release history is numbered consecutively; failed builds and retries no longer skip numbers."
    ]
  },
  {
    "number": "08",
    "title": "Readable damage at every distance",
    "changes": [
      "Damage numbers keep the same screen size at every distance, with distinct critical-hit styling."
    ]
  },
  {
    "number": "07",
    "title": "Clearer hits and simpler controls",
    "changes": [
      "Damage numbers are 60% larger, with distinct gold critical hits.",
      "Desktop play always uses mouse lock; removed the drag-to-look setting.",
      "New private rooms start with zero bots selected.",
      "The quality update button automatically follows every published build."
    ]
  },
  {
    "number": "06",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "05",
    "title": "Weapon tuning and spectating",
    "changes": [
      "Revised weapon stats, accuracy, ammunition and reload behavior.",
      "Pause-menu respawn and spectator mode with player switching.",
      "Improved floating damage numbers and critical-hit feedback."
    ]
  },
  {
    "number": "04",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "03",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "02",
    "title": "Quality update",
    "changes": [
      "Improved weapon models, model previews and working optic views.",
      "Expanded arenas and traveling projectiles fired from weapon muzzles."
    ]
  },
  {
    "number": "01",
    "title": "Welcome to Ravelfront",
    "changes": [
      "The original arenas, blasters, practice matches and private multiplayer rooms."
    ]
  }
];
export const RELEASES = typeof __RELEASE_HISTORY__ !== "undefined" ? __RELEASE_HISTORY__ : RELEASE_NOTES;
export const RELEASE = RELEASES[0].number;
