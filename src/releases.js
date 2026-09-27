export const RELEASE_NOTES = [
  { number: "50", title: "Better Together", changes: [
    "An original Yolk Yard lobby puts customized eggs on center stage, with Play, Locker, Item Shop, Career, Updates, Settings and Social. Public matchmaking is the primary action; Custom Match remains available. The separate offline-bot Play flow has been retired.",
    "Relay-backed lobby parties support invitations, acceptance, decline, leader controls, privacy, readiness and reconnects. Party members appear together and enter public or custom matches together, with reserved human seats and bot replacement.",
    "Yolk Royale Duos adds Fill / No Fill, protected teammates, team markers and vitals, bot partners, teammate spectating, shared placement and last-Duo victory. Teams persist through Spawn Island, the Eggspress and host recovery. Existing 32-contestant capacity and the authoritative online countdown are preserved.",
    "Eleven fictional blasters now use centralized, distinct damage falloff, upper-shell critical hits, rarity scaling, accuracy recovery, bloom, recoil, pellet patterns and build damage. Bots use the same combat rules. Scoped aiming stays stable and your scope sensitivity is preserved.",
    "Immediate firing feedback pairs with host-confirmed trajectories and damage. Most blasters use authoritative hitscan; Needle bolts and explosive projectiles retain travel. Bounded target-history compensation supports remote hits, and reticles communicate actual spread and first-shot readiness. Refresh to join updated rooms."
  ] },
  { number: "49", title: "Settings, Your Way", changes: [
    "Settings now use a wide category-tab layout with Video, Audio, Mouse, HUD, Gameplay and Keybinds sections, plus contextual descriptions for the selected option.",
    "Yolk Yard paper-and-ink styling, gold active tabs, independently scrolling options, a persistent footer and a compact mobile layout keep every control easy to reach. Existing automatic saves, resets and keybind Apply / Discard behavior are preserved."
  ] },
  { number: "48", title: "Six Slots, Full Width", changes: [
    "The Battle Royale inventory now reserves one dedicated pickaxe column and the remaining width for five equal item slots.",
    "Equipment cards no longer collapse into narrow strips at laptop or responsive panel sizes; empty and occupied slots keep identical dimensions."
  ] },
  { number: "47", title: "Ready for Departure", changes: [
    "Play Offline With Bots uses its own explicit session setting and a full ten-second Spawn Island countdown. Online matches retain sixty seconds, even when only one human is playing with bots.",
    "Online public and custom matches depart immediately when every configured contestant seat contains a connected human. Bots, spectators, stale records and duplicate connections never satisfy the threshold; the existing 32-contestant and 16-human limits are preserved.",
    "Joining players inherit the host's remaining time. Departure finalizes fill bots, locks the roster and resets practice equipment once. The warmup HUD separately reports real players and bots, and late arrivals remain spectator-only."
  ] },
  { number: "46", title: "Connected Island — On-Time Departure", changes: [
    "Spawn Island now follows sixty real seconds of host time even when a slow frame drops physics work. The replicated countdown and host-recovery checkpoint keep everyone on the same deadline, without accelerating movement or match physics.",
    "Includes the full Connected Island update: connected building and automatic materials, scroll-wheel reset, repaired map geometry, visible storm, smarter bots, dedicated pickaxe plus five item slots, 32-contestant fill, larger vitals and rebalanced storm phases."
  ] },
  { number: "45", title: "Connected Island", changes: [
    "Building automatically continues with the next usable material, while preserving deliberate selections. A shared host/preview solver ranks nearby grid attachments, including ramp-to-floor extensions, with consistent collision and resource validation.",
    "Wheel-up and wheel-down support contextual Edit + Reset edit bindings. Shared reset scrolling confirms in one gesture without switching equipment. A dedicated pickaxe precedes five equal slots numbered 1–5; HUD prompts follow your saved bindings.",
    "Sunnybreak foundations, stair landings, wall corners, roof trim and terrain transitions have been aligned. Roads now use the terrain surface itself. The storm has a clearly visible animated blue-violet wall driven by the actual safe-zone boundary.",
    "Royale now targets 32 contestants with up to 16 humans, bot fill and four separate spectator seats. Forty clear Spawn Island points, distributed bot landings, guaranteed ground-floor weapons, matching ammo and district chest minimums support the larger match.",
    "The host controls a 60-second Spawn Island countdown. Practice bots explore, idle and take limited turns at the range. Match bots can interrupt a distant fight for a much more dangerous nearby attacker, with commitment to prevent target flicker.",
    "Storm movement starts 140 seconds after Bus departure, then tightens through eight phases ending at 8:46. Larger responsive health/shield bars improve combat readability. Narrow collision queries, bounded pathfinding and shared sparse snapshots control browser and network work. Refresh before joining updated rooms."
  ] },
  { number: "44", title: "Smooth Boarding", changes: [
    "Inventory images are now pre-rendered from the actual item models, removing GPU readback stalls when entering matches and collecting new equipment. Island shaders prepare asynchronously while networking continues.",
    "Four separate spectator seats now fit safely alongside sixteen contestants on the deployed multiplayer relay. Admission and host recovery share the same capacity rule.",
    "Includes Hatch, Drop & Outplay: playable Spawn Island, authoritative late-join spectating, shared tactical bot intelligence, landing damage and launch protection, falling loot, Shell Market and Locker improvements, gliding and streak animation, and first-slot pickaxe controls."
  ] },
  { number: "43", title: "Hatch, Drop & Outplay", changes: [
    "Warm up on playable Hatchling Atoll before the Eggspress. One authoritative countdown moves every contestant to Sunnybreak with fresh health, gear and materials. Practice actions never earn match rewards.",
    "Battle Bus departure closes contestant admission. Active public matches offer Spectate, with eight separate spectator seats, protected win conditions and host-migration continuity.",
    "Landing-based fall damage, one-landing Shock Egg protection without automatic gliders, and falling loot that settles on surviving floors after edits or destruction. Launch Nests retain intentional glider redeployment.",
    "Shared bot intelligence now uses sight, sound, fading threat memory, cover, weapon ranges, team callouts and stuck recovery. Royale bots loot real pickups and chests, heal, harvest, build and rotate before the storm. All four difficulty names remain; harder bots get no extra supplies or hidden-player knowledge.",
    "An original Shell Market design, six actual equipped Locker previews, compact account Eggs, animated arena streak upgrades with real timers, and smoother glider deployment, banking and landing.",
    "Pickaxe is now slot 1; five items use slots 2–6. P is the dedicated pickaxe shortcut. L still closes flight tips. Controls remain rebindable. Refresh before joining updated rooms."
  ] },
  { number: "42", title: "Sunnybreak Reborn", changes: [
    "A rebuilt island with nine named districts, 17 smaller landmarks, hills, river crossings, a tidal harbor, wooded ridges and a quarry. Sixty-one searchable buildings have 100 interior floors, roof routes, balconies and furnished rooms.",
    "Eleven remodeled blasters share detailed held, world and upright ground-loot representations. Five ammo pickups now have distinct cartridge, shell and rocket silhouettes.",
    "Larger long-range optics use configurable magnification, reticles and handling: Needle 4.5×, Peeper 3.5×, Anchor 3.25× and Duet 1.8×. Your scope sensitivity setting still applies.",
    "603 authored ground-loot sockets and 170 possible chests feed weighted host-authoritative loot pools, matching weapon ammo and per-match spawn variation. Ownership survives recovery; new matches reset everything.",
    "Press L to close flight tips without leaving the Eggspress or changing your glider. Rebind Close flight tips in Controls; instructions return next match.",
    "Terrain-backed maps, landmark labels, layered bot routes, batched scenery, nearby pickup rendering and sparse loot updates keep the new island connected to real gameplay. Refresh before joining updated rooms."
  ] },
  { number: "41", title: "Manual builds, edits & materials", changes: ["Crosshair-driven world-space editing with piece-specific grids, stair gestures, roof corner selection, validity feedback, reset/cancel and optional release confirmation.", "Forward-facing ramps, persistent deliberate rotation, working edited doors, shared collision and host-validated guest edits.", "Object-aware finite harvesting budgets, weak points and material construction health. Player pickaxe damage remains 20. Reference differences are documented in the repository."] },
  { number: "40", title: "Egg Shop & Locker", changes: ["84 new earnable cosmetics across 12 original collections: outfits, pickaxes, blaster wraps, back accessories, gliders and dive trails.", "A visual item shop and locker with favorites, previews, saved loadouts and free original customization.", "A persistent browser wallet with 300 starter eggs, active-play and elimination rewards, and match completion bonuses. No real-money purchases or gameplay advantages."] },
  { number: "39", title: "Private owner overview", changes: ["A hidden menu gesture opens a server-verified owner code prompt and an overview of anonymous visits, session activity and live rooms.", "Owner analytics stay disabled until a private server code is configured. A persistent relay disk is needed to keep past sessions across restarts; no player names, chat or IP addresses are recorded for analytics."] },
  { number: "38", title: "Direct multiplayer relay", changes: ["Online rooms now use the replacement persistent WebSocket server, removing database polling from gameplay.", "Brief connection interruptions can recover without leaving the match."] },
  { number: "37", title: "Leaner multiplayer updates", changes: ["Reduced full recovery snapshots and merged queued movement updates while preserving action changes and world data.", "Prepared support for the replacement persistent relay and brief connection recovery."] },
  { number: "36", title: "Server-connected multiplayer", changes: ["Public listings, room codes, and match messages now use secure WebSockets through the shared game server.", "Arena and Yolk Royale retain their existing game rules, chat filtering, and host transfer. Direct player-to-player connections are no longer needed for the default online mode.", "Refresh before joining a new room. Connection reports now check the game server and shared directory."] },
  { number: "35", title: "A fresh idle every time", changes: ["The home egg starts easing into idle as soon as cursor movement stops and returns to face the camera directly, including after a manual spin.", "Eight shuffled idle animations cycle without consecutive repeats: low hold, high hold, inspection, reload, cartoon toss-and-catch, cradle, stretch and presentation.", "Cursor aiming interrupts every pose smoothly. Blaster flight, rotation, hands and reload parts ease back into place without changing gameplay ammunition."] },
  { number: "34", title: "An egg with personality", changes: ["The home-screen egg follows the mouse horizontally and vertically. Rotate it with a two-finger drag or twist.", "Two relaxed blaster holds alternate roughly every ten idle seconds, with gentle sway and breathing. Aiming, spinning and returning to idle blend smoothly, with hands staying on the blaster."] },
  { number: "33", title: "Smooth stairs and better controls", changes: ["Consistent stair contact, controlled step-downs and a smoothly eased camera remove stair jitter in arenas and Yolk Royale, including player-built stairs.", "Rebuilt keybind editor with primary and secondary slots, automatic reassignment of occupied inputs, mouse and scroll support, searchable actions, clear controls, Apply, Discard and confirmed default reset.", "Unsaved bindings stay in a draft; closing asks you to Apply or Discard. Escape remains available for the menu. Updated movement clients use compatible rooms."] },
  { number: "32", title: "One place to Play", changes: ["Choose Yolk Royale, Free for all or Team scramble from a single Play menu, with public matches, custom rooms, local bots and room codes together.", "Removed the left-side Loadout shortcut. New matches fill empty contestant seats with bots by default."] },
  { number: "31", title: "Harvest, build and edit in Yolk Royale", changes: ["Carry five items plus a permanent sixth-slot pickaxe. Harvest wood, brick and metal from destructible island scenery; aim for weak points for a faster harvest.", "Build walls, floors, stairs and roofs with grid previews, material costs, rotation, section editing, repairs and support collapse. Structures block movement and shots and take weapon damage.", "A new resource bank, blueprint selector, edit grid and six-slot hotbar bring building controls to keyboard and touch. Materials, world destruction and builds sync across the room and host transfers."] },
  { number: "30", title: "Names belong in the yard", changes: ["Ordinary names are allowed in chat, player profiles and public room listings, including names that also refer to places.", "Contact details, addresses, explicit private-detail disclosures and inappropriate language remain filtered."] },
  { number: "29", title: "Try a server connection", changes: ["A separate server check tests HTTPS access, secure WebSocket opening and three server replies without a room code.", "Open it from Check connection and copy the results. Multiplayer still uses its existing connections."] },
  { number: "28", title: "Arena streak power-ups", changes: ["Every five consecutive eliminations earns a random bonus in Free for all and Team scramble: Hard Boiled, Egg Breaker, Restock, Overheal, Double Eggs or Mini Egg.", "Stack bonuses, extend timed powers with eliminations, and track shield, timers and eggs on the HUD. Mini Egg shrinks your model and hitbox.", "Bonuses reset on death and respawn, sync in multiplayer and survive host transfers. Battle Royale has no streak bonuses."] },
  { number: "27", title: "Connection reports without developer tools", changes: ["Check matchmaking and public discovery from the home screen or connection errors.", "Room joins record data-channel and host-handshake progress. Copy a report without names, room codes, IP addresses or credentials.", "Directory reports distinguish remote responses from this browser acting as coordinator; empty results do not prove remote connectivity."] },
  { number: "26", title: "Smarter eggs, lasting rooms", changes: ["Easy, Normal, Hard and Impossible bots use adaptive routes, cover, varied aim and situational sidearms and poppers. Bots wear randomized outfits; new players start plain.", "Hosting transfers to the next player when the host leaves. Humans replace bots in filled matches, empty seats refill, and duplicate names must be changed.", "Chat stays on screen. Inventory opens on the right with actual item images, drag reordering, split/drop controls and detailed inspection. Directional red damage cues and a stronger waddle improve feedback.", "Long-range projectile hits, empty-slot aiming, wall collisions, and per-shot damage totals are corrected. Verified projectile speeds apply in every mode; Thumper rockets and popper grenades have new visuals.", "The three modes are Yolk Royale, Free for all and Team scramble. Arena maps gain connected upper routes. Royale has spaced loot, smaller chests, connected optional stairs, positional sounds, a kill feed and a storm that ends only with the last survivor.", "Victory and placement banners appear before the scoreboard. Public matches are the default."] },
  { number: "25", title: "Sunnybreak rebuilt", changes: ["A much denser island: 92 buildings, 560 trees, rolling terrain, distinct district architecture and hundreds of detailed props.", "Rebuilt Eggspress, curved gliders, treasure and supply chests, ammo and every utility item. Ground loot uses full blaster models; Peeper, Double Yolk and Comet have distinct new designs.", "Royale sprint now matches normal-mode movement speed; walking is slower. Footsteps and button-hover sounds are removed; button clicks retain feedback.", "Reset any sensitivity, field-of-view or audio slider—or reset all sliders. Press I or M again to close inventory or map; custom bindings work too."] },
  { number: "24", title: "Expanded chat and name filtering", changes: ["Merged both supplied profanity lists and canonical forms: 3,717 unique terms, with duplicates removed.", "The expanded filter applies to chat and player names, with checks for disguised spellings and safe word boundaries."] },
  { number: "23", title: "Yolk Royale: last egg standing", changes: ["Drop from the Eggspress onto Sunnybreak, a 512 × 512 island with nine districts, chests and floor loot.", "Public matchmaking, private rooms and bot matches support 16 contestants, five inventory slots, eleven blasters and eight utility items.", "Skydive, deploy your glider, sprint with stamina, mark the map and outrun eight storm stages. Eliminated eggs spectate until the rematch.", "Original sound bank adds positional combat, transport, wind, footsteps, loot, item use, shields, storm and victory feedback, with separate sound controls."] },
  { number: "22", title: "Good eggs, safer conversations", changes: ["Room, team and spectator chat with quick messages, desktop shortcuts and touch controls.", "Always-on filtering for chat and player names, including disguised language, common personal details and real-name/location detection.", "Mute players, choose quick messages only or turn chat off; report to the host, who can silence players or pause room chat.", "Host-enforced spam limits and independent recipient checks; chat clears when you leave the room."] },
  { number: "21", title: "Your look, from shell to fingertips", changes: ["Arms and hands now share your shell color, pattern, accent and finish in first person and multiplayer.", "The Egg Studio outfit preview shows your complete egg with arms and hands; option tiles still isolate their own category.", "Appearance changes, resets, reloads and weapon switches keep the full style consistent."] },
  { number: "20", title: "Sculpted hands and smooth switches", changes: ["Redesigned arms with smooth bends, fuller forearms and tapered wrists instead of sticks and ball joints.", "Larger sculpted hands have four curled fingers, defined palms and opposing thumbs for a more convincing grip.", "Kept every blaster’s aiming, firing and reload animations in first person and multiplayer.", "Blasters lower before switching and rise into a weapon-specific grip when drawn, with synchronized handling and clean rapid-switch transitions."] },
  { number: "19", title: "Hands on every blaster", changes: ["Shell-colored cartoon arms and hands use a different grip for every blaster.", "Distinct reload hand motions and moving ammo pieces follow the actual reload timer in first person and on other players.", "Arms follow aiming and firing, and reset cleanly when a reload ends or is cancelled."] },
  { number: "18", title: "More reliable shell hits", changes: ["Hitboxes cover the animated shell, with centered waddling and less visual lag on moving eggs.", "Clear shots over ledges retract the muzzle safely; close-range shots register even when starting inside a shell."] },
  { number: "17", title: "Plain shells and focused previews", changes: ["Choose No pattern, No headwear, or No eyewear; Reset appearance returns to a plain egg.", "Cosmetic image tiles show only their own category. The large preview keeps your complete outfit."] },
  { number: "16", title: "Your match, your rules", changes: ["One Create Match flow for public or private matches with configurable bots.", "Edit arena, mode, time limit, score target and bot difficulty in the lobby and before every rematch."] },
  { number: "15", title: "Open the yard", changes: ["Open the game directly without login, browser approval or activation codes.", "Restored invite-code multiplayer and local bot practice. Kept the public-match directory and public/private room controls without an access dashboard."] },
  { number: "14", title: "Steady scoped accuracy", changes: ["Moving and jumping no longer reduce accuracy while aiming through a sight or scope.", "Scoping immediately removes movement spread; firing spread still follows each blaster’s stats."] },

  { number: "13", title: "Your controls, your way", changes: ["Customize keyboard and mouse bindings with two bindings per action, or restore the defaults.", "Control hints follow your saved bindings."] },
  { number: "12", title: "The egg studio", changes: [
    "Choose your look with image tiles showing the actual 3D cosmetics and a larger outfit preview.",
    "24 shell colors, 20 headwear styles, 10 patterns, 4 finishes and 6 eyewear styles—all unlocked.",
    "Choose an accent color, shuffle your look or reset it. Styles save and appear in multiplayer."
  ] },
  { number: "11", title: "Your yard, on the same link", changes: ["Added public-match browsing and room visibility controls on the GitHub Pages address."] },
  { number: "10", title: "Crosshairs that show your accuracy", changes: [
    "Crosshair arms widen with movement and firing spread, then settle as accuracy recovers.",
    "The indicator uses the match host’s actual weapon spread in practice and multiplayer."
  ] },
  { number: "09", title: "Crosshair preferences and ordered updates", changes: [
    "Center Dot and Hit Markers can be switched independently, both enabled by default.",
    "Release history is numbered consecutively; failed builds and retries no longer skip numbers."
  ] },
  { number: "08", title: "Readable damage at every distance", changes: [
    "Damage numbers keep the same screen size at every distance, with distinct critical-hit styling."
  ] },
  { number: "07", title: "Clearer hits and simpler controls", changes: [
    "Damage numbers are 60% larger, with distinct gold critical hits.",
    "Desktop play always uses mouse lock; removed the drag-to-look setting.",
    "New private rooms start with zero bots selected.",
    "The quality update button automatically follows every published build."
  ] },
  { number: "06", title: "A smoother yard, on your terms", changes: [
    "Automatic update refresh in the menu and lobby; active matches wait until you leave.",
    "Click the quality update button to read numbered release notes.",
    "Smooth egg shells and a slower, wider, continuous waddle.",
    "Adjust scope sensitivity separately in Settings, for mouse and touch aiming.",
    "Choose Enter the Yard to spawn, and Respawn after each elimination."
  ] },
  { number: "05", title: "Weapon tuning and spectating", changes: [
    "Revised weapon stats, accuracy, ammunition and reload behavior.",
    "Pause-menu respawn and spectator mode with player switching.",
    "Improved floating damage numbers and critical-hit feedback."
  ] },
  { number: "04", title: "Egg movement and weapon polish", changes: [
    "Full ammo reserves leave ammo pickups available.",
    "Distinct projectile shapes and trails for each weapon.",
    "Compact, closed Thumper model and legless egg movement."
  ] },
  { number: "03", title: "Shell damage and hit feedback", changes: [
    "Shell cracks show damage, with a defeat animation and sound.",
    "Watch your opponent after an elimination and see their stats.",
    "Center hits receive a modest bonus with floating damage feedback."
  ] },
  { number: "02", title: "Quality update", changes: [
    "Improved weapon models, model previews and working optic views.",
    "Expanded arenas and traveling projectiles fired from weapon muzzles."
  ] }
  ,{ number: "01", title: "Welcome to Yolk Yard", changes: ["The original arenas, blasters, practice matches and private multiplayer rooms."] }
];
export const RELEASES = typeof __RELEASE_HISTORY__ !== "undefined" ? __RELEASE_HISTORY__ : RELEASE_NOTES;
export const RELEASE = RELEASES[0].number;
